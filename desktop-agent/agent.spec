# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Witzone Workspace Agent (Windows)
# Build: pyinstaller agent.spec

block_cipher = None

a = Analysis(
    ['agent.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        # pynput Windows backend
        'pynput.keyboard._win32',
        'pynput.mouse._win32',
        # pystray Windows backend
        'pystray._win32',
        # PIL / Pillow
        'PIL._tkinter_finder',
        'PIL.Image',
        'PIL.ImageDraw',
        # requests + urllib3
        'requests',
        'urllib3',
        'charset_normalizer',
        'certifi',
        'idna',
        # pywin32 (tray icon on Windows)
        'win32api',
        'win32con',
        'win32gui',
        'win32gui_struct',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='WitzoneAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,       # No console window — runs silently in system tray
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon='icon.ico',   # Uncomment and add icon.ico if you have one
)
