#!/usr/bin/env python3
import requests
import json

API_KEY = "si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Test different endpoints
endpoints = [
    ("GET", "https://ps.pndsn.com/v2/apps", "List apps v2"),
    ("GET", "https://admin.pubnub.com/api/v1/apps", "List apps v1"),
    ("GET", "https://ps.pndsn.com/api/v2/apps", "List apps v2 alt"),
    ("GET", "https://ps.pndsn.com/v2/keysets", "List keysets v2"),
    ("GET", "https://ps.pndsn.com/v2/keys", "List keys v2"),
]

print("Testing PubNub API endpoints...\n")

for method, url, description in endpoints:
    print(f"Testing: {description}")
    print(f"URL: {url}")

    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=5)
        else:
            response = requests.post(url, headers=headers, timeout=5)

        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")

    print("-" * 80)
    print()
