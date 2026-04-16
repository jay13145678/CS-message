/**
 * CS2 比赛数据爬虫 - 热门战队版
 * 只抓取热门战队的比赛
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DATA_SOURCE = 'https://vsgg.com/zh/cs2';

// 热门战队列表
const HOT_TEAMS = [
  // 一线战队
  'FaZe', 'Natus Vincere', 'NaVi', 'Vitality', 'G2', 'Heroic', 
  'MOUZ', 'Spirit', 'Liquid', 'ENCE', 'NIP', 'Astralis',
  'Cloud9', 'BIG', 'fnatic', 'Complexity', 'Imperial', 'FURIA',
  'Virtus.pro', 'VP', 'VP.Prodigy', '9z', 'Fluxo', 'MIBR',
  'Aurora', 'Team Liquid', 'Apeks', ' Eternal Fire', 'SINNERS',
  // 中国战队
  'TYLOO', 'RAZER', 'Eclipse', 'IG', 'NewHappy',
  // 二三线但常见的
  'B8', '1win', 'Sashi', 'Alliance', 'TNC', 'Execration',
  'Nuclear', 'Fire Flux', 'Metizport', 'ARCRED', 'Young Ninjas'
];

// 赛制正则
const FORMAT_REGEX = /^BO[123567]$/i;
// 比分数字正则
const SCORE_NUM_REGEX = /^[012]$/;
// 具体时间正则
const TIME_REGEX = /^\d{2}:\d{2}$/;
// 相对时间正则
const RELATIVE_TIME_REGEX = /^\d+分钟后$/;

// 检查是否是热门战队
function isHotTeam(name) {
  if (!name) return false;
  const upper = name.toUpperCase();
  return HOT_TEAMS.some(t => upper.includes(t.toUpperCase()) || t.toUpperCase().includes(upper));
}

// 清理队名（保留完整队名）
function cleanTeamName(name) {
  if (!name) return name;
  // 如果队名很短（2-3个字母），尝试找完整的
  if (name.length <= 4) {
    // 返回原始名
    return name;
  }
  return name;
}

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
    await browser.close();
    
    // 解析数据
    const data = parseVSGGText(bodyText);
    
    console.log(`[VSGG] 找到 ${data.finished.length} 场热门战队已完成比赛`);
    console.log(`[VSGG] 找到 ${data.upcoming.length} 场热门战队未开始比赛`);
    
    // 打印详情
    if (data.finished.length > 0) {
      console.log('\n✅ 已完成比赛:');
      data.finished.forEach(m => console.log(`  ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} [${m.tournament}] ${m.matchTime || ''}`));
    }
    if (data.upcoming.length > 0) {
      console.log('\n📅 即将开始:');
      data.upcoming.forEach(m => console.log(`  ${m.homeTeam} vs ${m.awayTeam} [${m.tournament}] ${m.matchTime || ''}`));
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
  
  const lines = text.split('\n').map(l => l.trim());
  
  let currentTournament = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 匹配分行比分格式：数字 + "-" + 数字
    if (SCORE_NUM_REGEX.test(line) && 
        i + 2 < lines.length && 
        lines[i + 1] === '-' && 
        SCORE_NUM_REGEX.test(lines[i + 2])) {
      
      const score1 = parseInt(line);
      const score2 = parseInt(lines[i + 2]);
      
      // 往前找队A
      let team1 = '', matchTime = '', format = 'BO3';
      for (let k = i - 1; k >= 0 && k > i - 8; k--) {
        const prev = lines[k];
        if (!prev) continue;
        if (isHotTeam(prev) && !team1) {
          team1 = cleanTeamName(prev);
        }
        if (FORMAT_REGEX.test(prev) && format === 'BO3') {
          format = prev.toUpperCase();
        }
        if (TIME_REGEX.test(prev) && !matchTime) {
          matchTime = prev;
        }
      }
      
      // 往后找队B
      let team2 = '';
      for (let k = i + 3; k < lines.length && k < i + 6; k++) {
        const next = lines[k];
        if (next && isHotTeam(next) && !team2) {
          team2 = cleanTeamName(next);
        }
        if (FORMAT_REGEX.test(next) && format === 'BO3') {
          format = next.toUpperCase();
        }
        if (TIME_REGEX.test(next) && !matchTime) {
          matchTime = next;
        }
      }
      
      // 往前找赛事名
      for (let k = i - 1; k >= 0 && k > i - 15; k--) {
        const prev = lines[k];
        if (prev && prev.length > 5 && prev.length < 60 && 
            !FORMAT_REGEX.test(prev) && !isHotTeam(prev) &&
            !TIME_REGEX.test(prev) &&
            prev !== '已结束' && prev !== '未开始') {
          currentTournament = prev;
          break;
        }
      }
      
      // 只有两边都是热门战队才记录
      if (isHotTeam(team1) && isHotTeam(team2) && currentTournament) {
        finished.push({
          tournament: currentTournament,
          homeTeam: team1,
          awayTeam: team2,
          homeScore: score1,
          awayScore: score2,
          format: format,
          matchTime: matchTime,
          winner: score1 > score2 ? team1 : team2,
          source: 'VSGG'
        });
      }
      
      i += 2;
    }
    
    // 匹配 "vs" (未开始)
    if (line.toLowerCase() === 'vs' && i > 0 && i < lines.length - 1) {
      const team1 = cleanTeamName(lines[i - 1]);
      let team2 = '', format = 'BO3', matchTime = '';
      
      // 往后找对手
      for (let j = i + 1; j < lines.length && j < i + 6; j++) {
        const next = lines[j];
        if (next && isHotTeam(next) && !team2) {
          team2 = cleanTeamName(next);
        }
        if (FORMAT_REGEX.test(next) && format === 'BO3') {
          format = next.toUpperCase();
        }
        if (TIME_REGEX.test(next) && !matchTime) {
          matchTime = next;
        }
      }
      
      // 往前找相对时间
      for (let j = i - 1; j >= 0 && j > i - 6; j--) {
        const prev = lines[j];
        if (prev && RELATIVE_TIME_REGEX.test(prev) && !matchTime) {
          matchTime = prev;
        }
      }
      
      // 往前找赛事名
      for (let j = i - 2; j >= 0 && j > i - 20; j--) {
        const prev = lines[j];
        if (prev && prev.length > 5 && prev.length < 60 && 
            !FORMAT_REGEX.test(prev) && !isHotTeam(prev) &&
            !TIME_REGEX.test(prev) &&
            prev !== '已结束' && prev !== '未开始' &&
            !RELATIVE_TIME_REGEX.test(prev)) {
          currentTournament = prev;
          break;
        }
      }
      
      // 只有两边都是热门战队才记录
      if (isHotTeam(team1) && isHotTeam(team2) && team1 !== team2 && currentTournament) {
        upcoming.push({
          tournament: currentTournament,
          homeTeam: team1,
          awayTeam: team2,
          format: format,
          matchTime: matchTime,
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
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${m.format}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#888;">${m.matchTime || '-'}</td>
      </tr>
    `).join('');
  } else {
    finishedHtml = '<tr><td colspan="6" style="padding:16px;text-align:center;color:#888;">暂无热门战队比赛数据</td></tr>';
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
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${m.format}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;"><span style="background:#007bff;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">${m.matchTime || '即将开始'}</span></td>
      </tr>
    `).join('');
  } else {
    upcomingHtml = '<tr><td colspan="6" style="padding:16px;text-align:center;color:#888;">暂无热门战队赛程</td></tr>';
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
<h1>🔥 CS2 比赛日报（热门战队）</h1>
<p class="subtitle">${todayStr}</p>

<h2>✅ 昨日（${yesterdayStr}）已完成比赛</h2>
<table>
  <tr>
    <th style="width:25%;">赛事</th>
    <th style="width:15%;">胜者</th>
    <th style="width:10%;text-align:center;">比分</th>
    <th style="width:15%;">败者</th>
    <th style="width:8%;text-align:center;">赛制</th>
    <th style="width:10%;text-align:center;">时间</th>
  </tr>
  ${finishedHtml}
</table>

<h2>📅 今日（${todayStr}）赛程</h2>
<table>
  <tr>
    <th style="width:25%;">赛事</th>
    <th style="width:15%;">队伍A</th>
    <th style="width:5%;text-align:center;"></th>
    <th style="width:15%;">队伍B</th>
    <th style="width:8%;text-align:center;">赛制</th>
    <th style="width:12%;text-align:center;">开赛时间</th>
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
    console.log('CS2 比赛日报 - 热门战队版');
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
