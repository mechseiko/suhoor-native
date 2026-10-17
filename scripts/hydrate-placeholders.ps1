# Hydrate OneDrive placeholder files: byte-rewrite reparse-point files into regular files.
# Usage: powershell -File hydrate-placeholders.ps1 <root> [-Fix]
param(
  [Parameter(Mandatory=$true)][string]$Root,
  [switch]$Fix
)
$rows = [System.Collections.Generic.List[object]]::new()
Get-ChildItem -LiteralPath $Root -Recurse -File -Force -ErrorAction SilentlyContinue |
  Where-Object { ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 } |
  ForEach-Object {
    $rows.Add($_.FullName)
    if ($Fix) {
      try {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        [System.IO.File]::WriteAllBytes($_.FullName, $bytes)
      } catch {
        Write-Output ("FAILED: " + $_.FullName + " :: " + $_.Exception.Message)
      }
    }
  }
Write-Output ("count=" + $rows.Count)
$rows | Select-Object -First 20 | ForEach-Object { Write-Output $_ }
