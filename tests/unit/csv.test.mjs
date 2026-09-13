import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, csvDocument } from '../../lib/csv.ts';

test('values a spreadsheet would run as a formula are neutralised', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-2', '@cmd', '\tx', '\rx', '\nx'])
    assert.equal(csvCell(value), `"'${value}"`);
});

test('quotes are doubled and empty values stay empty', () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(12), '"12"');
});

test('the document has a BOM and CRLF rows', () => {
  assert.equal(
    csvDocument([
      ['a', 1],
      ['b', null],
    ]),
    '﻿"a","1"\r\n"b",""',
  );
});
