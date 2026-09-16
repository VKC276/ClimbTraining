#!/usr/bin/env python3
"""Sätt Chromium till fullscreen via DevTools (windowState), inte maximize."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import socket
import struct
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse


def wait_browser(port: int) -> tuple[str, str] | None:
    for _ in range(30):
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}/json/version", timeout=2
            ) as response:
                version = json.loads(response.read().decode())
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}/json/list", timeout=2
            ) as response:
                pages = json.loads(response.read().decode())
            browser = version.get("webSocketDebuggerUrl")
            target = next((page.get("id") for page in pages if page.get("id")), None)
            if browser and target:
                return browser, target
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            pass
        time.sleep(0.4)
    return None


def ws_open(url: str) -> socket.socket:
    parsed = urlparse(url)
    sock = socket.create_connection(
        (parsed.hostname or "127.0.0.1", parsed.port or 80), timeout=5
    )
    key = base64.b64encode(os.urandom(16)).decode()
    path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    sock.sendall(
        (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        ).encode()
    )
    header = b""
    while b"\r\n\r\n" not in header:
        header += sock.recv(4096)
    return sock


def ws_send(sock: socket.socket, payload: dict) -> None:
    data = json.dumps(payload).encode()
    header = b"\x81"
    length = len(data)
    if length < 126:
        header += bytes([0x80 | length])
    elif length < 65536:
        header += bytes([0x80 | 126]) + struct.pack("!H", length)
    else:
        header += bytes([0x80 | 127]) + struct.pack("!Q", length)
    mask = os.urandom(4)
    header += mask
    sock.sendall(header + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def ws_recv_json(sock: socket.socket) -> dict:
    header = b""
    while len(header) < 2:
        header += sock.recv(2 - len(header))
    length = header[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", sock.recv(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", sock.recv(8))[0]
    if header[1] & 0x80:
        sock.recv(4)
    data = b""
    while len(data) < length:
        data += sock.recv(length - len(data))
    return json.loads(data.decode())


def main() -> None:
    port = int(os.environ.get("VVK_CDP_PORT", "9222"))
    found = wait_browser(port)
    if not found:
        return
    url, target_id = found
    sock = ws_open(url)
    sock.settimeout(5)
    ws_send(
        sock,
        {
            "id": 1,
            "method": "Browser.getWindowForTarget",
            "params": {"targetId": target_id},
        },
    )
    window_id = None
    for _ in range(8):
        message = ws_recv_json(sock)
        result = message.get("result") or {}
        if "windowId" in result:
            window_id = result["windowId"]
            break
    if window_id is None:
        sock.close()
        return
    ws_send(
        sock,
        {
            "id": 2,
            "method": "Browser.setWindowBounds",
            "params": {
                "windowId": window_id,
                "bounds": {"windowState": "fullscreen"},
            },
        },
    )
    try:
        ws_recv_json(sock)
    except (OSError, TimeoutError, json.JSONDecodeError):
        pass
    sock.close()


if __name__ == "__main__":
    main()
