// Intensive end-to-end tests via the running API server
// Goal: find all failure modes in the save / round-trip pipeline
import { writeFileSync, readFileSync, statSync } from 'node:fs';

const BASE = 'http://localhost:3001/api/videos/break-bad-cycles';
const FILE = String.raw`C:\Users\20252128\dev\Projects\LifeOS\vault\1 - Rough Notes\Proyect Notes\YouTube\videos\break-bad-cycles.md`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

async function put(body) {
  const r = await fetch(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  return r.json();
}
async function get() {
  const r = await fetch(BASE);
  return r.json();
}

function bodyOnDisk() {
  const raw = readFileSync(FILE, 'utf-8');
  const parts = raw.split(/^---\s*$/m);
  return parts[2] ?? raw;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// --- round-trip fidelity
test('T1 simple text: byte-identical via API', async () => {
  const input = 'hello world';
  await put(input);
  const out = (await get()).body;
  // Gray-matter may add trailing newline
  assert(out === input || out === input + '\n', `got ${JSON.stringify(out)}`);
});

test('T2 multiline paragraph preserved', async () => {
  const input = 'line one\nline two\nline three';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T3 headings round-trip', async () => {
  const input = '# H1\n\n## H2\n\n### H3\n\nbody';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T4 task list round-trip', async () => {
  const input = '- [ ] todo\n- [x] done';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T5 blockquote multiline preserved', async () => {
  const input = '> quote line one\n> quote line two';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T6 code fence preserved', async () => {
  const input = '```js\nconst x = 1;\nconst y = 2;\n```';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T7 inline math preserved', async () => {
  const input = 'inline $x^2$ math';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T8 block math preserved', async () => {
  const input = 'before\n\n$$\na^2 + b^2 = c^2\n$$\n\nafter';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T9 nested list preserved', async () => {
  const input = '- parent\n  - child\n  - child two';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T10 wikilink passthrough (Obsidian-specific)', async () => {
  const input = 'See [[another-note]] for reference';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T11 callout passthrough (Obsidian-specific)', async () => {
  const input = '> [!note]\n> important';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T12 footnote passthrough', async () => {
  const input = 'Text with footnote[^1]\n\n[^1]: the footnote';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T13 empty body', async () => {
  const input = '';
  await put(input);
  const out = (await get()).body;
  assert(out === '' || out === '\n', `got ${JSON.stringify(out)}`);
});

test('T14 whitespace-only body', async () => {
  const input = '   \n\n   ';
  await put(input);
  const out = (await get()).body;
  assert(out.trim() === input.trim(), `got ${JSON.stringify(out)}`);
});

test('T15 trailing newline accumulation (does it grow each save?)', async () => {
  await put('seed');
  const size1 = statSync(FILE).size;
  await put('seed');
  const size2 = statSync(FILE).size;
  await put('seed');
  const size3 = statSync(FILE).size;
  assert(size1 === size2 && size2 === size3, `file grew: ${size1} → ${size2} → ${size3}`);
});

test('T16 mtime changes on save', async () => {
  await put('A');
  const r1 = await get();
  await new Promise((r) => setTimeout(r, 20));
  await put('B');
  const r2 = await get();
  assert(r1.mtime !== r2.mtime, `mtime did not change: ${r1.mtime} === ${r2.mtime}`);
});

test('T17 mtime is stable between GET calls without write', async () => {
  await put('stable');
  const r1 = await get();
  const r2 = await get();
  assert(r1.mtime === r2.mtime, `mtime drifts between GETs: ${r1.mtime} vs ${r2.mtime}`);
});

test('T18 body trailing newline added automatically by gray-matter', async () => {
  const input = 'no trailing';
  await put(input);
  const raw = readFileSync(FILE, 'utf-8');
  // Always ends with \n because gray-matter appends
  assert(raw.endsWith('\n'), `file does not end with newline: ${JSON.stringify(raw.slice(-20))}`);
  // But body GET includes that \n
  const out = (await get()).body;
  assert(out === 'no trailing\n' || out === 'no trailing', `unexpected GET: ${JSON.stringify(out)}`);
});

test('T19 escaped markdown chars preserved', async () => {
  const input = 'a \\* b \\_ c \\[ d';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T20 YAML frontmatter never touched', async () => {
  await put('body');
  const raw = readFileSync(FILE, 'utf-8');
  assert(raw.startsWith('---'), 'no frontmatter');
  assert(/title:/.test(raw), 'title missing');
  assert(/^tags:/m.test(raw), 'tags missing');
});

// --- rapid save (race-condition hunt)
test('T21 rapid back-to-back saves do not corrupt', async () => {
  const promises = [];
  for (let i = 0; i < 5; i++) promises.push(put(`val-${i}`));
  await Promise.all(promises);
  const final = (await get()).body;
  assert(/^val-\d\s*$/.test(final), `unexpected final state: ${JSON.stringify(final)}`);
});

test('T22 concurrent save + get: get reflects last write', async () => {
  await put('A');
  const [, r] = await Promise.all([put('B'), new Promise((res) => setTimeout(res, 5)).then(() => get())]);
  // r.body should be either A or B, never corrupted
  assert(r.body.trim() === 'A' || r.body.trim() === 'B', `got ${JSON.stringify(r.body)}`);
});

// --- unicode + edge chars
test('T23 unicode preserved', async () => {
  const input = 'español · émojis 🎬 · 中文 · русский';
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `got ${JSON.stringify(out)}`);
});

test('T24 very long body', async () => {
  const input = 'lorem '.repeat(10000).trim();
  await put(input);
  const out = (await get()).body;
  assert(out.trimEnd() === input, `length mismatch: ${out.length} vs ${input.length}`);
});

test('T25 CRLF line endings normalize?', async () => {
  const input = 'line1\r\nline2\r\nline3';
  await put(input);
  const out = (await get()).body;
  // Should preserve or normalize consistently
  const hasCRLF = /\r\n/.test(out);
  const hasLF = /(?<!\r)\n/.test(out);
  console.log(`  crlf:${hasCRLF} lf:${hasLF}`);
  // At least one format should survive
  assert(out.replace(/\r/g, '').trimEnd() === input.replace(/\r/g, ''), `got ${JSON.stringify(out)}`);
});

// --- run
let pass = 0, fail = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`PASS ${t.name}`);
    pass++;
  } catch (e) {
    console.log(`FAIL ${t.name}: ${e.message}`);
    fail++;
  }
}
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
