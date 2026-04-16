#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查 VSGG 的 API 接口"""

import urllib.request
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

# 常见的 API 路径
api_paths = [
    "/api/matches",
    "/api/v1/matches",
    "/api/cs2/matches",
    "/api/games/cs2/matches",
    "/api/live/matches",
]

base_url = "https://vsgg.com"

for path in api_paths:
    url = base_url + path
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode('utf-8')
            print(f"[OK] {path} -> status: {resp.status}")
            print(f"     data: {data[:200]}")
    except urllib.error.HTTPError as e:
        print(f"[FAIL] {path} -> HTTP {e.code}")
    except Exception as e:
        print(f"[FAIL] {path} -> {type(e).__name__}")
