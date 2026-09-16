#!/usr/bin/env python3
"""Sätt Chromium i riktig fullscreen (F11), inte bara maximerat fönster."""

from __future__ import annotations

import base64
import json
import os
import socket
import struct
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse


def log(message: str) -> None:
    print(f"fullscreen: {message}", flush=True)


def fetch_json(url: str) -> dict | list | None:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def wait_targets(port: int) -> tuple[str, str] | None:
    for _ in range(40):
        version = fetch_json(f"http://127.0.0.1:{port}/json/version")
        pages = fetch_json(f"http://127.0.0.1:{port}/json/list")
        if isinstance(version, dict) and isinstance(pages, list):
            browser = version.get("webSocketDebuggerUrl")
            page = next(
                (
                    item
                    for item in pages
                    if item.get("type") == "page" and item.get("webSocketDebuggerUrl")
                ),
                None,
            )
            if browser and page:
                return browser, page["webSocketDebuggerUrl"]
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
        chunk = sock.recv(4096)
        if not chunk:
            break
        header += chunk
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


def cdp_call(sock: socket.socket, call_id: int, method: str, params: dict | None = None) -> dict:
    ws_send(sock, {"id": call_id, "method": method, "params": params or {}})
    for _ in range(12):
        message = ws_recv_json(sock)
        if message.get("id") == call_id:
            return message
    return {}


def window_state(browser: socket.socket, target_id: str, call_id: int) -> tuple[int | None, str]:
    reply = cdp_call(
        browser,
        call_id,
        "Browser.getWindowForTarget",
        {"targetId": target_id},
    )
    result = reply.get("result") or {}
    window_id = result.get("windowId")
    if window_id is None:
        return None, ""
    bounds = result.get("bounds") or {}
    state = str(bounds.get("windowState") or "")
    if not state:
        reply = cdp_call(
            browser,
            call_id + 1,
            "Browser.getWindowBounds",
            {"windowId": window_id},
        )
        state = str(((reply.get("result") or {}).get("bounds") or {}).get("windowState") or "")
    return window_id, state


def send_f11(page: socket.socket, call_id: int) -> None:
    for kind in ("keyDown", "keyUp"):
        cdp_call(
            page,
            call_id,
            "Input.dispatchKeyEvent",
            {
                "type": kind,
                "key": "F11",
                "code": "F11",
                "windowsVirtualKeyCode": 122,
                "nativeVirtualKeyCode": 122,
            },
        )
        call_id += 1


def page_target_id(port: int) -> str | None:
    pages = fetch_json(f"http://127.0.0.1:{port}/json/list")
    if not isinstance(pages, list):
        return None
    page = next((item for item in pages if item.get("type") == "page" and item.get("id")), None)
    return str(page["id"]) if page else None


def main() -> None:
    port = int(os.environ.get("VVK_CDP_PORT", "9222"))
    found = wait_targets(port)
    if not found:
        log("ingen CDP-anslutning")
        return
    browser_url, page_url = found
    browser = ws_open(browser_url)
    page = ws_open(page_url)
    browser.settimeout(5)
    page.settimeout(5)
    call_id = 1
    fullscreen = False
    for attempt in range(12):
        target_id = page_target_id(port)
        if not target_id:
            time.sleep(0.8)
            continue
        window_id, state = window_state(browser, target_id, call_id)
        call_id += 3
        log(f"försök {attempt + 1} state={state or '?'}")
        if state == "fullscreen":
            fullscreen = True
            break
        if window_id is not None:
            cdp_call(
                browser,
                call_id,
                "Browser.setWindowBounds",
                {"windowId": window_id, "bounds": {"windowState": "fullscreen"}},
            )
            call_id += 1
        send_f11(page, call_id)
        call_id += 2
        time.sleep(0.9)
    log("klar" if fullscreen else "inte fullscreen")
    browser.close()
    page.close()


if __name__ == "__main__":
    main()
