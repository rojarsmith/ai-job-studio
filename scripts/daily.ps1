# Daily 08:00 job (design section 8): S1 discover → S2 prep → S2 score (LLM, optional) → S2 apply → status.
# Register with Task Scheduler:
#   schtasks /Create /TN "job-loop-daily" /SC DAILY /ST 08:00 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\my\build\github\ai-job-studio\scripts\daily.ps1"
# Flags: -NoLlm skips the Claude Code scoring step; -Recheck runs liveness on old open rows.
param([switch]$NoLlm, [switch]$Recheck)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$log = Join-Path $root 'data\daily.log'
function Log($m) { $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"; Write-Host $line; Add-Content -Path $log -Value $line }

Log '== daily start =='
$discoverArgs = @('scripts/discover.mjs'); if ($Recheck) { $discoverArgs += '--recheck' }
node @discoverArgs 2>&1 | Tee-Object -FilePath $log -Append
node scripts/score-prep.mjs 2>&1 | Tee-Object -FilePath $log -Append

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $NoLlm -and $claude) {
  Log 'scoring with Claude Code (modes/score.md)'
  $prompt = Get-Content (Join-Path $root 'modes\score.md') -Raw
  & claude -p $prompt --permission-mode acceptEdits --allowedTools 'Read,Edit,Write,Glob,Grep,Bash(node scripts/score-apply.mjs)' 2>&1 | Tee-Object -FilePath $log -Append
} elseif (-not $NoLlm) {
  Log 'claude CLI not found; reports left with score: null. Run modes/score.md inside Claude Code, then node scripts/score-apply.mjs'
}
node scripts/score-apply.mjs 2>&1 | Tee-Object -FilePath $log -Append
node scripts/status.mjs 2>&1 | Tee-Object -FilePath $log -Append
Log '== daily end =='
