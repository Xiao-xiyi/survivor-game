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

# 1. 确认定制模板在（web\ 下是唯一正本，不从 docs 备份，避免把被覆盖的模板再还原回去）
foreach ($f in 'web\index.html', 'web\style.css') {
    if (-not (Test-Path $f)) {
        Write-Host "X 缺少定制模板 $f，请先把它补回来！" -ForegroundColor Red
        exit 1
    }
}

# 2. 把构建产物整目录镜像进 docs（多出来的删掉，改动的覆盖）
robocopy 'build\web-desktop' 'docs' /MIR /NFL /NDL /NJH /NP
if ($LASTEXITCODE -ge 8) { Write-Host "X robocopy 失败 code=$LASTEXITCODE" -ForegroundColor Red; exit 1 }

# 3. 用仓库里的定制模板覆盖回 docs
Copy-Item 'web\index.html' 'docs\index.html' -Force
Copy-Item 'web\style.css'  'docs\style.css'  -Force
New-Item -Path 'docs\.nojekyll' -ItemType File -Force | Out-Null

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