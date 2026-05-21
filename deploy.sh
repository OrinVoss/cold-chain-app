#!/bin/bash
# 徽农优选冷链物流 Demo - 部署脚本

set -e

cd "$(dirname "$0")"
echo "=== 1. 安装后端依赖 ==="
cd server && npm install --production && cd ..

echo "=== 2. 构建管理后台 ==="
cd web && npx vite build && cd ..

echo "=== 3. 构建司机端 ==="
cd mobile && npx vite build && cd ..

echo "=== 4. 启动服务 ==="
cd server
npx kill-port 3000 3001 3002 2>/dev/null || true
nohup node src/index.js > server.log 2>&1 &
echo "后端已启动 (端口 3000)"

cd ../web
nohup npx serve dist -l 3001 --cors > serve.log 2>&1 &
echo "管理后台已启动 (端口 3001)"

cd ../mobile
nohup npx serve dist -l 3002 --cors > serve.log 2>&1 &
echo "司机端已启动 (端口 3002)"

cd ..
echo ""
echo "========================================"
echo "  部署完成！"
echo "  后端 API:     http://localhost:3000"
echo "  管理后台:     http://localhost:3001"
echo "  司机移动端:   http://localhost:3002"
echo "========================================"
