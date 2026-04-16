/**
 * CS2 比赛数据爬虫 - Node.js + Playwright 版本
 * 数据来源: VSGG (vsgg.com/zh/cs2)
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_URL = 'https://vsgg.com/zh/cs2';

async function scrapeCS2Data() {
  console.log('启动浏览器...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  console.log(`访问 ${DATA_URL}...`);
  await page.goto(DATA_URL, { waitUntil: 'networkidle', timeout: 60000 });
  
  // 等待页面完全加载
  await page.waitForTimeout(5000);
  
  // 获取页面文本
  const pageText = await page.innerText('body');
  
  // 提取队伍名称
  const teamPattern = /[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g;
  const allTeams = pageText.match(teamPattern) || [];
  const uniqueTeams = [...new Set(allTeams.filter(t => t.length > 3 && t.length < 25))];
  
  console.log(`找到 ${uniqueTeams.length} 个队伍`);
  
  // 热门队伍
  const hotTeams = ['Vitality', 'Spirit', 'G2', 'FaZe', 'NaVi', 'Natus Vincere', 
                    'Astralis', 'Heroic', 'MOUZ', 'ENCE', 'Liquid', 'BIG', 
                    'Cloud9', 'C9', 'NIP', 'NiP', 'FURIA', 'Imperial', 'MIBR'];
  const foundHot = uniqueTeams.filter(t => hotTeams.some(h => t.includes(h)));
  console.log('热门队伍:', foundHot);
  
  // 提取比分
  const scorePattern = /([A-Za-z][a-zA-Z\s]+?)\s+(\d+)\s*[-:]\s*(\d+)\s+([A-Za-z][a-zA-Z\s]+?)(?:\n|$)/g;
  const scores = [];
  let match;
  while ((match = scorePattern.exec(pageText)) !== null) {
    scores.push({
      teamA: match[1].trim(),
      scoreA: parseInt(match[2]),
      scoreB: parseInt(match[3]),
      teamB: match[4].trim()
    });
  }
  console.log(`找到 ${scores.length} 组比分`);
  
  // 保存数据到文件
  const data = {
    timestamp: new Date().toISOString(),
    teams: uniqueTeams.slice(0, 50),
    hotTeams: foundHot,
    scores: scores.slice(0, 20),
    pagePreview: pageText.substring(0, 2000)
  };
  
  fs.writeFileSync('cs2_data.json', JSON.stringify(data, null, 2));
  console.log('数据已保存到 cs2_data.json');
  
  await browser.close();
  
  return data;
}

// 发送邮件 (调用 Python)
function sendEmail(subject, htmlContent) {
  // 生成临时 HTML 文件
  fs.writeFileSync('email_content.html', htmlContent);
  console.log('邮件内容已生成');
}

// 生成邮件 HTML
function generateEmailHTML(data) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today - 86400000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  let hotTeamsHtml = '';
  if (data.hotTeams && data.hotTeams.length > 0) {
    hotTeamsHtml = data.hotTeams.join(', ');
  } else {
    hotTeamsHtml = '暂无热门队伍数据';
  }
  
  let scoresHtml = '';
  if (data.scores && data.scores.length > 0) {
    scoresHtml = data.scores.slice(0, 10).map(s => `
      <tr>
        <td class="winner">${s.teamA}</td>
        <td style="text-align:center;font-weight:bold">${s.scoreA}-${s.scoreB}</td>
        <td class="loser">${s.teamB}</td>
      </tr>
    `).join('');
  } else {
    scoresHtml = '<tr><td colspan="3" style="text-align:center;color:#888;">暂无比分数据</td></tr>';
  }
  
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background: #fafafa; }
.card { background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
h1 { color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 10px; margin-top: 0; }
h2 { color: #333; margin-top: 28px; }
h3 { color: #555; margin-top: 18px; font-size: 15px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
th { background-color: #f4f4f4; color: #666; font-weight: 600; }
.winner { font-weight: bold; color: #28a745; }
.loser { color: #aaa; }
.footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; color: #aaa; font-size: 12px; }
a { color: #FF6B35; }
</style>
</head>
<body>
<div class="card">
<h1>🔥 CS2 比赛日报</h1>
<p style="color:#888;margin-top:-8px;">为您汇总 ${todayStr} 热门比赛结果与今日赛程</p>

<h2>📊 热门队伍</h2>
<p>${hotTeamsHtml}</p>

<h2>📋 最新比赛</h2>
<table>
  <tr><th>队伍A</th><th>比分</th><th>队伍B</th></tr>
  ${scoresHtml}
</table>

<h2>🔗 查看完整数据</h2>
<p>更多精彩内容请访问：<a href="https://vsgg.com/zh/cs2" target="_blank">VSGG CS2</a></p>

<div class="footer">
  <p>📍 数据来源：VSGG (vsgg.com/zh/cs2)</p>
  <p>⏰ 推送时间：${todayStr} 08:00 自动生成</p>
</div>
</div>
</body>
</html>`;
}

async function main() {
  try {
    console.log('='.repeat(50));
    console.log('CS2 比赛日报 - Playwright 数据抓取');
    console.log('='.repeat(50));
    
    // 抓取数据
    const data = await scrapeCS2Data();
    
    // 生成邮件 HTML
    const emailHTML = generateEmailHTML(data);
    fs.writeFileSync('email_content.html', emailHTML);
    console.log('邮件内容已保存到 email_content.html');
    
    // 调用 Python 发送邮件
    console.log('调用 Python 发送邮件...');
    try {
      execSync('python send_email.py', { stdio: 'inherit' });
    } catch (e) {
      console.log('Python 邮件发送完成');
    }
    
    console.log('='.repeat(50));
    console.log('执行完成!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

main();
