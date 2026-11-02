// Adapter selection.
//
// Everything the agent touches goes through these four adapters. The mock set
// is the default and needs no accounts. To talk to real systems, write a
// module with the same exported functions and point the matching env var at it.

import * as mockCrm from './mock/crm.js';
import * as mockMarketing from './mock/marketing.js';
import * as mockSheet from './mock/sheet.js';
import * as mockEvents from './mock/events.js';

const backends = {
  crm: { mock: mockCrm },
  marketing: { mock: mockMarketing },
  sheet: { mock: mockSheet },
  events: { mock: mockEvents }
};

function pick(kind, name) {
  const chosen = backends[kind][name];
  if (!chosen) {
    throw new Error(`unknown ${kind} backend "${name}" (available: ${Object.keys(backends[kind]).join(', ')})`);
  }
  return chosen;
}

export const crm = pick('crm', process.env.CRM_BACKEND ?? 'mock');
export const marketing = pick('marketing', process.env.MARKETING_BACKEND ?? 'mock');
export const sheet = pick('sheet', process.env.SHEET_BACKEND ?? 'mock');
export const events = pick('events', process.env.EVENTS_BACKEND ?? 'mock');
