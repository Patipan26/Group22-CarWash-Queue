const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sendPrivateUpload } = require('../src/middleware/privateUpload');

function response() {
  return {
    statusCode: 200,
    body: null,
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.headersSent = true; return this; },
    sendFile(filename, options, callback) { this.file = { filename, options }; callback?.(null); return this; }
  };
}

describe('private upload delivery', () => {
  it('rejects traversal paths and public URL paths without attempting file access', () => {
    for (const unsafePath of ['/uploads/../../etc/passwd', '/uploads/avatar.png', 'C:\\secret.pdf', null]) {
      const res = response();
      sendPrivateUpload(res, unsafePath);
      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /ไม่พบไฟล์แนบ/);
      assert.equal(res.file, undefined);
    }
  });

  it('serves approved image extensions inline with private no-store security headers', () => {
    const res = response();
    sendPrivateUpload(res, '/uploads/1731123456789-123456.jpg');
    assert.equal(res.file.filename, '1731123456789-123456.jpg');
    assert.equal(res.file.options.dotfiles, 'deny');
    assert.equal(res.file.options.headers['Cache-Control'], 'private, no-store');
    assert.equal(res.file.options.headers['X-Content-Type-Options'], 'nosniff');
    assert.match(res.file.options.headers['Content-Disposition'], /^inline/);
  });

  it('forces PDF attachments to download and maps missing-file errors to 404', () => {
    const res = response();
    sendPrivateUpload(res, '/uploads/1731123456789-123456.pdf');
    assert.match(res.file.options.headers['Content-Disposition'], /^attachment/);
    const missing = response();
    missing.sendFile = (_filename, _options, callback) => { callback({ statusCode: 404 }); };
    sendPrivateUpload(missing, '/uploads/1731123456789-123456.png');
    assert.equal(missing.statusCode, 404);
    assert.match(missing.body.message, /ไม่พบไฟล์แนบ/);
  });

  it('returns a controlled server error if an approved file cannot be opened', () => {
    const res = response();
    res.sendFile = (_filename, _options, callback) => { callback({ statusCode: 500 }); };
    sendPrivateUpload(res, '/uploads/1731123456789-123456.webp');
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /เปิดไฟล์แนบไม่ได้/);
  });
});
