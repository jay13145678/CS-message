/**
 * CS2 比赛数据爬虫 - Node.js + Playwright 版本
 * 数据来源: VSGG (vsgg.com/zh/cs2)
 * 基于真实页面结构重写
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DATA_URL = 'https://vsgg.com/zh/cs2';

async function scrapeCS2Data() {
  console.log('启动浏览器...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ 
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  console.log(`访问 ${DATA_URL}...`);
  
  try {
    await page.goto(DATA_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.log('页面加载超时，继续等待...');
  }
  
  // 等待页面渲染
  await page.waitForTimeout(3000);
  
  // 等待比赛列表加载
  try {
    await page.waitForSelector('.match-item', { timeout: 10000 });
  } catch (e) {
    console.log('未找到 match-item，尝试其他选择器...');
  }
  
  // 提取比赛数据
  const matches = await page.evaluate(() => {
    const results = {
      finished: [],   // 已结束比赛
      upcoming: []    // 未开始比赛
    };
    
    // 查找所有比赛项
    const matchItems = document.querySelectorAll('.match-item');
    
    matchItems.forEach(item => {
      const status = item.getAttribute('data-status') || 
                     (item.classList.contains('finished') ? 'finished' : 'upcoming');
      
      // 获取赛事名称
      const tournamentEl = item.querySelector('.tournament-name');
      const tournament = tournamentEl ? tournamentEl.textContent.trim() : '未知赛事';
      
      // 获取队伍名称
      const homeTeamEl = item.querySelector('.team.home .team-name');
      const awayTeamEl = item.querySelector('.team.away .team-name');
      const homeTeam = homeTeamEl ? homeTeamEl.textContent.trim() : '';
      const awayTeam = awayTeamEl ? awayTeamEl.textContent.trim() : '';
      
      // 获取赛制
      const formatEl = item.querySelector('.match-format');
      const format = formatEl ? formatEl.textContent.trim() : '';
      
      // 提取比分（仅已完成比赛）
      let homeScore = null;
      let awayScore = null;
      let winner = null;
      
      if (status === 'finished' || item.classList.contains('finished')) {
        const homeScoreEl = item.querySelector('.team.home .score');
        const awayScoreEl = item.querySelector('.team.away .score');
        homeScore = homeScoreEl ? parseInt(homeScoreEl.textContent) : null;
        awayScore = awayScoreEl ? parseInt(awayScoreEl.textContent) : null;
        
        // 判断获胜方
        const homeTeamEl2 = item.querySelector('.team.home');
        if (homeTeamEl2 && homeTeamEl2.classList.contains('winner')) {
          winner = homeTeam;
        } else {
          winner = awayTeam;
        }
      }
      
      // 只保留有效数据
      if (homeTeam && awayTeam) {
        const matchData = {
          tournament,
          homeTeam,
          awayTeam,
          format,
          ...(status === 'finished' || item.classList.contains('finished') ? {
            homeScore,
            awayScore,
            winner
          } : {})
        };
        
        if (status === 'finished' || item.classList.contains('finished')) {
          results.finished.push(matchData);
        } else {
          results.upcoming.push(matchData);
        }
      }
    });
    
    return results;
  });
  
  console.log(`找到 ${matches.finished.length} 场已结束比赛`);
  console.log(`找到 ${matches.upcoming.length} 场未开始比赛`);
  
  // 保存原始数据
  fs.writeFileSync('cs2_data.json', JSON.stringify(matches, null, 2));
  console.log('数据已保存到 cs2_data.json');
  
  await browser.close();
  return matches;
}

// 生成邮件 HTML
function generateEmailHTML(data) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today - 86400000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  // 昨日已结束比赛
  let finishedHtml = '';
  if (data.finished && data.finished.length > 0) {
    finishedHtml = data.finished.map(m => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.tournament}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#28a745;font-weight:bold;">${m.homeTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">${m.homeScore || 0} - ${m.awayScore || 0}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#666;">${m.awayTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.format}</td>
      </tr>
    `).join('');
  } else {
    finishedHtml = '<tr><td colspan="5" style="padding:16px;text-align:center;color:#888;">暂无比赛数据</td></tr>';
  }
  
  // 今日赛程
  let upcomingHtml = '';
  if (data.upcoming && data.upcoming.length > 0) {
    upcomingHtml = data.upcoming.slice(0, 15).map(m => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.tournament}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.homeTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#007bff;">vs</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.awayTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.format}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;"><span style="background:#007bff;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">即将开始</span></td>
      </tr>
    `).join('');
  } else {
    upcomingHtml = '<tr><td colspan="6" style="padding:16px;text-align:center;color:#888;">暂无赛程数据</td></tr>';
  }
  
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
.card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
h1 { color: #FF6B35; margin: 0 0 4px 0; font-size: 24px; }
.subtitle { color: #888; margin: 0 0 20px 0; font-size: 14px; }
h2 { color: #333; margin: 24px 0 12px 0; font-size: 18px; border-left: 4px solid #FF6B35; padding-left: 12px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; background: #fff; }
th { background: #f8f8f8; color: #666; font-weight: 600; text-align: left; padding: 10px 8px; }
td { padding: 8px; }
.winner { color: #28a745; font-weight: bold; }
.footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 12px; text-align: center; }
a { color: #FF6B35; text-decoration: none; }
</style>
</head>
<body>
<div class="card">
<h1>🔥 CS2 比赛日报</h1>
<p class="subtitle">${todayStr} · 数据来源 VSGG</p>

<h2>✅ 昨日（${yesterdayStr}）已完成比赛</h2>
<table>
  <tr>
    <th style="width:30%;">赛事</th>
    <th style="width:20%;">胜者</th>
    <th style="width:15%;text-align:center;">比分</th>
    <th style="width:20%;">败者</th>
    <th style="width:15%;">赛制</th>
  </tr>
  ${finishedHtml}
</table>

<h2>📅 今日（${todayStr}）赛程</h2>
<table>
  <tr>
    <th style="width:28%;">赛事</th>
    <th style="width:18%;">队伍A</th>
    <th style="width:8%;text-align:center;"></th>
    <th style="width:18%;">队伍B</th>
    <th style="width:12%;">赛制</th>
    <th style="width:16%;">状态</th>
  </tr>
  ${upcomingHtml}
</table>

<div class="footer">
  <p>📍 数据来源：<a href="https://vsgg.com/zh/cs2" target="_blank">VSGG CS2</a></p>
  <p>⏰ 自动生成于 ${todayStr} 08:00</p>
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
    
    console.log('='.repeat(50));
    console.log('执行完成!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

main();
