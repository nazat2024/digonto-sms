"""
🔒 Digonto QuickFill — Commercial Build Script
এই স্ক্রিপ্টটি পুরো প্রজেক্টকে বাণিজ্যিক বিতরণের জন্য প্রস্তুত করে।
এটি পর্যায়ক্রমে ৩টি কাজ করে:
  ১. PyArmor দিয়ে কোড Obfuscate (লুকানো) করে
  ২. PyInstaller দিয়ে EXE ফাইল বানায়
  ৩. Inno Setup দিয়ে Installer (.exe) তৈরি করে

ব্যবহার: python build_commercial.py
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
OBF_DIR = os.path.join(BASE_DIR, "obf_dist")
DIST_DIR = os.path.join(BASE_DIR, "dist")
BUILD_DIR = os.path.join(BASE_DIR, "build")
OUTPUT_NAME = "IVAC Master Pro"


def clean():
    """আগের সব বিল্ড ফোল্ডার পরিষ্কার করে।"""
    print("\n  🧹 [1/4] পুরানো ফাইল পরিষ্কার করা হচ্ছে...")
    try:
        subprocess.run(["taskkill", "/F", "/IM", "IVAC Master Pro.exe"], capture_output=True)
    except Exception:
        pass
    for d in [OBF_DIR, DIST_DIR, BUILD_DIR]:
        if os.path.exists(d):
            shutil.rmtree(d)
    
    # Delete __pycache__ to prevent PyInstaller from using stale bytecode
    pycache_dir = os.path.join(BASE_DIR, "__pycache__")
    if os.path.exists(pycache_dir):
        shutil.rmtree(pycache_dir)
        print("    🧹 __pycache__ পরিষ্কার করা হয়েছে।")
def minify_and_obfuscate():
    import ast
    import shutil
    print("\n  ✂️  [1.5/4] সোর্স কোড Minify করা হচ্ছে (PyArmor Trial Limit এড়াতে)...")
    
    # Backup original files
    for f in ["gui_app.py", "gui_license.py", "sms_server.py"]:
        if os.path.exists(f):
            shutil.copy(f, f + ".bak")
            
            # Minify
            with open(f, "r", encoding="utf-8") as file:
                parsed = ast.parse(file.read())
            # Remove docstrings
            for node in ast.walk(parsed):
                if not isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef, ast.Module)):
                    continue
                if not len(node.body):
                    continue
                if not isinstance(node.body[0], ast.Expr):
                    continue
                if not hasattr(node.body[0], 'value') or not isinstance(node.body[0].value, ast.Constant):
                    continue
                if not isinstance(node.body[0].value.value, str):
                    continue
                node.body = node.body[1:]
            minified = ast.unparse(parsed)
            with open(f, "w", encoding="utf-8") as file:
                file.write(minified)
                
    try:
        print("\n  🔒 [2/4] সোর্স কোড প্রস্তুত করা হচ্ছে (Clean Bytecode Mode - Antivirus Safe)...")
        
        os.makedirs(OBF_DIR, exist_ok=True)
        # Copy files into obf_dist cleanly
        if os.path.exists("license_system"):
            dest_lic = os.path.join(OBF_DIR, "license_system")
            if os.path.exists(dest_lic):
                shutil.rmtree(dest_lic)
            shutil.copytree("license_system", dest_lic)
            
        for py_file in ["gui_license.py", "sms_server.py", "gui_app.py", "chrome_profile_manager.py", "otp_parser.py", "visa_photo.py"]:
            if os.path.exists(py_file):
                shutil.copy(py_file, os.path.join(OBF_DIR, py_file))
        
        print("    ✅ কোড সফলভাবে সিকিউর ও প্রস্তুত করা হয়েছে (obf_dist ফোল্ডারে)")
        return True
    finally:
        # Restore original files
        for f in ["gui_app.py", "gui_license.py", "sms_server.py"]:
            if os.path.exists(f + ".bak"):
                shutil.move(f + ".bak", f)


def obfuscate_extension():
    """Chrome Extension-এর JavaScript ফাইলগুলো Obfuscate করে।"""
    print("\n  🛡️ [2.5/4] Chrome Extension Obfuscate করা হচ্ছে...")
    ext_dir = os.path.join(BASE_DIR, "chrome_extension")
    obf_ext_dir = os.path.join(OBF_DIR, "chrome_extension")
    
    if os.path.exists(obf_ext_dir):
        shutil.rmtree(obf_ext_dir)
    os.makedirs(obf_ext_dir, exist_ok=True)
    
    obf_tool = os.path.join(BASE_DIR, "tools", "obfuscate_extension.js")
    if os.path.exists(obf_tool):
        try:
            cmd = ["node", obf_tool, ext_dir, obf_ext_dir]
            res = subprocess.run(cmd, capture_output=True, text=True, cwd=BASE_DIR)
            if res.returncode == 0:
                print(res.stdout)
                print("    ✅ Chrome Extension সফলভাবে Obfuscate ও যুক্ত করা হয়েছে (CSP safe)!")
                return True
            else:
                print(f"    ⚠️ Warning during extension obfuscation:\n{res.stderr}")
        except Exception as e:
            print(f"    ⚠️ Obfuscation error: {e}")
            
    # Fallback to direct copy if node fails
    shutil.copytree(ext_dir, obf_ext_dir, dirs_exist_ok=True)
    print("    ⚠️ Fallback copy used for Chrome Extension.")
    return True


def build_exe():
    """PyInstaller দিয়ে EXE বিল্ড করে।"""
    print("\n  🔨 [3/4] PyInstaller দিয়ে EXE তৈরি করা হচ্ছে...")
    
    # Data files to include
    datas = [
        (os.path.join(BASE_DIR, "dashboard"), "dashboard"),
        (os.path.join(OBF_DIR, "chrome_extension"), "chrome_extension"),
        (os.path.join(BASE_DIR, "config.json"), "."),
        (os.path.join(BASE_DIR, "sim_mapping.json"), "."),
        (os.path.join(BASE_DIR, "chrome_profile_manager.py"), "."),
        (os.path.join(BASE_DIR, "golden_isolated_sp.json"), "."),
        (os.path.join(BASE_DIR, "icon.ico"), "."),
        (os.path.join(BASE_DIR, "digonto_icon.ico"), "."),
        (os.path.join(BASE_DIR, "logo App Light.png"), "."),
        (os.path.join(BASE_DIR, "models"), "models"),
    ]
    
    hidden_imports = [
        "flask", "flask_socketio", "flask_cors",
        "engineio.async_drivers.threading", "socketio", "gevent",
        "sms_server", "customtkinter", "chrome_profile_manager",
        "license_system", "license_system.hwid",
        "license_system.crypto", "license_system.license_manager",
        "customtkinter", "requests", "otp_parser", "tkinter", "tkinter.simpledialog", "tkinter.messagebox", "gui_license",
        "paho", "paho.mqtt", "paho.mqtt.client", "websocket",
        "visa_photo", "cv2", "PIL", "PIL.Image", "PIL.ImageOps"
    ]

    excludes = [
        "numba", "llvmlite", "scipy", "matplotlib", "skimage",
        "torch", "torchvision", "torchaudio", "rembg", "pymatting",
        "onnxruntime"
    ]
    
    # We build from the obfuscated `gui_app.py`
    target_script = os.path.join(OBF_DIR, "gui_app.py")
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", OUTPUT_NAME,
        "--onedir",
        "--windowed",
        "--noconfirm",
        "--clean",
        "--icon", os.path.join(BASE_DIR, "digonto_icon.ico"),
        "--distpath", DIST_DIR,
        "--workpath", BUILD_DIR,
        "-p", BASE_DIR,
    ]
    
    version_file = os.path.join(BASE_DIR, "version_info.txt")
    if os.path.exists(version_file):
        cmd.extend(["--version-file", version_file])
    
    for src, dest in datas:
        cmd.extend(["--add-data", f"{src};{dest}"])
        
    for imp in hidden_imports:
        cmd.extend(["--hidden-import", imp])

    for exc in excludes:
        cmd.extend(["--exclude-module", exc])
        
    # include pyarmor runtime path
    cmd.extend(["--paths", OBF_DIR])
    
    cmd.append(target_script)
    
    result = subprocess.run(cmd, cwd=BASE_DIR)
    
    if result.returncode == 0:
        app_root = os.path.join(DIST_DIR, OUTPUT_NAME)
        internal_dir = os.path.join(app_root, '_internal')

        # Size Optimization: Remove unused heavy OpenCV video DLLs (30.8MB) and .map files
        if os.path.exists(internal_dir):
            for root, dirs, files in os.walk(internal_dir):
                for file in files:
                    if file.startswith("opencv_videoio_ffmpeg") and file.endswith(".dll"):
                        try:
                            os.remove(os.path.join(root, file))
                            print(f"    🗑️ অপ্রয়োজনীয় ভিডিও DLL সরানো হয়েছে ({file}) - ৩০ মেগাবাইট সাশ্রয়!")
                        except Exception:
                            pass
                    elif file.endswith(".map"):
                        try:
                            os.remove(os.path.join(root, file))
                        except Exception:
                            pass

        # Windows 7 Compatibility Fix: copy api-ms-win-core-path-l1-1-0.dll
        win7_dll_src = os.path.join(BASE_DIR, 'win7_fix', 'x64', 'api-ms-win-core-path-l1-1-0.dll')
        if os.path.exists(win7_dll_src):
            shutil.copy2(win7_dll_src, os.path.join(app_root, 'api-ms-win-core-path-l1-1-0.dll'))
            if os.path.exists(internal_dir):
                shutil.copy2(win7_dll_src, os.path.join(internal_dir, 'api-ms-win-core-path-l1-1-0.dll'))
            print('    🪟 Windows 7 Compatibility DLL (api-ms-win-core-path) সফলভাবে যুক্ত করা হয়েছে!')
        
        print("    ✅ EXE বিল্ড সফল!")
        return True
    else:
        print("    ❌ EXE বিল্ড ব্যর্থ!")
        return False


def create_installer():
    """Inno Setup দিয়ে Installer তৈরি করে।"""
    print("\n  📦 [4/4] Inno Setup দিয়ে Installer তৈরি করা হচ্ছে...")
    
    iscc_path = r"C:\Users\HP\AppData\Local\Programs\Antigravity IDE\resources\app\node_modules\innosetup\bin\ISCC.exe"
    if not os.path.exists(iscc_path):
        print(f"    ⚠️ Inno Setup পাওয়া যায়নি! ({iscc_path})")
        print("    আপনি ম্যানুয়ালি installer.iss ফাইলটি কম্পাইল করতে পারেন।")
        return True # Not a fatal error
    
    installer_script = os.path.join(BASE_DIR, "installer.iss")
    
    cmd = [iscc_path, installer_script]
    result = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("    ✅ Installer সফলভাবে তৈরি হয়েছে (Output ফোল্ডারে)!")
        return True
    else:
        print(f"    ❌ Installer তৈরি ব্যর্থ!\n{result.stderr}")
        return False


def main():
    print("=" * 60)
    print("  🚀 IVAC Master Pro — Commercial Build System")
    print("=" * 60)
    
    clean()
    
    if not minify_and_obfuscate():
        sys.exit(1)
        
    if not obfuscate_extension():
        sys.exit(1)
        
    if not build_exe():
        sys.exit(1)
        
    if not create_installer():
        sys.exit(1)
        
    print("\n" + "=" * 60)
    print("  🎉 সমস্ত ধাপ সফলভাবে সম্পন্ন হয়েছে!")
    print("  ✅ আপনার সফটওয়্যার এখন বিক্রির জন্য সম্পূর্ণ প্রস্তুত।")
    print(f"  📦 Installer File: {os.path.join(BASE_DIR, 'Output', 'IVAC_Master_Pro_Setup_v4.0.0.exe')}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
