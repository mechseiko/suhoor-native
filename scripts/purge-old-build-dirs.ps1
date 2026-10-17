# Remove stale OneDrive-side gradle build dirs (superseded by C:\AndroidBuilds relocation)
$root = 'C:\Users\abdul\OneDrive\Desktop\Dev.Seiko\suhoor\suhoor-native'
$targets = Get-ChildItem $root -Recurse -Directory -Filter 'build' -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\\android\\build$' }
Write-Output ("found " + @($targets).Count + " stale android build dirs")
foreach ($t in $targets) {
  try {
    Remove-Item $t.FullName -Recurse -Force -ErrorAction Stop
    Write-Output ("deleted " + $t.FullName)
  } catch {
    Write-Output ("LOCKED  " + $t.FullName)
  }
}
$locked = @($targets | Where-Object { Test-Path $_.FullName }).Count
Write-Output ("remaining " + $locked)
 