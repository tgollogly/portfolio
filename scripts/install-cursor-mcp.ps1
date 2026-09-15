# Install Cloudflare MCP servers to USER scope (%USERPROFILE%\.cursor\mcp.json).
# Project .cursor/mcp.json often does NOT appear in Customize -> MCPs (Cursor bug).
param(
    [switch]$Force
)

$Source = Join-Path $PSScriptRoot "cursor-mcp-user.json"
$TargetDir = Join-Path $env:USERPROFILE ".cursor"
$Target = Join-Path $TargetDir "mcp.json"

if (-not (Test-Path $Source)) {
    Write-Error "Missing $Source"
    exit 1
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

if ((Test-Path $Target) -and -not $Force) {
    $backup = "$Target.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $Target $backup
    Write-Host "Backed up existing config to $backup"
}

Copy-Item $Source $Target -Force
Write-Host "Installed $Target"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Fully QUIT Cursor (not just Reload Window)"
Write-Host "  2. Reopen this repo (File -> Open Folder)"
Write-Host "  3. Customize -> MCPs — servers should appear under USER"
Write-Host "  4. Enable cloudflare-docs first (no login), then authenticate others"
