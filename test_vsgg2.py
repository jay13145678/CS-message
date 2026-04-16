#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查 VSGG 页面中的比赛数据"""

import urllib.request
import re

url = "https://vsgg.com/zh/cs2"
req = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9",
})

with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode("utf-8")

# 查找可能的比赛数据
print("=== 检查页面内容 ===")
print(f"总长度: {len(html)} 字符")

# 查找 team 关键词
team_matches = re.findall(r'[A-Za-z]+(?: [A-Z][a-z]+)+', html)
print(f"\n找到 {len(team_matches)} 个队伍名称")

# 查找比分模式
score_pattern = re.findall(r'(\d+)-(\d+)', html)
print(f"找到 {len(score_pattern)} 个比分模式")

# 查找赛事名称
event_keywords = ['IEM', 'ESL', 'BLAST', 'Vitality', 'Spirit', 'G2', 'NaVi', 'FaZe']
for keyword in event_keywords:
    count = html.count(keyword)
    if count > 0:
        print(f"'{keyword}' 出现 {count} 次")

# 尝试提取 script 标签中的 JSON 数据
script_tags = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
print(f"\n找到 {len(script_tags)} 个 script 标签")

# 查找可能的数据
for i, script in enumerate(script_tags):
    if 'match' in script.lower() or 'team' in script.lower():
        print(f"\nScript {i} 可能包含比赛数据 (长度: {len(script)})")
        print(script[:300])
        break
