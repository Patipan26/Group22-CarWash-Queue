const path = require('path');

const uploadDirectory = path.resolve(__dirname, '../../uploads');
const storedUploadPattern = /^\/uploads\/([0-9]+-[0-9]+\.(?:jpe?g|png|webp|pdf))$/i;

function sendPrivateUpload(res, storedPath) {
  const match = String(storedPath || '').match(storedUploadPattern);
  if (!match) return res.status(404).json({ message: 'ไม่พบไฟล์แนบ' });

  const filename = match[1];
  const isPdf = path.extname(filename).toLowerCase() === '.pdf';
  return res.sendFile(filename, {
    root: uploadDirectory,
    dotfiles: 'deny',
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': `${isPdf ? 'attachment' : 'inline'}; filename="${filename}"`
    }
  }, (error) => {
    if (error && !res.headersSent) {
      res.status(error.statusCode === 404 ? 404 : 500).json({
        message: error.statusCode === 404 ? 'ไม่พบไฟล์แนบ' : 'เปิดไฟล์แนบไม่ได้'
      });
    }
  });
}

module.exports = { sendPrivateUpload };
