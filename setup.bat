@echo off
chcp 65001 >nul
title Smart Agent - 一键安装

echo ==============================================
echo     Smart Agent 智能体 - 一键安装
echo ==============================================
echo.

cd /d "%~dp0"

echo [1/4] 检查 Node.js 环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [错误] 未检测到 Node.js！
    echo 请先前往 https://nodejs.org/ 下载并安装 LTS 版本
    echo 安装完成后，重新运行本脚本。
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo       检测到 Node.js 版本: %NODE_VER%
echo.

echo [2/4] 检查项目依赖...
if not exist node_modules (
    echo       正在安装依赖，首次安装需要几分钟，请耐心等待...
    echo       如果下载很慢或卡住，请先运行下面命令切换国内镜像源：
    echo       npm config set registry https://registry.npmmirror.com
    echo.
    call npm install
    if not exist node_modules (
        echo.
        echo [错误] 依赖安装失败，请检查网络连接后重试。
        echo 建议：先运行下面命令切换国内镜像源，再重新运行本脚本：
        echo       npm config set registry https://registry.npmmirror.com
        echo.
        pause
        exit /b 1
    )
) else (
    echo       依赖已存在，跳过安装。
)
echo.

echo [3/4] 检查配置文件...
if not exist .env (
    echo       正在生成配置文件...
    copy .env.example .env >nul
    powershell -NoProfile -Command "$envPath='.env'; $c = Get-Content $envPath; if (-not ($c -match 'JWT_SECRET')) { Add-Content $envPath ''; Add-Content $envPath '# Auth config'; Add-Content $envPath 'AUTH_ENABLED=true'; Add-Content $envPath ('JWT_SECRET=' + [guid]::NewGuid().ToString('N')) }"
    echo       配置文件已生成（已生成随机 JWT 密钥）。
) else (
    echo       配置文件已存在，跳过生成。
)
echo.

echo [4/4] 安装完成！正在启动服务...
echo.
echo -------------------------------------------------
echo   浏览器将自动打开，请完成以下配置：
echo   1. 选择一个 AI 模型
echo   2. 前往官网创建 API Key
echo   3. 粘贴密钥，完成配置
echo -------------------------------------------------
echo.
echo   服务地址: http://localhost:3000
echo   按 Ctrl+C 可停止服务
echo.

node app.js --open

pause
