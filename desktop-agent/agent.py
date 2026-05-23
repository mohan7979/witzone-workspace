"""
Witzone Workspace Desktop Agent
Monitors keyboard/mouse idle time and sends heartbeats to the server.
Runs as a system tray application.

One machine = one employee. Credentials are saved after first login.
"""

import time
import threading
import socket
import os
import sys
import configparser
import subprocess
from datetime import datetime

import requests
import pystray
from PIL import Image, ImageDraw
from pynput import mouse, keyboard

AGENT_VERSION      = "1.0.0"
CONFIG_FILE        = os.path.join(os.path.expanduser("~"), ".bpo_agent.cfg")
HEARTBEAT_INTERVAL = 60   # seconds
STARTUP_KEY        = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME           = "WitzoneAgent"

# Shared state
last_activity = time.time()
auth_token    = None
server_url    = None
current_user  = None
running       = True


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config():
    cfg = configparser.ConfigParser()
    if os.path.exists(CONFIG_FILE):
        cfg.read(CONFIG_FILE)
    return cfg


def save_config(url, token):
    cfg = configparser.ConfigParser()
    cfg["agent"] = {"server_url": url, "auth_token": token}
    with open(CONFIG_FILE, "w") as f:
        cfg.write(f)


# ---------------------------------------------------------------------------
# Windows startup registration
# ---------------------------------------------------------------------------

def is_windows():
    return sys.platform == "win32"


def set_autostart(enable: bool):
    """Add or remove the agent from Windows startup registry."""
    if not is_windows():
        return False
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, STARTUP_KEY,
            0, winreg.KEY_SET_VALUE | winreg.KEY_QUERY_VALUE,
        )
        if enable:
            exe_path = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(sys.argv[0])
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{exe_path}"')
        else:
            try:
                winreg.DeleteValue(key, APP_NAME)
            except FileNotFoundError:
                pass
        winreg.CloseKey(key)
        return True
    except Exception as e:
        print(f"Autostart error: {e}")
        return False


def get_autostart():
    """Return True if agent is registered in Windows startup."""
    if not is_windows():
        return False
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_KEY, 0, winreg.KEY_QUERY_VALUE)
        winreg.QueryValueEx(key, APP_NAME)
        winreg.CloseKey(key)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Activity tracking
# ---------------------------------------------------------------------------

def record_activity(*_):
    global last_activity
    last_activity = time.time()


def get_idle_seconds():
    return int(time.time() - last_activity)


# ---------------------------------------------------------------------------
# Server calls
# ---------------------------------------------------------------------------

def validate_token(url, token):
    """Check saved token against /api/auth/me. Returns user dict or None."""
    try:
        r = requests.get(
            f"{url}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("user")
    except requests.exceptions.RequestException:
        pass
    return None


def send_heartbeat():
    if not auth_token or not server_url:
        return
    payload = {
        "idle_seconds":  get_idle_seconds(),
        "machine_name":  socket.gethostname(),
        "agent_version": AGENT_VERSION,
    }
    try:
        r = requests.post(
            f"{server_url}/api/idle/heartbeat",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10,
        )
        r.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Heartbeat failed: {e}")


def heartbeat_loop():
    while running:
        send_heartbeat()
        time.sleep(HEARTBEAT_INTERVAL)


# ---------------------------------------------------------------------------
# Tray icon
# ---------------------------------------------------------------------------

def make_icon(authenticated=True):
    color = "#0ea5e9" if authenticated else "#64748b"
    img   = Image.new("RGB", (64, 64), color="#1e3a5f")
    draw  = ImageDraw.Draw(img)
    draw.ellipse([16, 16, 48, 48], fill=color)
    return img


# ---------------------------------------------------------------------------
# Tray menu actions
# ---------------------------------------------------------------------------

def on_login(icon, item):
    global auth_token, server_url, current_user

    # On Windows frozen exe: open a small input dialog via PowerShell
    # On dev/Mac: fall back to terminal input
    if is_windows() and getattr(sys, "frozen", False):
        url, email, password = _windows_login_dialog()
        if not url:
            return
    else:
        print("\n--- Witzone Workspace Login ---")
        url      = input("Server URL (e.g. http://192.168.1.10:5000): ").strip()
        email    = input("Email: ").strip()
        password = input("Password: ").strip()

    try:
        r = requests.post(
            f"{url}/api/auth/login",
            json={"email": email, "password": password},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        auth_token   = data["token"]
        server_url   = url
        current_user = data["user"]
        save_config(url, auth_token)

        name = f"{current_user['first_name']} {current_user['last_name']}"
        print(f"Logged in as {name} ({current_user.get('employee_id', '')})")
        icon.title = f"Witzone — {name}"
        icon.icon  = make_icon(authenticated=True)

        # Auto-enable startup on first successful login
        if is_windows() and not get_autostart():
            set_autostart(True)
            print("Added to Windows startup.")

        _show_balloon(icon, "Witzone", f"Logged in as {name}")

    except requests.exceptions.HTTPError as e:
        msg = ""
        try:
            msg = e.response.json().get("message", "")
        except Exception:
            pass
        err = msg or str(e)
        print(f"Login failed: {err}")
        _show_balloon(icon, "Login Failed", err)
    except Exception as e:
        print(f"Login failed: {e}")
        _show_balloon(icon, "Login Failed", str(e))


def on_toggle_autostart(icon, item):
    if not is_windows():
        print("Autostart is only supported on Windows.")
        return
    enabled = get_autostart()
    set_autostart(not enabled)
    state = "enabled" if not enabled else "disabled"
    print(f"Autostart {state}.")
    _show_balloon(icon, "Witzone", f"Start with Windows: {state}")


def on_quit(icon, item):
    global running
    running = False
    icon.stop()


# ---------------------------------------------------------------------------
# Windows helpers
# ---------------------------------------------------------------------------

def _windows_login_dialog():
    """Use PowerShell InputBox to collect server URL, email, password."""
    try:
        script = (
            'Add-Type -AssemblyName Microsoft.VisualBasic;'
            '$url = [Microsoft.VisualBasic.Interaction]::InputBox("Server URL (e.g. http://192.168.1.10:5000)", "Witzone Login", "http://");'
            '$email = [Microsoft.VisualBasic.Interaction]::InputBox("Email", "Witzone Login", "");'
            '$pass = [Microsoft.VisualBasic.Interaction]::InputBox("Password", "Witzone Login", "");'
            'Write-Output "$url|$email|$pass"'
        )
        result = subprocess.check_output(
            ["powershell", "-Command", script],
            text=True, timeout=120,
        ).strip()
        parts = result.split("|", 2)
        if len(parts) == 3:
            return parts[0].strip(), parts[1].strip(), parts[2].strip()
    except Exception as e:
        print(f"Dialog error: {e}")
    return "", "", ""


def _show_balloon(icon, title, message):
    """Show a Windows balloon notification (no-op on non-Windows)."""
    if not is_windows():
        return
    try:
        icon.notify(message, title)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    global auth_token, server_url, current_user, running

    # Load and validate saved credentials
    cfg = load_config()
    if "agent" in cfg:
        saved_url   = cfg["agent"].get("server_url", "").strip()
        saved_token = cfg["agent"].get("auth_token", "").strip()
        if saved_url and saved_token:
            user = validate_token(saved_url, saved_token)
            if user:
                auth_token   = saved_token
                server_url   = saved_url
                current_user = user
                print(f"Session active: {user['first_name']} {user['last_name']} ({user.get('employee_id', '')})")
            else:
                print("Saved token expired — please log in again via the tray icon.")

    # Input listeners
    ml = mouse.Listener(on_move=record_activity, on_click=record_activity, on_scroll=record_activity)
    kl = keyboard.Listener(on_press=record_activity)
    ml.start()
    kl.start()

    # Heartbeat thread
    threading.Thread(target=heartbeat_loop, daemon=True).start()

    # Tray setup
    authenticated = current_user is not None
    title = (
        f"Witzone — {current_user['first_name']} {current_user['last_name']}"
        if authenticated else "Witzone — Not logged in (right-click to login)"
    )

    autostart_label = lambda item: (
        "✓ Start with Windows" if get_autostart() else "  Start with Windows"
    )

    menu = pystray.Menu(
        pystray.MenuItem("Witzone Workspace", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Login / Re-authenticate", on_login),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(autostart_label, on_toggle_autostart),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", on_quit),
    )

    tray = pystray.Icon(APP_NAME, make_icon(authenticated), title, menu)
    print(f"Witzone Agent running — {title}")
    tray.run()

    # Cleanup
    running = False
    ml.stop()
    kl.stop()


if __name__ == "__main__":
    main()
