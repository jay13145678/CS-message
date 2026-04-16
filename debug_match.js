const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://vsgg.com/zh/cs2', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const text = await page.evaluate(() => document.body.innerText);
  await browser.close();
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  // 找包含比分的那几行
  for (let i = 0; i < lines.length; i++) {
    if (/^[012]$/.test(lines[i]) && i+2 < lines.length && lines[i+1] === '-') {
      console.log('比分上下文:');
      for (let j = Math.max(0,i-3); j < Math.min(lines.length, i+8); j++) {
        console.log((j === i ? '>' : ' ') + j + ': ' + lines[j]);
      }
      console.log('---');
    }
  }
})();
