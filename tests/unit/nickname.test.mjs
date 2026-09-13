import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  moderationKey,
  screenedKey,
  validateNickname,
} from '../../lib/nickname.ts';

const rejected = (name, blocked, allowed) =>
  assert.throws(() => validateNickname(name, blocked, allowed), name);
const accepted = (name, blocked, allowed) =>
  assert.equal(
    validateNickname(name, blocked, allowed).nickname,
    name.normalize('NFKC').trim(),
  );

test('length and character rules', () => {
  for (const name of ['', 'a', 'あ'.repeat(21), '<script>', 'a b', 'a​b', '--'])
    rejected(name);
  for (const name of ['ab', 'さくら', 'Sakura_2026', 'ねこ-まる'])
    accepted(name);
  assert.throws(() => validateNickname(42));
});

test('blocked words survive width, case, kana and separators', () => {
  for (const name of [
    'ＦＵＣＫ',
    'f-u-c-k',
    'セックス',
    '管理者さん',
    'シネ_シネ',
  ])
    rejected(name);
  assert.equal(moderationKey('ＡＤ-ｍｉｎ'), 'admin');
  assert.equal(moderationKey('シネマ'), 'しねま');
});

test('ordinary names that merely contain a blocked word are let through', () => {
  for (const name of [
    'Yamashita',
    'kinoshita',
    'Matsushita',
    'badminton',
    'シネマ部',
    'ころすけ',
    'Essex',
  ])
    accepted(name);
  // …but the blocked word on its own, or beside an allowed one, is refused.
  for (const name of [
    'shit',
    'shitty',
    'admin',
    'シネマしね',
    'badmintonadmin',
  ])
    rejected(name);
});

test('cutting out an allowed word never joins its neighbours into a blocked one', () => {
  assert.equal(screenedKey('しシネマね'), 'し|ね');
  accepted('しシネマね', ['しね']);
  // The cut is only where the allowed word is; the rest is still checked.
  rejected('シネマしね', ['しね']);
});

test('organiser lists add blocked and allowed words', () => {
  rejected('禁止見本さん', ['禁止見本']);
  rejected('ホゲタロウ', ['ほげ']);
  accepted('ホゲタロウ', ['ほげ'], ['ほげたろう']);
});
