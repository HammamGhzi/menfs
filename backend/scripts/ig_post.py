#!/usr/bin/env python3
"""
Instagram Auto-Post Script menggunakan instagrapi (Python).
Dipanggil oleh backend Node.js via child_process.

Usage:
  python3 ig_post.py <image_path> <caption> <username> <password> [session_path]

Output (stdout): JSON { "success": true, "media_id": "...", "code": "...", "url": "..." }
Error  (stderr): error message
Exit code: 0 = success, 1 = error
"""

import sys
import json
import os
from pathlib import Path

def load_env_file():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k not in os.environ and v:
                        os.environ[k] = v

def main():
    load_env_file()
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Usage: ig_post.py <image_path> <caption> <username> <password> [session_path]"}))
        sys.exit(1)

    image_path = sys.argv[1]
    caption = sys.argv[2]
    username = sys.argv[3]
    password = sys.argv[4]
    session_path = sys.argv[5] if len(sys.argv) > 5 else os.path.join(os.path.dirname(__file__), '..', '.ig_session.json')
    session_id = os.environ.get('IG_SESSIONID') or (sys.argv[6] if len(sys.argv) > 6 else None)

    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "error": f"Image file not found: {image_path}"}))
        sys.exit(1)

    try:
        from instagrapi import Client

        cl = Client()
        cl.delay_range = [1, 3]
        # Bypass deprecated qe/expose endpoint
        cl.expose = lambda *args, **kwargs: True

        if session_id:
            try:
                cl.login_by_sessionid(session_id)
            except Exception as s_err:
                print(json.dumps({"success": False, "error": f"Session ID login failed: {str(s_err)}"}))
                sys.exit(1)
        elif os.path.exists(session_path):
            try:
                cl.load_settings(session_path)
                cl.login(username, password)
            except Exception:
                cl = Client()
                cl.login(username, password)
                cl.dump_settings(session_path)
        else:
            cl.login(username, password)
            cl.dump_settings(session_path)

        # Upload photo
        media = cl.photo_upload(
            Path(image_path),
            caption=caption,
        )

        result = {
            "success": True,
            "media_id": str(media.id),
            "code": media.code,
            "url": f"https://www.instagram.com/p/{media.code}/" if media.code else None,
        }

        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
