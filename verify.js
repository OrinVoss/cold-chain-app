const { chromium } = require('playwright');
const path = require('path');

const WEB_BASE = 'http://127.0.0.1:5173';
const MOBILE_BASE = 'http://127.0.0.1:5174';
const API_BASE = 'http://127.0.0.1:3000/api/v1';

const RESULTS = [];

function result(name, status, detail) {
  const s = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`  ${s} ${name}${detail ? ': ' + detail : ''}`);
  RESULTS.push({ name, status, detail });
}

async function main() {
  console.log('\n========================================');
  console.log('  徽农优选冷链物流 Demo - Playwright 验证');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: true });

  // ─── API Tests ───
  console.log('─── API 后端测试 ───');
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    result('POST /auth/login', loginRes.ok && token ? 'PASS' : 'FAIL', loginData.user?.display_name || '');
  } catch (e) { result('POST /auth/login', 'FAIL', e.message); }

  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const { token } = await loginRes.json();
    const stats = await fetch(`${API_BASE}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    result('GET /dashboard/stats', stats.activeShipments >= 0 ? 'PASS' : 'FAIL', `活跃运输:${stats.activeShipments} 告警:${stats.activeAlerts}`);
  } catch (e) { result('GET /dashboard/stats', 'FAIL', e.message); }

  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'driver1', password: '123456' })
    });
    const { token } = await loginRes.json();
    const tasks = await fetch(`${API_BASE}/driver/tasks`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    result('GET /driver/tasks', tasks.length >= 0 ? 'PASS' : 'FAIL', `${tasks.length} 个任务`);
    const hasVehicleId = tasks[0]?.vehicle_id != null;
    result('  └ vehicle_id 字段', hasVehicleId ? 'PASS' : 'FAIL');
  } catch (e) { result('GET /driver/tasks', 'FAIL', e.message); }

  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const { token } = await loginRes.json();
    const me = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    result('GET /auth/me', me.username ? 'PASS' : 'FAIL', me.display_name || '');
  } catch (e) { result('GET /auth/me', 'FAIL', e.message); }

  // ─── Web Pages (Desktop 1280x800) ───
  console.log('\n─── Web 管理端页面 ───');

  const webCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const webPage = await webCtx.newPage();

  // Login
  try {
    await webPage.goto(`${WEB_BASE}/#/login`, { waitUntil: 'networkidle', timeout: 10000 });
    await webPage.waitForSelector('input[placeholder="用户名"]', { timeout: 5000 });
    await webPage.fill('input[placeholder="用户名"]', 'admin');
    await webPage.fill('input[placeholder="密码"]', 'admin123');
    await webPage.click('button:has-text("登 录")');
    await webPage.waitForURL('**/dashboard', { timeout: 5000 });
    result('Web 登录', 'PASS');
  } catch (e) { result('Web 登录', 'FAIL', e.message); }

  // Dashboard
  try {
    await webPage.waitForSelector('.kpi-card', { timeout: 5000 });
    const kpiCount = await webPage.locator('.kpi-card').count();
    const mapVisible = await webPage.locator('#vehicleMap').isVisible();
    result('概览仪表盘', kpiCount === 5 && mapVisible ? 'PASS' : 'WARN', `KPI:${kpiCount} 地图:${mapVisible}`);
    await webPage.screenshot({ path: path.join(__dirname, 'screenshots', 'web-dashboard.png'), fullPage: false });
  } catch (e) { result('概览仪表盘', 'FAIL', e.message); }

  // Monitoring
  try {
    await webPage.goto(`${WEB_BASE}/#/monitoring`, { waitUntil: 'networkidle', timeout: 10000 });
    await webPage.waitForTimeout(2000);
    const sensorCards = await webPage.locator('.sensor-card').count();
    const chartBox = await webPage.locator('.chart-box').isVisible();
    result('温度监控', sensorCards > 0 ? 'PASS' : 'WARN', `传感器卡片:${sensorCards} 图表:${chartBox}`);
    await webPage.screenshot({ path: path.join(__dirname, 'screenshots', 'web-monitoring.png'), fullPage: false });
  } catch (e) { result('温度监控', 'FAIL', e.message); }

  // Orders
  try {
    await webPage.goto(`${WEB_BASE}/#/orders`, { waitUntil: 'networkidle', timeout: 10000 });
    await webPage.waitForTimeout(2000);
    const rows = await webPage.locator('.el-table__body-wrapper tbody tr.el-table__row').count();
    result('订单管理', rows > 0 ? 'PASS' : 'FAIL', `${rows} 行`);
    await webPage.screenshot({ path: path.join(__dirname, 'screenshots', 'web-orders.png'), fullPage: false });
  } catch (e) { result('订单管理', 'FAIL', e.message); }

  // Shipments
  try {
    await webPage.goto(`${WEB_BASE}/#/shipments`, { waitUntil: 'networkidle', timeout: 10000 });
    await webPage.waitForTimeout(1000);
    const pipeCards = await webPage.locator('.pipe-card').count();
    result('运输追踪', pipeCards >= 4 ? 'PASS' : 'WARN', `管道卡片:${pipeCards}`);
    await webPage.screenshot({ path: path.join(__dirname, 'screenshots', 'web-shipments.png'), fullPage: false });
  } catch (e) { result('运输追踪', 'FAIL', e.message); }

  // Alerts
  try {
    await webPage.goto(`${WEB_BASE}/#/alerts`, { waitUntil: 'networkidle', timeout: 10000 });
    await webPage.waitForTimeout(1000);
    const alertRows = await webPage.locator('.alert-row').count();
    result('告警中心', 'PASS', `告警行:${alertRows}`);
    await webPage.screenshot({ path: path.join(__dirname, 'screenshots', 'web-alerts.png'), fullPage: false });
  } catch (e) { result('告警中心', 'FAIL', e.message); }

  // ─── Mobile Pages (iPhone 12 Pro 390x844) ───
  console.log('\n─── 手机司机端页面 ───');

  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileCtx.newPage();

  // Login
  try {
    await mobilePage.goto(`${MOBILE_BASE}/#/login`, { waitUntil: 'networkidle', timeout: 10000 });
    await mobilePage.fill('input[placeholder="请输入用户名"]', 'driver1');
    await mobilePage.fill('input[placeholder="请输入密码"]', '123456');
    await mobilePage.click('button:has-text("登 录")');
    await mobilePage.waitForURL('**/home', { timeout: 5000 });
    result('Mobile 登录', 'PASS');
  } catch (e) { result('Mobile 登录', 'FAIL', e.message); }

  // Home
  try {
    await mobilePage.waitForSelector('.stats-row', { timeout: 5000 });
    const statNums = await mobilePage.locator('.stat-num').count();
    result('首页', statNums === 4 ? 'PASS' : 'WARN', `统计数:${statNums}`);
    await mobilePage.screenshot({ path: path.join(__dirname, 'screenshots', 'mobile-home.png'), fullPage: false });
  } catch (e) { result('首页', 'FAIL', e.message); }

  // Tasks
  try {
    await mobilePage.goto(`${MOBILE_BASE}/#/tasks`, { waitUntil: 'networkidle', timeout: 10000 });
    await mobilePage.waitForTimeout(1000);
    const tabTitles = await mobilePage.locator('.van-tab__text').allTextContents();
    result('任务列表', tabTitles.length >= 2 ? 'PASS' : 'WARN', `标签:${tabTitles.join(',')}`);
    await mobilePage.screenshot({ path: path.join(__dirname, 'screenshots', 'mobile-tasks.png'), fullPage: false });
  } catch (e) { result('任务列表', 'FAIL', e.message); }

  // Monitor
  try {
    await mobilePage.goto(`${MOBILE_BASE}/#/monitor`, { waitUntil: 'networkidle', timeout: 10000 });
    await mobilePage.waitForTimeout(2000);
    const gaugeCards = await mobilePage.locator('.gauge-card').count();
    const infoCards = await mobilePage.locator('.info-card').count();
    result('温湿度监控', gaugeCards === 3 ? 'PASS' : 'WARN', `温度计:${gaugeCards} 信息卡:${infoCards}`);
    await mobilePage.screenshot({ path: path.join(__dirname, 'screenshots', 'mobile-monitor.png'), fullPage: false });
  } catch (e) { result('温湿度监控', 'FAIL', e.message); }

  // Alerts
  try {
    await mobilePage.goto(`${MOBILE_BASE}/#/alerts`, { waitUntil: 'networkidle', timeout: 10000 });
    await mobilePage.waitForTimeout(1000);
    const tabs = await mobilePage.locator('.van-tab__text').allTextContents();
    result('告警列表', tabs.length >= 2 ? 'PASS' : 'WARN', `标签:${tabs.join(',')}`);
    await mobilePage.screenshot({ path: path.join(__dirname, 'screenshots', 'mobile-alerts.png'), fullPage: false });
  } catch (e) { result('告警列表', 'FAIL', e.message); }

  // Profile
  try {
    await mobilePage.goto(`${MOBILE_BASE}/#/profile`, { waitUntil: 'networkidle', timeout: 10000 });
    await mobilePage.waitForSelector('.profile-header', { timeout: 5000 });
    const nameDisplay = await mobilePage.locator('.name').textContent();
    result('个人中心', nameDisplay ? 'PASS' : 'FAIL', nameDisplay || '');
    await mobilePage.screenshot({ path: path.join(__dirname, 'screenshots', 'mobile-profile.png'), fullPage: false });
  } catch (e) { result('个人中心', 'FAIL', e.message); }

  await browser.close();

  // ─── Summary ───
  console.log('\n========================================');
  console.log('  验证汇总');
  console.log('========================================');
  const passes = RESULTS.filter(r => r.status === 'PASS').length;
  const warns = RESULTS.filter(r => r.status === 'WARN').length;
  const fails = RESULTS.filter(r => r.status === 'FAIL').length;
  console.log(`  ✅ ${passes} 通过  ⚠️ ${warns} 警告  ❌ ${fails} 失败`);
  console.log(`  总计: ${RESULTS.length} 项检查`);
  console.log(`  截图保存至: app/screenshots/`);
  console.log('========================================\n');
}

main().catch(e => { console.error('Verification error:', e); process.exit(1); });
