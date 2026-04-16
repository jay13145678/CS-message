/**
 * CS2 比赛数据爬虫 - 多数据源版本
 * 主数据源: VSGG (vsgg.com/zh/cs2)
 * 备用数据源: GosuGamers (gosugamers.net/counterstrike/matches)
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DATA_SOURCES = {
  vsgg: 'https://vsgg.com/zh/cs2',
  gosugamers: 'https://www.gosugamers.net/counterstrike/matches'
};

// ==================== VSGG 数据源 ====================
async function scrapeVSGG(browser) {
  console.log('\n[VSGG] 正在抓取数据...');
  
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  try {
    await page.goto(DATA_SOURCES.vsgg, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // 尝试等待比赛列表
    try {
      await page.waitForSelector('.match-item', { timeout: 5000 });
    } catch (e) {
      console.log('[VSGG] 未找到 .match-item 选择器');
    }
    
    const matches = await page.evaluate(() => {
      const results = { finished: [], upcoming: [] };
      const matchItems = document.querySelectorAll('.match-item');
      
      matchItems.forEach(item => {
        const status = item.getAttribute('data-status');
        const tournamentEl = item.querySelector('.tournament-name');
        const tournament = tournamentEl ? tournamentEl.textContent.trim() : '未知赛事';
        
        const homeTeamEl = item.querySelector('.team.home .team-name');
        const awayTeamEl = item.querySelector('.team.away .team-name');
        const homeTeam = homeTeamEl ? homeTeamEl.textContent.trim() : '';
        const awayTeam = awayTeamEl ? awayTeamEl.textContent.trim() : '';
        
        const formatEl = item.querySelector('.match-format');
        const format = formatEl ? formatEl.textContent.trim() : '';
        
        if (homeTeam && awayTeam) {
          const matchData = { tournament, homeTeam, awayTeam, format, source: 'VSGG' };
          
          if (status === 'finished') {
            const homeScoreEl = item.querySelector('.team.home .score');
            const awayScoreEl = item.querySelector('.team.away .score');
            matchData.homeScore = homeScoreEl ? parseInt(homeScoreEl.textContent) : 0;
            matchData.awayScore = awayScoreEl ? parseInt(awayScoreEl.textContent) : 0;
            const homeEl = item.querySelector('.team.home');
            matchData.winner = (homeEl && homeEl.classList.contains('winner')) ? homeTeam : awayTeam;
            results.finished.push(matchData);
          } else {
            results.upcoming.push(matchData);
          }
        }
      });
      
      return results;
    });
    
    console.log(`[VSGG] 找到 ${matches.finished.length} 场已结束比赛`);
    console.log(`[VSGG] 找到 ${matches.upcoming.length} 场未开始比赛`);
    
    await page.close();
    return matches;
    
  } catch (error) {
    console.error('[VSGG] 抓取失败:', error.message);
    await page.close();
    return { finished: [], upcoming: [] };
  }
}

// ==================== GosuGamers 数据源 ====================
async function scrapeGosuGamers(browser) {
  console.log('\n[GosuGamers] 正在抓取数据...');
  
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  try {
    await page.goto(DATA_SOURCES.gosugamers, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    const matches = await page.evaluate(() => {
      const results = { finished: [], upcoming: [] };
      
      // GosuGamers 页面结构 - 查找所有比赛行
      // 根据页面内容，匹配模式可能包括表格行或div卡片
      const rows = document.querySelectorAll('tr.match, div.match-card, [class*="match"]');
      
      rows.forEach(row => {
        // 尝试提取队伍名称
        const teamNames = [];
        const teamEls = row.querySelectorAll('[class*="team"], [class*="opponent"], td:nth-child(n+2)');
        
        teamEls.forEach(el => {
          const text = el.textContent.trim();
          // 过滤掉时间、赛事名称等非队伍名称
          if (text && text.length > 1 && text.length < 20 && 
              !text.includes(':') && !text.includes('h') && 
              !text.match(/\d{2}:\d{2}/)) {
            teamNames.push(text);
          }
        });
        
        // 提取比分
        const scores = row.textContent.match(/\d+\s*[-:]\s*\d+/g);
        
        // 提取赛事名称
        let tournament = '';
        const tournamentEl = row.querySelector('[class*="tournament"], [class*="league"], td:first-child');
        if (tournamentEl) {
          tournament = tournamentEl.textContent.trim().split('\n')[0].trim();
        }
        
        // 提取赛制
        let format = '';
        if (row.textContent.includes('BO1')) format = 'BO1';
        else if (row.textContent.includes('BO3')) format = 'BO3';
        else if (row.textContent.includes('BO5')) format = 'BO5';
        
        // 如果找到两支队伍，添加到结果
        if (teamNames.length >= 2) {
          const teamA = teamNames[0];
          const teamB = teamNames[1];
          
          if (scores && scores.length > 0) {
            // 已结束比赛
            const scoreParts = scores[0].split(/[-:]/);
            const scoreA = parseInt(scoreParts[0]);
            const scoreB = parseInt(scoreParts[1]);
            
            results.finished.push({
              tournament,
              homeTeam: teamA,
              awayTeam: teamB,
              homeScore: scoreA,
              awayScore: scoreB,
              winner: scoreA > scoreB ? teamA : teamB,
              format,
              source: 'GosuGamers'
            });
          } else {
            // 未开始比赛
            results.upcoming.push({
              tournament,
              homeTeam: teamA,
              awayTeam: teamB,
              format,
              source: 'GosuGamers'
            });
          }
        }
      });
      
      return results;
    });
    
    console.log(`[GosuGamers] 找到 ${matches.finished.length} 场已结束比赛`);
    console.log(`[GosuGamers] 找到 ${matches.upcoming.length} 场未开始比赛`);
    
    await page.close();
    return matches;
    
  } catch (error) {
    console.error('[GosuGamers] 抓取失败:', error.message);
    await page.close();
    return { finished: [], upcoming: [] };
  }
}

// ==================== 数据合并与对照 ====================
function mergeAndCompareData(vsggData, ggData) {
  console.log('\n[数据对照] 合并多数据源...');
  
  const merged = {
    finished: [],
    upcoming: [],
    comparison: {
      vsggCount: vsggData.finished.length + vsggData.upcoming.length,
      ggCount: ggData.finished.length + ggData.upcoming.length,
      conflicts: []
    }
  };
  
  // 合并已结束比赛 - 优先使用 VSGG 数据
  const allFinished = [...vsggData.finished, ...ggData.finished];
  
  // 去重：根据赛事+队伍名称
  const seenFinished = new Set();
  allFinished.forEach(match => {
    const key = `${match.tournament}|${match.homeTeam}|${match.awayTeam}`;
    if (!seenFinished.has(key)) {
      seenFinished.add(key);
      merged.finished.push(match);
    }
  });
  
  // 合并未开始比赛
  const allUpcoming = [...vsggData.upcoming, ...ggData.upcoming];
  const seenUpcoming = new Set();
  allUpcoming.forEach(match => {
    const key = `${match.tournament}|${match.homeTeam}|${match.awayTeam}`;
    if (!seenUpcoming.has(key)) {
      seenUpcoming.add(key);
      merged.upcoming.push(match);
    }
  });
  
  // 检查数据一致性
  merged.finished.forEach(vsggMatch => {
    const corresponding = ggData.finished.find(gg => 
      vsggMatch.homeTeam.includes(gg.homeTeam) || gg.homeTeam.includes(vsggMatch.homeTeam) ||
      vsggMatch.awayTeam.includes(gg.awayTeam) || gg.awayTeam.includes(vsggMatch.awayTeam)
    );
    
    if (corresponding) {
      // 检查比分是否一致
      if (vsggMatch.homeScore !== corresponding.homeScore || 
          vsggMatch.awayScore !== corresponding.awayScore) {
        merged.comparison.conflicts.push({
          match: `${vsggMatch.homeTeam} vs ${vsggMatch.awayTeam}`,
          vsggScore: `${vsggMatch.homeScore}-${vsggMatch.awayScore}`,
          ggScore: `${corresponding.homeScore}-${corresponding.awayScore}`
        });
      }
    }
  });
  
  console.log(`[合并后] 共 ${merged.finished.length} 场已结束比赛, ${merged.upcoming.length} 场未开始比赛`);
  
  if (merged.comparison.conflicts.length > 0) {
    console.log(`[警告] 发现 ${merged.comparison.conflicts.length} 个数据不一致`);
    merged.comparison.conflicts.forEach(c => {
      console.log(`  - ${c.match}: VSGG=${c.vsggScore}, GG=${c.ggScore}`);
    });
  }
  
  return merged;
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
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;color:#999;">${m.source || ''}</td>
      </tr>
    `).join('');
  } else {
    finishedHtml = '<tr><td colspan="6" style="padding:16px;text-align:center;color:#888;">暂无比赛数据</td></tr>';
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
  
  // 数据来源说明
  const sourcesNote = [];
  const allMatches = [...(data.finished || []), ...(data.upcoming || [])];
  if (allMatches.some(m => m.source === 'VSGG')) sourcesNote.push('VSGG');
  if (allMatches.some(m => m.source === 'GosuGamers')) sourcesNote.push('GosuGamers');
  
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
<p class="subtitle">${todayStr} · 双数据源对照</p>

<h2>✅ 昨日（${yesterdayStr}）已完成比赛</h2>
<table>
  <tr>
    <th style="width:25%;">赛事</th>
    <th style="width:18%;">胜者</th>
    <th style="width:12%;text-align:center;">比分</th>
    <th style="width:18%;">败者</th>
    <th style="width:8%;">赛制</th>
    <th style="width:12%;">来源</th>
  </tr>
  ${finishedHtml}
</table>

<h2>📅 今日（${todayStr}）赛程</h2>
<table>
  <tr>
    <th style="width:25%;">赛事</th>
    <th style="width:18%;">队伍A</th>
    <th style="width:8%;text-align:center;"></th>
    <th style="width:18%;">队伍B</th>
    <th style="width:8%;">赛制</th>
    <th style="width:12%;">状态</th>
  </tr>
  ${upcomingHtml}
</table>

<div class="footer">
  <p>📍 数据来源：${sourcesNote.length > 0 ? sourcesNote.join(' / ') : 'VSGG'} · <a href="https://vsgg.com/zh/cs2" target="_blank">VSGG</a> · <a href="https://www.gosugamers.net/counterstrike/matches" target="_blank">GosuGamers</a></p>
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
    console.log('CS2 比赛日报 - 双数据源版本');
    console.log('='.repeat(50));
    
    // 启动浏览器（复用）
    console.log('\n启动浏览器...');
    const browser = await chromium.launch({ headless: true });
    
    // 抓取两个数据源
    const vsggData = await scrapeVSGG(browser);
    const ggData = await scrapeGosuGamers(browser);
    
    await browser.close();
    
    // 合并数据
    const mergedData = mergeAndCompareData(vsggData, ggData);
    
    // 保存原始数据
    fs.writeFileSync('cs2_data.json', JSON.stringify({
      vsgg: vsggData,
      gosugamers: ggData,
      merged: mergedData
    }, null, 2));
    console.log('\n数据已保存到 cs2_data.json');
    
    // 生成邮件 HTML
    const emailHTML = generateEmailHTML(mergedData);
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
