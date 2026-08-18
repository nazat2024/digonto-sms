# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['D:/Ivac Auto Fill/obf_dist/gui_app.py'],
    pathex=['D:/Ivac Auto Fill', 'D:/Ivac Auto Fill/obf_dist'],
    binaries=[],
    datas=[('D:/Ivac Auto Fill/dashboard', 'dashboard'), ('D:/Ivac Auto Fill/obf_dist/chrome_extension', 'chrome_extension'), ('D:/Ivac Auto Fill/config.json', '.'), ('D:/Ivac Auto Fill/sim_mapping.json', '.')],
    hiddenimports=['flask', 'flask_socketio', 'flask_cors', 'engineio.async_drivers.threading', 'socketio', 'gevent', 'sms_server', 'customtkinter', 'license_system', 'license_system.hwid', 'license_system.crypto', 'license_system.license_manager', 'customtkinter', 'requests', 'otp_parser', 'tkinter', 'gui_license', 'paho', 'paho.mqtt', 'paho.mqtt.client'],
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
    name='IVAC Auto Fill',
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
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='IVAC Auto Fill',
)
