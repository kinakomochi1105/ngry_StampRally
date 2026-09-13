import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decryptBlocklist, wordsFromJson } from '../../lib/forbidden.ts';
import { encryptBlocklist } from '../support/blocklist.mjs';

test('the blocklist decrypts with the key and IV from the environment', async () => {
  const fixture = encryptBlocklist(['ほげ', ' ＦＯＯ ', 'ほげ', 3]);
  process.env.NICKNAME_BLOCKLIST_KEY = fixture.key;
  process.env.NICKNAME_BLOCKLIST_IV = fixture.iv;
  assert.deepEqual(await decryptBlocklist(fixture.contents), ['ほげ', 'FOO']);
});

test('a missing or wrong key is a clear error, not an empty list', async () => {
  const fixture = encryptBlocklist(['ほげ']);
  delete process.env.NICKNAME_BLOCKLIST_KEY;
  process.env.NICKNAME_BLOCKLIST_IV = fixture.iv;
  await assert.rejects(
    decryptBlocklist(fixture.contents),
    /NICKNAME_BLOCKLIST_KEY/,
  );
  process.env.NICKNAME_BLOCKLIST_KEY = encryptBlocklist([]).key;
  await assert.rejects(
    decryptBlocklist(fixture.contents),
    /could not be decrypted|not valid JSON/,
  );
});

test('only a words array is accepted', () => {
  assert.equal(wordsFromJson('{"list": []}'), null);
  assert.equal(wordsFromJson('not json'), null);
  assert.deepEqual(wordsFromJson('{"words": ["a", "", "a"]}'), ['a']);
});
