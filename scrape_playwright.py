#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CS2 比赛日报 - Playwright 版本
使用浏览器自动化获取动态渲染的页面数据
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import json
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
import smtplib
import os

def scrape_vsgg_with_playwright():
    """使用 Playwright 抓取 VSGG 数据"""
    from playwright.sync_api import sync_playwright
    
    results = {'finished': [], 'upcoming': []}
    
    with sync_playwright() as p:
        print('[1] 启动浏览器...')
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        print('[2] 打开 VSGG...')
        page.goto('https://vsgg.com/zh/cs2', wait_until='networkidle', timeout=60000)
        
        # 等待页面加载
        page.wait_for_timeout(3000)
        
        # 尝试等待比赛列表出现
        try:
            page.wait_for_selector('.match-item, [class*="match"]', timeout=5000)
            print('[3] 找到比赛元素')
        except:
            print('[3] 未找到特定选择器，尝试获取页面文本')
        
        # 获取页面内容
        page_text = page.inner_text('body')
        page_html = page.content()
        
        print(f'[4] 页面文本长度: {len(page_text)} 字符')
        print(f'    页面HTML长度: {len(page_html)} 字符')
        
        # 提取队伍名称（常见CS2战队）
        import re
        cs2_teams = [
            'FURIA', 'MOUZ', 'Natus Vincere', 'NaVi', 'Aurora', 'Spirit', 'G2', 'Vitality',
            'Falcons', 'Heroic', 'Astralis', 'ENCE', 'BIG', 'Liquid', 'FaZe', 'Cloud9',
            'OG', 'Fnatic', 'NIP', 'NiP', 'Imperial', 'MIBR', 'B8', 'TBD'
        ]
        
        found_teams = []
        for team in cs2_teams:
            if team in page_text:
                found_teams.append(team)
        
        print(f'[5] 找到 {len(found_teams)} 支战队: {found_teams[:10]}')
        
        # 尝试提取比分
        score_pattern = re.findall(r'([A-Za-z]+)\s+(\d+)\s*[-:]\s*(\d+)\s+([A-Za-z]+)', page_text)
        print(f'[6] 找到 {len(score_pattern)} 组比分')
        
        for match in score_pattern[:10]:
            team_a, score_a, score_b, team_b = match
            if score_a and score_b:
                results['finished'].append({
                    'homeTeam': team_a,
                    'homeScore': int(score_a),
                    'awayTeam': team_b,
                    'awayScore': int(score_b),
                    'tournament': 'VSGG赛事',
                    'format': 'BO3'
                })
        
        browser.close()
    
    return results


def generate_email_html(data):
    """生成邮件 HTML"""
    today = datetime.now()
    today_str = today.strftime('%Y-%m-%d')
    yesterday = (today - timedelta(days=1)).strftime('%Y-%m-%d')
    
    finished_html = ''
    if data.get('finished'):
        for m in data['finished'][:15]:
            winner = m.get('homeTeam') if m.get('homeScore', 0) > m.get('awayScore', 0) else m.get('awayTeam')
            finished_html += f'''<tr><td>{m.get('tournament', 'CS2赛事')}</td><td style="color:#28a745;font-weight:bold;">{m.get('homeTeam', '')}</td><td style="text-align:center;font-weight:bold;">{m.get('homeScore', 0)} - {m.get('awayScore', 0)}</td><td>{m.get('awayTeam', '')}</td><td>{m.get('format', '')}</td></tr>'''
    else:
        finished_html = '<tr><td colspan="5" style="text-align:center;color:#888;">暂无比赛数据</td></tr>'
    
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body {{ font-family: -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }}
.card {{ background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }}
h1 {{ color: #FF6B35; }} h2 {{ color: #333; border-left: 4px solid #FF6B35; padding-left: 12px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
th {{ background: #f8f8f8; padding: 10px 8px; text-align: left; }}
td {{ padding: 10px 8px; border-bottom: 1px solid #eee; }}
.footer {{ margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 12px; text-align: center; }}
</style>
</head><body>
<div class="card">
<h1>🔥 CS2 比赛日报</h1>
<p style="color:#888;">{today_str} · Playwright自动抓取</p>

<h2>✅ 昨日（{yesterday}）已完成比赛</h2>
<table><tr><th>赛事</th><th>胜者</th><th>比分</th><th>败者</th><th>赛制</th></tr>
{finished_html}
</table>

<div class="footer">
<p>📍 数据来源：VSGG | 🤖 技术支持：Playwright浏览器自动化</p>
<p>⏰ 自动生成于 {today_str} 08:00</p>
</div>
</div></body></html>'''


def main():
    print('=' * 50)
    print('CS2 比赛日报 - Playwright 版本')
    print('=' * 50)
    
    # 抓取数据
    data = scrape_vsgg_with_playwright()
    
    print(f'\n[结果] 已结束: {len(data["finished"])} 场')
    
    # 生成邮件
    html_content = generate_email_html(data)
    
    # 保存
    with open('email_content.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    with open('cs2_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print('[OK] 文件已保存')
    print('=' * 50)


if __name__ == '__main__':
    main()
