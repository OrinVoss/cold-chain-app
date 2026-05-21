const { chromium } = require('playwright');
const path = require('path');

const WEB_BASE = 'http://127.0.0.1:5173';
const MOBILE_BASE = 'http://127.0.0.1:5174';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function capture() {
  console.log('\n========================================');
  console.log('  徽农优选 - PPT截图采集');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: true });

  // ==================== Web 管理端 ====================
  console.log('─── Web 管理端截图 ───');

  const webCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2  // 高清截图
  });
  const webPage = await webCtx.newPage();

  // Login
  await webPage.goto(`${WEB_BASE}/#/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await webPage.waitForSelector('input[placeholder="用户名"]', { timeout: 5000 });
  await webPage.fill('input[placeholder="用户名"]', 'admin');
  await webPage.fill('input[placeholder="密码"]', 'admin123');
  await webPage.click('button:has-text("登 录")');
  await webPage.waitForURL('**/dashboard', { timeout: 5000 });
  console.log('  已登录 Web 管理端');

  // 01 - Dashboard
  await webPage.waitForSelector('.kpi-card', { timeout: 8000 });
  await webPage.waitForTimeout(2000); // 等地图和实时数据加载
  await webPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'web-01-dashboard.png'),
    fullPage: false
  });
  console.log('  ✅ web-01-dashboard.png');

  // 02 - Temperature Monitoring
  await webPage.goto(`${WEB_BASE}/#/monitoring`, { waitUntil: 'networkidle', timeout: 10000 });
  await webPage.waitForTimeout(3000); // 等ECharts渲染和数据
  await webPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'web-02-monitoring.png'),
    fullPage: false
  });
  console.log('  ✅ web-02-monitoring.png');

  // 03 - Orders
  await webPage.goto(`${WEB_BASE}/#/orders`, { waitUntil: 'networkidle', timeout: 10000 });
  await webPage.waitForSelector('.el-table', { timeout: 5000 });
  await webPage.waitForTimeout(500);
  await webPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'web-03-orders.png'),
    fullPage: false
  });
  console.log('  ✅ web-03-orders.png');

  // 04 - Shipments
  await webPage.goto(`${WEB_BASE}/#/shipments`, { waitUntil: 'networkidle', timeout: 10000 });
  await webPage.waitForTimeout(1500);
  await webPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'web-04-shipments.png'),
    fullPage: false
  });
  console.log('  ✅ web-04-shipments.png');

  // 05 - Alerts
  await webPage.goto(`${WEB_BASE}/#/alerts`, { waitUntil: 'networkidle', timeout: 10000 });
  await webPage.waitForTimeout(1000);
  await webPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'web-05-alerts.png'),
    fullPage: false
  });
  console.log('  ✅ web-05-alerts.png');

  await webCtx.close();

  // ==================== 移动司机端 ====================
  console.log('\n─── 移动司机端截图 ───');

  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2  // 高清截图
  });
  const mPage = await mobileCtx.newPage();

  // Login via UI
  await mPage.goto(`${MOBILE_BASE}/#/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await mPage.waitForTimeout(1000);

  // Monitor console for errors
  mPage.on('console', msg => {
    if (msg.type() === 'error') console.log('  [console error]', msg.text());
  });
  mPage.on('pageerror', err => console.log('  [page error]', err.message));

  // Fill credentials
  await mPage.locator('input[placeholder="请输入用户名"]').first().fill('driver1');
  await mPage.locator('input[placeholder="请输入密码"]').first().fill('123456');

  // Wait for network and click
  const loginPromise = mPage.waitForResponse(resp => resp.url().includes('/api/v1/auth/login') && resp.status() === 200, { timeout: 10000 });
  await mPage.locator('.van-button').first().click();
  try {
    const loginResp = await loginPromise;
    console.log('  登录API响应:', loginResp.status());
    const loginData = await loginResp.json();
    console.log('  登录返回:', loginData.user?.display_name || 'OK');
  } catch (e) {
    console.log('  登录API未捕获到响应:', e.message);
  }

  await mPage.waitForTimeout(3000);
  console.log('  最终URL:', mPage.url());

  // Take screenshot of whatever we see
  await mPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'mobile-01-home.png'),
    fullPage: false
  });
  console.log('  ✅ mobile-01-home.png');

  // 07 - Tasks
  await mPage.goto(`${MOBILE_BASE}/#/tasks`, { waitUntil: 'networkidle', timeout: 10000 });
  await mPage.waitForTimeout(1500);
  await mPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'mobile-02-tasks.png'),
    fullPage: false
  });
  console.log('  ✅ mobile-02-tasks.png');

  // 08 - Task Detail (点击第一个任务)
  try {
    const firstTask = mPage.locator('.task-card').first();
    if (await firstTask.count() > 0) {
      await firstTask.click();
      await mPage.waitForTimeout(1500);
      await mPage.screenshot({
        path: path.join(SCREENSHOT_DIR, 'mobile-03-task-detail.png'),
        fullPage: false
      });
      console.log('  ✅ mobile-03-task-detail.png');
    } else {
      console.log('  ⚠️ 无任务，跳过任务详情截图');
      await mPage.screenshot({
        path: path.join(SCREENSHOT_DIR, 'mobile-03-task-detail.png'),
        fullPage: false
      });
    }
  } catch (e) {
    console.log('  ⚠️ 任务详情截图失败:', e.message);
    await mPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mobile-03-task-detail.png'),
      fullPage: false
    });
  }

  // 09 - Monitor
  await mPage.goto(`${MOBILE_BASE}/#/monitor`, { waitUntil: 'networkidle', timeout: 10000 });
  await mPage.waitForTimeout(3000); // 等温度计渲染
  await mPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'mobile-04-monitor.png'),
    fullPage: false
  });
  console.log('  ✅ mobile-04-monitor.png');

  // 10 - Alerts
  await mPage.goto(`${MOBILE_BASE}/#/alerts`, { waitUntil: 'networkidle', timeout: 10000 });
  await mPage.waitForTimeout(1000);
  await mPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'mobile-05-alerts.png'),
    fullPage: false
  });
  console.log('  ✅ mobile-05-alerts.png');

  await mPage.close();
  await browser.close();

  console.log('\n========================================');
  console.log('  截图采集完成! 共10张');
  console.log('  保存路径:', SCREENSHOT_DIR);
  console.log('========================================\n');
}

capture().catch(e => {
  console.error('截图采集失败:', e);
  process.exit(1);
});
