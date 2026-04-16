/**
 * CS2 比赛数据爬虫 - VSGG 版本
 * 使用 Playwright + 正则解析
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DATA_SOURCE = 'https://vsgg.com/zh/cs2';

// ==================== VSGG 爬虫 ====================
async function scrapeVSGG() {
  console.log('[VSGG] 正在抓取数据...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  try {
    await page.goto(DATA_SOURCE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // 获取页面文本内容
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    // 关闭浏览器
    await browser.close();
    
    // 解析数据
    const data = parseVSGGText(bodyText);
    
    console.log(`[VSGG] 找到 ${data.finished.length} 场已结束比赛`);
    console.log(`[VSGG] 找到 ${data.upcoming.length} 场未开始比赛`);
    
    // 打印详情
    if (data.finished.length > 0) {
      console.log('\n已完成比赛:');
      data.finished.forEach(m => console.log(`  ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} [${m.tournament}]`));
    }
    if (data.upcoming.length > 0) {
      console.log('\n即将开始:');
      data.upcoming.forEach(m => console.log(`  ${m.homeTeam} vs ${m.awayTeam} [${m.tournament}]`));
    }
    
    return data;
    
  } catch (error) {
    console.error('[VSGG] 抓取失败:', error.message);
    await browser.close();
    return { finished: [], upcoming: [] };
  }
}

// ==================== 文本解析 ====================
function parseVSGGText(text) {
  const finished = [];
  const upcoming = [];
  
  // 分割文本行
  const lines = text.split('\n').map(l => l.trim());
  
  let currentTournament = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 匹配单个比分数字 (0, 1, 2)，且下一个非空行是 "-"
    if (line.match(/^[012]$/) && i + 1 < lines.length && lines[i + 1].trim() === '-') {
      const score1 = parseInt(line);
      // 继续找下一个比分
      for (let j = i + 2; j < lines.length && j < i + 5; j++) {
        const nextLine = lines[j].trim();
        if (nextLine.match(/^[012]$/)) {
          const score2 = parseInt(nextLine);
          
          // 往前找两支队伍
          let team1 = '', team2 = '', format = '';
          for (let k = i - 1; k >= 0 && k > i - 6; k--) {
            const prev = lines[k].trim();
            if (prev && prev.length > 1 && !prev.match(/^(已结束|未开始)$/) && !prev.match(/^[\d:]+$/)) {
              if (!team2 && prev.match(/^[A-Za-z0-9]+$/)) {
                team2 = prev;
              } else if (!team1 && prev.match(/^[A-Za-z0-9]+$/) && prev !== team2) {
                team1 = prev;
              }
            }
            if (prev.match(/^BO[1235]$/)) {
              format = prev;
            }
          }
          
          // 找赛事名
          for (let k = i - 1; k >= 0 && k > i - 15; k--) {
            const prev = lines[k].trim();
            if (prev && prev.length > 5 && prev.length < 50 && 
                !prev.match(/^(已结束|未开始)$/) && !prev.match(/^[\d:]+$/)) {
              if (!prev.match(/^BO[1235]$/) && !prev.match(/Vitality|FURIA|MOUZ|G2|Spirit|Alliance|ESC|TDK|MANA|B8|Sashi|TNC|Aurora|KOLESIE|UNiTY|Falcons|Natus Vincere|regain|EMPIRE|LA|BE$/)) {
                currentTournament = prev;
                break;
              }
            }
          }
          
          if (team1 && team2 && currentTournament) {
            finished.push({
              tournament: currentTournament,
              homeTeam: team1,
              awayTeam: team2,
              homeScore: score1,
              awayScore: score2,
              format: format || 'BO3',
              winner: score1 > score2 ? team1 : team2,
              source: 'VSGG'
            });
          }
          
          i = j; // 跳过已处理的行
          break;
        }
      }
    }
    
    // 匹配 "vs" (未开始)
    if (line.toLowerCase() === 'vs' && i > 0 && i < lines.length - 1) {
      const team1 = lines[i - 1].trim();
      let team2 = '', format = '';
      
      // 往后找对手
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        const next = lines[j].trim();
        if (next && !next.match(/^[\d:]+$/) && next.length > 1) {
          if (next.match(/^BO[1235]$/)) {
            format = next;
          } else if (!team2) {
            team2 = next;
          }
        }
      }
      
      // 往前找赛事名
      for (let j = i - 2; j >= 0 && j > i - 15; j--) {
        const prev = lines[j].trim();
        if (prev && prev.length > 5 && prev.length < 50 && 
            !prev.match(/^(已结束|未开始)$/) && !prev.match(/^[\d:]+$/)) {
          if (!prev.match(/^BO[1235]$/) && !prev.match(/ARCRED|Metizport|Young Ninjas|Fire Flux|LA|BE|ESC|Ursa|Nuclear TigeRES|1win$/)) {
            currentTournament = prev;
            break;
          }
        }
      }
      
      if (team1 && team2 && team1 !== team2 && currentTournament) {
        upcoming.push({
          tournament: currentTournament,
          homeTeam: team1,
          awayTeam: team2,
          format: format || 'BO3',
          source: 'VSGG'
        });
      }
    }
  }
  
  // 去重
  const seenFinished = new Set();
  const uniqueFinished = finished.filter(m => {
    const key = `${m.homeTeam}|${m.awayTeam}|${m.homeScore}-${m.awayScore}`;
    if (seenFinished.has(key)) return false;
    seenFinished.add(key);
    return true;
  });
  
  const seenUpcoming = new Set();
  const uniqueUpcoming = upcoming.filter(m => {
    const key = `${m.homeTeam}|${m.awayTeam}`;
    if (seenUpcoming.has(key)) return false;
    seenUpcoming.add(key);
    return true;
  });
  
  return {
    finished: uniqueFinished,
    upcoming: uniqueUpcoming
  };
}

// ==================== 生成邮件 HTML ====================
function generateEmailHTML(data) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today - 86400000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  // 昨日已结束比赛
  let finishedHtml = '';
  if (data.finished && data.finished.length > 0) {
    finishedHtml = data.finished.slice(0, 15).map(m => `
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
        <td style="padding:8px;border-bottom:1px solid #eee;"><span style="background:#007bff;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">即将开始</span></td>
      </tr>
    `).join('');
  } else {
    upcomingHtml = '<tr><td colspan="5" style="padding:16px;text-align:center;color:#888;">暂无赛程数据</td></tr>';
  }
  
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
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
<p class="subtitle">${todayStr}</p>

<h2>✅ 昨日（${yesterdayStr}）已完成比赛</h2>
<table>
  <tr>
    <th style="width:30%;">赛事</th>
    <th style="width:18%;">胜者</th>
    <th style="width:12%;text-align:center;">比分</th>
    <th style="width:18%;">败者</th>
    <th style="width:10%;">赛制</th>
  </tr>
  ${finishedHtml}
</table>

<h2>📅 今日（${todayStr}）赛程</h2>
<table>
  <tr>
    <th style="width:30%;">赛事</th>
    <th style="width:18%;">队伍A</th>
    <th style="width:8%;text-align:center;"></th>
    <th style="width:18%;">队伍B</th>
    <th style="width:10%;">状态</th>
  </tr>
  ${upcomingHtml}
</table>

<div class="footer">
  <p>📍 数据来源：<a href="https://vsgg.com/zh/cs2" target="_blank">VSGG</a></p>
  <p>⏰ 自动生成于 ${todayStr} 08:00</p>
</div>
</div>
</body>
</html>`;
}

// ==================== 主函数 ====================
async function main() {
  try {
    console.log('='.repeat(50));
    console.log('CS2 比赛日报 - VSGG Playwright 版本');
    console.log('='.repeat(50));
    
    // 抓取数据
    const data = await scrapeVSGG();
    
    // 保存原始数据
    fs.writeFileSync('cs2_data.json', JSON.stringify(data, null, 2));
    console.log('\n数据已保存到 cs2_data.json');
    
    // 生成邮件 HTML
    const emailHTML = generateEmailHTML(data);
    fs.writeFileSync('email_content.html', emailHTML);
    console.log('邮件内容已保存到 email_content.html');
    
    console.log('\n' + '='.repeat(50));
    console.log('执行完成!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

main();
