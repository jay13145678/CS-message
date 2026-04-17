#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
发送CS2比赛比分邮件
"""
import smtplib
import os
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from datetime import datetime

SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 587
FROM_EMAIL = "2931417549@qq.com"
TO_EMAIL = "2931417549@qq.com"


def get_smtp_auth_code():
    """获取SMTP授权码 - 优先环境变量，其次配置文件"""
    # 1. 尝试环境变量
    auth_code = os.environ.get('SMTP_AUTH_CODE')
    if auth_code:
        return auth_code
    
    # 2. 尝试配置文件
    config_paths = [
        os.path.join(os.path.dirname(__file__), '.smtp_auth'),
        os.path.expanduser('~/.smtp_auth'),
    ]
    for path in config_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            except:
                pass
    
    return None


def read_html_content():
    """读取 HTML 内容"""
    try:
        with open('email_content.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print("[WARN] email_content.html 不存在")
        return get_default_html()


def get_default_html():
    """默认邮件内容"""
    today = datetime.now().strftime('%Y-%m-%d')
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background: #fafafa; }}
.card {{ background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }}
h1 {{ color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 10px; margin-top: 0; }}
.footer {{ margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; color: #aaa; font-size: 12px; }}
a {{ color: #FF6B35; }}
</style>
</head>
<body>
<div class="card">
<h1>🔥 CS2 比赛日报</h1>
<p>日期：{today}</p>
<p>更多精彩内容请访问：<a href="https://vsgg.com/zh/cs2">VSGG CS2</a></p>
<div class="footer">
  <p>📍 数据来源：VSGG (vsgg.com/zh/cs2)</p>
  <p>⏰ 推送时间：{today} 自动生成</p>
</div>
</div>
</body>
</html>"""


def send_email(subject, html_content, auth_code):
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
        server.login(FROM_EMAIL, auth_code)
        server.sendmail(FROM_EMAIL, [TO_EMAIL], msg.as_string())
        server.quit()

        print("[OK] 邮件发送成功!")
        return True
    except Exception as e:
        print(f"[FAIL] 邮件发送失败: {e}")
        return False


if __name__ == "__main__":
    auth_code = get_smtp_auth_code()
    if not auth_code:
        print("[ERROR] 未找到SMTP授权码。请设置环境变量 SMTP_AUTH_CODE 或创建 .smtp_auth 文件")
        sys.exit(1)
    
    subject = f"CS2 热门比赛日报 {datetime.now().strftime('%Y-%m-%d')}"
    html_content = read_html_content()
    
    success = send_email(subject, html_content, auth_code)
    sys.exit(0 if success else 1)
