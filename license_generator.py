"""
🔐 IVAC License Generator — শুধুমাত্র আপনার (Admin) জন্য!
এই টুল দিয়ে আপনি কাস্টমারদের জন্য লাইসেন্স কোড তৈরি করবেন।

⚠️ সাবধান: এই ফাইলটি কখনো কাস্টমারকে দেবেন না!
    এটি আপনার সিক্রেট টুল।

ব্যবহার:
    python license_generator.py
"""

import os
import sys
import time
from datetime import datetime, timedelta

# UTF-8 support
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from license_system.crypto import encode_license_key, decode_license_key

# Colorama
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    class Fore:
        RED = GREEN = YELLOW = CYAN = MAGENTA = WHITE = RESET = ""
    class Style:
        BRIGHT = RESET_ALL = ""


PLAN_MAP = {
    '1': (1, 'Basic'),
    '2': (2, 'Pro'),
    '3': (3, 'Enterprise'),
}


def print_banner():
    print(f"""
{Fore.MAGENTA}{Style.BRIGHT}
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🔐  IVAC License Generator                    ║
║   শুধুমাত্র Admin এর জন্য                       ║
║                                                  ║
╚══════════════════════════════════════════════════╝
{Style.RESET_ALL}""")


def generate_key_interactive():
    """ইন্টারেক্টিভভাবে লাইসেন্স কি তৈরি করে।"""
    print(f"\n{Fore.CYAN}━━━ নতুন লাইসেন্স কি তৈরি করুন ━━━{Style.RESET_ALL}\n")
    
    # প্ল্যান নির্বাচন
    print(f"  {Fore.YELLOW}প্ল্যান নির্বাচন করুন:{Style.RESET_ALL}")
    print(f"    {Fore.WHITE}1.{Style.RESET_ALL} Basic")
    print(f"    {Fore.WHITE}2.{Style.RESET_ALL} Pro")
    print(f"    {Fore.WHITE}3.{Style.RESET_ALL} Enterprise")
    
    plan_choice = input(f"\n  {Fore.CYAN}প্ল্যান (1/2/3): {Style.RESET_ALL}").strip()
    if plan_choice not in PLAN_MAP:
        print(f"\n  {Fore.RED}❌ ভুল প্ল্যান নির্বাচন!{Style.RESET_ALL}")
        return
    
    plan_code, plan_name = PLAN_MAP[plan_choice]
    
    # মেয়াদ নির্ধারণ
    print(f"\n  {Fore.YELLOW}মেয়াদ নির্ধারণ করুন:{Style.RESET_ALL}")
    print(f"    {Fore.WHITE}1.{Style.RESET_ALL}  7 দিন")
    print(f"    {Fore.WHITE}2.{Style.RESET_ALL} 15 দিন")
    print(f"    {Fore.WHITE}3.{Style.RESET_ALL} 30 দিন")
    print(f"    {Fore.WHITE}4.{Style.RESET_ALL} 60 দিন")
    print(f"    {Fore.WHITE}5.{Style.RESET_ALL} 90 দিন")
    print(f"    {Fore.WHITE}6.{Style.RESET_ALL} 180 দিন (৬ মাস)")
    print(f"    {Fore.WHITE}7.{Style.RESET_ALL} 365 দিন (১ বছর)")
    print(f"    {Fore.WHITE}8.{Style.RESET_ALL} কাস্টম (নিজে দিন)")
    
    DURATION_MAP = {
        '1': 7, '2': 15, '3': 30, '4': 60,
        '5': 90, '6': 180, '7': 365
    }
    
    duration_choice = input(f"\n  {Fore.CYAN}মেয়াদ (1-8): {Style.RESET_ALL}").strip()
    
    if duration_choice == '8':
        try:
            days = int(input(f"  {Fore.CYAN}কত দিন? {Style.RESET_ALL}").strip())
            if days <= 0:
                print(f"\n  {Fore.RED}❌ দিন সংখ্যা 0 এর বেশি হতে হবে!{Style.RESET_ALL}")
                return
        except ValueError:
            print(f"\n  {Fore.RED}❌ সংখ্যা দিন!{Style.RESET_ALL}")
            return
    elif duration_choice in DURATION_MAP:
        days = DURATION_MAP[duration_choice]
    else:
        print(f"\n  {Fore.RED}❌ ভুল নির্বাচন!{Style.RESET_ALL}")
        return
    
    # মেয়াদ হিসাব
    expiry_timestamp = int(time.time()) + (days * 86400)
    expiry_date = datetime.fromtimestamp(expiry_timestamp).strftime("%Y-%m-%d")
    
    # কি তৈরি
    license_key = encode_license_key(expiry_timestamp, plan_code)
    
    # ফলাফল দেখাও
    print(f"\n{Fore.GREEN}{'=' * 55}")
    print(f"  ✅ লাইসেন্স কি সফলভাবে তৈরি হয়েছে!")
    print(f"{'=' * 55}{Style.RESET_ALL}")
    print(f"""
  {Fore.YELLOW}📋 তথ্য:{Style.RESET_ALL}
     প্ল্যান:        {Fore.WHITE}{plan_name}{Style.RESET_ALL}
     মেয়াদ:         {Fore.WHITE}{days} দিন{Style.RESET_ALL}
     মেয়াদ শেষ:     {Fore.WHITE}{expiry_date}{Style.RESET_ALL}

  {Fore.GREEN}🔑 License Key:{Style.RESET_ALL}
  ┌─────────────────────────────────────┐
  │  {Fore.CYAN}{Style.BRIGHT}{license_key}{Style.RESET_ALL}  │
  └─────────────────────────────────────┘
""")
    
    # ভেরিফিকেশন
    verified = decode_license_key(license_key)
    if verified:
        print(f"  {Fore.GREEN}✅ ভেরিফিকেশন: সফল{Style.RESET_ALL}")
    else:
        print(f"  {Fore.RED}❌ ভেরিফিকেশন: ব্যর্থ (কোডে সমস্যা!){Style.RESET_ALL}")
    
    print(f"\n{Fore.YELLOW}  ⚡ এই কোডটি কপি করে কাস্টমারকে দিন।{Style.RESET_ALL}")
    print(f"{'=' * 55}\n")


def verify_key_interactive():
    """একটি কি ভেরিফাই করে দেখে।"""
    print(f"\n{Fore.CYAN}━━━ লাইসেন্স কি যাচাই ━━━{Style.RESET_ALL}\n")
    
    key = input(f"  {Fore.CYAN}License Key দিন: {Style.RESET_ALL}").strip()
    
    result = decode_license_key(key)
    
    if result is None:
        print(f"\n  {Fore.RED}❌ এই কি টি ভুল বা অবৈধ!{Style.RESET_ALL}\n")
        return
    
    expiry_date = datetime.fromtimestamp(result['expiry']).strftime("%Y-%m-%d %H:%M:%S")
    plan_name = {1: 'Basic', 2: 'Pro', 3: 'Enterprise'}.get(result['plan'], 'Unknown')
    
    now = int(time.time())
    remaining = max(0, (result['expiry'] - now) // 86400)
    is_expired = now > result['expiry']
    
    print(f"\n  {Fore.GREEN}✅ কি টি বৈধ!{Style.RESET_ALL}")
    print(f"     প্ল্যান:        {plan_name}")
    print(f"     মেয়াদ শেষ:     {expiry_date}")
    print(f"     বাকি আছে:      {remaining} দিন")
    if is_expired:
        print(f"     {Fore.RED}⏰ অবস্থা:       মেয়াদ শেষ!{Style.RESET_ALL}")
    else:
        print(f"     {Fore.GREEN}✅ অবস্থা:       সক্রিয়{Style.RESET_ALL}")
    print()


def bulk_generate():
    """একসাথে একাধিক কি তৈরি করে।"""
    print(f"\n{Fore.CYAN}━━━ ব্যাচ লাইসেন্স তৈরি ━━━{Style.RESET_ALL}\n")
    
    plan_choice = input(f"  {Fore.CYAN}প্ল্যান (1=Basic, 2=Pro, 3=Enterprise): {Style.RESET_ALL}").strip()
    if plan_choice not in PLAN_MAP:
        print(f"\n  {Fore.RED}❌ ভুল প্ল্যান!{Style.RESET_ALL}")
        return
    
    plan_code, plan_name = PLAN_MAP[plan_choice]
    
    try:
        days = int(input(f"  {Fore.CYAN}মেয়াদ (দিন): {Style.RESET_ALL}").strip())
        count = int(input(f"  {Fore.CYAN}কয়টি কি? {Style.RESET_ALL}").strip())
    except ValueError:
        print(f"\n  {Fore.RED}❌ সংখ্যা দিন!{Style.RESET_ALL}")
        return
    
    if count > 50:
        print(f"\n  {Fore.RED}❌ একবারে সর্বোচ্চ ৫০টি!{Style.RESET_ALL}")
        return
    
    expiry_timestamp = int(time.time()) + (days * 86400)
    expiry_date = datetime.fromtimestamp(expiry_timestamp).strftime("%Y-%m-%d")
    
    print(f"\n  {Fore.GREEN}━━━ {count}টি {plan_name} কি ({days} দিন, মেয়াদ: {expiry_date}) ━━━{Style.RESET_ALL}\n")
    
    keys = []
    for i in range(count):
        key = encode_license_key(expiry_timestamp, plan_code)
        keys.append(key)
        print(f"  {Fore.WHITE}{i+1:3d}.{Style.RESET_ALL} {Fore.CYAN}{key}{Style.RESET_ALL}")
    
    # ফাইলে সেভ
    save = input(f"\n  {Fore.YELLOW}ফাইলে সেভ করবেন? (y/n): {Style.RESET_ALL}").strip().lower()
    if save == 'y':
        filename = f"license_keys_{plan_name}_{days}d_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = os.path.join(_BASE_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"# IVAC License Keys - {plan_name} Plan - {days} Days\n")
            f.write(f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Expiry: {expiry_date}\n")
            f.write(f"# Total: {count} keys\n")
            f.write("#" + "=" * 50 + "\n\n")
            for i, key in enumerate(keys, 1):
                f.write(f"{i}. {key}\n")
        print(f"\n  {Fore.GREEN}✅ সেভ হয়েছে: {filename}{Style.RESET_ALL}")
    
    print()


_BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    print_banner()
    
    while True:
        print(f"  {Fore.YELLOW}কী করতে চান?{Style.RESET_ALL}")
        print(f"    {Fore.WHITE}1.{Style.RESET_ALL} 🔑 নতুন লাইসেন্স কি তৈরি")
        print(f"    {Fore.WHITE}2.{Style.RESET_ALL} ✅ লাইসেন্স কি যাচাই")
        print(f"    {Fore.WHITE}3.{Style.RESET_ALL} 📦 একসাথে একাধিক কি তৈরি (ব্যাচ)")
        print(f"    {Fore.WHITE}0.{Style.RESET_ALL} ❌ বের হন")
        
        choice = input(f"\n  {Fore.CYAN}নির্বাচন করুন (0-3): {Style.RESET_ALL}").strip()
        
        if choice == '1':
            generate_key_interactive()
        elif choice == '2':
            verify_key_interactive()
        elif choice == '3':
            bulk_generate()
        elif choice == '0':
            print(f"\n  {Fore.GREEN}👋 ধন্যবাদ!{Style.RESET_ALL}\n")
            break
        else:
            print(f"\n  {Fore.RED}❌ ভুল নির্বাচন!{Style.RESET_ALL}\n")


if __name__ == "__main__":
    main()
