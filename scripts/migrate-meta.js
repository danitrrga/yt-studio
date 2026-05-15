#!/usr/bin/env node
// Meta-sidecar migrator — extracts Production / Thumbnail Ideas / B-Roll Ideas / Post-Mortem
// sections from each video .md into a sibling .meta.md. Main .md keeps frontmatter + script.
//
// Dry-run by default. --apply writes, but first mirrors videos dir into a timestamped backup.
//
// Pipeline per file:
//  1) read slug.md → parse frontmatter + body
//  2) split body into H2 sections (## Foo)
//  3) partition: meta headings -> meta sidecar, everything else stays in main body
//  4) write slug.meta.md with extracted sections (skip if nothing matched)
//  5) write slug.md with remaining body

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const VIDEOS_DIR = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', 'videos');
const BACKUP_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', '.studio', 'backups');

const META_HEADINGS = [
  { matcher: /^production\b/i, canonical: 'Production' },
  { matcher: /^thumbnail/i, canonical: 'Thumbnail Ideas' },
  { matcher: /^b[\s-]?roll/i, canonical: 'B-Roll Ideas' },
  { matcher: /^post[\s-]?mortem/i, canonical: 'Post-Mortem' },
];

const APPLY = process.argv.includes('--apply');

function classifyHeading(heading) {
  const trimmed = heading.trim();
  for (const { matcher, canonical } of META_HEADINGS) {
    if (matcher.test(trimmed)) return canonical;
  }
  return null;
}

function splitBodyBySections(body) {
  // Returns array of { heading: string | null, lines: string[] }.
  // heading === null means "preamble before any H2".
  const lines = body.split(/\r?\n/);
  const out = [];
  let current = { heading: null, lines: [] };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      out.push(current);
      current = { heading: m[1].trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  out.push(current);
  return out;
}

function partition(sections) {
  const mainChunks = [];
  const metaChunks = [];
  for (const s of sections) {
    if (s.heading === null) {
      mainChunks.push(s);
      continue;
    }
    const canonical = classifyHeading(s.heading);
    if (canonical) {
      metaChunks.push({ heading: canonical, lines: s.lines });
    } else {
      mainChunks.push(s);
    }
  }
  return { mainChunks, metaChunks };
}

function serializeChunks(chunks) {
  return chunks
    .map((c) => {
      if (c.heading === null) return c.lines.join('\n');
      return `## ${c.heading}\n${c.lines.join('\n')}`;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/, '\n');
}

async function backupAll() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(BACKUP_ROOT, `meta-migration-${stamp}`);
  await fs.mkdir(target, { recursive: true });
  const files = await fs.readdir(VIDEOS_DIR);
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    await fs.copyFile(path.join(VIDEOS_DIR, f), path.join(target, f));
  }
  return target;
}

async function atomicWrite(filePath, content) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, filePath);
}

async function run() {
  const files = await fs.readdir(VIDEOS_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md') && !f.endsWith('.meta.md'));

  let backupDir = null;
  if (APPLY) {
    backupDir = await backupAll();
    console.log(`✓ backup: ${backupDir}`);
  } else {
    console.log('(dry-run — pass --apply to write)\n');
  }

  let touched = 0;
  let skipped = 0;

  for (const file of mdFiles) {
    const slug = path.basename(file, '.md');
    const p = path.join(VIDEOS_DIR, file);
    const metaP = path.join(VIDEOS_DIR, `${slug}.meta.md`);
    const raw = await fs.readFile(p, 'utf-8');
    const parsed = matter(raw);

    const sections = splitBodyBySections(parsed.content);
    const { mainChunks, metaChunks } = partition(sections);

    if (metaChunks.length === 0) {
      skipped += 1;
      console.log(`- ${slug} (no meta sections)`);
      continue;
    }

    // detect meta-file exists — don't overwrite if --apply
    let metaExists = false;
    try {
      await fs.access(metaP);
      metaExists = true;
    } catch {}

    const newBody = serializeChunks(mainChunks);
    const newMain = matter.stringify(newBody.replace(/^\n+/, ''), parsed.data);
    const newMeta = metaChunks.map((c) => `## ${c.heading}\n${c.lines.join('\n')}`.replace(/\s+$/, '')).join('\n\n') + '\n';

    console.log(`✎ ${slug}`);
    console.log(`   meta sections: ${metaChunks.map((c) => c.heading).join(', ')}`);
    console.log(`   main .md: ${parsed.content.length} → ${newBody.length} chars`);
    console.log(`   meta .md: ${newMeta.length} chars${metaExists ? ' (WOULD OVERWRITE)' : ''}`);

    if (APPLY) {
      if (metaExists) {
        console.log(`   SKIP: meta file already exists for ${slug}`);
        skipped += 1;
        continue;
      }
      await atomicWrite(p, newMain);
      await atomicWrite(metaP, newMeta);
      touched += 1;
    }
  }

  console.log(`\nSummary: ${APPLY ? 'migrated' : 'would migrate'} ${APPLY ? touched : mdFiles.length - skipped}, skipped ${skipped}`);
  if (!APPLY) console.log('Run with --apply to commit.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
