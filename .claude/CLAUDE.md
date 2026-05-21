# 徽农优选冷链物流 Demo 项目

## 项目结构
- `server/` - Node.js + Express + sql.js 后端 (端口 3000)
- `web/` - Vue 3 + Element Plus 管理端 (端口 5173)
- `mobile/` - Vue 3 + Vant 4 司机端 PWA (端口 5174)

## 启动
```bash
# 首次安装
cd server && npm install && cd ../web && npm install && cd ../mobile && npm install

# 启动全部 (需要三个终端)
cd server && node src/index.js
cd web && npx vite --host --port 5173
cd mobile && npx vite --host --port 5174
```

## 重要教训

### 地图坐标系
- 这是中国境内的项目，但 **必须使用 WGS-84 坐标 + OpenStreetMap 瓦片**，不要用高德/百度瓦片
- 高德瓦片用 GCJ-02 火星坐标，与 WGS-84 有 100-700m 偏移，在中国东部沿海会把内陆点偏移到海里
- **绝对不要混用 WGS-84 数据和 GCJ-02 瓦片**

### 前端修改后验证
- Vite HMR 热更新可能不生效，特别是修改了 script 部分后
- 每次修改完前端代码，建议用户在浏览器 **硬刷新 (Ctrl+Shift+R)** 或让用户重新打开页面
- 后端修改后必须重启 server 进程

### UI 设计
- 手机端 Vant 组件在 tab 标题中使用 van-badge 会溢出，改用文字计数如 `进行中(3)`
- Element Plus 表格操作列按钮用 `link` 类型 + `display:flex;align-items:center` 对齐
- 全局颜色用 CSS 变量统一管理，不要在各组件硬编码

### 数据库
- 用 sql.js (纯 JS，无需编译) 替代 better-sqlite3 (需要原生编译/node-gyp)
- DB 文件在 server/data/cold-chain.db，删掉后重启会自动重建和填充种子数据
- 模拟器每 3 秒生成一次温湿度+GPS 数据，只给 status='in_transit' 的车辆生成

### 坐标数据来源
- 车辆路线在 `server/src/services/sensor-simulator.js` 的 ROUTES 常量中定义
- 新增或修改路线时，确保坐标是准确的 WGS-84 坐标
- 参考：黄山(29.715,118.337)、杭州(30.274,120.155)、上海(31.230,121.473)
