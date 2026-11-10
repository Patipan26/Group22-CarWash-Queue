const fs = require('node:fs');
const path = require('node:path');

const project = process.argv[2];
if (!['client', 'server'].includes(project)) {
  console.error('Usage: node normalize-lcov.cjs <client|server>');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const reportPath = path.join(repoRoot, project, 'coverage', 'lcov.info');
if (!fs.existsSync(reportPath)) {
  console.error(`Coverage report not found: ${reportPath}`);
  process.exit(1);
}

const report = fs.readFileSync(reportPath, 'utf8');
const normalized = report.replace(/^SF:(.+)$/gm, (_line, sourcePath) => {
  const absoluteSource = path.isAbsolute(sourcePath)
    ? path.normalize(sourcePath)
    : path.resolve(repoRoot, project, sourcePath);
  const relativeSource = path.relative(repoRoot, absoluteSource).split(path.sep).join('/');
  return `SF:${relativeSource}`;
});

fs.writeFileSync(reportPath, normalized);
