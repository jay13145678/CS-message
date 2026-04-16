/**
 * CS2 比赛数据爬虫 - 5eplay版
 * 数据源：https://event.5eplay.com/csgo/matches
 */

const { chromium } = require('playwright');
const fs = require('fs');

// 5eplay 页面URL
const URL_RESULTS = 'https://event.5eplay.com/csgo/matches?tab=result';
const URL_UPCOMING = 'https://event.5eplay.com/csgo/matches?tab=schedule';

// 一线赛事列表
const TIER1_TOURNAMENTS = [
  'IEM', 'BLAST', 'Major', 'ESL Pro League', 'ESL Major',
  'PGL', 'DreamHack', 'VCT', 'CCT', 'FACEIT'
];

function isTier1Tournament(name) {
  if (!name) return false;
  return TIER1_TOURNAMENTS.some(t => name.includes(t));
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
  'Falcons', 'KOLESIE', 'TDK', 'MANA', 'PARIVISION', 'The MongolZ'
];

function isHotTeam(name) {
  if (!name) return false;
  const upper = name.toUpperCase();
  return HOT_TEAMS.some(t => upper.includes(t.toUpperCase()) || t.toUpperCase().includes(upper));
}

// 检测是否是队伍名（不是时间、赛制、百分比等）
function isTeamName(candidate) {
  if (!candidate || candidate.length < 2 || candidate.length > 25) return false;
  // 排除已知格式
  if (/^\d{2}:\d{2}$/.test(candidate)) return false; // 时间
  if (/^\d{4}-\d{2}/.test(candidate)) return false; // 日期
  // 排除所有赛制格式（BO1/BO2/BO3/BO5等）
  if (/^BO\d$/i.test(candidate)) return false; // BO1/BO2/BO3等
  if (/^BO[三五1-9]$/i.test(candidate)) return false; // BO三/BO五等
  if (/^\d+%$/.test(candidate)) return false; // 百分比
  if (/^\d+-\d+$/.test(candidate)) return false; // 比分 (如 13-5)
  if (/^--$/.test(candidate)) return false; // 占位符
  if (/^(进行中|赛前分析|已结束)$/.test(candidate)) return false; // 状态
  // 排除全数字（比分、地图数等）
  if (/^\d+$/.test(candidate)) return false;
  // 排除包含中文的（通常是赛事名）
  if (/[\u4e00-\u9fa5]/.test(candidate)) return false;
  // 队名通常以字母开头且至少3个字符
  if (!/^[a-zA-Z]/.test(candidate)) return false;
  if (candidate.length < 3) return false;
  // 排除常见非队名
  if (/^(CS|ESC|ESCAPE|TBD|NEXT)$/i.test(candidate)) return false;
  return true;
}

// ==================== 5eplay 爬虫 ====================
async function scrape5eplay() {
  console.log('[5eplay] 正在抓取数据...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  try {
    // 抓取赛果页面
    console.log('[5eplay] 抓取赛果页面...');
    await page.goto(URL_RESULTS, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const resultsText = await page.evaluate(() => document.body.innerText);
    const allMatches = parse5eplayLines(resultsText);

    // 分离已完成和未开始的比赛
    const finished = allMatches.filter(m => m.homeScore !== null && m.awayScore !== null && (m.homeScore > 0 || m.awayScore > 0));
    const upcoming = allMatches.filter(m => m.homeScore === null || (m.homeScore === 0 && m.awayScore === 0));

    await browser.close();

    console.log(`[5eplay] 找到 ${finished.length} 场已完成比赛`);
    console.log(`[5eplay] 找到 ${upcoming.length} 场即将开始的比赛`);

    if (finished.length > 0) {
      console.log('\n✅ 已完成比赛:');
      finished.slice(0, 10).forEach(m => {
        console.log(`  ${m.time} | ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} [${m.tournament}]`);
      });
    }
    if (upcoming.length > 0) {
      console.log('\n📅 即将开始:');
      upcoming.slice(0, 10).forEach(m => {
        console.log(`  ${m.time} | ${m.homeTeam} vs ${m.awayTeam} [${m.tournament}]`);
      });
    }

    return { finished, upcoming };

  } catch (error) {
    console.error('[5eplay] 抓取失败:', error.message);
    await browser.close();
    return { finished: [], upcoming: [] };
  }
}

// ==================== 5eplay 文本解析 ====================
function parse5eplayLines(text) {
  const matches = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // 扫描所有可能的队伍名位置
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 只从可能是队伍名的行开始
    if (!isTeamName(line)) continue;

    let team1 = line;

    // 往后找第二支队伍
    let team2 = '';
    let format = 'BO3';
    let time = '';
    let tournament = '';
    let homeScore = null;
    let awayScore = null;

    let j = i + 1;
    let foundSecondTeam = false;
    let foundFormat = false;

    while (j < i + 25 && j < lines.length) {
      const curr = lines[j];

      // 检测第二支队伍
      if (!foundSecondTeam && isTeamName(curr) && curr !== team1) {
        team2 = curr;
        foundSecondTeam = true;
        j++;
        continue;
      }

      // 检测赛制
      if (!foundFormat && /^BO[三五123]$/i.test(curr)) {
        format = curr.toUpperCase().replace('五', '5').replace('三', '3');
        foundFormat = true;
        j++;
        continue;
      }

      // 检测时间
      if (/^\d{2}:\d{2}$/.test(curr) && !time) {
        time = curr;
        j++;
        continue;
      }

      // 检测比分 (格式: X-Y 其中X和Y是数字)
      if (foundSecondTeam && /^\d+-\d+$/.test(curr)) {
        const [s1, s2] = curr.split('-').map(Number);
        // 有实际比分的才记录
        if (s1 > 0 || s2 > 0) {
          homeScore = s1;
          awayScore = s2;
        }
        j++;
        continue;
      }

      // 检测赛事名（包含中文的较长字符串）
      if (curr.length > 4 && /[\u4e00-\u9fa5]/.test(curr) && !tournament) {
        tournament = curr;
        j++;
        continue;
      }

      j++;
    }

    // 过滤：至少要有两支队伍
    if (!team1 || !team2) continue;

    // 过滤：至少有一支热门战队
    if (!isHotTeam(team1) && !isHotTeam(team2)) continue;

    // 过滤：一线赛事
    if (!isTier1Tournament(tournament)) continue;

    // 过滤：排除明显错误的
    if (team1.length < 2 || team2.length < 2) continue;

    matches.push({
      time: time,
      homeTeam: team1,
      awayTeam: team2,
      homeScore: homeScore,
      awayScore: awayScore,
      tournament: tournament,
      format: format,
      source: '5eplay',
      winner: homeScore !== null && awayScore !== null
        ? (homeScore > awayScore ? team1 : team2)
        : null
    });
  }

  // 去重：同一赛事+同一时间+同一队伍只保留第一场
  const seenKeys = new Set();
  return matches.filter(m => {
    const tournament = m.tournament || '';
    const time = m.time || '';
    const allTeams = [m.homeTeam.toUpperCase(), m.awayTeam.toUpperCase()].sort().join('|');
    // 检查任一队伍是否已在此赛事+时间出现过
    const teams = [m.homeTeam.toUpperCase(), m.awayTeam.toUpperCase()];
    for (const team of teams) {
      const key = `${tournament}|${time}|${team}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
    }
    return true;
  });
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
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#888;">${m.time || '-'}</td>
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
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;"><span style="background:#007bff;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">${m.time || '即将开始'}</span></td>
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
  <p>📍 数据来源：<a href="https://event.5eplay.com/csgo/matches" target="_blank">5eplay</a></p>
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
    console.log('CS2 比赛日报 - 5eplay版');
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
