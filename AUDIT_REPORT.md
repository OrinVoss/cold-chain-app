# 徽农优选冷链物流 Demo — 全面审计报告

**审计时间**: 2026-05-09  
**审计范围**: server/ (16 .js) + web/ (12 .vue/.js) + mobile/ (11 .vue/.js) = 39 个源文件  
**审计 Agent**: 7 个（Explore×3 + architecture-optimizer + code-quality-checker + fullstack-qa-inspector + ui-quality-inspector）

---

## 综合评分：35/100

| 维度 | 分数 | 致命 | 警告 | 建议 |
|------|------|------|------|------|
| 后端 | 30 | 2 | 5 | 10 |
| Web 前端 | 33 | 4 | 8 | 0 |
| 移动端 | 30 | 2 | 5 | 5 |
| 架构+耦合 | 17 | 5 | 6 | 5 |

---

## 🔴 P0 致命（系统核心功能无法工作）

| # | 位置 | 问题 | 影响 |
|---|------|------|------|
| 1 | `socket/handler.js:5` vs **所有 9 个前端文件** | WebSocket 命名空间不匹配。服务器在 `io.of('/realtime')` 监听，前端全部连 `io('/')` | **所有实时功能完全失效**（传感器推送、车辆位置、告警通知） |
| 2 | `auth.routes.js:33` | `GET /auth/me` 缺少认证中间件，直接引用 `req.user.id` 抛 TypeError | 移动端个人中心崩溃，返回 500 |
| 3 | `socket/handler.js` | `shipment:status-change` 事件从未被服务器发送 | 司机端任务列表永远不自动刷新 |
| 4 | `socket/handler.js` | `alert:acknowledged` 事件从未被服务器发送 | 告警确认不能跨端实时同步 |
| 5 | `mobile/TempMonitorView.vue:83` | 用任务 ID 替代车辆 ID 调用 `/sensors/vehicle/` | 湿度永远显示 `--`，车门状态不可用 |

## 🟠 P1 严重（功能模块损坏或数据不一致）

| # | 问题 |
|---|------|
| 6 | 温度阈值三端不一致：后端用偏差(2/5/8°C)、Web 用绝对值(4/6/8°C)、移动端(4/6°C 无橙色) |
| 7 | L1(预冷)/L3(仓储)/L4(配送) 三层数据库表和 API 完全缺失 — 策划书覆盖率 ~45% |
| 8 | 模拟器路线折返 bug：车辆到终点沿原路返回，产生虚假 GPS 轨迹 |
| 9 | 橙色告警颜色 = 红色（`#f56c6c`），三级告警实际只有两级可区分 |
| 10 | Web 告警中心"橙色"标签显示为蓝色（`levelTag` 返回空字符串） |
| 11 | 传感器 threshold 取混载货物最大值，肉类等严格温控品可能受损而系统不告警 |
| 12 | 模拟器自然异常最大偏移 4°C，红色告警（需 8°C）无法自然触发 |

## 🟡 P2 架构问题

| # | 问题 |
|---|------|
| 13 | 8 个组件各建独立 WebSocket 连接，3 处内存泄漏（无 onUnmounted 断开） |
| 14 | `useSocket.js` composable 完整实现但从未被任何组件导入（死代码） |
| 15 | Pinia 两个前端都装了但从未使用，`stores/` 目录不存在 |
| 16 | `shared/` 目录完全空置 |
| 17 | 无服务层 — 业务逻辑、数据访问、响应格式化全混在路由处理程序里 |
| 18 | `DELETE /orders/:id` 实际是软删除（status='cancelled'），违反 REST 语义 |
| 19 | 所有移动端 `catch(e) {}` 空块静默吞错，用户看不到任何失败反馈 |
| 20 | CSS 变量（variables.css）定义了但几乎没被使用，`#303133` 硬编码出现 12+ 次 |
| 21 | 两种绿色冲突（`#67c23a` vs `#52c41a`）用作成功色，出现在 6+ 个组件中 |
| 22 | 多个组件重复定义相同的传感器位置标签映射（5 处） |
| 23 | 地图标记通过 Leaflet 内部 API `_popup._content` 字符串匹配查找，极其脆弱 |
| 24 | N+1 查询模式：运输列表逐条查站点，数据量大时会成为性能瓶颈 |

## 🟢 P3 建议优化

| # | 建议 |
|---|------|
| 25 | 删除未使用的依赖（sass、pinia 如不需要） |
| 26 | 填充 `shared/` 目录（状态枚举、城市映射、温度阈值、API 客户端工厂） |
| 27 | ECharts 每次 sensor reading 都完整重建（`initChart()`），改用增量更新 |
| 28 | 无生产部署配置（Dockerfile、nginx、环境变量 CORS） |
| 29 | 无 404 通配符路由 |
| 30 | 移动端 PWA 未配置 Service Worker（`vite-plugin-pwa` 已装但未启用） |
| 31 | `POST /driver/location` 是空操作（不存数据库） |
| 32 | 模拟器种子数据 GPS 起点与 ROUTES 定义不一致（差约 10km） |
| 33 | JWT_SECRET 硬编码在源码中 |
| 34 | 无表单验证（创建订单对话框可提交空字段） |
| 35 | 无响应式断点 — Web 端零 media query |

---

## 优先级修复路线

1. **修 WebSocket 命名空间**：所有前端 `io('/')` → `io('/realtime')`
2. **修 `/auth/me`**：添加 authMiddleware
3. **补充缺失事件**：`shipment:status-change`、`alert:acknowledged`
4. **修移动端传感器 API**：用 vehicle_id 而非 task_id
5. **统一告警颜色**：黄=#e6a23c, 橙=#fa8c16, 红=#f5222d
6. **统一温度阈值**：前后端使用相同语义
7. **集中化 WebSocket**：一个应用一个共享连接
8. **清理死代码**：useSocket.js、Pinia、shared/
