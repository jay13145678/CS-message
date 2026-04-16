#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试 VSGG 数据抓取"""

import urllib.request
import urllib.error

url = "https://vsgg.com/zh/cs2"
req = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9",
})

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8")
    print(f"页面长度: {len(html)}")
    print(f"前500字符: {html[:500]}")
except urllib.error.HTTPError as e:
    print(f"HTTP错误: {e.code} {e.reason}")
except Exception as e:
    print(f"请求失败: {e}")
