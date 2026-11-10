$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $repoRoot 'client')
try {
  npm run test:coverage
  if ($LASTEXITCODE -ne 0) { throw 'Client coverage run failed.' }
}
finally {
  Pop-Location
}

Push-Location (Join-Path $repoRoot 'server')
try {
  npm run test:coverage
  if ($LASTEXITCODE -ne 0) { throw 'Server coverage run failed.' }
}
finally {
  Pop-Location
}

Write-Host 'Coverage reports created at client/coverage/lcov.info and server/coverage/lcov.info.'
