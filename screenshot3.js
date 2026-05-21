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
  // Hover over first row more button
  const moreBtn = await page.locator('.more-btn').first();
  if (moreBtn) {
    await moreBtn.hover();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'orders_tooltip.png', fullPage: false });
  }
  // Click detail on first row
  const detailBtn = await page.locator('text=详情').first();
  if (detailBtn) {
    await detailBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'orders_detail2.png', fullPage: false });
  }
  await browser.close();
  console.log('done');
})();
