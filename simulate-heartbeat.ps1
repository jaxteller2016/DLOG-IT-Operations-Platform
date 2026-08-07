param(
  [string]$BaseUrl = "http://192.168.100.5:5000",
  [string]$Email = "admin@example.com",
  [string]$Password = "Admin123!",
  [string]$AssetId,
  [string]$SerialNumber,
  [string]$IpAddress,
  [string]$MacAddress,
  [string]$OperatingSystem,
  [int]$CpuUsage = 42,
  [int]$MemoryUsage = 71,
  [int]$DiskFreePercent = 12,
  [ValidateSet("ok", "failed")][string]$BackupStatus = "failed",
  [int]$IntervalSeconds = 0
)

$ErrorActionPreference = "Stop"

function Resolve-ApiBaseUrl {
  param(
    [string]$Base
  )

  $normalizedBase = $Base.TrimEnd('/')
  $candidates = @()

  if ($normalizedBase.EndsWith('/api')) {
    $candidates += $normalizedBase
  } else {
    $candidates += $normalizedBase
    $candidates += "$normalizedBase/api"
  }

  foreach ($candidate in $candidates) {
    try {
      $probeBody = @{ email = $Email; password = $Password } | ConvertTo-Json
      $response = Invoke-RestMethod -Method Post -Uri "$candidate/auth/login" -ContentType "application/json" -Body $probeBody
      if ($response.token) {
        return @{ ApiBaseUrl = $candidate; LoginResponse = $response }
      }
    } catch {
      continue
    }
  }

  throw "Login failed. The server did not return a valid auth response from either $normalizedBase/auth/login or $normalizedBase/api/auth/login"
}

function Get-DefaultSerialNumber {
  try {
    $bios = Get-CimInstance -ClassName Win32_BIOS
    if ($bios.SerialNumber) { return $bios.SerialNumber.Trim() }
  } catch {}
  return "UNKNOWN-SERIAL"
}

function Get-DefaultIpAddress {
  try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" } |
      Sort-Object InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($ip) { return $ip }
  } catch {}
  return "192.168.20.45"
}

function Get-DefaultMacAddress {
  try {
    $mac = Get-NetAdapter |
      Where-Object { $_.Status -eq "Up" -and $_.MacAddress } |
      Select-Object -First 1 -ExpandProperty MacAddress
    if ($mac) { return $mac.Replace('-', ':') }
  } catch {}
  return "00:00:00:00:00:00"
}

function Get-DefaultOperatingSystem {
  try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    if ($os.Caption -and $os.Version) { return "$($os.Caption) $($os.Version)" }
    if ($os.Caption) { return $os.Caption }
  } catch {}
  return "Windows"
}

function Get-AutoAssetId {
  param(
    [string]$Serial,
    [string]$Mac
  )

  if ($Serial) {
    $serialClean = ($Serial -replace '[^A-Za-z0-9]', '')
    if ($serialClean) { return "HB-$serialClean" }
  }

  if ($Mac) {
    $macClean = ($Mac -replace '[^A-Za-z0-9]', '')
    if ($macClean) { return "HB-$macClean" }
  }

  return "HB-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
}

if (-not $SerialNumber) { $SerialNumber = Get-DefaultSerialNumber }
if (-not $IpAddress) { $IpAddress = Get-DefaultIpAddress }
if (-not $MacAddress) { $MacAddress = Get-DefaultMacAddress }
if (-not $OperatingSystem) { $OperatingSystem = Get-DefaultOperatingSystem }
if (-not $AssetId) { $AssetId = Get-AutoAssetId -Serial $SerialNumber -Mac $MacAddress }

$apiResolution = Resolve-ApiBaseUrl -Base $BaseUrl
$ApiBaseUrl = $apiResolution.ApiBaseUrl
$loginResponse = $apiResolution.LoginResponse
$token = $loginResponse.token

if (-not $token) {
  throw "Login failed. No token returned."
}

$headers = @{ Authorization = "Bearer $token" }

Write-Host "Authenticated to $ApiBaseUrl as $Email"
Write-Host "Sending heartbeats for asset $AssetId"
Write-Host "Serial: $SerialNumber | IP: $IpAddress | MAC: $MacAddress | OS: $OperatingSystem"

function Send-Heartbeat {
  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

  $payload = @{
    assetId = $AssetId
    serialNumber = $SerialNumber
    timestamp = $timestamp
    ipAddress = $IpAddress
    macAddress = $MacAddress
    operatingSystem = $OperatingSystem
    cpuUsage = $CpuUsage
    memoryUsage = $MemoryUsage
    diskFreePercent = $DiskFreePercent
    backupStatus = $BackupStatus
  } | ConvertTo-Json

  $response = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/monitoring/heartbeat" -Headers $headers -ContentType "application/json" -Body $payload
  $alertCount = if ($response.alerts) { $response.alerts.Count } else { 0 }

  Write-Host "[$timestamp] Heartbeat sent for asset $AssetId. Alerts returned: $alertCount"
  if ($alertCount -gt 0) {
    foreach ($alert in $response.alerts) {
      Write-Host "  - $($alert.type): $($alert.message)"
    }
  }
}

if ($IntervalSeconds -le 0) {
  Send-Heartbeat
  exit 0
}

Write-Host "Repeating every $IntervalSeconds second(s). Press Ctrl+C to stop."
while ($true) {
  Send-Heartbeat
  Start-Sleep -Seconds $IntervalSeconds
}
