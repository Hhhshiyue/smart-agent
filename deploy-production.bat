@echo off
REM Smart Agent 生产环境部署脚本（Windows）
REM 请按步骤执行

echo.
echo ========================================
echo   Smart Agent 生产环境部署向导
echo ========================================
echo.

REM 步骤 1: 检查 Node.js
echo [步骤 1/8] 检查 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Node.js 未安装，请先安装 Node.js 18+
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

REM 步骤 2: 检查配置文件
echo.
echo [步骤 2/8] 检查配置文件...
if not exist .env (
    echo [提示] 未找到 .env 文件，正在从模板创建...
    copy .env.example .env
    echo [重要] 请编辑 .env 文件，设置以下配置：
    echo   - LLM_API_KEY=your_real_api_key
    echo   - JWT_SECRET=your_strong_random_string
    echo   - HOST=0.0.0.0
    pause
)

REM 步骤 3: 安装依赖
echo.
echo [步骤 3/8] 安装项目依赖...
call npm install
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo [OK] 依赖安装完成

REM 步骤 4: 安装 PM2
echo.
echo [步骤 4/8] 检查 PM2 进程管理器...
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo [提示] PM2 未安装，正在安装...
    call npm install -g pm2
)
echo [OK] PM2 已就绪

REM 步骤 5: 创建必要目录
echo.
echo [步骤 5/8] 创建数据目录...
if not exist data mkdir data
if not exist data\memory mkdir data\memory
if not exist data\vectors mkdir data\vectors
if not exist data\logs mkdir data\logs
echo [OK] 目录创建完成

REM 步骤 6: 停止旧服务（如果存在）
echo.
echo [步骤 6/8] 停止旧服务...
call pm2 delete smart-agent >nul 2>&1
echo [OK] 清理完成

REM 步骤 7: 启动服务
echo.
echo [步骤 7/8] 启动 Smart Agent 服务...
call pm2 start app.js --name smart-agent --max-memory-restart 500M
if errorlevel 1 (
    echo [错误] 服务启动失败
    pause
    exit /b 1
)

REM 等待服务启动
timeout /t 3 /nobreak >nul

REM 步骤 8: 验证服务
echo.
echo [步骤 8/8] 验证服务状态...
call pm2 status
echo.

REM 测试健康检查
curl http://localhost:3000/api/health >nul 2>&1
if errorlevel 1 (
    echo [警告] 服务可能未正常启动，请检查日志
) else (
    echo [OK] 服务运行正常
)

echo.
echo ========================================
echo   部署完成！
echo ========================================
echo.
echo 访问地址：
echo   - Web 界面: http://localhost:3000
echo   - API 接口: http://localhost:3000/api
echo   - 健康检查: http://localhost:3000/api/health
echo.
echo 管理命令：
echo   - 查看状态: pm2 status
echo   - 查看日志: pm2 logs smart-agent
echo   - 重启服务: pm2 restart smart-agent
echo   - 停止服务: pm2 stop smart-agent
echo.
echo 重要提醒：
echo   1. 请确保已设置 .env 文件中的 LLM_API_KEY
echo   2. 建议修改 .env 文件中的 JWT_SECRET 为强随机字符串
echo   3. 生产环境建议设置 HOST=0.0.0.0
echo.
pause