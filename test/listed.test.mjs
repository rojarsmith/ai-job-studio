import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, makeListedCheck } from '../lib/listed.mjs';

test('normalizeName unifies 臺/台 and drops the legal-form suffix', () => {
  assert.equal(normalizeName('臺灣水泥股份有限公司'), normalizeName('台灣水泥(股)公司'));
  assert.equal(normalizeName(' Foo Co. '), 'fooco.');
});

test('listed check matches full or short names and either half of an underscore-joined name', () => {
  const isListed = makeListedCheck(['台達電子工業股份有限公司', '宏碁', '臺灣水泥股份有限公司']);
  assert.equal(isListed('台達電子工業股份有限公司'), true);
  assert.equal(isListed('宏碁股份有限公司'), true);
  assert.equal(isListed('Acme Ltd_台灣水泥股份有限公司'), true);
  assert.equal(isListed('某某新創股份有限公司'), false);
  assert.equal(isListed(''), false);
});
