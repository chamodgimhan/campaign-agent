#!/usr/bin/env node
// Entry point: a chat loop in the terminal.
//
// This stands in for WhatsApp. A real deployment would put a Twilio webhook
// here instead and pass the incoming message body to runAgent() unchanged.
//
//   npm run demo     offline, no API key, rule-based planner
//   npm start        live, Claude picks the tools (needs ANTHROPIC_API_KEY)
//   --yes            skip the confirmation prompt (for scripted runs)

import { argv, env, exit } from 'node:process';
import { runAgent } from './agent.js';
import { createConfirm } from './confirm.js';
import { createInterfaceAndAsk } from './prompt.js';

const flags = new Set(argv.slice(2));
const mode = flags.has('--demo') || !env.ANTHROPIC_API_KEY ? 'demo' : 'live';
const autoConfirm = flags.has('--yes');

if (mode === 'demo' && !flags.has('--demo')) {
  console.log('No ANTHROPIC_API_KEY found, so running in demo mode.\n');
}

console.log('Campaign agent. Type a message, or "exit" to quit.');
console.log('Try: "set up the campaign for the founder breakfast"');
console.log('     "who is registered for scale-up night?"');
console.log('     "list the events"\n');

// One interface, shared by the chat loop and the confirmation prompt.
const { rl, ask } = createInterfaceAndAsk();
const confirmFn = createConfirm(ask);

while (true) {
  const line = await ask('you > ');
  if (line === null) break; // end of input
  const message = line.trim();
  if (!message) continue;
  if (['exit', 'quit'].includes(message.toLowerCase())) break;

  try {
    const { reply, error } = await runAgent(message, { mode, autoConfirm, confirmFn });
    console.log(`\nagent > ${error ?? reply}\n`);
  } catch (err) {
    console.log(`\nagent > something went wrong: ${err.message}\n`);
  }
}

rl.close();
exit(0);
