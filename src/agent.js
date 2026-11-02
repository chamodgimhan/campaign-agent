// The agent loop.
//
// Two planners decide what to do next:
//   live  - Claude picks the tools (needs ANTHROPIC_API_KEY and npm install)
//   demo  - a small rule-based planner, so the project runs offline with no key
//
// Both drive the same tools and the same confirmation gate, so the write
// protection behaves identically either way.

import { schemas, runTool } from './tools/index.js';
import { confirm } from './confirm.js';

const SYSTEM_PROMPT = `You help an events team run campaigns from a chat message.

Rules:
- Look things up before acting. Never invent an event id, contact id or email.
- Draft a campaign before sending it, and show the operator a short summary first.
- Anything that sends mail or changes a record needs their confirmation; the
  tools handle asking, so just call them.
- If a tool returns an error, explain it plainly instead of retrying blindly.
- Keep replies short, the way you would write in a chat app.`;

// ---------------------------------------------------------------------------
// demo planner
// ---------------------------------------------------------------------------

function intentOf(message) {
  const m = message.toLowerCase();
  if (/(who|registrations|registered|attendees|signed up)/.test(m)) return 'registrations';
  if (/(list|what|which).*(event|events)/.test(m)) return 'events';
  if (/(campaign|invite|launch|promote|email)/.test(m)) return 'campaign';
  return 'events';
}

function segmentFor(eventTags = []) {
  return eventTags[0] ?? 'founders';
}

// Returns the next tool call given what has already run, or null when done.
function planDemo(intent, done, memory) {
  const did = (name) => done.some((d) => d.name === name);

  if (intent === 'events') {
    if (!did('list_events')) return { name: 'list_events', input: {} };
    return null;
  }

  if (intent === 'registrations') {
    if (!did('find_event')) return { name: 'find_event', input: { query: memory.query } };
    if (!memory.eventId) return null;
    if (!did('get_registrations')) return { name: 'get_registrations', input: { eventId: memory.eventId } };
    return null;
  }

  // campaign
  if (!did('find_event')) return { name: 'find_event', input: { query: memory.query } };
  if (!memory.eventId) return null;
  if (!did('get_audience')) return { name: 'get_audience', input: { segment: segmentFor(memory.eventTags) } };
  if (!memory.recipients?.length) return null;
  if (!did('draft_campaign')) {
    return {
      name: 'draft_campaign',
      input: {
        eventId: memory.eventId,
        subject: `You're invited: ${memory.eventName}`,
        body: `${memory.eventName} is on ${memory.eventDate} in ${memory.eventCity}. Reply to save a seat.`,
        recipients: memory.recipients
      }
    };
  }
  if (!memory.campaignId) return null;
  if (!did('send_campaign')) return { name: 'send_campaign', input: { campaignId: memory.campaignId } };
  if (!memory.sent) return null;
  if (!did('log_campaign')) {
    return {
      name: 'log_campaign',
      input: { campaignId: memory.campaignId, eventId: memory.eventId, note: 'launched from chat' }
    };
  }
  return null;
}

// Pulls the few facts the demo planner needs out of tool results.
function remember(memory, name, result) {
  if (result?.error) return memory;
  if (name === 'find_event') {
    const evt = result.events?.[0];
    if (evt) {
      memory.eventId = evt.id;
      memory.eventName = evt.name;
      memory.eventDate = evt.date;
      memory.eventCity = evt.city;
      memory.eventTags = evt.tags;
    }
  }
  if (name === 'get_audience') memory.recipients = (result.contacts ?? []).map((c) => c.email);
  if (name === 'draft_campaign') memory.campaignId = result.campaign?.id;
  if (name === 'send_campaign') memory.sent = true;
  return memory;
}

function summarise(intent, memory, done) {
  const failed = done.find((d) => d.result?.error);
  if (failed) return `I stopped at ${failed.name}: ${failed.result.error}`;

  if (intent === 'events') {
    const list = done.find((d) => d.name === 'list_events')?.result?.events ?? [];
    return list.map((e) => `- ${e.name}, ${e.date}, ${e.city} (${e.id})`).join('\n');
  }
  if (intent === 'registrations') {
    const rows = done.find((d) => d.name === 'get_registrations')?.result?.registrations ?? [];
    if (!memory.eventId) return 'I could not find that event.';
    return `${memory.eventName}: ${rows.filter((r) => r.status === 'registered').length} registered.`;
  }
  if (!memory.campaignId) return 'I could not prepare the campaign.';
  if (!memory.sent) return `Campaign ${memory.campaignId} is drafted but was not sent.`;
  return `Sent campaign ${memory.campaignId} for ${memory.eventName} to ${memory.recipients.length} contacts and logged it.`;
}

async function runDemo(message, options) {
  const intent = intentOf(message);
  const memory = { query: message };
  const done = [];

  for (let step = 0; step < (options.maxSteps ?? 10); step++) {
    const next = planDemo(intent, done, memory);
    if (!next) break;
    const result = await runTool(next.name, next.input, options);
    done.push({ name: next.name, input: next.input, result });
    remember(memory, next.name, result);
    if (result?.error && next.name !== 'send_campaign') break;
  }

  return { reply: summarise(intent, memory, done), steps: done };
}

// ---------------------------------------------------------------------------
// live planner
// ---------------------------------------------------------------------------

async function runLive(message, options) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.MODEL ?? 'claude-sonnet-4-5';

  const messages = [{ role: 'user', content: message }];
  const done = [];

  for (let step = 0; step < (options.maxSteps ?? 10); step++) {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: schemas,
      messages
    });

    messages.push({ role: 'assistant', content: response.content });

    const calls = response.content.filter((block) => block.type === 'tool_use');
    if (calls.length === 0) {
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      return { reply: text.trim(), steps: done };
    }

    const results = [];
    for (const call of calls) {
      const result = await runTool(call.name, call.input, options);
      done.push({ name: call.name, input: call.input, result });
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(result),
        is_error: Boolean(result?.error)
      });
    }
    messages.push({ role: 'user', content: results });
  }

  return { reply: 'I hit the step limit before finishing.', steps: done };
}

// ---------------------------------------------------------------------------

export async function runAgent(message, options = {}) {
  if (!message || !message.trim()) return { error: 'message is required' };
  const opts = { confirmFn: confirm, autoConfirm: false, maxSteps: 10, ...options };
  const mode = opts.mode ?? 'demo';
  console.log(`[AGENT] mode=${mode} message="${message}"`);
  return mode === 'live' ? runLive(message, opts) : runDemo(message, opts);
}
