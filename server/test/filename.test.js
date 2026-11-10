const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { decodeMultipartFilename } = require('../src/utils/filename');

describe('decodeMultipartFilename', () => {
  it('returns an empty string for a missing filename', () => {
    assert.equal(decodeMultipartFilename(undefined), '');
    assert.equal(decodeMultipartFilename(null), '');
  });

  it('preserves filenames already decoded as Unicode', () => {
    assert.equal(decodeMultipartFilename('หลักฐานการชำระ.pdf'), 'หลักฐานการชำระ.pdf');
  });

  it('decodes UTF-8 bytes that arrived as Latin-1 characters', () => {
    const original = 'หลักฐาน.pdf';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');
    assert.equal(decodeMultipartFilename(mojibake), original);
  });

  it('keeps the original value when decoding would introduce replacement characters', () => {
    assert.equal(decodeMultipartFilename('\xff-slip.jpg'), '\xff-slip.jpg');
  });
});
