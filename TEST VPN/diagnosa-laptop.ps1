# Diagnosa VPN di laptop ini (hanya baca, tidak mengubah apa pun, tidak mencetak key/sertifikat).
# Jalankan:  powershell -ExecutionPolicy Bypass -File ".\TEST VPN\diagnosa-laptop.ps1" [-SshHost 10.x.x.x] [-SshPort 22]
param([string]$Ovpn = "$PSScriptRoot\kp-la-2.ovpn", [string]$SshHost = "", [int]$SshPort = 22)

Write-Host "== 1. Target remote di profil ==" -ForegroundColor Cyan
$proto = 'udp'; $remotes = @(); $inBlock = $false
foreach ($l in Get-Content $Ovpn) {
  $t = $l.Trim()
  if (-not $t -or $t.StartsWith('#') -or $t.StartsWith(';')) { continue }
  if ($t.StartsWith('</')) { $inBlock = $false; continue }
  if ($t.StartsWith('<'))  { $inBlock = $true;  continue }
  if ($inBlock) { continue }
  $p = $t -split '\s+'
  if ($p[0] -eq 'proto' -and $p.Count -gt 1) { $proto = $p[1] }
  if ($p[0] -eq 'remote' -and $p.Count -gt 1) {
    $remotes += [pscustomobject]@{ Host = $p[1]; Port = $(if ($p.Count -gt 2) { [int]$p[2] } else { 1194 }); Proto = $(if ($p.Count -gt 3) { $p[3] } else { $proto }) }
  }
}
$remotes | Format-Table -AutoSize

Write-Host "== 2. Jangkauan TCP dari jaringan laptop SAAT INI ==" -ForegroundColor Cyan
foreach ($r in $remotes) {
  if ($r.Proto -like 'tcp*') {
    $ok = Test-NetConnection -ComputerName $r.Host -Port $r.Port -WarningAction SilentlyContinue
    "{0}:{1} -> {2}" -f $r.Host, $r.Port, $(if ($ok.TcpTestSucceeded) { 'TERJANGKAU' } else { 'TIDAK TERJANGKAU' })
  } else { "{0}:{1} (udp) -> tidak bisa dites dengan TCP" -f $r.Host, $r.Port }
}
Write-Host "IP publik/jaringan laptop saat ini:" -ForegroundColor Cyan
try { (Invoke-RestMethod https://api.ipify.org) } catch { "(gagal cek)" }

Write-Host "== 3. Adapter VPN aktif ==" -ForegroundColor Cyan
Get-NetAdapter | Where-Object { $_.InterfaceDescription -match 'TAP|Wintun|OpenVPN|WireGuard' } | Format-Table Name, InterfaceDescription, Status -AutoSize
Write-Host "Proses OpenVPN:" -ForegroundColor Cyan
Get-Process | Where-Object { $_.Name -match 'openvpn' } | Select-Object Name, Id | Format-Table -AutoSize

if ($SshHost) {
  Write-Host "== 4. SSH ke ${SshHost}:$SshPort (jalankan SETELAH OpenVPN tersambung) ==" -ForegroundColor Cyan
  $s = Test-NetConnection -ComputerName $SshHost -Port $SshPort -WarningAction SilentlyContinue
  "SSH port -> " + $(if ($s.TcpTestSucceeded) { 'TERJANGKAU (Termius seharusnya bisa)' } else { 'TIDAK TERJANGKAU' })
}
Write-Host "`nSelesai. Salin hasil ini ke Claude (tanpa isi file .ovpn)." -ForegroundColor Green
