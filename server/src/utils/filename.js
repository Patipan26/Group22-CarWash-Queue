function decodeMultipartFilename(value) {
  const filename = String(value || '');
  const hasDecodedUnicode = Array.from(filename).some((character) => character.codePointAt(0) > 0xff);
  if (hasDecodedUnicode) return filename;

  const decoded = Buffer.from(filename, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? filename : decoded;
}

module.exports = { decodeMultipartFilename };
