#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用 BeautifulSoup 解析 VSGG 比赛数据"""

import urllib.request
import re
from bs4 import BeautifulSoup

url = "https://vsgg.com/zh/cs2"
req = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9",
})

with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode("utf-8")

soup = BeautifulSoup(html, 'html.parser')

# 查找所有包含比分和队伍的元素
matches = []

# 尝试查找包含 2-0, 2-1 等比分的行
for tag in soup.find_all(string=re.compile(r'\d+-\d+')):
    parent = tag.parent
    if parent:
        text = parent.get_text()
        if re.search(r'[A-Za-z]{2,}.*\d+-\d+.*[A-Za-z]{2,}', text):
            print(f"找到比赛: {text[:100]}")

print("\n=== 查找表格 ===")
tables = soup.find_all('table')
print(f"找到 {len(tables)} 个表格")

for i, table in enumerate(tables):
    rows = table.find_all('tr')
    print(f"\n表格 {i+1}: {len(rows)} 行")
    for row in rows[:3]:  # 只显示前3行
        cells = row.find_all(['td', 'th'])
        print([c.get_text(strip=True)[:30] for c in cells])
