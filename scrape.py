#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CS2 比赛数据爬虫 - 简单 HTTP 版本
数据来源: VSGG (vsgg.com/zh/cs2)
不需要浏览器，轻量快速
"""

import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime, timedelta

DATA_URL = 'https://vsgg.com/zh/cs2'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

def scrape_vsgg():
    """从 VSGG 抓取数据"""
    print('[VSGG] 正在抓取数据...')
    
    try:
        response = requests.get(DATA_URL, headers=HEADERS, timeout=30)
        response.encoding = 'utf-8'
        html = response.text
        
        print(f'[VSGG] 页面长度: {len(html)} 字符')
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # 查找比赛容器
        matches = {'finished': [], 'upcoming': []}
        
        # 查找包含比赛信息的 div
        match_divs = soup.find_all('div', class_=re.compile(r'match', re.I))
        print(f'[VSGG] 找到 {len(match_divs)} 个 match 相关 div')
        
        for div in match_divs:
            try:
                # 获取赛事名称
                tournament_el = div.find(class_=re.compile(r'tournament|league|event', re.I))
                tournament = tournament_el.get_text(strip=True) if tournament_el else ''
                
                # 获取队伍名称 - 常见模式
                team_els = div.find_all(class_=re.compile(r'team|name', re.I))
                teams = []
                for el in team_els:
                    text = el.get_text(strip=True)
                    # 过滤非队伍名称
                    if text and len(text) > 1 and len(text) < 30:
                        if not any(x in text.lower() for x in ['vs', 'bo', 'tbd', 'tba', ':']):
                            teams.append(text)
                
                # 获取比分
                score_text = div.get_text()
                scores = re.findall(r'(\d+)\s*[-:]\s*(\d+)', score_text)
                
                # 获取赛制
                format_match = re.search(r'BO(\d+)', score_text, re.I)
                format_str = f"BO{format_match.group(1)}" if format_match else ''
                
                # 只保留有队伍信息的数据
                if len(teams) >= 2 and tournament:
                    match_data = {
                        'tournament': tournament,
                        'homeTeam': teams[0],
                        'awayTeam': teams[1],
                        'format': format_str,
                        'source': 'VSGG'
                    }
                    
                    if scores:
                        match_data['homeScore'] = int(scores[0][0])
                        match_data['awayScore'] = int(scores[0][1])
                        match_data['winner'] = teams[0] if match_data['homeScore'] > match_data['awayScore'] else teams[1]
                        matches['finished'].append(match_data)
                    else:
                        matches['upcoming'].append(match_data)
                        
            except Exception as e:
                continue
        
        print(f'[VSGG] 找到 {len(matches["finished"])} 场已结束比赛')
        print(f'[VSGG] 找到 {len(matches["upcoming"])} 场未开始比赛')
        
        return matches
        
    except Exception as e:
        print(f'[VSGG] 抓取失败: {e}')
        return {'finished': [], 'upcoming': []}


def generate_email_html(data):
    """生成邮件 HTML"""
    today = datetime.now()
    today_str = today.strftime('%Y-%m-%d')
    yesterday = (today - timedelta(days=1)).strftime('%Y-%m-%d')
    
    # 已结束比赛
    finished_html = ''
    if data.get('finished'):
        for m in data['finished'][:15]:
            finished_html += f'''
            <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;">{m.get('tournament', 'CS2赛事')}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;color:#28a745;font-weight:bold;">{m.get('homeTeam', '')}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">{m.get('homeScore', 0)} - {m.get('awayScore', 0)}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;color:#666;">{m.get('awayTeam', '')}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">{m.get('format', '')}</td>
            </tr>'''
    else:
        finished_html = '<tr><td colspan="5" style="padding:16px;text-align:center;color:#888;">暂无比赛数据</td></tr>'
    
    # 未开始比赛
    upcoming_html = ''
    if data.get('upcoming'):
        for m in data['upcoming'][:15]:
            upcoming_html += f'''
            <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;">{m.get('tournament', 'CS2赛事')}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">{m.get('homeTeam', '')}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#007bff;">vs</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">{m.get('awayTeam', '')}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">{m.get('format', '')}</td>
            </tr>'''
    else:
        upcoming_html = '<tr><td colspan="5" style="padding:16px;text-align:center;color:#888;">暂无赛程数据</td></tr>'
    
    return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }}
.card {{ background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }}
h1 {{ color: #FF6B35; margin: 0 0 4px 0; font-size: 24px; }}
.subtitle {{ color: #888; margin: 0 0 20px 0; font-size: 14px; }}
h2 {{ color: #333; margin: 24px 0 12px 0; font-size: 18px; border-left: 4px solid #FF6B35; padding-left: 12px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 14px; background: #fff; }}
th {{ background: #f8f8f8; color: #666; font-weight: 600; text-align: left; padding: 10px 8px; }}
.footer {{ margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 12px; text-align: center; }}
a {{ color: #FF6B35; text-decoration: none; }}
</style>
</head>
<body>
<div class="card">
<h1>🔥 CS2 比赛日报</h1>
<p class="subtitle">{today_str} · 数据来源 VSGG</p>

<h2>✅ 昨日（{yesterday}）已完成比赛</h2>
<table>
  <tr>
    <th style="width:30%;">赛事</th>
    <th style="width:20%;">胜者</th>
    <th style="width:15%;text-align:center;">比分</th>
    <th style="width:20%;">败者</th>
    <th style="width:15%;">赛制</th>
  </tr>
  {finished_html}
</table>

<h2>📅 今日（{today_str}）赛程</h2>
<table>
  <tr>
    <th style="width:30%;">赛事</th>
    <th style="width:20%;">队伍A</th>
    <th style="width:10%;text-align:center;"></th>
    <th style="width:20%;">队伍B</th>
    <th style="width:20%;">赛制</th>
  </tr>
  {upcoming_html}
</table>

<div class="footer">
  <p>📍 数据来源：<a href="https://vsgg.com/zh/cs2" target="_blank">VSGG CS2</a></p>
  <p>⏰ 自动生成于 {today_str} 08:00</p>
</div>
</div>
</body>
</html>'''


if __name__ == '__main__':
    print('='*50)
    print('CS2 比赛日报 - Python HTTP 版本')
    print('='*50)
    
    # 抓取数据
    data = scrape_vsgg()
    
    # 保存数据
    with open('cs2_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print('数据已保存到 cs2_data.json')
    
    # 生成邮件 HTML
    html_content = generate_email_html(data)
    with open('email_content.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print('邮件内容已保存到 email_content.html')
    
    print('='*50)
    print('执行完成!')
    print('='*50)
