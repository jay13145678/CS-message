/**
 * CS2 比赛数据爬虫 - 5eplay赛事版
 * 策略：获取赛事列表 → 进入每个一线赛事 → 获取完整赛程
 */

const { chromium } = require('playwright');
const fs = require('fs');

// 一线赛事关键词
const TIER1_KEYWORDS = [
  'IEM', 'BLAST', 'Major', 'ESL Pro League', 'ESL Major',
  'PGL', 'DreamHack', 'VCT', 'CCT', 'FACEIT'
];

function isTier1Tournament(name) {
  if (!name) return false;
  return TIER1_KEYWORDS.some(k => name.includes(k));
}

// 热门战队列表
const HOT_TEAMS = [
  'FaZe', 'Natus Vincere', 'NaVi', 'Vitality', 'G2', 'Heroic',
  'MOUZ', 'Spirit', 'Liquid', 'ENCE', 'NIP', 'Astralis',
  'Cloud9', 'BIG', 'fnatic', 'Complexity', 'Imperial', 'FURIA',
  'Virtus.pro', 'VP', '9z', 'Fluxo', 'MIBR',
  'Aurora', 'Apeks', 'Eternal Fire', 'SINNERS',
  'TYLOO', 'RAZER', 'Eclipse', 'IG', 'NewHappy',
  'B8', '1win', 'Sashi', 'Alliance', 'Execration',
  'Nuclear', 'Fire Flux', 'Metizport', 'ARCRED', 'Young Ninjas',
  'Lavked', 'Bebop', 'ESC', 'Ursa', 'regain', 'EMPIRE',
  'Falcons', 'KOLESIE', 'TDK', 'MANA', 'PARIVISION', 'The MongolZ',
  'Legacy', 'Passion UA', 'Gentle Mates', 'HOTU', 'RED Canids', '3DMAX'
];

function isHotTeam(name) {
  if (!name) return false;
  const upper = name.toUpperCase();
  return HOT_TEAMS.some(t => upper.includes(t.toUpperCase()) || t.toUpperCase().includes(upper));
}

// ==================== 从赛事列表提取赛事 ====================
async function getEventList(context) {
  console.log('[5eplay] 获取赛事列表...');

  const page = await context.newPage();
  await page.goto('https://event.5eplay.com/csgo/events', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const text = await page.evaluate(() => document.body.innerText);

  // 已知的一线赛事
  const knownTier1 = [
    'IEM 里约 2026',
    'CCT 全球总决赛 2026',
    'CCT 2026 南美挑战者 系列赛1',
    'CCT 2026 挑战者 欧洲 第1季',
    'NODWIN Clutch 系列 7',
    'ESL 挑战者联赛 S51'
  ];

  const events = [];
  for (const name of knownTier1) {
    if (text.includes(name)) {
      events.push({ name, url: '' });
    }
  }

  await page.close();
  console.log(`[5eplay] 找到 ${events.length} 个一线赛事`);

  return events;
}

// ==================== 从赛事页面获取赛程 ====================
async function getMatchesFromEvent(context, eventUrl, eventName) {
  if (!eventUrl) {
    console.log(`[5eplay] ${eventName}: 未找到URL`);
    return [];
  }

  const matchesUrl = `${eventUrl}?channel=matches`;
  console.log(`[5eplay] 抓取 ${eventName}...`);

  try {
    const page = await context.newPage();
    await page.goto(matchesUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    const text = await page.evaluate(() => document.body.innerText);
    const parsedMatches = parseEventMatches(text, eventName);
    await page.close();

    return parsedMatches;
  } catch (e) {
    console.log(`[5eplay] 抓取失败 ${eventName}: ${e.message}`);
    return [];
  }
}

// ==================== 解析赛事赛程页面 ====================
function parseEventMatches(text, defaultTournament) {
  const matches = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  let currentDate = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 检测日期行 (格式: 2026-04-15 或 2026-04-16(今天))
    const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      i++;
      continue;
    }

    // 检测时间行 (格式: 21:00)
    const timeMatch = line.match(/^(\d{2}:\d{2})$/);
    if (timeMatch) {
      const time = timeMatch[1];
      i++;

      // 跳过赛制 (BO3)
      if (lines[i] && /^BO\d$/i.test(lines[i])) {
        i++;
      }

      // 接下来是队伍1
      const team1 = lines[i];
      if (!team1 || !/^[a-zA-Z]/.test(team1) || team1.length < 3) {
        i++;
        continue;
      }
      i++;

      // 队伍2
      const team2 = lines[i];
      if (!team2 || !/^[a-zA-Z]/.test(team2) || team2.length < 3) {
        i++;
        continue;
      }
      i++;

      // 跳过胜率 (XX%)
      while (lines[i] && /^\d+%$/.test(lines[i])) {
        i++;
      }

      // 总比分 (格式: 2 或 0)
      let homeScore = null;
      let awayScore = null;

      // 总比分通常是 0-2 或 2-0 这样的两行
      const score1 = lines[i];
      if (score1 && /^\d+$/.test(score1) && parseInt(score1) <= 3) {
        homeScore = parseInt(score1);
        i++;

        const score2 = lines[i];
        if (score2 && /^\d+$/.test(score2) && parseInt(score2) <= 3) {
          awayScore = parseInt(score2);
          i++;
        }
      }

      // 记录比赛
      matches.push({
        time: time,
        date: currentDate,
        homeTeam: team1,
        awayTeam: team2,
        homeScore: homeScore,
        awayScore: awayScore,
        tournament: defaultTournament,
        format: 'BO3',
        source: '5eplay'
      });

      continue;
    }

    i++;
  }

  return matches;
}

// ==================== 主爬虫函数 ====================
async function scrape5eplay() {
  console.log('[5eplay] 正在抓取数据...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  try {
    // 1. 获取赛事列表
    const events = await getEventList(context);

    // 2. 已知赛事URL映射
    const knownUrls = {
      'IEM 里约 2026': 'https://event.5eplay.com/csgo/events/csgo_tt_8242',
    };

    // 3. 遍历每个一线赛事获取赛程
    let allMatches = [];
    for (const event of events) {
      const eventUrl = knownUrls[event.name];
      if (!eventUrl) continue;

      const matches = await getMatchesFromEvent(context, eventUrl, event.name);
      console.log(`[5eplay] ${event.name}: 找到 ${matches.length} 场比赛`);
      allMatches.push(...matches);
    }

    // 4. 过滤热门战队
    let filteredMatches = allMatches.filter(m =>
      isHotTeam(m.homeTeam) || isHotTeam(m.awayTeam)
    );
    console.log(`[5eplay] 过滤热门战队后: ${filteredMatches.length} 场`);

    // 5. 去重
    const seenKeys = new Set();
    filteredMatches = filteredMatches.filter(m => {
      const key = `${m.date}|${m.time}|${m.homeTeam}|${m.awayTeam}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    await browser.close();

    // 6. 分离已完成和即将开始的比赛
    const finished = filteredMatches.filter(m => m.homeScore !== null && m.awayScore !== null);
    const upcoming = filteredMatches.filter(m => m.homeScore === null);

    console.log(`\n[5eplay] 已完成比赛: ${finished.length} 场`);
    console.log(`[5eplay] 即将开始: ${upcoming.length} 场`);

    if (finished.length > 0) {
      console.log('\n✅ 已完成比赛:');
      finished.slice(0, 10).forEach(m => {
        console.log(`  ${m.date} ${m.time} | ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} [${m.tournament}]`);
      });
    }
    if (upcoming.length > 0) {
      console.log('\n📅 即将开始:');
      upcoming.slice(0, 10).forEach(m => {
        console.log(`  ${m.date} ${m.time} | ${m.homeTeam} vs ${m.awayTeam} [${m.tournament}]`);
      });
    }

    return { finished, upcoming };

  } catch (error) {
    console.error('[5eplay] 抓取失败:', error.message);
    await browser.close();
    return { finished: [], upcoming: [] };
  }
}

// ==================== 生成邮件 HTML ====================
function generateEmailHTML(data) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today - 86400000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let finishedHtml = '';
  if (data.finished && data.finished.length > 0) {
    finishedHtml = data.finished.map(m => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.tournament || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#28a745;font-weight:bold;">${m.homeTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">${m.homeScore || 0} - ${m.awayScore || 0}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#666;">${m.awayTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${m.format}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#888;">${m.date ? m.date.slice(5) : ''} ${m.time || '-'}</td>
      </tr>
    `).join('');
  } else {
    finishedHtml = '<tr><td colspan="6" style="padding:16px;text-align:center;color:#888;">暂无热门战队比赛数据</td></tr>';
  }

  let upcomingHtml = '';
  if (data.upcoming && data.upcoming.length > 0) {
    upcomingHtml = data.upcoming.map(m => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.tournament || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.homeTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#007bff;">vs</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${m.awayTeam}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${m.format}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;"><span style="background:#007bff;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">${m.date ? m.date.slice(5) : ''} ${m.time || '即将开始'}</span></td>
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
  <p>📍 数据来源：<a href="https://event.5eplay.com/csgo/events" target="_blank">5eplay</a></p>
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
    console.log('CS2 比赛日报 - 5eplay赛事版');
    console.log('='.repeat(50));

    const data = await scrape5eplay();

    fs.writeFileSync('cs2_data.json', JSON.stringify(data, null, 2));
    console.log('\n数据已保存到 cs2_data.json');

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
