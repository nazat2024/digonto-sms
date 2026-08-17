"""
IVAC OTP Auto-Fill System — মূল অর্কেস্ট্রেটর (Chrome Extension Version)

ব্যবহার:
    python main.py
"""

import os
import sys

# Windows console এ Bengali/Unicode সঠিকভাবে দেখাতে UTF-8 mode সেট
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
import json
import time
from datetime import datetime

# Colorama for colored output
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    class Fore:
        RED = GREEN = YELLOW = CYAN = MAGENTA = WHITE = RESET = ""
    class Style:
        BRIGHT = RESET_ALL = ""

from sms_server import socketio, app

def print_banner():
    """প্রোগ্রামের ব্যানার দেখায়।"""
    banner = f"""
{Fore.CYAN}{Style.BRIGHT}
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🇮🇳  IVAC OTP Auto-Fill System  🇧🇩               ║
║   (Chrome Extension Edition)                         ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
{Style.RESET_ALL}
    📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    """
    print(banner)

def launch_profiles():
    """সব ক্রোম প্রোফাইল এক্সটেনশন সহ চালু করে"""
    config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    if not os.path.exists(config_file):
        return

    try:
        with open(config_file, "r", encoding="utf-8") as f:
            config = json.load(f)
    except Exception:
        return

    profiles = config.get("profiles", [])
    active_profiles = [p for p in profiles if p.get("enabled", True)]
    
    if not active_profiles:
        return
        
    print(f"\n{Fore.CYAN}❓ আপনি কি আপনার {len(active_profiles)} টি ক্রোম প্রোফাইল একসাথে ওপেন করতে চান? (y/n): {Style.RESET_ALL}", end="")
    choice = input().strip().lower()
    
    if choice == 'y':
        ext_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chrome_extension")
        import subprocess
        
        print(f"\n{Fore.GREEN}🚀 প্রোফাইলগুলো ওপেন করা হচ্ছে...{Style.RESET_ALL}")
        for p in active_profiles:
            profile_dir = p.get("chrome_profile")
            if profile_dir:
                print(f"   👉 খুলছে: {p.get('name', profile_dir)} ({profile_dir})")
                
                # Command to launch Chrome with the extension and go to IVAC
                cmd = f'start chrome.exe --profile-directory="{profile_dir}" --load-extension="{ext_path}" "https://appointment.ivacbd.com/signin"'
                subprocess.Popen(cmd, shell=True)
                time.sleep(1) # একটু বিরতি যেন পিসি হ্যাং না হয়

def run_system():
    """SMS সার্ভার চালু করে"""
    host = "0.0.0.0"
    port = 5000

    print(f"\n{Fore.GREEN}🚀 SMS সার্ভার চালু হচ্ছে — http://{host}:{port}")
    print(f"{Fore.CYAN}📊 Dashboard — http://localhost:{port}")
    print(f"{Fore.YELLOW}📨 SMS Endpoint — POST http://<PC_IP>:{port}/api/sms")
    print(f"{Fore.GREEN}🧩 Chrome Extension Ready!")
    
    # সার্ভারটি ব্যাকগ্রাউন্ডে চালু করে দিচ্ছি যাতে input() এর জন্য আটকে না থাকে
    import threading
    server_thread = threading.Thread(
        target=lambda: socketio.run(app, host=host, port=port, debug=False, allow_unsafe_werkzeug=True, log_output=False)
    )
    server_thread.daemon = True
    server_thread.start()

    print(f"\n{Fore.YELLOW}✅ সার্ভার ব্যাকগ্রাউন্ডে চালু হয়েছে! (Dashboard এ যেতে পারেন)")
    
    # এখন প্রোফাইল ওপেন করার জন্য প্রশ্ন করবে
    launch_profiles()
    
    print(f"\n{Fore.YELLOW}✅ আপনার Chrome ব্রাউজারগুলো থেকে লগইন করুন।")
    print(f"{Fore.YELLOW}   বট নিজে থেকেই OTP টাইপ করে দেবে!")

    try:
        # Main thread কে বাঁচিয়ে রাখার জন্য লুপ
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}🛑 সার্ভার বন্ধ করা হয়েছে")

if __name__ == "__main__":
    print_banner()
    
    # ===== LICENSE CHECK =====
    from license_system.license_manager import (
        check_license, activate_license, LicenseStatus, get_masked_key
    )
    
    license_info = check_license()
    
    while not license_info.is_valid:
        if license_info.status == LicenseStatus.NOT_ACTIVATED:
            print(f"\n{Fore.YELLOW}{'=' * 55}")
            print(f"  🔑 লাইসেন্স অ্যাক্টিভেশন প্রয়োজন!")
            print(f"{'=' * 55}{Style.RESET_ALL}")
            print(f"\n  {Fore.CYAN}আপনার লাইসেন্স কোড দিন:{Style.RESET_ALL}")
            key = input(f"  🔑 License Key: ").strip()
            
            if not key:
                print(f"\n  {Fore.RED}❌ কোড দিতে হবে! প্রোগ্রাম বন্ধ হচ্ছে।{Style.RESET_ALL}")
                sys.exit(1)
            
            license_info = activate_license(key)
            
            if license_info.is_valid:
                print(f"\n  {Fore.GREEN}✅ লাইসেন্স সফলভাবে অ্যাক্টিভেট হয়েছে!{Style.RESET_ALL}")
                print(f"     প্ল্যান:      {license_info.plan}")
                print(f"     মেয়াদ:       {license_info.expiry_date} পর্যন্ত")
                print(f"     বাকি আছে:    {license_info.days_remaining} দিন")
            else:
                print(f"\n  {Fore.RED}{license_info.error_message}{Style.RESET_ALL}")
                retry = input(f"\n  {Fore.YELLOW}আবার চেষ্টা করবেন? (y/n): {Style.RESET_ALL}").strip().lower()
                if retry != 'y':
                    print(f"\n  {Fore.RED}প্রোগ্রাম বন্ধ হচ্ছে।{Style.RESET_ALL}")
                    sys.exit(1)
        
        elif license_info.status == LicenseStatus.EXPIRED:
            print(f"\n{Fore.RED}{'=' * 55}")
            print(f"  ⏰ আপনার লাইসেন্সের মেয়াদ শেষ!")
            print(f"{'=' * 55}{Style.RESET_ALL}")
            print(f"\n  {license_info.error_message}")
            print(f"\n  {Fore.YELLOW}নতুন লাইসেন্স কোড দিন:{Style.RESET_ALL}")
            key = input(f"  🔑 License Key: ").strip()
            
            if not key:
                sys.exit(1)
            
            license_info = activate_license(key)
            if license_info.is_valid:
                print(f"\n  {Fore.GREEN}✅ নতুন লাইসেন্স সফলভাবে অ্যাক্টিভেট হয়েছে!{Style.RESET_ALL}")
            else:
                print(f"\n  {Fore.RED}{license_info.error_message}{Style.RESET_ALL}")
                sys.exit(1)
        
        elif license_info.status == LicenseStatus.INVALID_DEVICE:
            print(f"\n{Fore.RED}{'=' * 55}")
            print(f"  🚫 ডিভাইস মিসম্যাচ!")
            print(f"{'=' * 55}{Style.RESET_ALL}")
            print(f"\n  {license_info.error_message}")
            print(f"\n  {Fore.YELLOW}এই কম্পিউটারের জন্য আলাদা লাইসেন্স প্রয়োজন।{Style.RESET_ALL}")
            input(f"\n  Enter চাপুন বের হতে...")
            sys.exit(1)
        
        else:
            print(f"\n  {Fore.RED}{license_info.error_message}{Style.RESET_ALL}")
            input(f"\n  Enter চাপুন বের হতে...")
            sys.exit(1)
    
    # লাইসেন্স সক্রিয় — সফটওয়্যার চালু!
    masked = get_masked_key(license_info.license_key)
    print(f"\n{Fore.GREEN}  🔑 লাইসেন্স: {masked}  |  প্ল্যান: {license_info.plan}  |  মেয়াদ: {license_info.expiry_date} ({license_info.days_remaining} দিন বাকি){Style.RESET_ALL}")
    
    if license_info.days_remaining <= 7:
        print(f"  {Fore.YELLOW}⚠️  সতর্কতা: আপনার লাইসেন্সের মেয়াদ মাত্র {license_info.days_remaining} দিন বাকি আছে!{Style.RESET_ALL}")
    
    run_system()
