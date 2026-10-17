$targets = @(
  'C:\Users\abdul\OneDrive\Desktop\Dev.Seiko\suhoor\suhoor-native\node_modules\@react-native-async-storage\async-storage\android\build',
  'C:\Users\abdul\OneDrive\Desktop\Dev.Seiko\suhoor\suhoor-native\node_modules\@react-native-community\geolocation\android\build',
  'C:\Users\abdul\OneDrive\Desktop\Dev.Seiko\suhoor\suhoor-native\node_modules\@react-native-community\netinfo\android\build'
)
foreach ($t in $targets) {
  if (-not (Test-Path $t)) { Write-Output ("gone " + $t); continue }
  try {
    Remove-Item $t -Recurse -Force -ErrorAction Stop
    Write-Output ("deleted " + $t)
  } catch {
    Write-Output ("LOCKED " + $t)
  }
}
