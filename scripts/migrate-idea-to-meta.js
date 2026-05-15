#!/usr/bin/env node
/*
 * Move every video's `## Idea` section from the script body into the meta
 * sidecar. After this runs:
 *   - <slug>.md has no `## Idea` section
 *   - <slug>.meta.md has `## Idea` as its first section, populated with the
 *     content that was previously in the script body
 *
 * Placeholder italic content (`_..._`) is treated as empty and not migrated.
 *
 * Default = dry-run. Use --apply to commit.
 * Backups written to vault/.../YouTube/.trash/migration-idea-<ts>/
 */

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');

const VAULT_BASE = process.env.VAULT_PATH || 'C:/Users/20252128/dev/Projects/LifeOS/vault';
const YT_ROOT = path.join(VAULT_BASE, '1 - Rough Notes', 'Proyect Notes', 'YouTube');
const VIDEOS_DIR = path.join(YT_ROOT, 'videos');
const BACKUP_ROOT = path.join(YT_ROOT, '.trash');
const APPLY = process.argv.includes('--apply');

const META_TEMPLATE_FILE = path.join(VAULT_BASE, '5 - Templates', 'video-meta-template.md');

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

function isPlaceholder(text) {
  const t = text.trim();
  if (!t) return true;
  const lines = t.split(/\r?\n/).filter(Boolean);
  return lines.every((ln) => /^_.+_\s*$/.test(ln.trim()));
}

function stripIdeaFromBody(body) {
  const sections = splitH2(body);
  const kept = sections.filter((s) => !s.heading.toLowerCase().startsWith('idea'));
  let extractedIdea = '';
  for (const s of sections) {
    if (s.heading.toLowerCase().startsWith('idea')) {
      const text = s.content.join('\n').trim();
      if (!isPlaceholder(text)) extractedIdea = text;
    }
  }
  // Reassemble preserving leading newline if original had one.
  const pre = body.startsWith('\n') ? '' : '';
  const out = kept
    .map((s) => `## ${s.heading}\n${s.content.join('\n')}`)
    .join('\n')
    .replace(/^\n+/, '');
  return { newBody: pre + out, extractedIdea };
}

async function loadMetaTemplate() {
  try {
    return await fs.readFile(META_TEMPLATE_FILE, 'utf-8');
  } catch {
    return '## Idea\n\n## Production\n\n## Publish\n\n## Title Ideas\n\n## Thumbnail Ideas\n\n## Post-Mortem\n';
  }
}

function ensureIdeaInMetaSidecar(metaRaw, idea) {
  // Check if Idea section already present
  const sections = splitH2(metaRaw);
  const hasIdea = sections.some((s) => s.heading.toLowerCase().startsWith('idea'));
  if (hasIdea) {
    // Replace Idea section's body
    const lines = metaRaw.split(/\r?\n/);
    const out = [];
    let inIdea = false;
    let injected = false;
    for (const ln of lines) {
      const isH2 = /^##\s+(?!#)/.test(ln);
      const isIdeaH2 = /^##\s+idea\b/i.test(ln);
      if (isIdeaH2) {
        out.push(ln);
        if (idea.trim()) {
          out.push('');
          out.push(idea.trim());
        }
        inIdea = true;
        injected = true;
        continue;
      }
      if (inIdea && isH2) {
        // start of next section — emit a blank line before
        if (out[out.length - 1] !== '') out.push('');
        inIdea = false;
        out.push(ln);
        continue;
      }
      if (inIdea) continue; // drop old Idea body
      out.push(ln);
    }
    if (!injected) return metaRaw;
    return out.join('\n');
  }
  // Prepend Idea section
  const ideaBlock = idea.trim()
    ? `## Idea\n\n${idea.trim()}\n\n`
    : `## Idea\n\n`;
  return ideaBlock + metaRaw.replace(/^\n+/, '');
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
  const backupDir = path.join(BACKUP_ROOT, `migration-idea-${ts}`);

  if (APPLY) {
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`Backing up ${targets.length * 2} files to ${backupDir}`);
    for (const f of targets) {
      const metaName = f.replace(/\.md$/, '.meta.md');
      try {
        await fs.copyFile(path.join(VIDEOS_DIR, f), path.join(backupDir, f));
      } catch {}
      try {
        await fs.copyFile(path.join(VIDEOS_DIR, metaName), path.join(backupDir, metaName));
      } catch {}
    }
  }

  const metaTemplate = await loadMetaTemplate();
  let changedScripts = 0;
  let migratedIdeas = 0;
  let createdMetas = 0;
  let updatedMetas = 0;

  for (const file of targets) {
    const slug = file.replace(/\.md$/, '');
    const scriptPath = path.join(VIDEOS_DIR, file);
    const metaPath = path.join(VIDEOS_DIR, `${slug}.meta.md`);

    const scriptRaw = await fs.readFile(scriptPath, 'utf-8');
    const { data, content } = matter(scriptRaw);
    const { newBody, extractedIdea } = stripIdeaFromBody(content);

    const scriptUsesCRLF = /\r\n/.test(scriptRaw);
    const finalScriptBody = scriptUsesCRLF
      ? newBody.replace(/\r?\n/g, '\r\n')
      : newBody;
    const newScript = matter.stringify(finalScriptBody, data);
    const scriptChanged = newScript !== scriptRaw;

    // Meta sidecar
    let metaRaw;
    let metaExisted = true;
    try {
      metaRaw = await fs.readFile(metaPath, 'utf-8');
    } catch {
      metaRaw = metaTemplate;
      metaExisted = false;
    }
    const metaUsesCRLF = metaExisted && /\r\n/.test(metaRaw);
    let nextMeta = ensureIdeaInMetaSidecar(metaRaw, extractedIdea);
    if (metaUsesCRLF) nextMeta = nextMeta.replace(/\r?\n/g, '\r\n');
    else if (!metaExisted) nextMeta = nextMeta.replace(/\r\n/g, '\n');
    const metaChanged = nextMeta !== metaRaw || !metaExisted;

    if (scriptChanged || metaChanged) {
      const ideaTag = extractedIdea ? ` · idea: ${extractedIdea.slice(0, 40)}${extractedIdea.length > 40 ? '…' : ''}` : '';
      const tag = !metaExisted ? ' (created meta)' : '';
      console.log(`${APPLY ? 'APPLY' : 'DRY  '} ${file}${ideaTag}${tag}`);
      if (scriptChanged) changedScripts++;
      if (extractedIdea) migratedIdeas++;
      if (!metaExisted) createdMetas++;
      else if (metaChanged) updatedMetas++;

      if (APPLY) {
        if (scriptChanged) {
          const tmp = `${scriptPath}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(tmp, newScript, 'utf-8');
          await fs.rename(tmp, scriptPath);
        }
        if (metaChanged) {
          const tmp = `${metaPath}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(tmp, nextMeta, 'utf-8');
          await fs.rename(tmp, metaPath);
        }
      }
    }
  }

  console.log('');
  console.log(`Total scripts: ${targets.length}`);
  console.log(`Scripts modified: ${changedScripts}`);
  console.log(`Ideas migrated to meta: ${migratedIdeas}`);
  console.log(`Meta sidecars created: ${createdMetas}`);
  console.log(`Meta sidecars updated: ${updatedMetas}`);
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
