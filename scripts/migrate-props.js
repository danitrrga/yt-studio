#!/usr/bin/env node
// Frontmatter migrator — collapses the 20-field legacy schema to the 11-field canonical one.
// Dry-run by default. --apply writes, but first mirrors the videos dir into a timestamped backup.
//
// Pipeline per file:
//  1) parse frontmatter (gray-matter)
//  2) normalize status: 'review' -> 'editing', 'uploading' -> 'published'
//  3) merge topic CSV tokens into tags (union, case-insensitive dedupe, cap 10)
//  4) drop dropped fields
//  5) default content_type -> 'long' if missing
//  6) normalize empty-string dates to null
//  7) write back in canonical key order via tempfile + rename

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const VIDEOS_DIR = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', 'videos');
const BACKUP_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', '.studio', 'backups');

const DROPPED_FIELDS = [
  'topic',
  'archived',
  'production_status',
  'publish_status',
  'series',
  'episode',
  'thumbnail_url',
  'hook',
  'cta',
  'ice_impact',
  'ice_confidence',
  'ice_ease',
  'preflight',
];

const CANONICAL_ORDER = [
  'title',
  'status',
  'content_type',
  'category',
  'audience',
  'tags',
  'target_date',
  'record_date',
  'published_date',
  'cycle',
  'created',
];

const STATUS_REMAP = {
  review: 'editing',
  uploading: 'published',
};

function normDate(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    return t;
  }
  return null;
}

function unionTags(existing, add) {
  const seen = new Map();
  const push = (raw) => {
    if (typeof raw !== 'string') return;
    const t = raw.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (!seen.has(key)) seen.set(key, t);
  };
  (existing || []).forEach(push);
  (add || []).forEach(push);
  return Array.from(seen.values()).slice(0, 10);
}

function transform(raw) {
  const data = { ...raw };

  // 2) status remap
  if (typeof data.status === 'string' && STATUS_REMAP[data.status]) {
    data.status = STATUS_REMAP[data.status];
  }

  // 3) topic -> tags
  const topicTokens =
    typeof data.topic === 'string'
      ? data.topic.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
      : [];
  const mergedTags = unionTags(Array.isArray(data.tags) ? data.tags : [], topicTokens);

  // 4) drop dropped fields
  for (const k of DROPPED_FIELDS) delete data[k];

  // 5) default content_type
  if (!data.content_type) data.content_type = 'long';

  // 6) normalize dates
  data.target_date = normDate(data.target_date);
  data.record_date = normDate(data.record_date);
  data.published_date = normDate(data.published_date);
  if (!data.created) data.created = new Date().toISOString().slice(0, 10);
  else data.created = normDate(data.created);

  // Apply merged tags last (after topic delete)
  data.tags = mergedTags;

  // Reorder to canonical order (keeps unknown keys at the end — there should be none post-drop)
  const ordered = {};
  for (const k of CANONICAL_ORDER) {
    if (k in data) ordered[k] = data[k];
  }
  // Any remaining unknown key stays (shouldn't happen post-drop, but defense in depth)
  for (const k of Object.keys(data)) {
    if (!(k in ordered)) ordered[k] = data[k];
  }
  return ordered;
}

function diff(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const k of keys) {
    const a = JSON.stringify(before[k]);
    const b = JSON.stringify(after[k]);
    if (a !== b) {
      if (before[k] === undefined) changes.push(`+ ${k} = ${b}`);
      else if (after[k] === undefined) changes.push(`- ${k} (was ${a})`);
      else changes.push(`~ ${k}: ${a} -> ${b}`);
    }
  }
  return changes;
}

async function backup() {
  const ts = new Date().toISOString().slice(0, 10);
  const dest = path.join(BACKUP_ROOT, `props-migration-${ts}`);
  await fs.mkdir(dest, { recursive: true });
  const files = await fs.readdir(VIDEOS_DIR);
  let n = 0;
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    await fs.copyFile(path.join(VIDEOS_DIR, f), path.join(dest, f));
    n++;
  }
  return { dest, n };
}

async function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (e) {
    try { await fs.unlink(tempPath); } catch {}
    throw e;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'APPLY' : 'DRY-RUN';
  console.log(`\nMigrator: ${mode}`);
  console.log(`Vault: ${VIDEOS_DIR}\n`);

  if (apply) {
    const { dest, n } = await backup();
    console.log(`Backup: ${n} files -> ${dest}\n`);
  }

  const files = (await fs.readdir(VIDEOS_DIR)).filter((f) => f.endsWith('.md')).sort();
  const summary = { changed: 0, unchanged: 0, written: 0, fieldsDropped: {} };

  for (const file of files) {
    const filePath = path.join(VIDEOS_DIR, file);
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(raw);
    const before = parsed.data;
    const after = transform(before);
    const changes = diff(before, after);

    if (changes.length === 0) {
      summary.unchanged++;
      continue;
    }
    summary.changed++;
    for (const c of changes) {
      if (c.startsWith('- ')) {
        const field = c.slice(2).split(' ')[0];
        summary.fieldsDropped[field] = (summary.fieldsDropped[field] || 0) + 1;
      }
    }

    console.log(`• ${file}`);
    for (const c of changes) console.log(`    ${c}`);

    if (apply) {
      const output = matter.stringify(parsed.content, after);
      await atomicWrite(filePath, output);
      summary.written++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Changed: ${summary.changed}`);
  console.log(`Unchanged (idempotent): ${summary.unchanged}`);
  console.log(`Written: ${summary.written}`);
  if (Object.keys(summary.fieldsDropped).length) {
    console.log(`Fields dropped:`);
    for (const [k, n] of Object.entries(summary.fieldsDropped)) {
      console.log(`  ${k}: ${n} files`);
    }
  }
  if (!apply) console.log('\nDry-run complete. Re-run with --apply to write.');
}

main().catch((e) => {
  console.error('Migrator failed:', e);
  process.exit(1);
});
