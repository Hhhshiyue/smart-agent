# Smart Agent 一键安装包生成脚本
# 用法: powershell -ExecutionPolicy Bypass -File build-package.ps1
# 将项目打包为 zip（排除 node_modules、数据、密钥等），供其他电脑安装

param(
    [string]$Project = "",
    [string]$OutputDir = "",
    [string]$Version = "1.0.0"
)

# 默认取脚本所在目录为项目目录，输出到上级目录的 dist 文件夹
if (-not $Project) { $Project = $PSScriptRoot }
if (-not $OutputDir) { $OutputDir = Join-Path (Split-Path $PSScriptRoot -Parent) "dist" }

$ErrorActionPreference = "Stop"

$packageName = "smart-agent-v$Version"
$staging = Join-Path $env:TEMP "smart-agent-package"
$packageRoot = Join-Path $staging $packageName

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Smart Agent 安装包生成" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 清理临时目录
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
Write-Host "[1/4] 已创建临时目录"

# 2. 复制项目文件（排除无需打包的内容）
$excludeDirs = @("node_modules", "data", "tests", ".git", "docs")
Write-Host "[2/4] 正在复制项目文件（排除: node_modules/data/tests/.env 等）..."
robocopy $Project $packageRoot /E /XD $excludeDirs /XF ".env" ".env.production" "deploy-production.bat" "deploy-production.sh" "ecosystem.config.json" /NFL /NDL /NJH /NJS /NP | Out-Null

# 3. 创建运行时数据目录骨架
New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot "data\logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot "data\memory") | Out-Null
Write-Host "[3/4] 已创建数据目录骨架"

# 4. 压缩为 zip
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null }
$zipPath = Join-Path $OutputDir $packageName
$zipFile = "$zipPath.zip"
if (Test-Path $zipFile) { Remove-Item -Force $zipFile }
Write-Host "[4/4] 正在压缩为 zip..."
Compress-Archive -Path $packageRoot -DestinationPath $zipFile -CompressionLevel Optimal

# 清理临时目录
Remove-Item -Recurse -Force $staging

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  打包完成！" -ForegroundColor Green
Write-Host "  安装包: $zipPath.zip" -ForegroundColor Green
Write-Host ""
Write-Host "  使用方法：" -ForegroundColor Yellow
Write-Host "  1. 将 zip 拷贝到目标电脑并解压" -ForegroundColor Yellow
Write-Host "  2. 双击 setup.bat 一键安装" -ForegroundColor Yellow
Write-Host "  3. 浏览器自动打开配置向导，选择 AI 模型并填写密钥" -ForegroundColor Yellow
Write-Host "  4. 日常使用双击 start.bat 启动" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""