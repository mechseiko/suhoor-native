Start-Process -FilePath "$env:LocalAppData\Microsoft\OneDrive\OneDrive.exe"
Start-Sleep -Seconds 3
$p = Get-Process OneDrive -ErrorAction SilentlyContinue
if ($p) { Write-Output ("OneDrive running pid " + $p.Id) } else { Write-Output "OneDrive NOT running" }
