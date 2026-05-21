const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5173/#/login');
  await page.waitForTimeout(1000);
  await page.fill('input[type=text]', 'admin');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button');
  await page.waitForTimeout(1500);
  await page.goto('http://localhost:5173/#/orders');
  await page.waitForTimeout(2000);
  // Hover over first row action area to trigger tooltip
  const firstRowAction = await page.locator('.action-cell').first();
  if (firstRowAction) {
    await firstRowAction.hover();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: 'orders_action.png', fullPage: false });
  await browser.close();
  console.log('done');
})();
