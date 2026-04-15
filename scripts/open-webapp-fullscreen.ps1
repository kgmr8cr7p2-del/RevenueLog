param(
  [Parameter(Mandatory = $true)]
  [string]$Url
)

$browserPaths = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($browser) {
  Start-Process -FilePath $browser -ArgumentList @('--start-fullscreen', $Url)
  exit 0
}

Start-Process $Url
