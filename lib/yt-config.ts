/**
 * Runtime configuration for the YouTube Studio content path.
 *
 * Single path concept. The user configures ONE absolute path; everything
 * (videos, hub, trash, templates, diagnostics) lives directly under it.
 * No subpath split — works for both Obsidian-vault users (point at a
 * subdirectory of their vault) and standalone users (point at any folder).
 *
 * Config file: <VAULT_BASE>/.yt-studio.json (control-plane location, fixed
 * at the docker mount target so it survives changes to rootPath).
 *
 * Defaults to VAULT_BASE itself (the docker mount). Daniel's existing
 * vault layout: he sets rootPath to his existing
 * "1 - Rough Notes/Proyect Notes/YouTube" subdir.
 *
 * What stays forced (DESIGN.md round-trip invariants):
 *   <root>/videos/, <root>/hub/, <root>/.trash/, <root>/hub/.trash/
 *   <root>/templates/ (createVideo template + meta template)
 *   <root>/.diagnostics/ (telemetry NDJSON, 30-day retention)
 *   <slug>.meta.md, <slug>.thumb.<ext> companions
 *   Frontmatter shape, atomic writes
 *
 * mtime-cached so the hot read path stays sub-ms.
 */

import fs from 'fs/promises';
import path from 'path';
import { VAULT_BASE } from './vault-base';

const CONFIG_FILENAME = '.yt-studio.json';

/** Default content path = the docker mount target itself. */
const DEFAULT_ROOT_PATH = VAULT_BASE;

export interface YtConfig {
  /** Absolute path to the YT content root. */
  rootPath: string;
}

let cache: { mtime: number; config: YtConfig } | null = null;
let resolvedSync: string = DEFAULT_ROOT_PATH;

function configFilePath(): string {
  return path.join(VAULT_BASE, CONFIG_FILENAME);
}

/**
 * Validate an absolute path is safe. Throws on invalid input — caller
 * translates to HTTP 400.
 */
export function validateRootPath(input: string): void {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('rootPath must be a non-empty string');
  }
  if (input.length > 512) {
    throw new Error('rootPath too long (max 512 chars)');
  }
  // Must be absolute. Accept both POSIX (/...) and Windows (C:\...) for the
  // edge case where someone runs outside docker.
  const isPosixAbs = input.startsWith('/');
  const isWinAbs = /^[a-z]:[\\/]/i.test(input);
  if (!isPosixAbs && !isWinAbs) {
    throw new Error('rootPath must be an absolute path');
  }
  // Reject traversal segments
  const normalized = path.normalize(input);
  if (normalized.includes('/..') || normalized.includes('\\..')) {
    throw new Error('rootPath must not contain `..` traversal');
  }
}

async function readConfigFile(): Promise<YtConfig> {
  try {
    const raw = await fs.readFile(configFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.rootPath === 'string') {
      try { validateRootPath(parsed.rootPath); } catch { return { rootPath: DEFAULT_ROOT_PATH }; }
      return { rootPath: parsed.rootPath };
    }
  } catch { /* missing or invalid — fall through to default */ }
  return { rootPath: DEFAULT_ROOT_PATH };
}

/**
 * Read the active config. Caches based on the config file's mtime — repeated
 * calls during the same request are sub-millisecond.
 */
export async function getYtConfig(): Promise<YtConfig> {
  let mtime = 0;
  try {
    const stat = await fs.stat(configFilePath());
    mtime = stat.mtimeMs;
  } catch {
    mtime = 0;
  }
  if (cache && cache.mtime === mtime) return cache.config;
  const config = await readConfigFile();
  cache = { mtime, config };
  resolvedSync = config.rootPath;
  return config;
}

/**
 * Write a new config atomically. Validates input before touching disk.
 * Caller is responsible for ensuring the target structure exists (call
 * `ensureYtStructure` after if appropriate).
 */
export async function setYtConfig(config: YtConfig): Promise<void> {
  validateRootPath(config.rootPath);
  const target = configFilePath();
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  await fs.rename(tmp, target);
  cache = null;
  resolvedSync = config.rootPath;
}

/**
 * Ensure the forced internal structure exists at the given absolute root.
 * Idempotent — safe to call repeatedly.
 */
export async function ensureYtStructure(absoluteRoot: string): Promise<void> {
  await fs.mkdir(absoluteRoot, { recursive: true });
  await fs.mkdir(path.join(absoluteRoot, 'videos'), { recursive: true });
  await fs.mkdir(path.join(absoluteRoot, 'hub'), { recursive: true });
  await fs.mkdir(path.join(absoluteRoot, '.trash'), { recursive: true });
  await fs.mkdir(path.join(absoluteRoot, 'hub', '.trash'), { recursive: true });
  await fs.mkdir(path.join(absoluteRoot, 'templates'), { recursive: true });
  await fs.mkdir(path.join(absoluteRoot, '.diagnostics'), { recursive: true });
}

/**
 * Detection helper for the Settings UI. Returns whether the configured root
 * exists + whether the forced structure is already in place.
 */
export async function describeRootPath(): Promise<{
  rootPath: string;
  exists: boolean;
  hasStructure: boolean;
}> {
  const config = await getYtConfig();
  const root = config.rootPath;
  let exists = false;
  let hasStructure = false;
  try {
    const stat = await fs.stat(root);
    exists = stat.isDirectory();
    if (exists) {
      try {
        const videosStat = await fs.stat(path.join(root, 'videos'));
        const hubStat = await fs.stat(path.join(root, 'hub'));
        hasStructure = videosStat.isDirectory() && hubStat.isDirectory();
      } catch {}
    }
  } catch {}
  return { rootPath: root, exists, hasStructure };
}

/**
 * Synchronous resolved root path. Reflects the last `getYtConfig()` call.
 */
export function getResolvedRootPath(): string {
  return resolvedSync;
}

/**
 * Resolved subdirectory paths. Forced internal structure — the user
 * configures only the root; everything else is always derived.
 */
export interface YtPaths {
  ytRoot: string;
  videosDir: string;
  trashDir: string;
  hubDir: string;
  hubTrashDir: string;
  templatesDir: string;
  diagnosticsDir: string;
}

export async function getYtPaths(): Promise<YtPaths> {
  const config = await getYtConfig();
  const ytRoot = config.rootPath;
  return {
    ytRoot,
    videosDir: path.join(ytRoot, 'videos'),
    trashDir: path.join(ytRoot, '.trash'),
    hubDir: path.join(ytRoot, 'hub'),
    hubTrashDir: path.join(ytRoot, 'hub', '.trash'),
    templatesDir: path.join(ytRoot, 'templates'),
    diagnosticsDir: path.join(ytRoot, '.diagnostics'),
  };
}
