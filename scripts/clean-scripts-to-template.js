#!/usr/bin/env node
/*
 * Rebuild every video body to match the canonical template:
 *
 *   ## Idea
 *
 *   {preserved user idea text or template placeholder}
 *
 *   ## Script
 *
 *   ### Hook (0-30s)
 *   ### Open Loop
 *   ### Body
 *   ### CTA
 *
 * What is preserved per file:
 *   - Frontmatter (untouched)
 *   - Content under `## Idea` (until next H2)
 *   - Content under `## Script` ### Hook / Open Loop / Body / CTA
 *
 * What is dropped:
 *   - Duplicate `#### Tags: [[..]]` lines
 *   - `## Pipeline (...)` admin sections (planning cycles, etc.)
 *   - `## Notes` ad-hoc lists at the bottom
 *   - Any other H2 section that is not Idea or Script
 *   - Italic-only placeholder text (`_..._`) — replaced with template default
 *
 * Default = dry-run. Use --apply to commit.
 * Backups written to vault/.../YouTube/.trash/migration-template-<ts>/
 */

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const YT_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube');
const VIDEOS_DIR = path.join(YT_ROOT, 'videos');
const BACKUP_ROOT = path.join(YT_ROOT, '.trash');
const APPLY = process.argv.includes('--apply');

const TEMPLATE_DEFAULTS = {
  hook: "_Pattern interrupt, bold claim, or question that earns the next 10 seconds. Make the viewer need to know more._",
  openLoop: "_Tease what's coming. Plant a question or stake the viewer wants resolved. Pays off later in the body._",
  body: "_The substance. Walk through the points that deliver on the hook's promise. Use beats, not paragraphs._",
  cta: "_What you want viewers to do next — subscribe, comment a specific thing, watch the next video. One ask, not three._",
};

function splitH2(body) {
  const lines = body.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(?!#)(.+?)\s*$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { heading: m[1].trim(), content: [] };
      continue;
    }
    if (cur) cur.content.push(line);
  }
  if (cur) sections.push(cur);
  return sections;
}

function splitH3(body) {
  const lines = body.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^###\s+(?!#)(.+?)\s*$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { heading: m[1].trim(), content: [] };
      continue;
    }
    if (cur) cur.content.push(line);
  }
  if (cur) sections.push(cur);
  return sections;
}

function isPlaceholder(text) {
  const t = text.trim();
  if (!t) return true;
  // Whole content is one or more italic-only lines (`_text_`)
  const lines = t.split(/\r?\n/).filter(Boolean);
  return lines.every((ln) => /^_.+_\s*$/.test(ln.trim()));
}

function pickContentOrDefault(text, defaultPlaceholder) {
  return isPlaceholder(text) ? defaultPlaceholder : text.trim();
}

function classifyH3(heading) {
  const h = heading.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (/^hook\b/.test(h)) return 'hook';
  if (/^open[\s_-]*loop\b/.test(h)) return 'openLoop';
  if (/^body\b/.test(h)) return 'body';
  if (/^cta\b/.test(h) || /^call[\s_-]*to[\s_-]*action\b/.test(h)) return 'cta';
  return null;
}

function buildBody(parts) {
  return [
    '## Script',
    '',
    '### Hook (0-30s)',
    '',
    parts.hook,
    '',
    '### Open Loop',
    '',
    parts.openLoop,
    '',
    '### Body',
    '',
    parts.body,
    '',
    '### CTA',
    '',
    parts.cta,
    '',
  ].join('\n');
}

function normalizeBody(body) {
  const sections = splitH2(body);
  const parts = {
    hook: TEMPLATE_DEFAULTS.hook,
    openLoop: TEMPLATE_DEFAULTS.openLoop,
    body: TEMPLATE_DEFAULTS.body,
    cta: TEMPLATE_DEFAULTS.cta,
  };
  const stripped = [];

  for (const sec of sections) {
    const raw = sec.content.join('\n');
    const headingLower = sec.heading.toLowerCase();

    if (headingLower.startsWith('script')) {
      const subs = splitH3(raw);
      for (const sub of subs) {
        const id = classifyH3(sub.heading);
        const subText = sub.content.join('\n');
        if (!id) continue; // unknown subsection — drop
        parts[id] = pickContentOrDefault(subText, TEMPLATE_DEFAULTS[id]);
      }
      continue;
    }
    // Anything else (including legacy ## Idea) — strip + record for diagnostics
    stripped.push(sec.heading);
  }

  return { newBody: buildBody(parts), stripped };
}

async function main() {
  let files;
  try {
    files = await fs.readdir(VIDEOS_DIR);
  } catch (e) {
    console.error(`Cannot read ${VIDEOS_DIR}: ${e.message}`);
    process.exit(1);
  }
  const targets = files.filter((f) => f.endsWith('.md') && !f.endsWith('.meta.md'));

  if (targets.length === 0) {
    console.log('No .md files found.');
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUP_ROOT, `migration-template-${ts}`);

  if (APPLY) {
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`Backing up ${targets.length} files to ${backupDir}`);
    for (const f of targets) {
      await fs.copyFile(path.join(VIDEOS_DIR, f), path.join(backupDir, f));
    }
  }

  let changed = 0;
  let totalStripped = new Map();

  for (const file of targets) {
    const fp = path.join(VIDEOS_DIR, file);
    const raw = await fs.readFile(fp, 'utf-8');
    const { data, content } = matter(raw);
    const { newBody, stripped } = normalizeBody(content);
    const usesCRLF = /\r\n/.test(raw);
    const finalBody = usesCRLF ? newBody.replace(/\r?\n/g, '\r\n') : newBody;
    const out = matter.stringify(finalBody, data);

    const wasDifferent = out !== raw;
    if (wasDifferent) {
      changed++;
      for (const s of stripped) {
        totalStripped.set(s, (totalStripped.get(s) ?? 0) + 1);
      }
      console.log(
        `${APPLY ? 'APPLY' : 'DRY  '} ${file}  ${stripped.length ? `· stripped: ${stripped.join(', ')}` : ''}`
      );
      if (APPLY) {
        const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(tmp, out, 'utf-8');
        await fs.rename(tmp, fp);
      }
    }
  }

  console.log('');
  console.log(`Total files: ${targets.length}`);
  console.log(`Files changed: ${changed}`);
  console.log(`Stripped section types:`);
  for (const [name, count] of [...totalStripped.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}× "${name}"`);
  }
  if (!APPLY) {
    console.log('');
    console.log('Dry-run only. Re-run with --apply to commit.');
  } else {
    console.log('');
    console.log(`Backup: ${backupDir}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
