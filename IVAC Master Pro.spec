# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['D:/Ivac Auto Fill/obf_dist/gui_app.py'],
    pathex=['D:/Ivac Auto Fill', 'D:/Ivac Auto Fill/obf_dist'],
    binaries=[],
    datas=[('D:/Ivac Auto Fill/dashboard', 'dashboard'), ('D:/Ivac Auto Fill/obf_dist/chrome_extension', 'chrome_extension'), ('D:/Ivac Auto Fill/config.json', '.'), ('D:/Ivac Auto Fill/sim_mapping.json', '.'), ('D:/Ivac Auto Fill/chrome_profile_manager.py', '.'), ('D:/Ivac Auto Fill/golden_isolated_sp.json', '.'), ('D:/Ivac Auto Fill/icon.ico', '.'), ('D:/Ivac Auto Fill/digonto_icon.ico', '.'), ('D:/Ivac Auto Fill/logo App Light.png', '.')],
    hiddenimports=['flask', 'flask_socketio', 'flask_cors', 'engineio.async_drivers.threading', 'socketio', 'gevent', 'sms_server', 'customtkinter', 'chrome_profile_manager', 'license_system', 'license_system.hwid', 'license_system.crypto', 'license_system.license_manager', 'customtkinter', 'requests', 'otp_parser', 'tkinter', 'tkinter.simpledialog', 'tkinter.messagebox', 'gui_license', 'paho', 'paho.mqtt', 'paho.mqtt.client', 'websocket'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='IVAC Master Pro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['D:/Ivac Auto Fill/digonto_icon.ico'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='IVAC Master Pro',
)
