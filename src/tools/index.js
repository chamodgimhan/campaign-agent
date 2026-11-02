// Tool registry.
//
// Each tool has a schema (sent to the model) and a run function (what actually
// happens). Tools with write: true must pass through the confirmation gate
// before run() is called -- see agent.js.

import { crm, marketing, sheet, events } from '../adapters/index.js';

export const tools = [
  {
    name: 'find_event',
    write: false,
    description: 'Find events by name, city, tag or id. Use this before anything that needs an eventId.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Name, city, tag or event id' } },
      required: ['query']
    },
    run: async ({ query }) => events.findEvent(query)
  },
  {
    name: 'list_events',
    write: false,
    description: 'List all upcoming events.',
    input_schema: { type: 'object', properties: {} },
    run: async () => events.listEvents()
  },
  {
    name: 'get_audience',
    write: false,
    description: 'Get the contacts in a segment, to use as campaign recipients.',
    input_schema: {
      type: 'object',
      properties: { segment: { type: 'string', description: 'e.g. founders, investors, operations' } },
      required: ['segment']
    },
    run: async ({ segment }) => crm.findContactsBySegment(segment)
  },
  {
    name: 'draft_campaign',
    write: false,
    description: 'Prepare a campaign in draft. Nothing is sent. Returns a campaignId to send later.',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        recipients: { type: 'array', items: { type: 'string' }, description: 'Email addresses' }
      },
      required: ['eventId', 'subject', 'recipients']
    },
    run: async (input) => marketing.createCampaign(input)
  },
  {
    name: 'send_campaign',
    write: true,
    description: 'Send a drafted campaign to its recipients. Requires confirmation.',
    input_schema: {
      type: 'object',
      properties: { campaignId: { type: 'string' } },
      required: ['campaignId']
    },
    run: async ({ campaignId }) => marketing.sendCampaign(campaignId)
  },
  {
    name: 'log_campaign',
    write: true,
    description: 'Append a row about a campaign to the tracking sheet. Requires confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        eventId: { type: 'string' },
        note: { type: 'string' }
      },
      required: ['campaignId', 'eventId']
    },
    run: async (input) => sheet.appendRow(input)
  },
  {
    name: 'get_registrations',
    write: false,
    description: 'List who is registered for an event.',
    input_schema: {
      type: 'object',
      properties: { eventId: { type: 'string' } },
      required: ['eventId']
    },
    run: async ({ eventId }) => crm.getRegistrations(eventId)
  },
  {
    name: 'register_attendee',
    write: true,
    description: 'Register a contact for an event. Requires confirmation.',
    input_schema: {
      type: 'object',
      properties: { eventId: { type: 'string' }, contactId: { type: 'string' } },
      required: ['eventId', 'contactId']
    },
    run: async ({ eventId, contactId }) => crm.addRegistration(eventId, contactId)
  },
  {
    name: 'cancel_attendee',
    write: true,
    description: 'Cancel a contact registration for an event. Requires confirmation.',
    input_schema: {
      type: 'object',
      properties: { eventId: { type: 'string' }, contactId: { type: 'string' } },
      required: ['eventId', 'contactId']
    },
    run: async ({ eventId, contactId }) => crm.cancelRegistration(eventId, contactId)
  }
];

export const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

// The shape the Claude API expects: schema fields only, no run/write.
export const schemas = tools.map(({ name, description, input_schema }) => ({
  name,
  description,
  input_schema
}));

export async function runTool(name, input, { autoConfirm = false, confirmFn } = {}) {
  const tool = byName[name];
  if (!tool) return { error: `unknown tool "${name}"` };

  if (tool.write && confirmFn) {
    const approved = await confirmFn(name, input, { autoConfirm });
    if (!approved) {
      console.log(`[TOOL:${name}] declined by operator`);
      return { error: 'the operator declined this action, so nothing was changed' };
    }
  }

  try {
    const result = await tool.run(input ?? {});
    console.log(`[TOOL:${name}] ${result?.error ? `error: ${result.error}` : 'ok'}`);
    return result;
  } catch (err) {
    console.log(`[TOOL:${name}] threw: ${err.message}`);
    return { error: err.message };
  }
}
