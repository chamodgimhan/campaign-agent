import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../src/agent.js';
import { __reset as resetCrm } from '../src/adapters/mock/crm.js';
import { __reset as resetMarketing } from '../src/adapters/mock/marketing.js';
import { __reset as resetSheet } from '../src/adapters/mock/sheet.js';

const approve = async () => true;
const decline = async () => false;

function reset() {
  resetCrm();
  resetMarketing();
  resetSheet();
}

test('an empty message is rejected', async () => {
  const result = await runAgent('   ');
  assert.match(result.error, /message is required/);
});

test('demo mode runs a campaign end to end once approved', async () => {
  reset();
  const { reply, steps } = await runAgent('set up the campaign for the founder breakfast', {
    confirmFn: approve
  });
  const names = steps.map((s) => s.name);
  assert.deepEqual(names, ['find_event', 'get_audience', 'draft_campaign', 'send_campaign', 'log_campaign']);
  assert.match(reply, /Sent campaign/);
});

test('declining means nothing is sent and nothing is logged', async () => {
  reset();
  const { reply, steps } = await runAgent('launch the campaign for the founder breakfast', {
    confirmFn: decline
  });
  assert.ok(!steps.some((s) => s.name === 'log_campaign'), 'must not log after a decline');
  assert.match(reply, /stopped at send_campaign/);
});

test('registration questions are answered without any write', async () => {
  reset();
  const { reply, steps } = await runAgent('who is registered for scale-up night?', { confirmFn: decline });
  assert.deepEqual(steps.map((s) => s.name), ['find_event', 'get_registrations']);
  assert.match(reply, /1 registered/);
});

test('listing events needs no event lookup', async () => {
  reset();
  const { steps } = await runAgent('list the events');
  assert.deepEqual(steps.map((s) => s.name), ['list_events']);
});
