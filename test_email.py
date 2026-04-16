#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

def send_test_email():
    from_email = "jay13145678@qq.com"
    to_email = "jay13145678@qq.com"
    auth_code = "rldkmdjeweccccdd"

    msg = MIMEMultipart('alternative')
    # QQ邮箱要求的格式
    msg['From'] = formataddr(("CS2比分助手", from_email))
    msg['To'] = to_email
    msg['Subject'] = "CS2 热门比赛日报 - 测试"

    html = """
    <html><body>
        <h1>CS2 比分推送测试</h1>
        <p>如果你收到这封邮件，说明邮件发送功能配置成功！</p>
        <p>从明天起，每天早上8点你会收到CS2热门比赛日报</p>
        <hr>
        <small>由 WorkBuddy 自动发送</small>
    </body></html>
    """

    msg.attach(MIMEText(html, 'html', 'utf-8'))

    try:
        server = smtplib.SMTP("smtp.qq.com", 587)
        server.starttls()
        server.login(from_email, auth_code)
        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()
        print("[OK] Email sent successfully!")
        return True
    except Exception as e:
        print(f"[FAIL] Send failed: {e}")
        return False

if __name__ == "__main__":
    send_test_email()
