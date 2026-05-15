/**
 * Single source of truth for the vault root path.
 *
 * Set via `VAULT_PATH` environment variable (typically configured in
 * docker-compose.yml). Defaults to `/vault` — the conventional docker mount
 * target — so a fresh clone with the standard volume mount Just Works.
 *
 * For new users running outside docker: set VAULT_PATH to point at your
 * Obsidian vault root.
 *
 * The YouTube subpath inside this vault is configurable at runtime via
 * `lib/yt-config.ts` (Slice 2 — config file at <VAULT_BASE>/.yt-studio.json).
 */
export const VAULT_BASE = process.env.VAULT_PATH || '/vault';
