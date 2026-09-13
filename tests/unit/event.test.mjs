import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { defaultEventId, event } from '../../lib/event.ts';

afterEach(() => {
  delete process.env.RALLY_EVENT_ID;
});

test('the festival id comes from RALLY_EVENT_ID, defaulting to the original', () => {
  assert.equal(event.id, defaultEventId);
  process.env.RALLY_EVENT_ID = 'festival-2027';
  assert.equal(event.id, 'festival-2027');
});

test('a malformed id is an error rather than a silent switch of festival', () => {
  process.env.RALLY_EVENT_ID = 'Festival 2027';
  assert.throws(() => event.id, /RALLY_EVENT_ID/);
});
