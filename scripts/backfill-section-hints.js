#!/usr/bin/env node
// Backfill explanatory placeholders into TRULY EMPTY script subsections.
// Never touches a section that already has any non-whitespace content.
//
// Default: dry-run. Pass --apply to commit. Backups under
// .studio/backups/backfill-hints-<timestamp>/.

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const VIDEOS_DIR = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', 'videos');
const BACKUP_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', '.studio', 'backups');
const APPLY = process.argv.includes('--apply');

const HINTS = {
  // H2-level
  Idea: '_Core message in 1-2 sentences. The single thesis the whole video is built around._',
  // H3-level under Script — match by lowercase prefix
};

const H3_HINTS = [
  {
    match: /^hook\b/i,
    text: "_Pattern interrupt, bold claim, or question that earns the next 10 seconds. Make the viewer need to know more._",
  },
  {
    match: /^open\s*loop\b/i,
    text: "_Tease what's coming. Plant a question or stake the viewer wants resolved. Pays off later in the body._",
  },
  {
    match: /^body\b/i,
    text: "_The substance. Walk through the points that deliver on the hook's promise. Use beats, not paragraphs._",
  },
  {
    match: /^cta\b/i,
    text: "_What you want viewers to do next — subscribe, comment a specific thing, watch the next video. One ask, not three._",
  },
];

// Stale placeholders left by earlier normalizer runs. Treated as empty so they
// get replaced by the new fuller hint text.
const STALE_PLACEHOLDERS = [
  '_Core message in 1-2 sentences._',
];

function isEmpty(content) {
  const trimmed = content.replace(/^\s+|\s+$/g, '');
  if (trimmed === '') return true;
  return STALE_PLACEHOLDERS.includes(trimmed);
}

function backfillSubsections(scriptContent) {
  const lines = scriptContent.split(/\r?\n/);
  const out = [];
  let curHeading = null;
  let curBuf = [];
  let modified = false;

  const flush = () => {
    if (curHeading) {
      const hint = H3_HINTS.find((h) => h.match.test(curHeading));
      if (hint && isEmpty(curBuf.join('\n'))) {
        out.push(`### ${curHeading}`);
        out.push('');
        out.push(hint.text);
        out.push('');
        modified = true;
      } else {
        out.push(`### ${curHeading}`);
        // Preserve original content
        let inner = curBuf.join('\n').replace(/^\n+|\n+$/g, '');
        if (inner) {
          out.push('');
          out.push(inner);
          out.push('');
        } else {
          out.push('');
        }
      }
    }
    curHeading = null;
    curBuf = [];
  };

  for (const line of lines) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m) {
      flush();
      curHeading = m[1].trim();
      continue;
    }
    if (curHeading !== null) {
      curBuf.push(line);
    } else {
      out.push(line);
    }
  }
  flush();

  return { content: out.join('\n').replace(/\n{3,}/g, '\n\n'), modified };
}

function backfillBody(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let curH2 = null;
  let curBuf = [];
  let modified = false;

  const flush = () => {
    if (curH2 === null) return;
    const heading = curH2;
    const content = curBuf.join('\n');

    if (heading.toLowerCase() === 'idea' && isEmpty(content)) {
      out.push(`## ${heading}`);
      out.push('');
      out.push(HINTS.Idea);
      out.push('');
      modified = true;
    } else if (heading.toLowerCase() === 'script') {
      const { content: nextContent, modified: nestedModified } = backfillSubsections(content);
      out.push(`## ${heading}`);
      out.push('');
      out.push(nextContent.replace(/^\n+|\n+$/g, ''));
      out.push('');
      if (nestedModified) modified = true;
    } else {
      out.push(`## ${heading}`);
      const inner = content.replace(/^\n+|\n+$/g, '');
      if (inner) {
        out.push('');
        out.push(inner);
        out.push('');
      } else {
        out.push('');
      }
    }
    curH2 = null;
    curBuf = [];
  };

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && !line.match(/^###/)) {
      flush();
      curH2 = m[1].trim();
      continue;
    }
    if (curH2 !== null) {
      curBuf.push(line);
    } else {
      out.push(line);
    }
  }
  flush();

  return { body: out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n'), modified };
}

async function atomicWrite(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, file);
}

async function run() {
  const files = (await fs.readdir(VIDEOS_DIR)).filter(
    (f) => f.endsWith('.md') && !f.endsWith('.meta.md')
  );
  let backupDir = null;
  if (APPLY) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupDir = path.join(BACKUP_ROOT, `backfill-hints-${stamp}`);
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`✓ backup: ${backupDir}\n`);
  } else {
    console.log('(dry-run — pass --apply to write)\n');
  }
  let touched = 0;
  for (const f of files) {
    const p = path.join(VIDEOS_DIR, f);
    const raw = await fs.readFile(p, 'utf-8');
    const parsed = matter(raw);
    const { body: nextBody, modified } = backfillBody(parsed.content);
    if (!modified) {
      console.log(`- ${f}`);
      continue;
    }
    const nextRaw = matter.stringify(nextBody, parsed.data);
    console.log(`✎ ${f}`);
    if (APPLY) {
      await fs.copyFile(p, path.join(backupDir, f));
      await atomicWrite(p, nextRaw);
      touched += 1;
    }
  }
  console.log(`\nSummary: ${APPLY ? 'backfilled' : 'would backfill'} ${touched || files.length}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
