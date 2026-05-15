#!/usr/bin/env node
// Ensure every video has a meta sidecar with all canonical sections.
// - Missing sidecar → create from template.
// - Existing sidecar → inject any missing sections in canonical order, preserving existing content.
//
// Default: dry-run. Pass --apply to commit. Backups under
// .studio/backups/backfill-meta-<timestamp>/.

const fs = require('fs/promises');
const path = require('path');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const VIDEOS_DIR = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', 'videos');
const TEMPLATE_FILE = path.join(VAULT_BASE, '5 - Templates', 'video-meta-template.md');
const BACKUP_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', '.studio', 'backups');
const APPLY = process.argv.includes('--apply');

const CANONICAL = [
  { match: /^production\b/i, heading: 'Production' },
  { match: /^publish\b/i, heading: 'Publish' },
  { match: /^title\b/i, heading: 'Title Ideas' },
  { match: /^thumbnail\b/i, heading: 'Thumbnail Ideas' },
  { match: /^post[-\s]mortem\b/i, heading: 'Post-Mortem' },
];

function splitH2(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (cur) out.push(cur);
      cur = { heading: m[1].trim(), content: [] };
      continue;
    }
    if (cur) cur.content.push(line);
  }
  if (cur) out.push(cur);
  return out;
}

function classify(heading) {
  for (const slot of CANONICAL) {
    if (slot.match.test(heading)) return slot;
  }
  return null;
}

function serialize(sections) {
  const parts = [];
  for (const s of sections) {
    parts.push(`## ${s.heading}`);
    const inner = s.content.join('\n').replace(/^\n+|\n+$/g, '');
    if (inner) {
      parts.push('');
      parts.push(inner);
      parts.push('');
    } else {
      parts.push('');
    }
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n');
}

async function atomicWrite(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, file);
}

async function run() {
  const templateRaw = await fs.readFile(TEMPLATE_FILE, 'utf-8');
  const templateSections = splitH2(templateRaw);
  const templateBySlot = new Map();
  for (const s of templateSections) {
    const slot = classify(s.heading);
    if (slot) templateBySlot.set(slot.heading, s);
  }

  const files = (await fs.readdir(VIDEOS_DIR)).filter((f) => f.endsWith('.md'));
  const videoFiles = files.filter((f) => !f.endsWith('.meta.md'));

  let backupDir = null;
  if (APPLY) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupDir = path.join(BACKUP_ROOT, `backfill-meta-${stamp}`);
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`✓ backup: ${backupDir}\n`);
  } else {
    console.log('(dry-run — pass --apply to write)\n');
  }

  let touched = 0;
  for (const f of videoFiles) {
    const slug = f.replace(/\.md$/, '');
    const metaPath = path.join(VIDEOS_DIR, `${slug}.meta.md`);
    let exists = false;
    try {
      await fs.access(metaPath);
      exists = true;
    } catch {}

    if (!exists) {
      console.log(`+ ${slug}.meta.md (missing → create from template)`);
      if (APPLY) {
        await atomicWrite(metaPath, templateRaw);
        touched += 1;
      }
      continue;
    }

    const existingRaw = await fs.readFile(metaPath, 'utf-8');
    const existingSections = splitH2(existingRaw);
    const existingBySlot = new Map();
    const extras = [];
    for (const s of existingSections) {
      const slot = classify(s.heading);
      if (slot && !existingBySlot.has(slot.heading)) {
        existingBySlot.set(slot.heading, s);
      } else {
        extras.push(s);
      }
    }

    // Build canonical-order list, using existing content where present, template fallback otherwise
    const canonicalSections = CANONICAL.map((slot) => {
      const existing = existingBySlot.get(slot.heading);
      if (existing) return existing;
      const fromTemplate = templateBySlot.get(slot.heading);
      return fromTemplate ?? { heading: slot.heading, content: [] };
    });
    const finalSections = [...canonicalSections, ...extras];

    const next = serialize(finalSections);
    if (next === existingRaw) {
      console.log(`- ${slug}.meta.md`);
      continue;
    }
    const missingHeadings = CANONICAL
      .filter((slot) => !existingBySlot.has(slot.heading))
      .map((slot) => slot.heading);
    console.log(`✎ ${slug}.meta.md (added: ${missingHeadings.join(', ') || 'reformat only'})`);
    if (APPLY) {
      await fs.copyFile(metaPath, path.join(backupDir, `${slug}.meta.md`));
      await atomicWrite(metaPath, next);
      touched += 1;
    }
  }

  console.log(`\nSummary: ${APPLY ? 'updated' : 'would update'} ${touched || '?'} file(s)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
