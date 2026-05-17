'use client';

export function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

// Average spoken pace ~150 words/minute (YouTube-creator convention).
// Reading pace ~200 wpm. Show both so creators know script length.
const SPOKEN_WPM = 150;
const READING_WPM = 220;

function fmtMin(words: number, wpm: number): string {
  const mins = words / wpm;
  if (mins < 1) return `<1 min`;
  if (mins < 10) return `${mins.toFixed(1)} min`;
  return `${Math.round(mins)} min`;
}

export function WordCount({ body }: { body: string }) {
  const words = countWords(body);
  return (
    <div
      className="text-xs text-[var(--fg-dim)] tabular-nums"
      aria-live="polite"
    >
      <span>{words.toLocaleString()} {words === 1 ? 'word' : 'words'}</span>
      {words > 0 && (
        <>
          <span className="mx-1.5 text-[var(--line)]">·</span>
          <span title="Spoken duration at 150 wpm">{fmtMin(words, SPOKEN_WPM)} spoken</span>
          <span className="mx-1.5 text-[var(--line)]">·</span>
          <span title="Reading time at 220 wpm">{fmtMin(words, READING_WPM)} read</span>
        </>
      )}
    </div>
  );
}
