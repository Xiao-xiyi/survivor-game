# ============================================
# 一键发布：把 build\web-desktop 部署到 docs/ 并推送 GitHub
# 用法：
#   pwsh deploy.ps1                 （默认提交信息）
#   pwsh deploy.ps1 -Msg "deploy: 加了新敌人"
# ============================================
param([string]$Msg = "deploy: 更新在线试玩")

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# 0. 先确认构建产物在不在
if (-not (Test-Path 'build\web-desktop\index.html')) {
    Write-Host 'X 没找到 build\web-desktop，先在 Cocos 里点一次【构建发布】！' -ForegroundColor Red
    exit 1
}

# 1. 备份 3 个"手工定制"文件（构建产物里没有它们/会被覆盖）
$keepHtml  = if (Test-Path 'docs\index.html')  { Get-Content 'docs\index.html' -Raw } else { $null }
$keepCss   = if (Test-Path 'docs\style.css')   { Get-Content 'docs\style.css'  -Raw } else { $null }
$hadJekyll = Test-Path 'docs\.nojekyll'

# 2. 把构建产物整目录镜像进 docs（多出来的删掉，改动的覆盖）
robocopy 'build\web-desktop' 'docs' /MIR /NFL /NDL /NJH /NP
if ($LASTEXITCODE -ge 8) { Write-Host "X robocopy 失败 code=$LASTEXITCODE" -ForegroundColor Red; exit 1 }

# 3. 还原定制文件
if ($keepHtml  -ne $null) { Set-Content -Path 'docs\index.html' -Value $keepHtml  -NoNewline }
if ($keepCss   -ne $null) { Set-Content -Path 'docs\style.css'  -Value $keepCss   -NoNewline }
if ($hadJekyll)           { New-Item -Path 'docs\.nojekyll' -ItemType File -Force | Out-Null }

# 4. settings.json 每次构建都会把 exactFitScreen 重置成 false，重新打开
$sp = 'docs\src\settings.json'
if (Test-Path $sp) {
    $j = Get-Content $sp -Raw
    $j = $j -replace '"exactFitScreen"\s*:\s*false', '"exactFitScreen": true'
    [System.IO.File]::WriteAllText((Resolve-Path $sp).Path, $j)
}

# 5. 提交 + 推送（没变化就不推）
git add -A
$st = git status --short
if (-not $st) {
    Write-Host 'OK 没有变化：这次构建和线上已经一样，无需推送。' -ForegroundColor Green
} else {
    git commit -m $Msg | Out-Host
    git push
    Write-Host 'OK 已推送！等 1~2 分钟，到线上页面按 Ctrl+F5 查看。' -ForegroundColor Green
}