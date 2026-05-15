const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const VIDEOS = 'C:/Users/20252128/dev/Projects/LifeOS/vault/1 - Rough Notes/Proyect Notes/YouTube/videos';

// Canonical restoration data (from the earlier Notion digest report)
const CATALOG = {
  'abrir-la-mente': { title: 'Abrir la mente de la gente en cuanto el crecimiento espiritual/personal', status: 'research', audience: 'TOFU', category: 'Spirituality', topic: 'Consciousness' },
  'atention-spam-exam': { title: 'Examen de attention span', status: 'research', audience: 'TOFU', category: 'Dopamine Detox', topic: 'Attention, Focus, Dopamine' },
  'charisma-types': { title: 'Which charisma type are you? How to boost your charisma, magnetism', status: 'research', audience: 'TOFU', category: 'Charisma', topic: 'Charisma', record_date: '2026-03-04' },
  'crear-sistemas': { title: 'Como crear sistemas para conseguir todos tus objetivos', status: 'research', audience: 'MOFU', category: 'Productivity', topic: 'Goals, Productivity', record_date: '2026-02-10' },
  'dejar-de-ser-npc': { title: 'Como dejar de ser un NPC y recuperar tu vida', status: 'research', audience: 'TOFU', category: 'Self-discovery', topic: 'NPC, Self-ownership, Agency' },
  'encontrar-sentido': { title: 'Como encontrar sentido en lo que haces', status: 'research', audience: 'TOFU', category: 'Masculinity', topic: 'Masculinity, Productivity, Self-discovery, Meaning' },
  'escapar-improductividad': { title: 'Como escapar de la improductividad — método definitivo', status: 'research', audience: 'MOFU', category: 'Dopamine Detox', topic: 'Dopamine detox, Monk mode, Productivity' },
  'journaling-habit': { title: 'Journaling — the habit that changed my life', status: 'research', audience: 'TOFU', category: 'Habits', topic: 'Journaling, Habits, Self-discovery' },
  'mujer-de-10-aura': { title: 'Como tener una mujer de 10 — Aura, ambición y status social', status: 'research', audience: 'TOFU', category: 'Aura', topic: 'Aura, Masculinity' },
  'obsesion-controlada': { title: 'Como la obsesión controlada te puede llevar a ser millonario', status: 'research', audience: 'TOFU', category: 'Learning', topic: 'Obsession, Learning' },
  'primera-reflexion-memento-mori': { title: 'Primera reflexión — memento mori', status: 'research', audience: 'TOFU', category: 'Mindset', topic: 'Death, Meaning' },
  'routines-maximum-efficiency': { title: 'How to set up your routines for maximum efficiency', status: 'scripting', audience: 'MOFU', category: 'Productivity', topic: 'Routines, Efficiency, Productivity' },
};

const files = fs.readdirSync(VIDEOS).filter(f => f.endsWith('.md'));
let fixed = 0;
for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const p = path.join(VIDEOS, file);
  const raw = fs.readFileSync(p, 'utf-8');
  const parsed = matter(raw);
  const data = parsed.data;
  if (data.title && Array.isArray(data.tags) && data.tags.includes('video')) continue; // not damaged
  const canon = CATALOG[slug];
  if (!canon) {
    console.log('SKIP (no canon):', slug);
    continue;
  }
  const merged = {
    title: canon.title,
    status: canon.status,
    archived: false,
    category: canon.category,
    audience: canon.audience,
    target_date: data.target_date ?? null,
    record_date: canon.record_date ?? data.record_date ?? null,
    published_date: data.published_date ?? null,
    topic: canon.topic,
    tags: ['youtube', 'video'],
    cycle: data.cycle ?? null,
    created: data.created ?? '2026-04-20',
  };
  // Preserve phase 5 fields if present
  for (const k of ['preflight','content_type','series','episode','thumbnail_url','hook','cta','ice_impact','ice_confidence','ice_ease','production_status','publish_status']) {
    if (data[k] != null) merged[k] = data[k];
  }
  const out = matter.stringify(parsed.content, merged);
  fs.writeFileSync(p, out, 'utf-8');
  console.log('RESTORED:', slug);
  fixed++;
}
console.log(`\n${fixed} files restored.`);
