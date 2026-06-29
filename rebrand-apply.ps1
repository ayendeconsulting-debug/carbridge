<#
  rebrand-apply.ps1 - swap the visible "CarBridge" wordmark/copy -> "Ayende Autos".

  Surface-only and idempotent. Case-sensitive blanket swap across the 9 UI files
  (so the lowercase @carbridge/* imports and CB_* env keys are never touched),
  plus a best-effort strip of the "Working title - brand TBD" footer badge.

  This file is PURE ASCII: the few non-ASCII glyphs (middle dot, em dash) are
  built from code points at runtime, so it parses the same on Windows PowerShell
  5.1 (ANSI) and PowerShell 7 (UTF-8). File IO is UTF-8 so the .tsx contents are
  read/written correctly regardless. Safe to run more than once.
#>
$ErrorActionPreference = "Stop"
$root = "C:\Dev\carbridge"

$mid  = [char]0x00B7   # middle dot
$dash = [char]0x2014   # em dash

# Footer badge to remove from Landing.tsx (built from code points, no literals).
$badge = " " + $mid + " <b>Working title " + $dash + " brand TBD</b>"

$targets = @(
  'apps\web\app\(shop)\upgrade\page.tsx',
  'apps\web\app\layout.tsx',
  'apps\web\components\AdminConsole.tsx',
  'apps\web\components\AdminGate.tsx',
  'apps\web\components\AdminTabs.tsx',
  'apps\web\components\AppHeader.tsx',
  'apps\web\components\DetailClient.tsx',
  'apps\web\components\Landing.tsx',
  'apps\web\lib\payments\index.ts'
)

$enc = New-Object System.Text.UTF8Encoding($false)   # UTF-8, no BOM
$changed = 0
foreach ($rel in $targets) {
  $path = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $path)) { Write-Warning "skip (not found): $rel"; continue }
  $text   = [System.IO.File]::ReadAllText($path, $enc)
  $before = $text
  $text   = $text.Replace($badge, "")            # strip footer badge (Landing only; no-op elsewhere)
  $text   = $text.Replace("CarBridge", "Ayende Autos")   # case-sensitive brand swap
  if ($text -ne $before) {
    [System.IO.File]::WriteAllText($path, $text, $enc)
    Write-Host "updated:   $rel" -ForegroundColor Green
    $changed++
  } else {
    Write-Host "no change: $rel" -ForegroundColor DarkGray
  }
}
Write-Host ""
Write-Host "$changed file(s) updated." -ForegroundColor Cyan
Write-Host "Watchpoint: 'Ayende Autos' is wider than 'CarBridge' -- eyeball the header/landing wordmark on mobile after build (ping me for a CSS tweak if it wraps)." -ForegroundColor Yellow
