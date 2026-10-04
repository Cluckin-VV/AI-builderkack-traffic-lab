param(
    [int]$Port = 8021
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
$server = $null
try {
    $env:AI_BUILDER_PORT = "$Port"
    $server = Start-Process -FilePath 'python' -ArgumentList '-m', 'ai_builder.server' -WorkingDirectory $repo -WindowStyle Hidden -PassThru
    $health = "http://127.0.0.1:$Port/health"
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri $health -TimeoutSec 2
            if ($response.app_version) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw "Local server did not become ready at $health" }

    npx --yes --package @playwright/cli playwright-cli -s=judge-demo open "http://127.0.0.1:$Port/"
    if ($LASTEXITCODE -ne 0) { throw 'Could not open the judge demo browser' }
    $phaseFiles = @(
        'tools/judge-demo-v06-phase1.js',
        'tools/judge-demo-v06-phase2.js',
        'tools/judge-demo-v06-phase3.js'
    )
    foreach ($phaseFile in $phaseFiles) {
        $phaseCode = ((Get-Content (Join-Path $repo $phaseFile) |
            Where-Object { $_ -notmatch '^\s*//' }) -join ' ').Replace([char]34, [char]39)
        npx --yes --package @playwright/cli playwright-cli -s=judge-demo run-code $phaseCode
        if ($LASTEXITCODE -ne 0) { throw "Judge demo browser flow failed at $phaseFile" }
    }
    # The expected unsupported-intent preview returns HTTP 422. Each phase
    # asserts real page/console errors while filtering that intentional rejection;
    # do not print the raw accumulated console buffer as a failure summary.
    if ($LASTEXITCODE -ne 0) { throw 'Could not read judge demo console' }
} finally {
    npx --yes --package @playwright/cli playwright-cli -s=judge-demo close 2>$null
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id }
    Remove-Item Env:AI_BUILDER_PORT -ErrorAction SilentlyContinue
    Pop-Location
}
