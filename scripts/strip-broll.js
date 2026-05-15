#!/usr/bin/env node
// One-shot: remove the `## B-Roll Ideas` section from every *.meta.md.
// Default is dry-run. Pass --apply to commit.

const fs = require('fs/promises');
const path = require('path');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const VIDEOS_DIR = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', 'videos');
const BACKUP_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', '.studio', 'backups');
const APPLY = process.argv.includes('--apply');

function stripBRoll(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let skip = false;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const norm = h2[1].toLowerCase();
      skip = norm.startsWith('b-roll') || norm.startsWith('b roll');
      if (skip) continue;
    }
    if (!skip) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n');
}

async function atomicWrite(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, file);
}

async function run() {
  const files = (await fs.readdir(VIDEOS_DIR)).filter((f) => f.endsWith('.meta.md'));
  let touched = 0;
  let backupDir = null;
  if (APPLY) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupDir = path.join(BACKUP_ROOT, `strip-broll-${stamp}`);
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`✓ backup: ${backupDir}`);
  } else {
    console.log('(dry-run — pass --apply to write)\n');
  }

  for (const f of files) {
    const p = path.join(VIDEOS_DIR, f);
    const raw = await fs.readFile(p, 'utf-8');
    const next = stripBRoll(raw);
    if (next === raw) {
      console.log(`- ${f} (no B-Roll)`);
      continue;
    }
    console.log(`✎ ${f} (${raw.length} → ${next.length} chars)`);
    if (APPLY) {
      await fs.copyFile(p, path.join(backupDir, f));
      await atomicWrite(p, next);
      touched += 1;
    }
  }

  console.log(`\nSummary: ${APPLY ? 'stripped' : 'would strip'} ${touched || files.filter((_) => true).length}`);
  if (!APPLY) console.log('Run with --apply to commit.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
