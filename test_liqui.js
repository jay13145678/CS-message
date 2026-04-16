const { chromium } = require('playwright');

async function testLiquipedia() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://liquipedia.net/counterstrike/Intel_Extreme_Masters_Rio_2026', { timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const text = await page.evaluate(() => document.body.innerText);
  await browser.close();
  
  // 查找比赛相关内容
  const lines = text.split('\n').filter(l => l.trim());
  for (let i = 0; i < 100; i++) {
    console.log(i + ': ' + lines[i]);
  }
}

testLiquipedia();
