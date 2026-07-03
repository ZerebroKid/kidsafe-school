# Runs the Zumi LiveKit agent worker in an auto-restart loop.
# The livekit-rtc native layer panics on some client disconnects
# ("malformed serialized RtcError"), which kills the worker. This loop brings
# it right back so a fresh session always has an agent available.
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
while ($true) {
  Add-Content -Path "agent-loop.log" -Value "=== starting agent $(Get-Date -Format o) ==="
  & $py agent.py dev *>> "agent-loop.log"
  Add-Content -Path "agent-loop.log" -Value "=== agent exited (code=$LASTEXITCODE); restarting in 2s ==="
  Start-Sleep -Seconds 2
}
