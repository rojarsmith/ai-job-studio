import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTitleFilter } from '../lib/titlefilter.mjs';

const ok = makeTitleFilter({
  title_include: ['software|軟體|AI|engineering|研發', 'director|manager|head|副總|處長|經理|主管'],
  title_exclude: ['sales|業務|採購|儲備|intern'],
});

test('every include entry must match, case-insensitively', () => {
  assert.equal(ok('Director of Software Engineering'), true);
  assert.equal(ok('研發部經理'), true);
  assert.equal(ok('Software Engineer'), false);      // role family but no level
  assert.equal(ok('Regional Manager'), false);       // level but no role family
});
test('any exclude match drops the title', () => {
  assert.equal(ok('Software Sales Manager'), false);
  assert.equal(ok('儲備軟體經理'), false);
});
test('no lists keep everything', () => {
  assert.equal(makeTitleFilter({})('anything'), true);
  assert.equal(makeTitleFilter()(''), true);
});
