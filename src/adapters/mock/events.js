// Mock events adapter. Stands in for whatever system holds the event list.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const seedPath = fileURLToPath(new URL('../../data/seed.json', import.meta.url));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

export async function listEvents() {
  return { events: seed.events };
}

// True when `term` appears in `text` as a whole word, so the tag "ai" does not
// match inside "campaign".
function hasWord(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

export async function findEvent(query) {
  if (!query) return { error: 'query is required' };
  const q = String(query).toLowerCase().trim();

  // Matches a bare term ("founder breakfast") and a whole sentence that
  // contains one ("set up the campaign for the founder breakfast").
  const matches = seed.events.filter((e) => {
    const name = e.name.toLowerCase();
    const city = e.city.toLowerCase();
    if (e.id.toLowerCase() === q) return true;
    if (name.includes(q) || hasWord(q, name)) return true;
    if (city === q || hasWord(q, city)) return true;
    return e.tags.some((t) => {
      const tag = t.toLowerCase();
      return tag === q || hasWord(q, tag);
    });
  });

  console.log(`[ADAPTER:events] findEvent "${query}" -> ${matches.length}`);
  if (matches.length === 0) return { error: `no event matching "${query}"` };
  return { events: matches };
}
