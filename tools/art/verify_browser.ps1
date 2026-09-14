# Requires the local preview server at 127.0.0.1:8011; changes only its temporary demo state.
# This companion avoids Windows .cmd multiline/double-quote argument mangling.
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..\..')
try {
    npx --yes --package @playwright/cli playwright-cli -s=urban open http://127.0.0.1:8011
    if ($LASTEXITCODE -ne 0) { throw 'Could not open preview browser' }
    $visualCheck = ((Get-Content (Join-Path $PSScriptRoot 'verify_browser.js') |
        Where-Object { $_ -notmatch '^\s*//' }) -join ' ').Replace([char]34, [char]39)
    npx --yes --package @playwright/cli playwright-cli -s=urban run-code $visualCheck
    if ($LASTEXITCODE -ne 0) { throw 'Visual browser verification failed' }
} finally {
    Pop-Location
}
