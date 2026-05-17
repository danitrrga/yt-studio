# yt/studio — Design System

> Local content pipeline. A dev tool, not a marketing site.
> Treat this document as a contract. When in doubt, choose the **plainer** option.

This document is the **single source of truth** for the visual language.
The Phase 12 brief at `~/.claude/plans/phase12-redesign-brief.md` is the **why**; this is the **what**.

---

## 0 · Principles

1. **Surgical, not decorative.** Every color, border, and glyph must earn its place. The default is no chrome.
2. **Two fonts, two jobs.** Inter for readable UI (prose, labels, body). JetBrains Mono for code, numbers, shortcuts, CLI, logs. Never flip them.
3. **Red is a scalpel.** Use `#FF0000` for the brand mark, destructive actions, hard failures, and the recording state. Never for hover, never for decoration, never for "primary CTA."
4. **Hairlines, not boxes.** Hierarchy comes from 1px rules and tone shifts, not borders + shadows + radii stacked together.
5. **Information density is a feature.** Tables show many rows. Sidebars show many items. Padding is restrained.
6. **Animation conveys state, not personality.** ease-out only. ≤180ms. No bounce, no spring.

If you're tempted to add color, gradient, shadow, or animation — assume the answer is no until proven otherwise.

---

## 1 · Naming & wordmark

| Context | Form |
|---|---|
| Package / repo / CLI / Docker image | `yt-studio` (kebab-case, lowercase) |
| Display wordmark (logo) | `yt/studio` (the slash is the brand) |
| Spoken / window title | "yt-studio" (read "y-t studio") |
| Filename in code | `ytStudio` (camelCase) where required |

**Never:**
- Title Case ("Yt Studio", "YT Studio")
- All-caps wordmark ("YT/STUDIO")
- The literal phrase "YouTube Studio" anywhere in product UI, README copy, or marketing — the slash is what disambiguates from YouTube's own product

### Logo (the `yt/` monogram)
- Lockup: `yt` in Inter Bold (700), letter-spacing tightened, immediately followed by `/` in the brand red, set in JetBrains Mono Bold.
- The slash is **always mono** — it signals the terminal/code DNA of the product.
- Clearspace: at least the width of the `/` character on all sides.
- Min size: 16×16 for the favicon. Below 24×24, drop the wordmark and show only the `/` glyph in red on a dark square (`#0a0a0a`).
- File names: `logo-dark.svg`, `logo-light.svg`, `favicon.svg`, `icon-512.png`, `icon-192.png`, `apple-touch-icon.png`.

---

## 2 · Color tokens

All values are final. Do not invent shades. If a need arises that isn't covered, add it to this table first.

All tokens live in `app/globals.css` as CSS custom properties. Components reference them by name; **inline hex or `hsl(...)` outside this file is forbidden** except for status-driven tinting via `STATUS_COLOR_VAR` lookup tables (centralized in `lib/status.ts` and `lib/calendar-events.ts`).

### 2.1 Surface (the dark canvas)

| Token | Hex | Use |
|---|---|---|
| `--bg`          | `#0a0a0a` | App background. The single ground tone. |
| `--bg-raised`   | `#111111` | Cards, popovers, kanban columns. Anything that floats over `--bg`. |
| `--bg-sunken`   | `#070707` | Inputs, code blocks, tables zebra-bands. Things you can drop into. |
| `--bg-hover`    | `#161616` | Row hover, button hover on raised surfaces. |
| `--bg-active`   | `#1c1c1c` | Pressed/active state. |
| `--bg-selected` | `#1a1a1a` | Sidebar item selected, table row selected. Pair with `--fg` text (not red). |

### 2.2 Foreground

| Token | Hex | Use |
|---|---|---|
| `--fg`          | `#ededed` | Primary text. Headings, body, key data. |
| `--fg-muted`    | `#a3a3a3` | Secondary text. Labels, captions, breadcrumbs. |
| `--fg-dim`      | `#737373` | Tertiary text. Placeholders, helper text, inactive nav. |
| `--fg-faint`    | `#525252` | Disabled, watermarks, structural marks. |
| `--fg-inverse`  | `#0a0a0a` | Text on red or light backgrounds. |

### 2.3 Lines

| Token | Hex | Use |
|---|---|---|
| `--line`        | `#1f1f1f` | Default 1px hairline. Section dividers, card borders, table borders. |
| `--line-strong` | `#2a2a2a` | Emphasized line. Active input border, kanban column gutters. |
| `--line-faint`  | `#161616` | Background grids, faint dividers in dense lists. |

### 2.4 Brand & semantic

| Token | Hex | Use |
|---|---|---|
| `--red`         | `#FF0000` | Brand. The `/` glyph. Destructive confirm buttons. Recording dot. Active "live" states. |
| `--red-dim`     | `#A30000` | Red used at length (small text, sustained UI like a fails counter). Reduces eye fatigue. |
| `--red-wash`    | `#1a0606` | Background tint for destructive/error containers. Use sparingly. |

### 2.5 Status palette

For video pipeline stages and event levels only. These are restricted to **pills, dots, and chart series**. They never appear as button colors, never as link colors, never as background fills outside of pills.

| Token | Hex | Stage / level |
|---|---|---|
| `--status-idea`      | `#737373` | Idea (neutral gray) |
| `--status-research`  | `#7C7CFF` | Research (cool indigo) |
| `--status-scripting` | `#E0A24A` | Scripting (amber) |
| `--status-filming`   | `#FF8A3D` | Filming (orange) |
| `--status-editing`   | `#B084F5` | Editing (violet) |
| `--status-published` | `#3FB984` | Published (green) |
| `--status-error`     | `#FF0000` | Hard error (= `--red`) |
| `--status-warn`      | `#E0A24A` | Warning (= scripting amber) |
| `--status-info`      | `#7C7CFF` | Info (= research indigo) |

All status tokens render at full saturation only at ≤14px (pill labels, dots). At larger sizes, use the color at 60% opacity over `--bg-raised`.

### 2.6 Light-mode (README on GitHub, exported docs)
Light is a **rendering target**, not a UI mode. The product is dark-only.

| Token | Hex |
|---|---|
| `--bg-light`       | `#f7f7f7` |
| `--fg-light`       | `#0a0a0a` |
| `--fg-muted-light` | `#525252` |
| `--line-light`     | `#e5e5e5` |

The red and status tokens are the same in both modes.

---

## 3 · Typography

### 3.1 Font strategy — two fonts, two jobs

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

**Inter** (`--font-sans`) is the default UI font. Use it for:
- All body text and prose
- Sidebar labels and nav items
- Form inputs and placeholders
- Toast messages, empty states, error copy
- Button labels, tooltips, metadata

**JetBrains Mono** (`--font-mono`) is for dense structured data. Use it for:
- Keyboard shortcut chips (`⌘K`, `ctrl+s`)
- All numeric columns (dates, counts, durations, IDs)
- Code blocks and script editor
- Diagnostic / log views
- The `yt/` logo slash
- Section eyebrow labels (`NOW WORKING ON`, `WRITING THIS WEEK`)
- The `--text-xs` size generally pairs well with mono

Self-host both in `public/fonts/` — no Google Fonts `<link>` in production.

There is no serif. No third font. If something looks like it wants a different font, it wants different weight or spacing instead.

### 3.2 Weights

Use only these three:

| Weight | Value | Use |
|---|---|---|
| Regular | 400 | Body, table cells, labels |
| Medium  | 500 | Sidebar items, table headers, secondary buttons |
| Bold    | 700 | Page titles, the `yt/` mark, primary buttons, key metrics |

Weight 600 is forbidden — it muddies the system. Promote to 700 or demote to 500.

### 3.3 Type scale

Round numbers. Don't invent in-between sizes.

| Token | Size / line-height | Letter-spacing | Font | Use |
|---|---|---|---|---|
| `--text-xs`      | 11 / 16 | `+0.06em` (always uppercase) | mono | Eyebrow labels, table column headers, status chip text |
| `--text-sm`      | 12 / 18 | `+0.02em`                    | sans | Helper text, dim metadata, footer chrome |
| `--text-base`    | 13 / 20 | 0                            | sans | Default UI text. Sidebar, table cells, form inputs |
| `--text-md`      | 14 / 22 | 0                            | sans | Body in docs, longer descriptions |
| `--text-lg`      | 16 / 24 | `-0.005em`                   | sans | Subheadings, card titles |
| `--text-xl`      | 20 / 28 | `-0.01em`                    | sans | Section titles |
| `--text-2xl`     | 26 / 32 | `-0.015em`                   | sans | Page titles ("Dashboard", "Diagnostics") |
| `--text-3xl`     | 38 / 44 | `-0.02em`                    | sans | Hero, marketing |
| `--text-display` | 56 / 60 | `-0.025em`                   | sans | README hero only |

Body text never goes below 12px. Inputs and clickable text never below 13px.

### 3.4 Rules

- **Headings**: weight 700, color `--fg`, Inter.
- **Body**: weight 400, color `--fg` (or `--fg-muted` if subordinate), Inter.
- **Labels** (`--text-xs`): always uppercase, weight 500, color `--fg-dim`, JetBrains Mono. Examples: `NOW WORKING ON`, `WRITING THIS WEEK`, `COMING UP TO RECORD`.
- **Numerals in metrics**: tabular-nums (`font-variant-numeric: tabular-nums`), JetBrains Mono. Always.
- **No italics in chrome.** Use color shift or weight shift for emphasis instead.
- **No underlines** except for hovered inline links inside long-form text.

---

## 4 · Spacing & layout

### 4.1 Spacing scale — 4px base, integer multiples

| Token | px |
|---|---|
| `--space-0`  | 0  |
| `--space-1`  | 4  |
| `--space-2`  | 8  |
| `--space-3`  | 12 |
| `--space-4`  | 16 |
| `--space-5`  | 20 |
| `--space-6`  | 24 |
| `--space-8`  | 32 |
| `--space-10` | 40 |
| `--space-12` | 48 |
| `--space-16` | 64 |
| `--space-20` | 80 |

Do not use values not on this scale.

### 4.2 Density (row heights)

Default density: **compact**.

| Surface | Compact (default) | Comfortable |
|---|---|---|
| Sidebar item | 32px | 36px |
| Table row | 36px | 44px |
| Kanban card padding | 8px | 12px |
| Timeline row | 40px | 56px |
| Timeline bar | 26px | 36px |
| Calendar event chip | 18px | 22px |
| Hub card thumb width | 80px | 112px |

### 4.3 Container widths

- App shell: full viewport, no max width.
- Sidebar: 224px fixed (`14rem` at 16px root).
- Main column: fills remaining viewport, padded `--space-8` (32px) horizontally on ≥1024px, `--space-4` below.
- Settings, modals, focused docs: max-content-width 720px.
- Long-form markdown (README rendering, video scripts): max-content-width 680px.

### 4.4 Grid

The kanban board uses a fixed-width column system (`280px` per column, `--space-4` gutter, horizontally scrollable). Everything else uses CSS grid or flex — no twelve-column framework.

---

## 5 · Borders, radii, shadows

- **Radii**: only `0`, `2px`, `4px`, and `9999px` (pill). Default to `4px` for cards, buttons, inputs, badges. Pill is reserved for status chips and the `+ New video` button.
- **Borders**: only `1px solid var(--line)` or `1px solid var(--line-strong)`. No 2px borders except in the recording state.
- **Shadows**: none. Zero. Elevation is conveyed by `--bg-raised` against `--bg`, not by `box-shadow`. The one exception is the focused-element ring (see §8.3).
- **No glassmorphism.** No `backdrop-filter`. Ever.

**Forbidden:** `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`.

---

## 6 · Iconography & glyphs

### 6.1 The play triangle `▶`

The `▶` (U+25B6) is the only branded glyph. Use it as:
- The recording indicator (filled red, 8–10px) before a "live"/"recording" label.
- The "now playing" / "now rendering" marker in lists.
- The pipeline arrow between stages, in red: `──▶`.

Do **not** use it as a generic "play" button — those should be SVG play-icon buttons.

### 6.2 Icon set

Use **Lucide** (`lucide-react`). Default size 16px, stroke width 1.5, color `--fg-muted`. Active/hover color `--fg`.

Permitted icons:

```
LayoutGrid  Film        Inbox       Hammer      Clock
Map         Library     Settings    Activity    RefreshCw
Search      Filter      ArrowUpDown ChevronLeft ChevronRight
ChevronDown Plus        X           Check       Pencil
Calendar    Camera      Download    Upload      AlertCircle
Circle      CheckCircle2 XCircle   Eye         EyeOff
ExternalLink Copy
```

Adding new icons requires updating this list.

Never use emoji in product UI or repo docs.

### 6.3 ASCII / monospace decoration

Where appropriate (CLI output, log views, empty states), use box-drawing characters: `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`. These are real characters in mono, not images.

---

## 7 · Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--motion-fast`  | 80ms   | linear   | Hover/press tone shifts |
| `--motion-base`  | 140ms  | ease-out | Most state changes |
| `--motion-slow`  | 200ms  | ease-out | Panel slide-in, modal fade-in |
| `--motion-pulse` | 1200ms | ease-in-out | Recording dot only |

**Discipline:**
- Only animate `transform` and `opacity` for 60fps
- No bounces, no elastic, no spring overshoot
- No animation > 200ms (recording pulse exempt)
- `prefers-reduced-motion` honored in `globals.css`

**Forbidden patterns:**
- `transition-all` — animate specific properties only
- Scale > 1.05 on hover
- Rotation on drag ghost
- Pulsing/breathing on idle elements
- Sequenced staggered enters of >3 items

---

## 8 · States

### 8.1 Hover
Tone shift only — background goes up one step in the surface scale. Never apply a color tint on hover.

### 8.2 Pressed / active
Tone shift down (`--bg-active`).

### 8.3 Focus (keyboard)
**Always visible.** `outline: none` is forbidden without a replacement.
Replacement: `box-shadow: 0 0 0 2px rgba(255,255,255,0.10), 0 0 0 3px var(--bg)`. White ring offset by the background color.

### 8.4 Disabled
Opacity 0.4. No hover. Cursor `not-allowed`.

### 8.5 Live / recording
The recording dot is a solid `--red` 8px circle that pulses opacity 1 → 0.4 → 1 over 1200ms, ease-in-out, infinite. Pair with the label `REC`. This is the only blinking element in the system.

### 8.6 Empty
Always written copy, never an illustration. One sentence at `--fg-muted`, optionally a single-button next step.

### 8.7 Error
Inline `--red-dim` text below the field. Toast for app-level errors. **Never** a red modal scrim.

---

## 9 · Component patterns

### 9.1 Buttons

| Variant | Background | Text | Border | Height | Use |
|---|---|---|---|---|---|
| Primary     | `--fg`        | `--fg-inverse` | none                    | 32px | Single primary action per view |
| Secondary   | `--bg-raised` | `--fg`         | `1px solid --line-strong` | 32px | Common actions |
| Ghost       | transparent   | `--fg-muted` → `--fg` on hover | none     | 32px | Toolbar actions |
| Destructive | `--red`       | `--fg-inverse` | none                    | 32px | Delete, discard. Always behind a confirm step. |
| Icon-only   | transparent   | `--fg-muted` → `--fg` | none               | 28×28px | Toolbar icons |

- Border-radius: `4px`. Pill (`9999px`) only for the marquee `+ New video` button.
- Font: Inter, `--text-base`, weight 500.
- A `kbd` hint inside a button sits right, in JetBrains Mono `--text-xs`, `--fg-dim`, in a `1px solid --line` chip with `2px` radius.
- Disabled: opacity 0.4, no hover.

**Rule:** Standalone primary CTAs (New video, Convert to video, Save, Confirm) use `--fg` fill (white-on-dark). **Red is never a primary CTA** — only for destructive actions.

### 9.2 Form fields

- Height 32px. Padding `0 12px`. Border `1px solid --line`. Radius `4px`. Background `--bg-sunken`. Font: Inter `--text-base`.
- Focus: border `--line-strong`, plus `box-shadow: 0 0 0 2px rgba(255,255,255,0.06)`. **Not** red.
- Error state: border `--red`, helper text `--red-dim`. No red background fill.
- Placeholder: `--fg-dim`.
- Search inputs: leading 14px `Search` icon at `--fg-dim`, `12px` left padding, `8px` between icon and text.

### 9.3 Status pills

- Height 22px. Pill radius. Padding `0 10px`. Font: JetBrains Mono `--text-xs`, uppercase, weight 500, `+0.08em` tracking.
- Leading dot: `6px` solid circle in the matching `--status-*` color.
- Background: same status color at 12% opacity over `--bg-raised`.
- Text: same status color at full saturation. For `--status-idea` gray, text is `--fg-muted`.

### 9.4 Cards

- Background `--bg-raised`. Border `1px solid --line`. Radius `4px`. Padding `--space-5` (20px) default, `--space-4` for dense lists.
- Card title: Inter `--text-lg`, weight 700, `--fg`.
- Card metadata: Inter `--text-sm`, `--fg-muted`, small inline icons.
- No shadows. Hover lifts border to `--line-strong`.

### 9.5 Tables

- Header: JetBrains Mono `--text-xs`, uppercase, `--fg-dim`, `+0.08em`, weight 500. Row height 32px header, 36px body.
- Body: Inter `--text-base`. Tabular numerals in mono. Cell padding `0 12px`.
- Row hover: `--bg-hover`. Row selected: `--bg-selected` + 2px `--red` left bar in first cell.
- Row dividers: `1px solid --line-faint`.
- Empty state: centered block, `▶` in `--fg-faint`, single sentence at `--fg-muted`.

### 9.6 Sidebar

- Width 224px. Background `--bg`. No right border.
- Top-level item: 32px height, `0 12px` padding, icon 16px + 12px gap + Inter `--text-base` weight 500 `--fg-muted`. Selected: `--bg-selected`, label `--fg`, no red mark.
- Nested item: 24px indent from icon column. Selected nested: 2px `--red` left bar.
- Section labels: JetBrains Mono `--text-xs`, uppercase, `--fg-dim`.
- Footer: status dot + health summary, Inter `--text-sm`, `--fg-dim`. Fails count in `--red-dim` (not `--red`).

### 9.7 Page header

- Page title: Inter `--text-2xl`, weight 700, `--fg`.
- Subtitle: Inter `--text-md`, `--fg-muted`.
- Right side: view-switcher pills, then primary actions. Active pill: `--fg` background, `--fg-inverse` text. **Not** red.
- View switcher icons 14px, leading the label, 8px gap.

### 9.8 Kanban

- Column 280px. Column header: 32px row, status dot + JetBrains Mono uppercase label + count chip.
- Column background `--bg`. Cards inside `--bg-raised`.
- Empty column: dashed `1px --line`, `+` and "Drop here or click to add" in `--fg-dim`, height 88px, radius `4px`.
- Drag overlay: no shadow. Opacity 0.9 on the dragging card.

### 9.9 Code blocks & logs

- Background `--bg-sunken`. Border `1px solid --line`. Padding `--space-4`. Font: JetBrains Mono throughout.
- Log columns: `TIME` (`--fg-dim`), `SCOPE` (`--fg`), `EVENT` (`--fg`), `LEVEL` (status dot + text), `DETAIL` (`--fg-muted`).
- A failure line gets a `--red` dot but its row background stays `--bg`.

### 9.10 Toasts

- Position: bottom-right, 16px inset. Stack with 8px gap.
- Width 360px. Padding `--space-4`. Background `--bg-raised`. Border `1px solid --line-strong`. Radius `4px`.
- Title: Inter weight 700. Body: Inter `--fg-muted`. Auto-dismiss 5s; error toasts persist until acknowledged.

---

## 10 · Voice & copy

- **Lowercase everywhere except proper nouns and page headings.** Buttons say "save", "delete", "new video".
- **Use the imperative for actions.** "Open script", not "Click here to open the script".
- **No marketing voice.** No "supercharge", "effortlessly", "AI-powered", "magic". Describe what the thing does.
- **Time format**: relative for recent events ("just now", "12m ago", "today", "tomorrow", "in 4d"); absolute for ≥14 days ("May 19").
- **Number format**: tabular figures, no thousand separators below 10000. Use `·` (middle dot) as the inline separator: `9 fails · 24h`.
- **Empty states**: state the situation plainly. "No videos in production." Not "Looks like there's nothing here yet!"
- **Status pills** use the `STATUS_LABELS` map in `lib/status.ts`. Capitalize there once.
- **Toasts**: under 8 words. Action verbs in past tense for confirmations ("script saved", "clip captured").
- **Errors**: state the cause, not the apology. "save failed — check diagnostics" not "oops, something went wrong."

---

## 11 · CSS variables — drop in

```css
:root {
  /* Surface */
  --bg: #0a0a0a;
  --bg-raised: #111111;
  --bg-sunken: #070707;
  --bg-hover: #161616;
  --bg-active: #1c1c1c;
  --bg-selected: #1a1a1a;

  /* Foreground */
  --fg: #ededed;
  --fg-muted: #a3a3a3;
  --fg-dim: #737373;
  --fg-faint: #525252;
  --fg-inverse: #0a0a0a;

  /* Lines */
  --line: #1f1f1f;
  --line-strong: #2a2a2a;
  --line-faint: #161616;

  /* Brand */
  --red: #FF0000;
  --red-dim: #A30000;
  --red-wash: #1a0606;

  /* Status */
  --status-idea: #737373;
  --status-research: #7C7CFF;
  --status-scripting: #E0A24A;
  --status-filming: #FF8A3D;
  --status-editing: #B084F5;
  --status-published: #3FB984;
  --status-error: #FF0000;
  --status-warn: #E0A24A;
  --status-info: #7C7CFF;

  /* Type */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --text-xs: 11px;       --lh-xs: 16px;
  --text-sm: 12px;       --lh-sm: 18px;
  --text-base: 13px;     --lh-base: 20px;
  --text-md: 14px;       --lh-md: 22px;
  --text-lg: 16px;       --lh-lg: 24px;
  --text-xl: 20px;       --lh-xl: 28px;
  --text-2xl: 26px;      --lh-2xl: 32px;
  --text-3xl: 38px;      --lh-3xl: 44px;
  --text-display: 56px;  --lh-display: 60px;

  /* Spacing */
  --space-0: 0;      --space-1: 4px;   --space-2: 8px;
  --space-3: 12px;   --space-4: 16px;  --space-5: 20px;
  --space-6: 24px;   --space-8: 32px;  --space-10: 40px;
  --space-12: 48px;  --space-16: 64px; --space-20: 80px;

  /* Radii */
  --radius-none: 0;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-pill: 9999px;

  /* Motion */
  --motion-fast: 80ms linear;
  --motion-base: 140ms ease-out;
  --motion-slow: 200ms ease-out;
}

html, body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--lh-base);
  font-feature-settings: 'ss01' 1;
  -webkit-font-smoothing: antialiased;
}

/* Mono contexts */
kbd, code, pre, .tabular, [data-mono] {
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1, 'ss01' 1;
}

*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.10), 0 0 0 3px var(--bg);
}
```

---

## 12 · Tailwind config — drop in

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0a",
          raised:  "#111111",
          sunken:  "#070707",
          hover:   "#161616",
          active:  "#1c1c1c",
          selected:"#1a1a1a",
        },
        fg: {
          DEFAULT: "#ededed",
          muted:   "#a3a3a3",
          dim:     "#737373",
          faint:   "#525252",
          inverse: "#0a0a0a",
        },
        line: {
          DEFAULT: "#1f1f1f",
          strong:  "#2a2a2a",
          faint:   "#161616",
        },
        red: {
          DEFAULT: "#FF0000",
          dim:     "#A30000",
          wash:    "#1a0606",
        },
        status: {
          idea:      "#737373",
          research:  "#7C7CFF",
          scripting: "#E0A24A",
          filming:   "#FF8A3D",
          editing:   "#B084F5",
          published: "#3FB984",
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs:      ["11px", { lineHeight: "16px", letterSpacing: "0.06em" }],
        sm:      ["12px", { lineHeight: "18px", letterSpacing: "0.02em" }],
        base:    ["13px", { lineHeight: "20px" }],
        md:      ["14px", { lineHeight: "22px" }],
        lg:      ["16px", { lineHeight: "24px", letterSpacing: "-0.005em" }],
        xl:      ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "2xl":   ["26px", { lineHeight: "32px", letterSpacing: "-0.015em" }],
        "3xl":   ["38px", { lineHeight: "44px", letterSpacing: "-0.02em" }],
        display: ["56px", { lineHeight: "60px", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        none: "0",
        sm:   "2px",
        md:   "4px",
        pill: "9999px",
        // lg / xl / 2xl / 3xl intentionally omitted — use md (4px) max
      },
      transitionDuration: { fast: "80ms", base: "140ms", slow: "200ms" },
      transitionTimingFunction: { out: "cubic-bezier(0, 0, 0.2, 1)" },
      fontWeight: { normal: "400", medium: "500", bold: "700" },
      boxShadow: {
        // Only the focus ring. No elevation shadows.
        focus: "0 0 0 2px rgba(255,255,255,0.10), 0 0 0 3px #0a0a0a",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 13 · Anti-patterns (do NOT ship)

If you see any of these in a diff, push back:

- Inline hex or `hsl(...)` outside `globals.css`, `lib/status.ts`, or `lib/calendar-events.ts`
- Gradients of any kind, including subtle ones. Backgrounds are flat hex.
- `backdrop-filter` / glassmorphism / translucent panels
- `box-shadow` on any surface except the focus ring
- `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` — max is `rounded-md` (4px)
- `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-inner`
- `transition-all` — animate specific properties only
- Tailwind palette colors (`text-blue-500`, `bg-red-400`, etc.) — use semantic tokens
- Colored buttons other than white-on-dark (primary) or red-on-dark (destructive)
- Red used as a CTA or hover tint — red is a scalpel, not decoration
- `--red` used for the fails counter footer — use `--red-dim` there
- Animation > 200ms (recording pulse exempt)
- `bounce`, `elastic`, `spring` easing
- Ad-hoc spacing values like `p-[13px]`, `mt-[7px]` — 4px grid only
- Emoji in product UI, docs, or commit conventions
- Decorative SVG illustrations on empty states
- More than two fonts (`--font-sans` + `--font-mono` only)
- Weight 600 — use 500 or 700
- `<h1>` larger than 26px outside hero blocks

---

## 14 · Compliance gates

Every component edit must pass:

1. `tsc --noEmit` clean
2. `grep -E "hsl\(\s*[0-9]|#[0-9a-fA-F]{3,8}" components/ app/ --include="*.tsx"` returns nothing outside `lib/status.ts` and `lib/calendar-events.ts`
3. `grep -E "shadow-(sm|md|lg|xl|inner)" components/ app/ --include="*.tsx"` returns nothing
4. `grep -E "rounded-(lg|xl|2xl|3xl)" components/ app/ --include="*.tsx"` returns nothing
5. `grep -E "backdrop-filter|backdrop-blur" components/ app/ --include="*.tsx"` returns nothing
6. WCAG AA contrast on all text-on-surface combinations
7. Visual diff vs. previous commit reviewed

---

## 15 · Implementation checklist

When porting the codebase to this design system:

- [ ] Drop the CSS variables block (§11) into `app/globals.css`, replacing the old indigo-based tokens.
- [ ] Replace `tailwind.config.ts` with the config in §12.
- [ ] Self-host Inter and JetBrains Mono in `public/fonts/`, declare `@font-face`, remove any Google Fonts `<link>`.
- [ ] Update `lib/status.ts` `STATUS_COLOR_VAR` to reference the new `--status-*` tokens.
- [ ] Update `lib/calendar-events.ts` similarly.
- [ ] Audit all `text-` and `bg-` classes against the new token names. Anything off-token → reclassify.
- [ ] Replace all `--color-accent` / `--color-surface` / `--color-fg-secondary` references with new tokens.
- [ ] Swap any `rounded-lg` / `rounded-xl` with `rounded-md` (4px).
- [ ] Move every `box-shadow` except the focus ring to `none`.
- [ ] Replace sidebar active state color tint with `--bg-selected` + `--fg` (no color).
- [ ] Confirm the diagnostic page failures counter uses `--red-dim`, not `--red`.
- [ ] Convert primary CTAs from indigo accent to `--fg` fill (white-on-dark).
- [ ] Run grep for `gradient`, `backdrop-filter`, `shadow-` — should return zero in app code.

---

## 16 · Versioning

This document is version-controlled with the repo. Material changes to §2 (color tokens), §3 (typography), or §7 (motion) require a Phase 12-style brief and CEO sign-off. Trivial additions (new component pattern, new token) can ship inline.

**Last updated:** Phase 12b, 2026-05-15.
**Previous system:** Phase 12a, 2026-04-26 (indigo accent, Inter-only).
**Next review:** after Phase 12f completes.
