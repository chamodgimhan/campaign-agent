import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTool, byName, schemas } from '../src/tools/index.js';
import { __reset as resetCrm } from '../src/adapters/mock/crm.js';
import { __reset as resetMarketing } from '../src/adapters/mock/marketing.js';

const approve = async () => true;
const decline = async () => false;

test('every write tool is marked and every schema is well formed', () => {
  assert.equal(schemas.length, Object.keys(byName).length);
  for (const s of schemas) {
    assert.ok(s.name && s.description && s.input_schema, `${s.name} is incomplete`);
    assert.equal(s.input_schema.type, 'object');
  }
  assert.ok(byName.send_campaign.write);
  assert.ok(!byName.find_event.write);
});

test('find_event matches on name, city and tag', async () => {
  const byNameResult = await runTool('find_event', { query: 'founder breakfast' });
  assert.equal(byNameResult.events[0].id, 'evt-101');

  const byCity = await runTool('find_event', { query: 'utrecht' });
  assert.equal(byCity.events[0].id, 'evt-103');

  const missing = await runTool('find_event', { query: 'nothing here' });
  assert.match(missing.error, /no event matching/);
});

test('a declined confirmation stops the write', async () => {
  resetMarketing();
  const draft = await runTool('draft_campaign', {
    eventId: 'evt-101',
    subject: 'Hello',
    recipients: ['iris@example.com']
  });
  const id = draft.campaign.id;

  const declined = await runTool('send_campaign', { campaignId: id }, { confirmFn: decline });
  assert.match(declined.error, /declined/);

  const { campaigns } = await (await import('../src/adapters/mock/marketing.js')).listCampaigns();
  assert.equal(campaigns.find((c) => c.id === id).status, 'draft', 'campaign must stay a draft');
});

test('an approved confirmation lets the write through', async () => {
  resetMarketing();
  const draft = await runTool('draft_campaign', {
    eventId: 'evt-101',
    subject: 'Hello',
    recipients: ['iris@example.com', 'tomas@example.com']
  });
  const sent = await runTool('send_campaign', { campaignId: draft.campaign.id }, { confirmFn: approve });
  assert.equal(sent.sent.recipients, 2);
});

test('errors come back as { error } rather than throwing', async () => {
  resetCrm();
  const unknown = await runTool('does_not_exist', {});
  assert.match(unknown.error, /unknown tool/);

  const duplicate = await runTool('register_attendee', { eventId: 'evt-101', contactId: 'c-1' }, { confirmFn: approve });
  assert.match(duplicate.error, /already registered/);

  const missing = await runTool('get_audience', {});
  assert.ok(missing.error);
});
