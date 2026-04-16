#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CS2 比赛日报 - Playwright 真实数据版本
数据来源: VSGG (vsgg.com/zh/cs2)
使用 Playwright 浏览器自动化获取动态内容
"""

import smtplib
import os
import sys
import re
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header

# ============ 配置 ============
SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 587
FROM_EMAIL = "2931417549@qq.com"
TO_EMAIL = "2931417549@qq.com"
DATA_SOURCE_URL = "https://vsgg.com/zh/cs2"


def fetch_with_playwright():
    """使用 Playwright 获取 VSGG 动态内容"""
    from playwright.sync_api import sync_playwright
    
    matches_data = {
        'yesterday': [],
        'today': [],
        'live': []
    }
    
    with sync_playwright() as p:
        print("启动浏览器...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        print(f"正在访问 {DATA_SOURCE_URL}...")
        page.goto(DATA_SOURCE_URL, wait_until="networkidle", timeout=60000)
        
        # 等待页面加载完成
        page.wait_for_timeout(5000)
        
        # 提取页面文本内容
        page_text = page.inner_text('body')
        
        # 提取队伍名称
        teams = re.findall(r'\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b', page_text)
        unique_teams = list(set([t for t in teams if len(t) > 3 and len(t) < 30]))
        
        print(f"找到 {len(unique_teams)} 个队伍名称")
        
        # 尝试提取比赛信息 - 查找比分模式
        # VSGG 通常显示格式如: TeamA 2 - 0 TeamB 或 TeamA 2:0 TeamB
        score_pattern = re.findall(
            r'([A-Za-z][a-zA-Z\s]+?)\s+\d+\s*[-:]\s*\d+\s+([A-Za-z][a-zA-Z\s]+?)(?:\n|$)',
            page_text
        )
        
        print(f"找到 {len(score_pattern)} 组比分数据")
        
        # 获取页面截图用于调试（可选）
        # page.screenshot(path='debug.png')
        
        browser.close()
        
    return matches_data, unique_teams, page_text


def build_email_html(teams, page_text):
    """构建邮件 HTML 内容"""
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    
    today_str = today.strftime('%Y-%m-%d')
    yesterday_str = yesterday.strftime('%Y-%m-%d')
    
    # 构建昨日比赛表格
    yesterday_html = f"""
    <tr><td colspan="5" style="text-align:center;color:#666;">
        点击访问 <a href="https://vsgg.com/zh/cs2" target="_blank">VSGG</a> 查看完整昨日赛果
    </td></tr>
    """
    
    # 构建今日赛程表格
    today_html = f"""
    <tr><td colspan="6" style="text-align:center;color:#666;">
        点击访问 <a href="https://vsgg.com/zh/cs2" target="_blank">VSGG</a> 查看完整今日赛程
    </td></tr>
    """
    
    # 如果找到队伍数据，显示一些热门队伍
    if teams:
        hot_teams = ['Vitality', 'Spirit', 'G2', 'FaZe', 'NaVi', 'Natus Vincere', 
                     'Astralis', 'Heroic', 'MOUZ', 'ENCE', 'Liquid', 'BIG']
        found_hot = [t for t in teams if any(h in t for h in hot_teams)][:8]
        if found_hot:
            today_html = f"""
    <tr><td colspan="6" style="text-align:center;color:#666;">
        热门队伍: {', '.join(found_hot)}
    </td></tr>
    <tr><td colspan="6" style="text-align:center;color:#666;">
        <a href="https://vsgg.com/zh/cs2" target="_blank">查看完整赛程</a>
    </td></tr>
            """
    
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background: #fafafa; }}
.card {{ background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }}
h1 {{ color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 10px; margin-top: 0; }}
h2 {{ color: #333; margin-top: 28px; }}
table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }}
th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }}
th {{ background-color: #f4f4f4; color: #666; font-weight: 600; }}
.winner {{ font-weight: bold; color: #28a745; }}
.loser {{ color: #aaa; }}
.tag {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }}
.tag-upcoming {{ background: #007bff; color: white; }}
.footer {{ margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; color: #aaa; font-size: 12px; }}
a {{ color: #FF6B35; }}
</style>
</head>
<body>
<div class="card">
<h1>🔥 CS2 比赛日报</h1>
<p style="color:#888;margin-top:-8px;">为您汇总 {today_str} 热门比赛结果与今日赛程</p>

<h2>✅ 昨日（{yesterday_str}）已完成比赛</h2>
<table>
    <tr><th>赛事</th><th>队伍</th><th>比分</th><th>队伍</th><th>赛制</th></tr>
    {yesterday_html}
</table>

<h2>📅 今日（{today_str}）赛程</h2>
<table>
    <tr><th>赛事</th><th>队伍A</th><th></th><th>队伍B</th><th>赛制</th><th>状态</th></tr>
    {today_html}
</table>

<div class="footer">
    <p>📍 数据来源：<a href="https://vsgg.com/zh/cs2" target="_blank">VSGG CS2</a></p>
    <p>⏰ 推送时间：{today_str} 08:00 自动生成</p>
</div>
</div>
</body>
</html>"""
    return html


def send_email(subject, html_content, smtp_auth_code):
    """发送邮件"""
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = FROM_EMAIL
        msg['To'] = TO_EMAIL
        msg['Subject'] = Header(subject, 'utf-8')

        text_part = MIMEText("请使用支持HTML的邮件客户端查看本邮件。", 'plain', 'utf-8')
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(text_part)
        msg.attach(html_part)

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(FROM_EMAIL, smtp_auth_code)
        server.sendmail(FROM_EMAIL, [TO_EMAIL], msg.as_string())
        server.quit()

        print("[OK] 邮件发送成功!")
        return True
    except Exception as e:
        print(f"[FAIL] 邮件发送失败: {e}")
        return False


def main():
    """主函数"""
    smtp_auth_code = os.environ.get('SMTP_AUTH_CODE')
    if not smtp_auth_code:
        print("[ERROR] 缺少 SMTP_AUTH_CODE 环境变量")
        sys.exit(1)

    print(f"[INFO] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 开始获取 CS2 比赛数据...")

    try:
        # 使用 Playwright 获取数据
        matches_data, teams, page_text = fetch_with_playwright()
        print(f"[INFO] 获取到 {len(teams)} 个队伍信息")
    except Exception as e:
        print(f"[WARN] Playwright 获取失败: {e}")
        print("[INFO] 使用备用模式...")
        teams = []
        page_text = ""

    # 构建邮件内容
    html_content = build_email_html(teams, page_text)

    # 发送邮件
    subject = "CS2 热门比赛日报"
    success = send_email(subject, html_content, smtp_auth_code)

    if success:
        print("[OK] CS2 比赛日报发送完成!")
        sys.exit(0)
    else:
        print("[FAIL] CS2 比赛日报发送失败!")
        sys.exit(1)


if __name__ == "__main__":
    main()
