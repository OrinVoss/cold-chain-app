# 徽农优选冷链物流 Demo — 全面检测报告 v2.0

**检测时间**: 2026-05-11  
**检测范围**: server/ (16 .js) + web/ (12 .vue/.js) + mobile/ (11 .vue/.js)  
**检测方式**: 静态代码分析 + 依赖扫描（npm audit 因镜像源限制未返回结果）  
**基准对比**: 上一版报告 (AUDIT_REPORT.md, 2026-05-09)

---

## 综合评分：48/100（↑13 分）

| 维度 | 分数 | 致命 | 严重 | 警告 | 建议 |
|------|------|------|------|------|------|
| 后端安全 | 40 | 1 | 4 | 6 | 4 |
| Web 前端 | 55 | 0 | 2 | 4 | 3 |
| 移动端 | 52 | 0 | 2 | 5 | 4 |
| 架构+工程化 | 35 | 0 | 2 | 7 | 6 |

> 评分说明：上一版部分 P0 问题已修复（WebSocket 命名空间、`/auth/me` 中间件、缺失事件等），故总分提升；但安全与架构层面的深层问题仍然存在。

---

## 🔴 P0 致命（1 项）

| # | 位置 | 问题 | 影响 |
|---|------|------|------|
| 1 | `server/src/index.js:27-32` | **每次启动无条件删除 `data/cold-chain.db` 并重建**。`fs.unlinkSync(dbPath)` 在 `main()` 开头执行，无任何环境判断开关。 | **所有生产数据在服务器重启后完全丢失**，系统只能作为纯演示用途，无法承载真实业务。 |

**修复建议**：
```js
// 增加环境变量控制，仅开发/演示模式才重置数据库
const RESET_DB = process.env.RESET_DB === 'true' || process.env.NODE_ENV === 'demo';
if (RESET_DB) {
  try { fs.unlinkSync(dbPath); } catch (e) { /* ignore */ }
}
```

---

## 🟠 P1 严重（10 项）

### 安全类

| # | 位置 | 问题 | 影响 |
|---|------|------|------|
| 2 | `server/src/config.js:3` | **JWT_SECRET 硬编码在源码中**。`huinong-cold-chain-demo-secret-key-2024` 暴露在版本控制里。 | 任何人拿到源码即可伪造任意用户 token，完全绕过认证体系。 |
| 3 | `server/src/index.js:38-40` | **Socket.IO CORS 开放为 `origin: '*'`**。 | 跨域无限制，恶意网页可直接连上 WebSocket 接收实时传感器数据与告警。 |
| 4 | `server/src/index.js:77-86` | **`POST /simulation/inject-alert` 仅校验登录，无角色/权限控制**。 | 任意登录用户（包括 viewer、driver）均可注入虚假温度异常，干扰业务判断。 |
| 5 | `server/src/routes/driver.routes.js:105` | **司机确认告警时不校验告警归属**。`PUT /driver/alerts/:id/acknowledge` 只带 `req.user.id`，不验证该告警是否属于当前司机车辆。 | 司机 A 可以确认司机 B 车辆的告警。 |
| 6 | `server/src/routes/alert.routes.js:19-24` | **告警确认不验证告警是否存在**。`UPDATE alerts SET ... WHERE id = ?`，若 id 不存在仍返回成功，且触发 `alert:acknowledged` 事件。 | 可对不存在的告警 ID 发送确认，产生幽灵事件。 |

### 功能/逻辑类

| # | 位置 | 问题 | 影响 |
|---|------|------|------|
| 7 | `server/src/services/alert-engine.js:22` | **低温偏离不触发告警**。`deviation = reading.value - threshold`，当 `deviation <= 2` 时直接 return。若温度低于 0°C（如 -5°C），deviation 为负，永远不会触发任何级别告警。 | 制冷过度/设备故障导致低温时系统完全无感知，肉类等严格温控品存在冻损风险。 |
| 8 | `server/src/services/sensor-simulator.js:64-66` | **车辆到达终点后永久停滞**。`route.step < route.waypoints.length - 1` 时递增，到达终点后不再更新 step，车辆永远停留在最后一个坐标点。 | GPS 轨迹在终点后变成静止点，与真实配送"返回仓库"或"继续下一站"不符。 |
| 9 | `web/src/views/orders/OrderListView.vue:97` | **创建订单表单存在重复属性**。`newOrder` 对象定义了两次 `required_temp_min:0`。 | 第二个覆盖第一个，无功能影响，但属于明显代码错误，可能掩盖其他拼写问题。 |
| 10 | `server/src/routes/order.routes.js:87-92` | **`DELETE /orders/:id` 与 `PUT /:id/cancel` 行为完全一致**。两者都是软删除（设置 status='cancelled'）。 | 违反 REST 语义，调用方无法区分"删除"与"取消"，且 `DELETE` 未返回资源实际状态。 |
| 11 | `server/src/routes/order.routes.js:42-68` | **创建订单无输入校验**。`customer_name`、`delivery_address` 等字段直接入库，前端同样无表单验证规则。 | 可创建客户名、地址均为空的废单，导致后续流程异常。 |

---

## 🟡 P2 架构与代码质量（14 项）

| # | 位置/范围 | 问题 | 建议 |
|---|-----------|------|------|
| 12 | 8 个前端组件各自建独立 Socket | **WebSocket 连接未集中管理**。`OverviewView`、`TempMonitorView`、`AlertCenterView`、`TaskListView`、`TaskDetailView`、`TempMonitorView(mobile)`、`AlertListView(mobile)`、`HomeView` 各自 `io()`。 | 建立统一的 `useSocket()` composable 或在 App 层共享单一连接，减少服务器连接数与前端内存占用。 |
| 13 | `shared/` 目录完全空置 | 状态枚举、城市映射、温度阈值、API 客户端工厂在三端重复定义。 | 将公共常量（温度阈值、位置标签、状态映射）迁移到 `shared/`。 |
| 14 | `web/` + `mobile/` | **Pinia 已安装但从未使用**。两个前端都依赖 `pinia` 但无 `stores/` 目录。 | 若状态简单可移除依赖；若后续扩展应引入全局 store 管理用户态与 socket。 |
| 15 | `server/src/routes/*.js` | **业务逻辑、数据访问、响应格式化全部混在路由处理程序中**，无 Service 层。 | 按领域拆分为 `services/order.service.js` 等，路由只做参数解析与响应转发。 |
| 16 | `server/src/routes/order.routes.js:6-27` | **N+1 查询**。`orders` 列表先查 50 条，再逐条查 `order_items`。 | 使用 JOIN 一次性取出，或在应用层做批量查询。 |
| 17 | `server/src/routes/shipment.routes.js:7-29` | **N+1 查询**。`shipments` 列表逐条查 `shipment_stops`。 | 同上，使用 JOIN 或批量 IN 查询。 |
| 18 | `web/src/views/orders/OrderListView.vue:112-123` | **大量硬编码颜色**。`#303133`、`#409eff` 等出现多次，未使用 `variables.css` 中定义的变量。 | 统一使用 CSS 变量，便于主题切换与维护。 |
| 19 | `mobile/` 全局 | **错误静默处理**。`AlertListView.vue:55`、`HomeView.vue:92,96` 等 `catch(e) {}` 为空块。 | 至少输出 `console.error`，用户侧使用 `showToast` 提示失败。 |
| 20 | `web/src/views/monitoring/TempMonitorView.vue:87-115` | **ECharts 每次 sensor reading 都完整重建**。`initChart()` 在每次收到数据时被调用，销毁并重建整个图表实例。 | 使用 `chart.setOption({ series: [{ data: newData }] }, false)` 做增量更新。 |
| 21 | `server/src/database/connection.js:97-100` | **数据库 auto-save 每 5 秒无条件执行**，即使无写操作也持续写磁盘。 | 增加 dirty 标记，仅在有变更时才执行 `save()`。 |
| 22 | `mobile/src/views/AlertListView.vue:42` | **橙色告警标签与黄色同级**。`levelTagType` 中 orange 返回 `'warning'`，与 yellow 相同。 | orange 应使用独立视觉标识（如 Vant 的 `'primary'` 或自定义颜色）。 |
| 23 | `web/src/views/alerts/AlertCenterView.vue:51` | **橙色告警标签类型错误**。`levelTag('orange')` 返回空字符串，Element Plus 会显示为默认样式。 | 补充映射：`orange: 'warning'` 或自定义。 |
| 24 | `server/src/routes/dashboard.routes.js:38-57` | **车辆位置查询存在潜在性能问题**。子查询 `MAX(id)` 在数据量大时效率低，且使用 `id` 而非 `recorded_at` 判断最新记录不严谨。 | 使用 `ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY recorded_at DESC)` 或建立索引。 |
| 25 | `web/src/views/monitoring/TempMonitorView.vue:54-65` | **温度阈值前后端语义不一致**。前端使用绝对值（>4°C 黄，>6°C 橙，>8°C 红），后端使用偏离阈值（>2°C 黄，>5°C 橙，>8°C 红）。 | 统一使用后端基于货物阈值的偏差语义，或前端也按货物要求动态计算。 |

---

## 🟢 P3 建议优化（10 项）

| # | 位置 | 建议 |
|---|------|------|
| 26 | `server/src/index.js:89-92` | 错误处理器未区分异常类型，一律返回 500。建议对验证错误返回 400，认证错误返回 401。 |
| 27 | `mobile/src/api/client.js:18` | 401 时执行 `localStorage.clear()` 过于激进，会清除用户偏好等其他数据。建议仅清除 `token`。 |
| 28 | `web/` + `mobile/` | 无 404 通配符路由，用户直接访问非法 URL 时可能看到空白页。 |
| 29 | `mobile/vite.config.js` | `vite-plugin-pwa` 已安装但未在 `plugins` 中引入，PWA 功能未生效。 |
| 30 | `server/src/routes/driver.routes.js:82-85` | `POST /driver/location` 是空操作，不存入数据库。若需轨迹记录应实现持久化。 |
| 31 | `server/src/database/seed.js` | 种子数据 GPS 起点 `29.715, 118.337` 与 `sensor-simulator.js` 的 `ROUTES` 第一段 `29.715, 118.337` 已一致（旧版不一致问题已修复）。 |
| 32 | `server/src/services/sensor-simulator.js:106-110` | 自然异常最大偏移约 `4°C`（`ANOMALY_RANGE: [0.5, 3.0]` × 多步累积），红色告警需 `8°C` 偏差，几乎无法自然触发。 | 调整 `ANOMALY_RANGE` 上限或降低红阈值，确保演示时能观察到全部三级告警。 |
| 33 | `server/` 全局 | 无生产部署配置（Dockerfile、nginx 反向代理、环境变量注入、PM2 进程管理）。 |
| 34 | 全局 | 无单元测试、无 e2e 测试（`verify.js` 仅为截图脚本），无 ESLint/Prettier 配置。 |
| 35 | `server/src/routes/alert.routes.js:27-31` | `GET /alerts/stats` 与 `dashboard.routes.js:14` 中的 alertByLevel 查询重复，可复用。 |

---

## 修复优先级路线图

### 第一优先（立即修复）
1. **P0-1 数据库重置**：增加 `RESET_DB` 环境变量开关，默认不删除数据库。
2. **P1-2 JWT_SECRET**：改为从环境变量读取，`process.env.JWT_SECRET || fallback`。
3. **P1-3 Socket.IO CORS**：限制为实际前端域名，开发环境可白名单 `localhost:5173/5174`。
4. **P1-7 低温告警**：修改 `alert-engine.js` 逻辑，使用 `Math.abs(deviation)` 或分别判断上下限。

### 第二优先（本周内）
5. **P1-4/5/6 权限与校验**：为模拟器接口加 admin 角色校验；告警确认时校验存在性与归属。
6. **P1-9 重复属性**：修复 `OrderListView.vue` 的 `required_temp_min` 拼写。
7. **P1-11 输入校验**：在 `order.routes.js` 的 `POST /` 中加必填字段校验。
8. **P2-12 WebSocket 集中化**：实现统一的 socket composable，避免 8 处独立连接。

### 第三优先（技术债清理）
9. **P2-13/14 shared + Pinia**：迁移公共常量，决定是否启用 Pinia。
10. **P2-15/16/17 服务层 + N+1**：按领域拆分 service，优化列表查询。
11. **P2-20 ECharts 增量更新**：改用 `setOption` 局部更新。
12. **P2-18/19/22/23 UI 一致性**：统一颜色变量、补齐错误提示、修复告警标签映射。

---

## 附录：上一版问题修复状态

| 旧版编号 | 问题 | 状态 |
|---------|------|------|
| P0-1 | WebSocket 命名空间不匹配 (`/realtime` vs `/`) | ✅ 已修复，当前全部使用默认命名空间 |
| P0-2 | `/auth/me` 缺少 `authMiddleware` | ✅ 已修复，`auth.routes.js:34` 已挂载中间件 |
| P0-3 | `shipment:status-change` 事件从未发送 | ✅ 已修复，`shipment.routes.js` 与 `driver.routes.js` 均已发送 |
| P0-4 | `alert:acknowledged` 事件从未发送 | ✅ 已修复，`alert.routes.js` 与 `driver.routes.js` 均已发送 |
| P0-5 | 移动端传感器 API 用 task_id 代替 vehicle_id | ✅ 已修复，`TempMonitorView.vue:83-84` 已正确取 `vehicleId` |
| P1-8 | 模拟器路线折返 bug | ⚠️ 已改变，现为"到达终点后停滞"而非"折返" |
| P2-14 | `useSocket.js` composable 死代码 | ✅ 已移除（目录不存在） |
