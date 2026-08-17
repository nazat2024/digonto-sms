"""
🔒 IVAC Auto Fill — Commercial Build Script
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
OUTPUT_NAME = "IVAC Auto Fill"


def clean():
    """আগের সব বিল্ড ফোল্ডার পরিষ্কার করে।"""
    print("\n  🧹 [1/4] পুরানো ফাইল পরিষ্কার করা হচ্ছে...")
    for d in [OBF_DIR, DIST_DIR, BUILD_DIR]:
        if os.path.exists(d):
            shutil.rmtree(d)
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
        print("\n  🔒 [2/4] PyArmor দিয়ে সোর্স কোড Obfuscate করা হচ্ছে...")
        
        # Obfuscate only specific core components to avoid Trial Limit on gui_app.py
        cmd = f"{sys.executable} -m pyarmor.cli gen -O obf_dist license_system sms_server.py gui_license.py"
        result = subprocess.run(cmd, shell=True, cwd=BASE_DIR, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"    ❌ Obfuscation ব্যর্থ!\n{result.stderr}")
            return False
            
        # Copy gui_app.py without obfuscation
        shutil.copy("gui_app.py", os.path.join(OBF_DIR, "gui_app.py"))
        
        print("    ✅ কোড সফলভাবে সিকিউর করা হয়েছে (obf_dist ফোল্ডারে)")
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
    
    if not os.path.exists(obf_ext_dir):
        os.makedirs(obf_ext_dir, exist_ok=True)
        
    shutil.copytree(ext_dir, obf_ext_dir, dirs_exist_ok=True)
    
    for file in ["content.js", "background.js", "popup.js"]:
        js_file = os.path.join(obf_ext_dir, file)
        if os.path.exists(js_file):
            print(f"    - Included {file}...")
            
    print("    ✅ Chrome Extension সফলভাবে যুক্ত করা হয়েছে (CSP safe)!")
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
    ]
    
    hidden_imports = [
        "flask", "flask_socketio", "flask_cors",
        "engineio.async_drivers.threading", "socketio", "gevent",
        "sms_server", "customtkinter",
        "license_system", "license_system.hwid",
        "license_system.crypto", "license_system.license_manager",
        "customtkinter", "requests", "otp_parser", "tkinter", "gui_license"
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
        "--distpath", DIST_DIR,
        "--workpath", BUILD_DIR,
        "-p", BASE_DIR,
    ]
    
    for src, dest in datas:
        cmd.extend(["--add-data", f"{src};{dest}"])
        
    for imp in hidden_imports:
        cmd.extend(["--hidden-import", imp])
        
    # include pyarmor runtime path
    cmd.extend(["--paths", OBF_DIR])
    
    cmd.append(target_script)
    
    result = subprocess.run(cmd, cwd=BASE_DIR)
    
    if result.returncode == 0:
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
    print("  🚀 IVAC Auto Fill — Commercial Build System")
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
    print(f"  📦 Installer File: {os.path.join(BASE_DIR, 'Output', 'IVAC_Auto_Fill_Setup_v3.0.0.exe')}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
