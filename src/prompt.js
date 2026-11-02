// A single place that reads a line from the operator.
//
// Both the chat loop and the confirmation gate go through one ask(), because a
// readline interface cannot be iterated and questioned at the same time, and
// two interfaces on one stdin compete for input.
//
// Lines are queued as they arrive. A pipe delivers its whole script at once,
// and readline emits every line immediately, so anything not consumed right
// away would otherwise be dropped -- which previously turned a piped "yes"
// into a silent decline. Returns null at end of input.

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export function createAsk(rl, out = stdout) {
  const pending = [];   // lines read but not yet asked for
  const waiting = [];   // askers with no line yet
  let closed = false;

  rl.on('line', (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else pending.push(line);
  });

  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift()(null);
  });

  return async function ask(question = '') {
    if (question) out.write(question);
    if (pending.length) return pending.shift();
    if (closed) return null;
    return new Promise((resolve) => waiting.push(resolve));
  };
}

export function createInterfaceAndAsk() {
  const rl = createInterface({ input: stdin, output: stdout });
  return { rl, ask: createAsk(rl) };
}
