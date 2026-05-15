import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { getYtPaths } from './yt-config';
import type { FileChangeEvent } from './types';

type Listener = (event: FileChangeEvent) => void;
const listeners = new Set<Listener>();
let watcher: FSWatcher | null = null;
let starting: Promise<void> | null = null;

async function startWatcher(): Promise<void> {
  if (watcher) return;
  if (starting) return starting;
  starting = (async () => {
    const { videosDir } = await getYtPaths();
    if (watcher) return; // racing subscriber may have started us
    watcher = chokidar.watch(videosDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });
    const emit = (type: FileChangeEvent['type'], filePath: string) => {
      if (!filePath.endsWith('.md')) return;
      const slug = path.basename(filePath, '.md');
      listeners.forEach((fn) => fn({ type, slug }));
    };
    watcher.on('change', (p) => emit('change', p));
    watcher.on('add', (p) => emit('add', p));
    watcher.on('unlink', (p) => emit('unlink', p));
  })();
  await starting;
  starting = null;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  // Fire-and-forget; the watcher only matters for events delivered after it boots
  void startWatcher();
  return () => {
    listeners.delete(fn);
  };
}
