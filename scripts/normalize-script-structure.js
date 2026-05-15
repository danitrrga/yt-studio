#!/usr/bin/env node
// Ensure every video has canonical script structure:
//   ## Idea
//   ## Script
//     ### Hook (0-30s)
//     ### Open Loop
//     ### Body
//     ### CTA
//
// Preserves existing content + heading names (only injects what's missing).
// Other H2 sections (Pipeline, Production, Links, etc.) are kept in place.
//
// Default: dry-run. Use --apply to commit. Pre-apply backup written to
// .studio/backups/normalize-script-<timestamp>/.

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const VIDEOS_DIR = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', 'videos');
const BACKUP_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', '.studio', 'backups');
const APPLY = process.argv.includes('--apply');

const CANONICAL_H3 = [
  { id: 'hook', defaultHeading: 'Hook (0-30s)', match: /^hook\b/i },
  { id: 'open_loop', defaultHeading: 'Open Loop', match: /^open\s*loop\b/i },
  { id: 'body', defaultHeading: 'Body', match: /^body\b/i },
  { id: 'cta', defaultHeading: 'CTA', match: /^cta\b/i },
];

function splitH2Sections(body) {
  const lines = body.split(/\r?\n/);
  const preamble = [];
  const sections = []; // { heading, content[] }
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && !line.match(/^###/)) {
      if (cur) sections.push(cur);
      cur = { heading: m[1].trim(), content: [] };
      continue;
    }
    if (cur) cur.content.push(line);
    else preamble.push(line);
  }
  if (cur) sections.push(cur);
  return { preamble: preamble.join('\n'), sections };
}

function splitH3Sections(content) {
  const lines = content.split(/\r?\n/);
  const preamble = [];
  const subs = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m) {
      if (cur) subs.push(cur);
      cur = { heading: m[1].trim(), content: [] };
      continue;
    }
    if (cur) cur.content.push(line);
    else preamble.push(line);
  }
  if (cur) subs.push(cur);
  return { preamble: preamble.join('\n').trim(), subs };
}

function classifyH3(heading) {
  for (const slot of CANONICAL_H3) {
    if (slot.match.test(heading)) return slot.id;
  }
  return null;
}

function ensureScriptSubsections(scriptContent) {
  const { preamble, subs } = splitH3Sections(scriptContent);
  // Map existing canonical subsections by id
  const existing = {};
  const extras = [];
  for (const s of subs) {
    const id = classifyH3(s.heading);
    if (id && !existing[id]) {
      existing[id] = s;
    } else {
      extras.push(s);
    }
  }
  // Build canonical order, preserving existing heading names + content
  const ordered = CANONICAL_H3.map((slot) => {
    if (existing[slot.id]) return existing[slot.id];
    return { heading: slot.defaultHeading, content: [''] };
  });
  // Append extras (unrecognized H3s) at end
  ordered.push(...extras);

  const parts = [];
  if (preamble.trim()) parts.push(preamble.trim(), '');
  for (const sub of ordered) {
    parts.push(`### ${sub.heading}`);
    const c = sub.content.join('\n').replace(/^\s+|\s+$/g, '');
    if (c) parts.push('', c);
    parts.push('');
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n');
}

function normalizeBody(body) {
  const { preamble, sections } = splitH2Sections(body);

  const ideaIdx = sections.findIndex((s) => /^idea$/i.test(s.heading));
  const scriptIdx = sections.findIndex((s) => /^script$/i.test(s.heading));

  let nextSections = [...sections];

  // Ensure Idea exists — insert at start if missing
  if (ideaIdx === -1) {
    nextSections.unshift({
      heading: 'Idea',
      content: ['', '_Core message in 1-2 sentences._', ''],
    });
  }

  // Ensure Script exists — insert right after Idea if missing
  let curScriptIdx = nextSections.findIndex((s) => /^script$/i.test(s.heading));
  if (curScriptIdx === -1) {
    const insertAt = nextSections.findIndex((s) => /^idea$/i.test(s.heading)) + 1;
    nextSections.splice(insertAt, 0, {
      heading: 'Script',
      content: [],
    });
    curScriptIdx = insertAt;
  }

  // Ensure Script has canonical H3s
  const script = nextSections[curScriptIdx];
  const normalizedContent = ensureScriptSubsections(script.content.join('\n'));
  nextSections[curScriptIdx] = { heading: script.heading, content: normalizedContent.split(/\r?\n/) };

  // Reassemble
  const parts = [];
  if (preamble.trim() || preamble.length) {
    parts.push(preamble.replace(/\s+$/, ''));
    if (preamble.trim()) parts.push('');
  }
  for (const s of nextSections) {
    parts.push(`## ${s.heading}`);
    const c = s.content.join('\n').replace(/^\s+|\s+$/g, '');
    if (c) parts.push('', c);
    parts.push('');
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n');
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
    backupDir = path.join(BACKUP_ROOT, `normalize-script-${stamp}`);
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
    const nextBody = normalizeBody(parsed.content);
    if (nextBody === parsed.content || nextBody.trim() === parsed.content.trim()) {
      console.log(`- ${f} (already normalized)`);
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
  console.log(`\nSummary: ${APPLY ? 'normalized' : 'would normalize'} ${touched || files.length}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
