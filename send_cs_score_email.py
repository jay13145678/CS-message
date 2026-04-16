#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CS2比赛比分邮件发送脚本
使用QQ邮箱SMTP发送邮件
"""

import smtplib
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header

# QQ邮箱配置
SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 587

# 收件人
TO_EMAIL = "2931417549@qq.com"


def send_email(subject: str, html_content: str, from_alias: str = "CS2比分助手") -> bool:
    """发送邮件"""
    try:
        # 使用环境变量或直接写入（请注意安全，生产环境建议使用环境变量）
        # 这里简化处理，实际使用时建议通过环境变量传递
        from_email = "2931417549@qq.com"

        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['From'] = from_email
        msg['To'] = TO_EMAIL
        msg['Subject'] = Header(subject, 'utf-8')

        # HTML内容
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)

        # 纯文本备用
        text_part = MIMEText(html_content, 'plain', 'utf-8')
        msg.attach(text_part)

        # 连接SMTP服务器并发送
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(from_email, SMTP_AUTH_CODE)
        server.sendmail(from_email, [TO_EMAIL], msg.as_string())
        server.quit()

        print(f"邮件发送成功: {TO_EMAIL}")
        return True

    except Exception as e:
        print(f"邮件发送失败: {e}")
        return False


def build_email_html(score_data: str) -> str:
    """构建邮件HTML内容"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }}
            h1 {{ color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 10px; }}
            h2 {{ color: #333; margin-top: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
            th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
            th {{ background-color: #f8f8f8; color: #666; }}
            .highlight {{ background-color: #fff3cd; }}
            .hot {{ color: #dc3545; font-weight: bold; }}
            .winner {{ font-weight: bold; color: #28a745; }}
            .loser {{ color: #999; }}
            .tag {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; }}
            .tag-live {{ background: #dc3545; color: white; }}
            .tag-upcoming {{ background: #007bff; color: white; }}
            .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }}
        </style>
    </head>
    <body>
        <h1>🔥 CS2 比赛日报</h1>
        <p style="color: #666;">为您汇总最新热门比赛结果</p>

        {score_data}

        <div class="footer">
            <p>📍 数据来源：VSGG</p>
            <p>⏰ 推送时间：自动生成</p>
        </div>
    </body>
    </html>
    """
    return html


if __name__ == "__main__":
    # 从环境变量获取授权码
    SMTP_AUTH_CODE = "yeaafaxirdvfdcdf"

    if len(sys.argv) < 2:
        print("用法: python send_email.py '<HTML内容>'")
        sys.exit(1)

    subject = "🔥 CS2 热门比赛日报"
    html_content = sys.argv[1]

    success = send_email(subject, html_content)
    sys.exit(0 if success else 1)
