// Human-in-the-loop gate.
//
// Any tool marked as a write goes through here first. The agent never sends a
// campaign or changes a record without the operator typing yes. If input ends
// before they answer, that counts as declined -- never as approval.

import { createInterfaceAndAsk } from './prompt.js';

export function describe(toolName, input) {
  switch (toolName) {
    case 'send_campaign':
      return `Send campaign ${input.campaignId} to its recipient list`;
    case 'log_campaign':
      return `Write a row to the campaign log for ${input.campaignId}`;
    case 'register_attendee':
      return `Register contact ${input.contactId} for event ${input.eventId}`;
    case 'cancel_attendee':
      return `Cancel contact ${input.contactId} for event ${input.eventId}`;
    default:
      return `${toolName} ${JSON.stringify(input)}`;
  }
}

// Builds a confirm function on top of an ask() from prompt.js.
export function createConfirm(ask) {
  return async function confirm(toolName, input, { autoConfirm = false } = {}) {
    const summary = describe(toolName, input);
    if (autoConfirm) {
      console.log(`[CONFIRM] auto-approved: ${summary}`);
      return true;
    }
    const answer = await ask(`\n[CONFIRM] ${summary}\n          Type "yes" to go ahead: `);
    if (answer === null) {
      console.log('[CONFIRM] input closed, treating as declined');
      return false;
    }
    const ok = answer.trim().toLowerCase() === 'yes';
    console.log(ok ? '[CONFIRM] approved' : '[CONFIRM] declined');
    return ok;
  };
}

// Standalone version for callers with no interface of their own.
export async function confirm(toolName, input, options = {}) {
  if (options.autoConfirm) return createConfirm(async () => null)(toolName, input, options);
  const { rl, ask } = createInterfaceAndAsk();
  try {
    return await createConfirm(ask)(toolName, input, options);
  } finally {
    rl.close();
  }
}
