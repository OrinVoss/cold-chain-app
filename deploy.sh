#!/bin/bash
# 徽农优选冷链物流 Demo - 部署脚本
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== 1. 安装后端依赖 ==="
cd "$ROOT/server" && npm install && cd "$ROOT"

echo "=== 2. 安装并构建管理后台 ==="
cd "$ROOT/web" && npm install && npx vite build && cd "$ROOT"

echo "=== 3. 安装并构建司机端 ==="
cd "$ROOT/mobile" && npm install && npx vite build && cd "$ROOT"

echo "=== 4. 安装 serve ==="
npm install -g serve 2>/dev/null || true

echo "=== 5. 启动服务 ==="
npx kill-port 3000 3001 3002 2>/dev/null || true

cd "$ROOT/server"
nohup node src/index.js > "$ROOT/server/server.log" 2>&1 &
echo "后端已启动 (端口 3000)"

cd "$ROOT/web"
nohup npx serve dist -l 3001 --cors > "$ROOT/web/serve.log" 2>&1 &
echo "管理后台已启动 (端口 3001)"

cd "$ROOT/mobile"
nohup npx serve dist -l 3002 --cors > "$ROOT/mobile/serve.log" 2>&1 &
echo "司机端已启动 (端口 3002)"

cd "$ROOT"
echo ""
echo "========================================"
echo "  部署完成！"
echo "  管理后台:     http://$(curl -s ifconfig.me):3001"
echo "  司机移动端:   http://$(curl -s ifconfig.me):3002"
echo "  后端 API:     http://localhost:3000"
echo "========================================"
