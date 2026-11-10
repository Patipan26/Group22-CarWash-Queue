const { before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let options;
let uploadModule;

before(() => {
  const multerPath = require.resolve('multer');
  const uploadPath = require.resolve('../src/middleware/upload');
  const previousMulter = require.cache[multerPath];
  delete require.cache[uploadPath];
  require.cache[multerPath] = {
    id: multerPath,
    filename: multerPath,
    loaded: true,
    exports: Object.assign((config) => {
      options = config;
      return { single: (field) => ({ field }) };
    }, { diskStorage: (storage) => storage })
  };
  try {
    uploadModule = require(uploadPath);
  } finally {
    if (previousMulter) require.cache[multerPath] = previousMulter;
    else delete require.cache[multerPath];
  }
});

describe('contact attachment upload middleware', () => {
  it('limits uploaded files to 5 MB', () => {
    assert.equal(options.limits.fileSize, 5 * 1024 * 1024);
    assert.deepEqual(uploadModule.single('attachment'), { field: 'attachment' });
  });

  it('allows only image and PDF attachment MIME types', () => {
    for (const mimetype of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      let result;
      options.fileFilter({}, { mimetype }, (_error, accepted) => { result = accepted; });
      assert.equal(result, true, `${mimetype} should be accepted`);
    }
    for (const mimetype of ['text/plain', 'application/zip', 'image/svg+xml', 'application/octet-stream']) {
      let result;
      options.fileFilter({}, { mimetype }, (_error, accepted) => { result = accepted; });
      assert.equal(result, false, `${mimetype} should be rejected`);
    }
  });

  it('stores uploads under the private uploads directory', () => {
    let destination;
    options.storage.destination({}, {}, (_error, value) => { destination = value; });
    assert.equal(destination, path.join(__dirname, '../uploads'));
  });

  it('uses randomized names and extensions derived from the validated MIME type', () => {
    for (const [mimetype, extension] of [
      ['image/jpeg', '.jpg'], ['image/png', '.png'],
      ['image/webp', '.webp'], ['application/pdf', '.pdf'],
      ['application/unknown', '.bin']
    ]) {
      let filename;
      options.storage.filename({}, { mimetype }, (_error, value) => { filename = value; });
      assert.match(filename, new RegExp(`^[0-9]+-[a-f0-9]{32}\\${extension}$`));
    }
  });
});
