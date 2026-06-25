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

import io
import base64

import requests
import pystray
from PIL import Image, ImageDraw, ImageGrab
from pynput import mouse, keyboard

AGENT_VERSION        = "1.2.4"
CONFIG_FILE          = os.path.join(os.path.expanduser("~"), ".bpo_agent.cfg")
HEARTBEAT_INTERVAL   = 60   # seconds between heartbeats once connected
RECONNECT_INTERVAL   = 10   # seconds between auth retries when not yet connected
SCREEN_POLL_INTERVAL = 3    # seconds — how often to ask the server "should I capture?"
SCREEN_MAX_WIDTH     = 1280  # downscale captured frames to keep them small
SCREEN_JPEG_QUALITY  = 40
STARTUP_KEY        = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME           = "WitzoneAgent"


def resource_path(rel):
    """Resolve a bundled resource path — works both in dev and in the
    PyInstaller one-file build (which unpacks data into sys._MEIPASS)."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


ICON_FILE = resource_path("witzone.png")  # Witzone logo for the system-tray icon

# Shared state
last_activity  = time.time()
auth_token     = None
server_url     = None
current_user   = None
running        = True
saved_email    = None    # kept so the agent can silently re-login when its token expires
saved_password = None
tray_icon      = None    # set in main() before tray.run(); background threads use this


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config():
    cfg = configparser.ConfigParser()
    if os.path.exists(CONFIG_FILE):
        cfg.read(CONFIG_FILE)
    return cfg


def save_config(url, token, email=None, password=None):
    """Persist session. Merges with any existing config so a token-only refresh
    doesn't wipe the saved credentials used for silent re-login."""
    cfg = configparser.ConfigParser()
    if os.path.exists(CONFIG_FILE):
        cfg.read(CONFIG_FILE)
    if "agent" not in cfg:
        cfg["agent"] = {}
    cfg["agent"]["server_url"] = url
    cfg["agent"]["auth_token"] = token
    if email is not None:
        cfg["agent"]["email"] = email
    if password is not None:
        cfg["agent"]["pw"] = base64.b64encode(password.encode()).decode()
    with open(CONFIG_FILE, "w") as f:
        cfg.write(f)


# ---------------------------------------------------------------------------
# Windows startup registration
# ---------------------------------------------------------------------------

TASK_NAME  = "WitzoneAgent"          # Task Scheduler task name
STARTUP_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"

def is_windows():
    return sys.platform == "win32"


def _exe_path():
    return sys.executable if getattr(sys, "frozen", False) else os.path.abspath(sys.argv[0])


def _schtasks(*args, timeout=15):
    """Run schtasks.exe silently and return True on success."""
    try:
        r = subprocess.run(
            ["schtasks"] + list(args),
            capture_output=True, timeout=timeout,
            creationflags=0x08000000,   # CREATE_NO_WINDOW
        )
        return r.returncode == 0
    except Exception:
        return False


def set_autostart(enable: bool):
    """Register / remove the agent startup task via Windows Task Scheduler.

    Task Scheduler fires the agent ~30 s after the user logs in, which is
    long enough for explorer.exe and the notification area to be fully ready.
    HKCU\\Run fires immediately at login — before the tray exists — so the
    icon silently disappears on many machines.

    Also removes any legacy HKCU\\Run entry left by older versions so the
    agent does not launch twice.
    """
    if not is_windows():
        return False
    exe = _exe_path()
    try:
        # Always clean up the old registry-based entry so we never double-launch.
        try:
            import winreg
            k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_KEY, 0, winreg.KEY_SET_VALUE)
            winreg.DeleteValue(k, TASK_NAME)
            winreg.CloseKey(k)
        except Exception:
            pass   # key may not exist — that is fine

        if enable:
            # /SC ONLOGON  — trigger: user logs on
            # /DELAY 0000:30  — wait 30 s after logon (MMMM:SS format)
            # /IT  — only run when a user is interactively logged on
            # /RL LIMITED  — run with standard (non-elevated) privileges
            # /F  — overwrite if already exists
            ok = _schtasks(
                "/Create",
                "/TN", TASK_NAME,
                "/TR", f'"{exe}"',
                "/SC", "ONLOGON",
                "/DELAY", "0000:30",
                "/IT",
                "/RL", "LIMITED",
                "/F",
            )
            return ok
        else:
            return _schtasks("/Delete", "/TN", TASK_NAME, "/F")
    except Exception as e:
        print(f"Autostart error: {e}")
        return False


def get_autostart():
    """Return True if the startup task exists in Task Scheduler."""
    if not is_windows():
        return False
    # Check Task Scheduler task (current method)
    if _schtasks("/Query", "/TN", TASK_NAME):
        return True
    # Also check legacy registry key (set by older agent versions)
    try:
        import winreg
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_KEY, 0, winreg.KEY_QUERY_VALUE)
        winreg.QueryValueEx(k, TASK_NAME)
        winreg.CloseKey(k)
        return True
    except Exception:
        return False


def _ensure_single_instance():
    """Allow only one running copy of the agent. If another instance already
    holds the mutex, exit immediately (second launch from duplicate startup)."""
    if not is_windows():
        return
    try:
        import ctypes
        ctypes.windll.kernel32.CreateMutexW(None, True, "WitzoneAgentMutex_v1")
        if ctypes.windll.kernel32.GetLastError() == 183:   # ERROR_ALREADY_EXISTS
            sys.exit(0)
    except Exception:
        pass


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


def reauthenticate():
    """Silently re-login with saved credentials.
    Returns True on success, None on network error (retry later), False on bad credentials."""
    global auth_token
    if not (server_url and saved_email and saved_password):
        return False
    try:
        r = requests.post(
            f"{server_url}/api/auth/login",
            json={"email": saved_email, "password": saved_password, "agent": True},
            timeout=10,
        )
        if r.ok:
            auth_token = r.json()["token"]
            save_config(server_url, auth_token)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Re-authenticated successfully.")
            return True
        # Server reachable but rejected credentials (401/400)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Re-authentication rejected (HTTP {r.status_code}).")
        return False
    except requests.exceptions.RequestException:
        # Network not ready — caller should retry later, not treat as auth failure
        return None


def _auth_headers():
    return {"Authorization": f"Bearer {auth_token}"}


def authed_request(method, path, **kwargs):
    """Make an authenticated request; on 401 (expired token) re-login once and
    retry. Returns the Response, or None on a network error."""
    url = f"{server_url}{path}"
    try:
        r = requests.request(method, url, headers=_auth_headers(), **kwargs)
        if r.status_code == 401 and reauthenticate():
            r = requests.request(method, url, headers=_auth_headers(), **kwargs)
        return r
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Request failed ({path}): {e}")
        return None


def send_heartbeat():
    global auth_token, current_user
    if not server_url:
        return

    # Case A: no token at all — try to authenticate with saved credentials
    if not auth_token:
        if not (saved_email and saved_password):
            return  # no credentials saved; waiting for manual login
        result = reauthenticate()
        if result is not True:
            return  # None = network not ready yet; False = bad creds; retry next cycle
        # Fall through: auth_token now set

    # Case B: have a token but current_user is unknown (e.g. network was down at startup,
    # we used the saved token optimistically, or we just re-authenticated above)
    if current_user is None:
        user = validate_token(server_url, auth_token)
        if user:
            current_user = user
            _update_tray_icon(user)
        # If validate_token returned None (network hiccup or expired token), fall through
        # and send the heartbeat anyway — authed_request will handle a 401 by calling
        # reauthenticate() and retrying, so the heartbeat will still go through.

    authed_request("POST", "/api/idle/heartbeat", timeout=10, json={
        "idle_seconds":  get_idle_seconds(),
        "machine_name":  socket.gethostname(),
        "agent_version": AGENT_VERSION,
    })


def capture_and_upload():
    """Grab the current screen (all monitors), downscale, JPEG-compress and
    upload to the server. Called only when the server says a superuser is
    actively viewing this machine."""
    if not auth_token or not server_url:
        return
    try:
        try:
            img = ImageGrab.grab(all_screens=True)   # Windows: spans all monitors
        except TypeError:
            img = ImageGrab.grab()                   # older Pillow / single screen
        if img.width > SCREEN_MAX_WIDTH:
            ratio = SCREEN_MAX_WIDTH / float(img.width)
            img = img.resize((SCREEN_MAX_WIDTH, max(1, int(img.height * ratio))))
        if img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=SCREEN_JPEG_QUALITY)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        authed_request("POST", "/api/idle/screen/frame", timeout=15, json={"image": b64})
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Screen capture failed: {e}")


def screen_loop():
    """Poll the server; while a superuser is viewing this machine, capture and
    upload a frame each cycle. Idle/cheap when nobody is watching."""
    while True:
        try:
            if auth_token and server_url:
                r = authed_request("GET", "/api/idle/screen/poll", timeout=10)
                if r is not None and r.ok and r.json().get("capture"):
                    capture_and_upload()
        except Exception:
            pass
        time.sleep(SCREEN_POLL_INTERVAL)


def heartbeat_loop():
    # Fast-poll until we have a confirmed user (handles network-not-ready at Windows startup)
    while running and current_user is None:
        send_heartbeat()          # tries reauth if needed; sets current_user on success
        time.sleep(RECONNECT_INTERVAL)
    # Normal cadence once connected
    while running:
        send_heartbeat()
        time.sleep(HEARTBEAT_INTERVAL)


# ---------------------------------------------------------------------------
# Tray icon
# ---------------------------------------------------------------------------

def make_icon(authenticated=True):
    """System-tray icon = the Witzone logo. Dimmed when not logged in.
    Falls back to a simple drawn circle if the bundled image is unavailable."""
    try:
        img = Image.open(ICON_FILE).convert("RGBA").resize((64, 64), Image.LANCZOS)
        if not authenticated:
            from PIL import ImageEnhance
            img = ImageEnhance.Brightness(img).enhance(0.5)  # greyed-out until login
        return img
    except Exception:
        color = "#0ea5e9" if authenticated else "#64748b"
        img   = Image.new("RGB", (64, 64), color="#1e3a5f")
        draw  = ImageDraw.Draw(img)
        draw.ellipse([16, 16, 48, 48], fill=color)
        return img


# ---------------------------------------------------------------------------
# Tray helpers
# ---------------------------------------------------------------------------

def _update_tray_icon(user):
    """Update tray tooltip and icon brightness from a background thread.
    Called after silent re-authentication so the tray reflects the active user."""
    global tray_icon
    if tray_icon is None:
        return
    try:
        name = f"{user['first_name']} {user['last_name']}"
        tray_icon.title = f"Witzone — {name}"
        tray_icon.icon  = make_icon(authenticated=True)
        _show_balloon(tray_icon, "Witzone", f"Connected — {name}")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Tray menu actions
# ---------------------------------------------------------------------------

def on_login(icon, item):
    global auth_token, server_url, current_user, saved_email, saved_password

    # On Windows frozen exe: open a small input dialog via PowerShell
    # On dev/Mac: fall back to terminal input
    if is_windows() and getattr(sys, "frozen", False):
        url, email, password = _windows_login_dialog()
        if not url:
            return
    else:
        print("\n--- Witzone Workspace Login ---")
        url      = input("Server URL [https://hrms.witzonetech.com]: ").strip() or "https://hrms.witzonetech.com"
        email    = input("Email: ").strip()
        password = input("Password: ").strip()

    try:
        r = requests.post(
            f"{url}/api/auth/login",
            json={"email": email, "password": password, "agent": True},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        auth_token     = data["token"]
        server_url     = url
        current_user   = data["user"]
        saved_email    = email
        saved_password = password
        save_config(url, auth_token, email, password)

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


def _windows_password_dialog():
    """Prompt for the admin exit password. Returns the typed text ('' if blank/cancelled)."""
    try:
        script = (
            'Add-Type -AssemblyName Microsoft.VisualBasic;'
            '$p = [Microsoft.VisualBasic.Interaction]::InputBox('
            '"Enter the admin exit password to quit the Witzone agent.", "Witzone — Exit", "");'
            'Write-Output $p'
        )
        return subprocess.check_output(
            ["powershell", "-Command", script], text=True, timeout=120
        ).strip()
    except Exception:
        return ""


def report_exit_attempt(password):
    """Tell the server about a quit attempt (it emails HR/Superadmin every time)
    and return whether exit is authorized. Fails CLOSED — if the server can't be
    reached, the agent keeps running so it can't be quit while offline."""
    if not (auth_token and server_url):
        return False
    r = authed_request("POST", "/api/agent/exit-attempt", timeout=15, json={
        "password": password,
        "machine_name": socket.gethostname(),
    })
    if r is None:
        return False
    try:
        return bool(r.json().get("allow"))
    except Exception:
        return False


def on_quit(icon, item):
    global running
    # Quitting is gated by an admin exit password; every attempt is reported to
    # HR / Superadmin by the server.
    if is_windows() and getattr(sys, "frozen", False):
        pwd = _windows_password_dialog()
    else:
        try:
            pwd = input("Admin exit password: ").strip()
        except EOFError:
            pwd = ""
    if not pwd:
        return  # cancelled / empty → keep running, no attempt logged

    if report_exit_attempt(pwd):
        _show_balloon(icon, "Witzone", "Agent stopped.")
        running = False
        icon.stop()
    else:
        _show_balloon(icon, "Witzone", "Incorrect exit password — the agent will keep running. This attempt was reported.")


# ---------------------------------------------------------------------------
# Windows helpers
# ---------------------------------------------------------------------------

def _windows_login_dialog():
    """Use PowerShell InputBox to collect server URL, email, password."""
    try:
        script = (
            'Add-Type -AssemblyName Microsoft.VisualBasic;'
            '$url = [Microsoft.VisualBasic.Interaction]::InputBox("Server URL", "Witzone Login", "https://hrms.witzonetech.com");'
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
# Startup helper
# ---------------------------------------------------------------------------

def _wait_for_shell():
    """Wait until the Windows taskbar exists before registering the tray icon.

    When the agent is launched via the registry Run key or a startup task,
    Windows starts it before explorer.exe has finished creating the notification
    area.  Calling pystray.Icon.run() too early silently drops the icon — the
    process runs but never appears in the tray.

    We poll for 'Shell_TrayWnd' (the taskbar window class) and only proceed
    once it is visible.  On a fast machine this returns in under a second; on
    a slow first-boot it may take 10-20 s.  The 60 s ceiling is a last-resort
    fallback so the agent never hangs indefinitely.
    """
    if not is_windows() or not getattr(sys, 'frozen', False):
        return   # dev mode or non-Windows — no delay needed
    try:
        import ctypes
        user32 = ctypes.windll.user32
        for _ in range(60):
            if user32.FindWindowW('Shell_TrayWnd', None):
                time.sleep(2)   # small buffer after the taskbar is detected
                return
            time.sleep(1)
    except Exception:
        time.sleep(10)   # ctypes unavailable — blind wait as a fallback


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    global auth_token, server_url, current_user, running, saved_email, saved_password, tray_icon

    # Prevent two instances running at once (e.g. both HKCU\Run and Task Scheduler
    # firing on the same login session after an upgrade).
    _ensure_single_instance()

    # Safety net: wait for the taskbar before creating the tray icon.
    # Task Scheduler /DELAY already handles this at the OS level, but we keep
    # this as a belt-and-suspenders guard for manual launches too.
    _wait_for_shell()

    # Migrate legacy HKCU\Run entry → Task Scheduler (first run after upgrade).
    # Silently upgrades users who previously clicked "Start with Windows" on an
    # older version so they don't need to toggle it off and on again.
    if is_windows() and getattr(sys, "frozen", False):
        try:
            import winreg
            k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_KEY, 0, winreg.KEY_QUERY_VALUE)
            winreg.QueryValueEx(k, TASK_NAME)
            winreg.CloseKey(k)
            # Legacy key found — replace it with the Task Scheduler task
            set_autostart(True)
        except Exception:
            pass   # key not present — nothing to migrate

    # Load and validate saved credentials
    cfg = load_config()
    if "agent" in cfg:
        saved_url   = cfg["agent"].get("server_url", "").strip()
        saved_token = cfg["agent"].get("auth_token", "").strip()
        em          = cfg["agent"].get("email", "").strip()
        pw_enc      = cfg["agent"].get("pw", "").strip()
        if saved_url:
            server_url = saved_url
        if em:
            saved_email = em
        if pw_enc:
            try:
                saved_password = base64.b64decode(pw_enc).decode()
            except Exception:
                saved_password = None
        if saved_url and saved_token:
            user = validate_token(saved_url, saved_token)
            if user:
                # Best case: token valid and server reachable
                auth_token   = saved_token
                current_user = user
                print(f"Session active: {user['first_name']} {user['last_name']} ({user.get('employee_id', '')})")
            else:
                # validate_token failed — could be network down (common at Windows startup)
                # OR the token genuinely expired.  Try a fresh login with saved credentials.
                reauth = reauthenticate()
                if reauth is True:
                    # Fresh token acquired
                    current_user = validate_token(server_url, auth_token)
                    name = current_user or {}
                    print(f"Re-authenticated ({name.get('employee_id', '') if isinstance(name, dict) else ''}).")
                elif reauth is None:
                    # Network not ready (RequestException) — keep the saved token and let
                    # the heartbeat loop verify + update current_user once the network is up.
                    auth_token = saved_token
                    print("Network not ready at startup — will reconnect automatically when available.")
                else:
                    # Server reachable but rejected credentials → truly need manual re-login
                    print("Credentials rejected — please log in again via the tray icon.")

    # Input listeners — wrapped so a hook-permission failure at startup never
    # crashes the agent; idle tracking simply won't work in that case.
    ml = kl = None
    try:
        ml = mouse.Listener(on_move=record_activity, on_click=record_activity, on_scroll=record_activity)
        kl = keyboard.Listener(on_press=record_activity)
        ml.start()
        kl.start()
    except Exception as e:
        print(f"Input listener error (idle tracking disabled): {e}")

    # Heartbeat thread
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    # Live-screen poll thread (captures only while a superuser is viewing)
    threading.Thread(target=screen_loop, daemon=True).start()

    # Tray setup
    authenticated = current_user is not None
    connecting    = bool(auth_token and not current_user)  # saved token but no network yet
    if authenticated:
        title = f"Witzone — {current_user['first_name']} {current_user['last_name']}"
    elif connecting:
        title = "Witzone — Connecting..."
    else:
        title = "Witzone — Not logged in (right-click to login)"

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

    tray = pystray.Icon(APP_NAME, make_icon(authenticated or connecting), title, menu)
    tray_icon = tray  # expose to background threads so they can update icon/title on reconnect
    print(f"Witzone Agent running — {title}")
    tray.run()

    # Cleanup
    running = False
    if ml: ml.stop()
    if kl: kl.stop()


if __name__ == "__main__":
    main()
