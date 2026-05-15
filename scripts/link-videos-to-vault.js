#!/usr/bin/env node
/*
 * Link video files into the Obsidian vault system:
 *
 * 1. Add `#### Tags: [[tag1]] [[tag2]]...` line right after frontmatter
 *    (converts YAML tags → wikilinks to 3 - Tags/ pages)
 * 2. Append `## Links` section at end with [[youtube-channel]] + [[youtube-production]]
 * 3. Create missing tag pages in 3 - Tags/
 *
 * Skips: 'youtube', 'video' (type tags), 'cycle-N' (metadata).
 * Normalizes tag names to lowercase-kebab for wikilink filenames.
 *
 * Default = dry-run. Use --apply to commit.
 */

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const VIDEOS_DIR = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', 'videos');
const TAGS_DIR = path.join(VAULT_BASE, '3 - Tags');
const BACKUP_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube', '.trash');
const APPLY = process.argv.includes('--apply');

const SKIP_TAGS = new Set(['youtube', 'video']);
const CYCLE_RE = /^cycle-\d+$/i;

function slugifyTag(tag) {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function isContentTag(tag) {
  if (SKIP_TAGS.has(tag.toLowerCase())) return false;
  if (CYCLE_RE.test(tag)) return false;
  return true;
}

function buildTagsLine(tags) {
  const content = tags.filter(isContentTag);
  if (content.length === 0) return null;
  const links = content.map(t => `[[${slugifyTag(t)}]]`);
  return `#### Tags: ${links.join(' ')}`;
}

const LINKS_SECTION = `## Links

- [[youtube-channel]]
- [[youtube-production]]`;

async function main() {
  let files;
  try {
    files = await fs.readdir(VIDEOS_DIR);
  } catch (e) {
    console.error(`Cannot read ${VIDEOS_DIR}: ${e.message}`);
    process.exit(1);
  }
  const targets = files.filter(f => f.endsWith('.md') && !f.endsWith('.meta.md'));

  if (targets.length === 0) {
    console.log('No .md files found.');
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUP_ROOT, `migration-links-${ts}`);

  if (APPLY) {
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`Backing up ${targets.length} files to ${backupDir}`);
    for (const f of targets) {
      await fs.copyFile(path.join(VIDEOS_DIR, f), path.join(backupDir, f));
    }
  }

  const allContentTags = new Set();
  let changedFiles = 0;

  for (const file of targets) {
    const fp = path.join(VIDEOS_DIR, file);
    const raw = await fs.readFile(fp, 'utf-8');
    const { data, content } = matter(raw);

    const tags = Array.isArray(data.tags) ? data.tags : [];
    const contentTags = tags.filter(isContentTag);
    contentTags.forEach(t => allContentTags.add(slugifyTag(t)));

    // Check if already has #### Tags: line
    const hasTagsLine = /^####\s+Tags:/m.test(content);
    // Check if already has ## Links section
    const hasLinksSection = /^##\s+Links\b/m.test(content);

    if (hasTagsLine && hasLinksSection) continue; // Already linked

    let newContent = content;

    // Add #### Tags: right at the top of body (before first ## heading)
    if (!hasTagsLine) {
      const tagsLine = buildTagsLine(tags);
      if (tagsLine) {
        // Insert after initial whitespace, before first H2
        const trimmed = newContent.replace(/^\n+/, '');
        newContent = '\n' + tagsLine + '\n\n' + trimmed;
      }
    }

    // Add ## Links at end
    if (!hasLinksSection) {
      newContent = newContent.replace(/\n*$/, '') + '\n\n' + LINKS_SECTION + '\n';
    }

    if (newContent === content) continue;

    changedFiles++;
    console.log(`${APPLY ? 'APPLY' : 'DRY  '} ${file}  tags: ${contentTags.length}  links: ${!hasLinksSection ? 'added' : 'exists'}`);

    if (APPLY) {
      const usesCRLF = /\r\n/.test(raw);
      const finalContent = usesCRLF ? newContent.replace(/\r?\n/g, '\r\n') : newContent;
      const output = matter.stringify(finalContent, data);
      const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, output, 'utf-8');
      await fs.rename(tmp, fp);
    }
  }

  // Create missing tag pages
  let createdTags = 0;
  const existingTags = new Set();
  try {
    const tagFiles = await fs.readdir(TAGS_DIR);
    for (const f of tagFiles) {
      if (f.endsWith('.md')) existingTags.add(f.replace(/\.md$/, '').toLowerCase());
    }
  } catch {}

  for (const tag of allContentTags) {
    if (existingTags.has(tag)) continue;
    createdTags++;
    console.log(`${APPLY ? 'TAG  ' : 'TAG? '} 3 - Tags/${tag}.md  (new)`);
    if (APPLY) {
      await fs.writeFile(path.join(TAGS_DIR, `${tag}.md`), '', 'utf-8');
    }
  }

  console.log('');
  console.log(`Total videos: ${targets.length}`);
  console.log(`Files changed: ${changedFiles}`);
  console.log(`Tag pages to create: ${createdTags}`);
  if (!APPLY) {
    console.log('');
    console.log('Dry-run only. Re-run with --apply to commit.');
  } else {
    console.log(`Backup: ${backupDir}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
