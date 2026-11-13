import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWish, validKey, validMonthSlot } from './validate.js';

test('validateWish', () => {
  assert.deepEqual(validateWish({ name: '  Bà  nội ', message: 'Chúc cháu ngoan', color: 'xanh' }).wish, { name: 'Bà nội', message: 'Chúc cháu ngoan', color: 'xanh' });
  assert.equal(validateWish({ name: 'A', message: 'Chúc cháu', color: 'tím' }).wish.color, 'dao');
  assert.ok(validateWish({ name: '', message: 'Chúc cháu ngoan' }).error);
  assert.ok(validateWish({ name: 'A', message: 'hi' }).error);
  assert.equal(validateWish({ name: 'A', message: 'Chúc cháu ngoan', website: 'x' }).error, 'spam');
  assert.equal(validateWish({ name: 'A', message: 'x'.repeat(900) }).wish.message.length, 500);
  assert.ok(validateWish(null).error);
});

test('validKey / validMonthSlot', () => {
  assert.ok(validKey('p/123e4567-e89b-12d3-a456-426614174000.webp'));
  assert.ok(!validKey('../secret'));
  assert.ok(!validKey('p/abc.webp'));
  assert.ok(validMonthSlot(12, 3));
  assert.ok(!validMonthSlot(13, 1));
  assert.ok(!validMonthSlot(1, 0));
});

import { parseRange } from './validate.js';
test('parseRange', () => {
  assert.deepEqual(parseRange('bytes=0-9'), { offset: 0, length: 10 });
  assert.deepEqual(parseRange('bytes=100-'), { offset: 100 });
  assert.deepEqual(parseRange('bytes=-500'), { suffix: 500 });
  assert.equal(parseRange('bytes=9-1'), null);
  assert.equal(parseRange('bytes=0-1,5-9'), null);
  assert.equal(parseRange(null), null);
});

import { hasBadWords } from './validate.js';
test('hasBadWords', () => {
  assert.ok(hasBadWords('đồ ĐM nhà mày'));
  assert.ok(hasBadWords('vcl!!!'));
  assert.ok(!hasBadWords('Chúc Mỡ lớn khôn, mau ăn chóng lớn'));
  assert.ok(!hasBadWords('Chúc cháu ngoan, đi học giỏi, lễ phép'));
  assert.ok(!hasBadWords('Đừng quên ăn đủ bữa'));
});
