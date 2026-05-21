#!/bin/bash
# 徽农优选冷链物流 Demo - 服务端部署脚本
# 使用方法：在 Workbench 终端里粘贴执行

set -e

echo "=== 1. 安装依赖 ==="
cd /root/app/server && npm install --production
cd /root/app

echo "=== 2. 构建前端 ==="
cd /root/app/web && npx vite build
cd /root/app/mobile && npx vite build
cd /root/app

echo "=== 3. 安装 serve 静态文件托管 ==="
npm install -g serve 2>/dev/null || true

echo "=== 4. 启动服务 ==="
# 后端
cd /root/app/server
npx kill-port 3000 3001 3002 2>/dev/null || true
nohup node src/index.js > /root/app/server/server.log 2>&1 &
echo "后端已启动 (端口 3000)"

# 前端管理后台 (端口 3001)
nohup serve /root/app/web/dist -l 3001 --cors > /root/app/web/serve.log 2>&1 &
echo "管理后台已启动 (端口 3001)"

# 前端司机端 (端口 3002)
nohup serve /root/app/mobile/dist -l 3002 --cors > /root/app/mobile/serve.log 2>&1 &
echo "司机端已启动 (端口 3002)"

echo ""
echo "========================================"
echo "  部署完成！"
echo "  后端 API:     http://$(curl -s ifconfig.me):3000"
echo "  管理后台:     http://$(curl -s ifconfig.me):3001"
echo "  司机移动端:   http://$(curl -s ifconfig.me):3002"
echo "========================================"
