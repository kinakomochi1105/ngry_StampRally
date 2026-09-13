import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSettings, validateSettings } from '../../lib/settings.ts';
import { defaultSettings } from '../../lib/types.ts';

test('settings saved by an older release gain the newer fields', () => {
  const stored = {
    title: '桜祭',
    grades: ['1', '2'],
    classes: ['A'],
    maxNumber: 40,
    registrationOpen: false,
  };
  assert.deepEqual(readSettings(stored), {
    ...stored,
    nicknameBlockedWords: [],
    nicknameAllowedWords: [],
  });
});

test('broken stored values fall back field by field', () => {
  assert.deepEqual(readSettings(null), defaultSettings);
  assert.deepEqual(readSettings([]), defaultSettings);
  const read = readSettings({
    title: '',
    grades: 'x',
    maxNumber: 0,
    nicknameBlockedWords: ['a', 3],
  });
  assert.equal(read.title, defaultSettings.title);
  assert.deepEqual(read.grades, defaultSettings.grades);
  assert.equal(read.maxNumber, defaultSettings.maxNumber);
  assert.deepEqual(read.nicknameBlockedWords, ['a']);
});

test('the console form is validated and normalised', () => {
  const valid = validateSettings({
    title: ' 桜祭 ',
    grades: ['1', ' 2 '],
    classes: ['A'],
    maxNumber: '35',
    registrationOpen: true,
    nicknameBlockedWords: [' ほげ ', 'ほげ'],
    nicknameAllowedWords: ['シネマ'],
  });
  assert.equal(valid.title, '桜祭');
  assert.deepEqual(valid.grades, ['1', '2']);
  assert.equal(valid.maxNumber, 35);
  assert.deepEqual(valid.nicknameBlockedWords, ['ほげ']);
  assert.deepEqual(valid.nicknameAllowedWords, ['シネマ']);
  const base = { title: 'x', grades: ['1'], classes: ['A'], maxNumber: 1 };
  for (const bad of [
    null,
    { ...base, title: '' },
    { ...base, grades: [] },
    { ...base, grades: ['1', '1'] },
    { ...base, maxNumber: 1000 },
    { ...base, nicknameAllowedWords: ['a'.repeat(41)] },
  ])
    assert.throws(
      () => validateSettings(bad),
      (error) => error.status === 400,
    );
});
