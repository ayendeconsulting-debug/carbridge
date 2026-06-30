<#
  emdash-clean.ps1 - replace em-dashes (U+2014) with a plain hyphen across all
  .ts/.tsx in the repo. Prose em-dashes are written " - " (the dash already has
  spaces around it), so they become a clean spaced hyphen; the rare no-space
  case becomes a plain hyphen. En-dashes (range "1-5 wk") and arrows are left
  alone. Pure ASCII (the em-dash is built from its code point) so it parses on
  Windows PowerShell 5.1 and 7 alike; reads/writes UTF-8 (no BOM). Idempotent.

  Run AFTER extracting the feature zip, so it also cleans anything it ships.
#>
$ErrorActionPreference = "Stop"
$root = "C:\Dev\carbridge"
$em = [char]0x2014   # em dash

$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx |
  Where-Object { $_.FullName -notmatch '\\(node_modules|\.next|dist|\.git)\\' }

$enc = New-Object System.Text.UTF8Encoding($false)   # UTF-8, no BOM
$changed = 0
foreach ($f in $files) {
  $text = [System.IO.File]::ReadAllText($f.FullName, $enc)
  if ($text.IndexOf($em) -ge 0) {
    [System.IO.File]::WriteAllText($f.FullName, $text.Replace($em, "-"), $enc)
    Write-Host ("cleaned: " + $f.FullName.Substring($root.Length + 1)) -ForegroundColor Green
    $changed++
  }
}
Write-Host ""
Write-Host "$changed file(s) had em-dashes replaced with '-'." -ForegroundColor Cyan
