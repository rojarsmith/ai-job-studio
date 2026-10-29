# Weekly job (design section 8, Monday): S7 follow-up drafts, S6 ghosting sweep, S9 retro, session health.
#   schtasks /Create /TN "job-loop-weekly" /SC WEEKLY /D MON /ST 09:00 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\path\to\ai-job-studio\scripts\weekly.ps1 -Workspace D:\private\job-workspace"
param([string]$Workspace, [switch]$NoLlm)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if ($Workspace) { $env:JOB_WORKSPACE = $Workspace }
$ws = (& node scripts/workspace.mjs path 2>$null | Select-Object -First 1)
if (-not $ws) { Write-Error 'cannot resolve workspace'; exit 1 }
$log = Join-Path $ws 'data\weekly.log'
function Log($m) { $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"; Write-Host $line; Add-Content -Path $log -Value $line }

Log "== weekly start (workspace: $ws) =="
& node scripts/track.mjs --mark-ghosted 2>&1 | Tee-Object -FilePath $log -Append
& node scripts/followup.mjs 2>&1 | Tee-Object -FilePath $log -Append
& node scripts/retro.mjs 2>&1 | Tee-Object -FilePath $log -Append

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $NoLlm -and $claude) {
  foreach ($mode in @('followup', 'retro')) {
    Log "running modes/$mode.md"
    $prompt = Get-Content (Join-Path $root "modes\$mode.md") -Raw
    & claude -p $prompt --permission-mode acceptEdits --add-dir $ws --allowedTools 'Read,Edit,Write,Glob,Grep' 2>&1 | Tee-Object -FilePath $log -Append
  }
}
& node scripts/track.mjs 2>&1 | Tee-Object -FilePath $log -Append
& node scripts/status.mjs 2>&1 | Tee-Object -FilePath $log -Append
Log 'sessions: run  node scripts/prepare.mjs <site> --check  for any site the retro flags as stale'
Log '== weekly end =='
