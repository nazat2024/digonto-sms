"""
🔨 Digonto QuickFill — EXE Build Script
এই স্ক্রিপ্ট PyInstaller দিয়ে সফটওয়্যারকে .exe ফাইলে রূপান্তর করে।

ব্যবহার: python build_exe.py
"""

import os
import sys
import shutil
import subprocess

# Windows console UTF-8 fix
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
BUILD_DIR = os.path.join(BASE_DIR, "build")
OUTPUT_NAME = "IVAC Master Pro"

def clean():
    """আগের বিল্ড ফাইল মুছে ফেলে।"""
    for d in [DIST_DIR, BUILD_DIR]:
        if os.path.exists(d):
            shutil.rmtree(d)
            print(f"  🧹 Cleaned: {d}")
    
    spec_file = os.path.join(BASE_DIR, f"{OUTPUT_NAME}.spec")
    if os.path.exists(spec_file):
        os.remove(spec_file)

def build():
    """PyInstaller দিয়ে EXE বিল্ড করে।"""
    print("\n" + "=" * 55)
    print("  🔨 IVAC Master Pro — EXE Builder")
    print("=" * 55)
    
    # Clean
    print("\n  📁 Step 1: পুরানো ফাইল পরিষ্কার করা হচ্ছে...")
    clean()
    
    # Data files to include
    datas = [
        # Dashboard files
        (os.path.join(BASE_DIR, "dashboard"), "dashboard"),
        # Chrome Extension
        (os.path.join(BASE_DIR, "chrome_extension"), "chrome_extension"),
    ]
    
    # Hidden imports (Flask needs these)
    hidden_imports = [
        "flask", "flask_socketio", "flask_cors",
        "engineio.async_drivers.threading",
        "socketio",
        "gevent",
        "license_system", "license_system.hwid",
        "license_system.crypto", "license_system.license_manager",
        "gui_license",
        "chrome_profile_manager"
    ]
    
    # Build command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", OUTPUT_NAME,
        "--onedir",               # একটি ফোল্ডারে সব ফাইল
        "--windowed",             # কনসোল উইন্ডো লুকাবে (GUI mode)
        "--noconfirm",            # আগের বিল্ড ওভাররাইট করবে
        "--clean",                # ক্যাশ পরিষ্কার করবে
    ]
    
    # Add data files
    for src, dest in datas:
        cmd.extend(["--add-data", f"{src};{dest}"])
    
    # Add hidden imports
    for imp in hidden_imports:
        cmd.extend(["--hidden-import", imp])
    
    # Add additional files
    additional_files = [
        "config.json",
        "sim_mapping.json",
        "otp_parser.py",
        "sms_server.py",
        "chrome_profile_manager.py",
    ]
    for f in additional_files:
        fpath = os.path.join(BASE_DIR, f)
        if os.path.exists(fpath):
            cmd.extend(["--add-data", f"{fpath};."])
    
    # Main script
    cmd.append(os.path.join(BASE_DIR, "gui_app.py"))
    
    print(f"\n  🔧 Step 2: EXE বিল্ড করা হচ্ছে...")
    print(f"  ⏳ এটি কয়েক মিনিট সময় নিতে পারে...\n")
    
    result = subprocess.run(cmd, cwd=BASE_DIR)
    
    if result.returncode == 0:
        # Windows 7 Compatibility Fix
        win7_dll_src = os.path.join(BASE_DIR, 'win7_fix', 'x64', 'api-ms-win-core-path-l1-1-0.dll')
        if os.path.exists(win7_dll_src):
            app_root = os.path.join(DIST_DIR, OUTPUT_NAME)
            internal_dir = os.path.join(app_root, '_internal')
            shutil.copy2(win7_dll_src, os.path.join(app_root, 'api-ms-win-core-path-l1-1-0.dll'))
            if os.path.exists(internal_dir):
                shutil.copy2(win7_dll_src, os.path.join(internal_dir, 'api-ms-win-core-path-l1-1-0.dll'))
            print("    🪟 Windows 7 Compatibility DLL যুক্ত করা হয়েছে!")
            
        exe_path = os.path.join(DIST_DIR, OUTPUT_NAME, f"{OUTPUT_NAME}.exe")
        print(f"\n  {'=' * 55}")
        print(f"  ✅ বিল্ড সফল!")
        print(f"  {'=' * 55}")
        print(f"  📁 Output: {os.path.join(DIST_DIR, OUTPUT_NAME)}")
        print(f"  🖥️ EXE: {exe_path}")
        
        # Size
        if os.path.exists(exe_path):
            size_mb = os.path.getsize(exe_path) / (1024 * 1024)
            print(f"  📦 Size: {size_mb:.1f} MB")
        
        print(f"\n  💡 চালাতে: dist\\{OUTPUT_NAME}\\{OUTPUT_NAME}.exe")
        print(f"  {'=' * 55}\n")
    else:
        print(f"\n  ❌ বিল্ড ব্যর্থ! (Exit code: {result.returncode})")
        print(f"  উপরের এরর মেসেজ দেখুন।\n")
    
    return result.returncode


if __name__ == "__main__":
    sys.exit(build())
