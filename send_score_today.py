#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CS2 2026-04-16 比赛日报发送脚本
数据来源: VSGG (vsgg.com/zh/cs2)
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header

SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 587
FROM_EMAIL = "2931417549@qq.com"
TO_EMAIL = "2931417549@qq.com"
SMTP_AUTH_CODE = "yeaafaxirdvfdcdf"

score_html = """
<h2>&#x2705; 昨日（2026-04-15）已完成比赛</h2>

<h3>&#x1F3C6; IEM Rio 2026（重点赛事）</h3>
<table>
  <tr><th>队伍A（胜）</th><th>比分</th><th>队伍B（负）</th><th>赛制</th></tr>
  <tr><td class="winner">FURIA</td><td style="text-align:center;font-weight:bold">2-0</td><td class="loser">MOUZ</td><td>BO3</td></tr>
  <tr><td class="winner">Natus Vincere</td><td style="text-align:center;font-weight:bold">2-1</td><td class="loser">Aurora</td><td>BO3</td></tr>
  <tr><td class="winner">Spirit</td><td style="text-align:center;font-weight:bold">2-0</td><td class="loser">G2</td><td>BO3</td></tr>
  <tr><td class="winner">Falcons</td><td style="text-align:center;font-weight:bold">2-1</td><td class="loser">Vitality</td><td>BO3</td></tr>
  <tr><td class="winner">Aurora</td><td style="text-align:center;font-weight:bold">2-0</td><td class="loser">B8</td><td>BO3</td></tr>
</table>
<p class="hot">&#x1F4A5; 爆冷：FURIA 2-0 横扫 MOUZ；Falcons 2-1 击败卫冕冠军 Vitality！</p>

<h3>&#x1F3AE; 其他赛事</h3>
<table>
  <tr><th>赛事</th><th>队伍A（胜）</th><th>比分</th><th>队伍B（负）</th><th>赛制</th></tr>
  <tr><td>Tipsport Conquest Of Prague 2026</td><td class="winner">Alliance</td><td style="text-align:center;font-weight:bold">1-0</td><td class="loser">UNiTY</td><td>BO1</td></tr>
  <tr><td>Tipsport Conquest Of Prague 2026</td><td class="winner">Sashi</td><td style="text-align:center;font-weight:bold">1-0</td><td class="loser">TNC</td><td>BO2</td></tr>
  <tr><td>Tipsport Conquest Of Prague 2026</td><td class="winner">KOLESIE</td><td style="text-align:center;font-weight:bold">1-0</td><td class="loser">ESC</td><td>BO1</td></tr>
  <tr><td>NODWIN Clutch Series 7</td><td class="winner">TDK</td><td style="text-align:center;font-weight:bold">2-0</td><td class="loser">MANA</td><td>BO3</td></tr>
  <tr><td>Dust2us Eagle Masters Series 7</td><td class="winner">regain</td><td style="text-align:center;font-weight:bold">2-0</td><td class="loser">EMPIRE</td><td>BO3</td></tr>
</table>

<h2>&#x1F4C5; 今日（2026-04-16）赛程</h2>
<table>
  <tr><th>赛事</th><th>队伍A</th><th></th><th>队伍B</th><th>赛制</th><th>状态</th></tr>
  <tr class="highlight"><td>European Pro League Series 6</td><td>ARCRED</td><td style="text-align:center">vs</td><td>Metizport</td><td>BO5</td><td><span class="tag tag-upcoming">即将开始</span></td></tr>
  <tr><td>United21 League Season 47</td><td>Young Ninjas</td><td style="text-align:center">vs</td><td>Fire Flux</td><td>BO3</td><td><span class="tag tag-upcoming">即将开始</span></td></tr>
  <tr><td>NODWIN Clutch Series 7</td><td>Lavked LA</td><td style="text-align:center">vs</td><td>BE Bebop</td><td>BO3</td><td><span class="tag tag-upcoming">即将开始</span></td></tr>
  <tr><td>NODWIN Clutch Series 7</td><td>ESC</td><td style="text-align:center">vs</td><td>Ursa</td><td>BO3</td><td><span class="tag tag-upcoming">即将开始</span></td></tr>
  <tr><td>NODWIN Clutch Series 7</td><td>1win</td><td style="text-align:center">vs</td><td>Nuclear TigeRES</td><td>BO3</td><td><span class="tag tag-upcoming">即将开始</span></td></tr>
</table>
<p style="color:#888;font-size:13px;">&#x26A0;&#xFE0F; IEM Rio 2026 今日赛程待更新（赛事持续至04/21，目前进入半决赛前淘汰阶段）</p>
"""

html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background: #fafafa; }}
.card {{ background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }}
h1 {{ color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 10px; margin-top: 0; }}
h2 {{ color: #333; margin-top: 28px; }}
h3 {{ color: #555; margin-top: 18px; font-size: 15px; }}
table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }}
th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }}
th {{ background-color: #f4f4f4; color: #666; font-weight: 600; }}
.highlight {{ background-color: #fff8e1; }}
.hot {{ color: #dc3545; font-weight: bold; font-size: 14px; }}
.winner {{ font-weight: bold; color: #28a745; }}
.loser {{ color: #aaa; }}
.tag {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }}
.tag-upcoming {{ background: #007bff; color: white; }}
.footer {{ margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; color: #aaa; font-size: 12px; }}
</style>
</head>
<body>
<div class="card">
<h1>&#x1F525; CS2 比赛日报</h1>
<p style="color:#888;margin-top:-8px;">为您汇总 2026-04-16 热门比赛结果与今日赛程</p>

{score_html}

<div class="footer">
  <p>&#x1F4CD; 数据来源：VSGG (vsgg.com/zh/cs2)</p>
  <p>&#x23F0; 推送时间：2026-04-16 08:00 自动生成</p>
</div>
</div>
</body>
</html>"""

msg = MIMEMultipart('alternative')
msg['From'] = FROM_EMAIL
msg['To'] = TO_EMAIL
msg['Subject'] = Header("CS2 热门比赛日报", 'utf-8')

text_part = MIMEText("请使用支持HTML的邮件客户端查看本邮件。", 'plain', 'utf-8')
html_part = MIMEText(html_content, 'html', 'utf-8')
msg.attach(text_part)
msg.attach(html_part)

server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
server.starttls()
server.login(FROM_EMAIL, SMTP_AUTH_CODE)
server.sendmail(FROM_EMAIL, [TO_EMAIL], msg.as_string())
server.quit()
print("邮件发送成功！")
