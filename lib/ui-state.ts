const KEY = 'yt-studio:ui:v1';

export interface UIState {
  sidebarCollapsed: boolean;
  focusByPage: Record<string, boolean>;
  metadataSidebarCollapsed: boolean;
}

const DEFAULT: UIState = {
  sidebarCollapsed: false,
  focusByPage: {},
  metadataSidebarCollapsed: false,
};

export function loadUIState(): UIState {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function saveUIState(state: UIState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}
