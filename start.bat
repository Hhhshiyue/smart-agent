@echo off
chcp 65001 >nul
title Smart Agent

echo ==============================================
echo     Smart Agent 智能体 - 启动
echo ==============================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo 未检测到项目依赖，正在自动安装...
    echo 首次安装需要几分钟，请耐心等待，不要关闭本窗口。
    echo 如果下载很慢或卡住，请先运行下面命令切换国内镜像源：
    echo npm config set registry https://registry.npmmirror.com
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
    echo.
    echo 依赖安装完成！
    echo.
)

echo 正在启动 Smart Agent 服务...
echo 浏览器地址: http://localhost:3000
echo 按 Ctrl+C 可停止服务
echo.

echo 正在启动服务，浏览器将自动打开...
node app.js --open

pause
