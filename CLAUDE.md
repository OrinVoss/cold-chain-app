# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# 项目说明 — 徽农优选冷链物流 Demo

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

冷链物流监控 Demo：后台管理端 + 司机移动端 + 模拟 IoT 传感器后端。三个独立 SPA 通过 REST + Socket.IO 实时通信。

## 仓库结构

```
app/
  server/   Node.js + Express + sql.js + Socket.IO          (端口 3000)
  web/      Vue 3 + Element Plus + ECharts + Leaflet        (端口 5173)
  mobile/   Vue 3 + Vant 4 + vite-plugin-pwa                (端口 5174)
  shared/   预留共享代码目录（当前为空）
  verify.js Playwright 端到端验证脚本
```

## 常用命令

```bash
# 一次性安装三端依赖
npm run install:all

# 同时启动三端 (concurrently)
npm run dev

# 单独启动 (开发时通常用)
npm run dev:server     # node src/index.js
npm run dev:web        # vite --port 5173
npm run dev:mobile     # vite --port 5174

# 端到端验证（需先把三端启动起来）
node verify.js
```

无构建产物部署配置，无 lint，无单元测试框架。`verify.js` 是唯一的回归脚本，调用 API + 用 Playwright 打开页面截图。

## 架构关键点（跨文件理解）

### 服务器启动行为
`server/src/index.js:25-32` **每次启动都删除 `data/cold-chain.db` 并重新建表+灌种子数据**。种子在 `database/seed.js`，包含 6 个用户、5 辆车、3 条进行中运输。开发时不要把任何"持久数据"放进 SQLite — 重启即丢。

### WebSocket 模式
- 服务器：`server/src/socket/handler.js` 使用**默认命名空间**（`io.on('connection')`），JWT 通过 `socket.handshake.auth.token` 校验
- 模块导出 `setupSocket(io)` 返回 `emit(event, data)`，`getEmit()` 给路由层用来跨模块触发事件
- 前端：`io('/', { path: '/socket.io', auth: { token } })`，每个用到实时数据的视图各自建独立 socket（已知技术债，见 `AUDIT_REPORT.md`）
- 服务器发出的事件：`sensor:reading` `vehicle:position` `alert:new` `shipment:status-change` `alert:acknowledged`

### 模拟器 + 告警引擎链路
1. `services/sensor-simulator.js` 每 3 秒只对 `status='in_transit'` 的运输生成读数
2. 每条 `sensor:reading` 经 `services/alert-engine.js` 评估温度偏差
3. 阈值定义在 `config.js`：黄=>2°C、橙=>5°C、红=>8°C 偏差
4. 5 分钟内同车同传感器同级告警自动去重，避免刷屏
5. 路线坐标硬编码在 `sensor-simulator.js:6-37` 的 `ROUTES` 常量里（黄山→杭州/上海/金华）

### 前端 → 后端调用约定
- Vite 开发服务器代理 `/api` 和 `/socket.io` 到 `localhost:3000`（见 `web/vite.config.js`、`mobile/vite.config.js`）
- `web/src/api/client.js` 和 `mobile/src/api/client.js`：axios 实例，baseURL `/api/v1`，请求拦截器自动注入 `Bearer <token>`，401 时清 localStorage 并跳 `#/login`
- 路由用 `createWebHashHistory()`（hash 路由），不是 history 模式
- 登录后 token 存 localStorage，路由 `beforeEach` 守卫做未登录跳转

### 数据库适配层
`server/src/database/connection.js` 用 sql.js（纯 JS，不需 node-gyp）包装出类似 better-sqlite3 的 `prepare().get()/all()/run()` API。每 5 秒自动持久化到磁盘文件。任何写操作之后**必须显式调用 `db.save()`** 才能立即落盘（路由层模式：写完就 save，参考 `driver.routes.js:65`）。

### 演示账号
来自 `database/seed.js`：
- `admin / admin123`（管理员，沈俊杰）
- `warehouse / 123456`（仓库主管，李明）
- `driver1|2|3 / 123456`（司机，关联 vehicle_id 1|2|3）
- `viewer / 123456`（只读，陈心瑶）

## 已知技术债

详见 `AUDIT_REPORT.md`。改动相关代码时注意：
- 8 处独立 socket 连接没有集中管理
- `useSocket.js` composable 写完没人用
- `shared/` 目录空置，三端有重复的标签映射、颜色常量
- 温度阈值前后端语义不完全一致（后端用偏差，前端有用绝对值）
- N+1 查询：运输列表逐条查站点
- `JWT_SECRET` 硬编码在 `server/src/config.js`
- 移动端多处 `catch(e) {}` 静默吞错

## 文档与辅助文件

- `AUDIT_REPORT.md` — 7 个 agent 联合审计报告，列出 P0/P1/P2/P3 问题
- `不知道叫什么对策划书.docx` — 原始策划书
- `gen_ppt.py` / `gen_ppt_v2.py` / `capture-ppt-screenshots.js` — PPT 生成与截图工具，与运行时无关
- `.claude/CLAUDE.md` — 历史经验教训（坐标系、HMR、UI 细节），写新代码前值得读一眼
