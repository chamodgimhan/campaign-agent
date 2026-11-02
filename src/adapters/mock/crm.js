// Mock CRM adapter.
// Stands in for a real CRM (HubSpot, Pipedrive, ...) so the agent runs with no
// accounts and no API keys. Every function returns the same shape a real
// adapter would, so swapping this out means writing one file.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const seedPath = fileURLToPath(new URL('../../data/seed.json', import.meta.url));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

// In-memory state, reset on every run. Nothing is written to disk.
const state = {
  contacts: structuredClone(seed.contacts),
  registrations: structuredClone(seed.registrations)
};

export async function findContactsBySegment(segment) {
  if (!segment) return { error: 'segment is required' };
  const matches = state.contacts.filter((c) => c.segment === segment);
  console.log(`[ADAPTER:crm] findContactsBySegment ${segment} -> ${matches.length}`);
  return { contacts: matches };
}

export async function listContacts() {
  return { contacts: state.contacts };
}

export async function getRegistrations(eventId) {
  if (!eventId) return { error: 'eventId is required' };
  const rows = state.registrations.filter((r) => r.eventId === eventId);
  return { registrations: rows };
}

export async function addRegistration(eventId, contactId) {
  if (!eventId || !contactId) return { error: 'eventId and contactId are required' };
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return { error: `no contact with id ${contactId}` };
  const existing = state.registrations.find((r) => r.eventId === eventId && r.contactId === contactId);
  if (existing && existing.status === 'registered') {
    return { error: `${contact.name} is already registered for ${eventId}` };
  }
  if (existing) existing.status = 'registered';
  else state.registrations.push({ eventId, contactId, status: 'registered' });
  console.log(`[ADAPTER:crm] addRegistration ${eventId} ${contactId}`);
  return { registered: { eventId, contactId, name: contact.name } };
}

export async function cancelRegistration(eventId, contactId) {
  if (!eventId || !contactId) return { error: 'eventId and contactId are required' };
  const row = state.registrations.find((r) => r.eventId === eventId && r.contactId === contactId);
  if (!row) return { error: `no registration for ${contactId} on ${eventId}` };
  row.status = 'cancelled';
  console.log(`[ADAPTER:crm] cancelRegistration ${eventId} ${contactId}`);
  return { cancelled: { eventId, contactId } };
}

// Exposed so tests can start from a known state.
export function __reset() {
  state.contacts = structuredClone(seed.contacts);
  state.registrations = structuredClone(seed.registrations);
}
