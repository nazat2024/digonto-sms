"""
IVAC Extension Installer
এই স্ক্রিপ্টটি আপনার ডেস্কটপের সব Chrome শর্টকাটে আমাদের এক্সটেনশনটি যুক্ত করে দেবে।
"""

import os
import subprocess
import time
from pathlib import Path

def main():
    print("="*60)
    print("🚀 IVAC Chrome Extension Installer")
    print("="*60)
    
    # Windows-এ Desktop পাথ বের করার সঠিক নিয়ম (OneDrive সাপোর্ট সহ)
    import ctypes.wintypes
    CSIDL_DESKTOP = 0
    buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
    ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOP, None, 0, buf)
    desktop_path = buf.value
    
    if not desktop_path or not os.path.exists(desktop_path):
        desktop_path = os.path.join(os.environ.get('USERPROFILE', ''), 'Desktop')
    ext_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chrome_extension')
    
    if not os.path.exists(ext_path):
        print(f"❌ Error: Extension folder not found at {ext_path}")
        time.sleep(5)
        return
        
    print(f"\nখুঁজছি: {desktop_path} ...")
    
    # PowerShell script to modify shortcuts
    ps_script = f"""
    $WshShell = New-Object -comObject WScript.Shell
    $extPath = "{ext_path}"
    $flag = "--load-extension=`"$extPath`""
    
    $shortcuts = Get-ChildItem -Path "{desktop_path}" -Filter "*.lnk"
    $count = 0
    
    foreach ($shortcut in $shortcuts) {{
        $link = $WshShell.CreateShortcut($shortcut.FullName)
        if ($link.TargetPath -match "chrome.exe") {{
            if ($link.Arguments -notmatch "--load-extension") {{
                $link.Arguments = $link.Arguments + " " + $flag
                $link.Save()
                Write-Host "✅ আপডেট করা হয়েছে: $($shortcut.Name)"
                $count++
            }} else {{
                Write-Host "⚠️ আগেই আপডেট করা আছে: $($shortcut.Name)"
            }}
        }}
    }}
    
    Write-Host "`nমোট $count টি শর্টকাট আপডেট করা হয়েছে!"
    """
    
    try:
        subprocess.run(["powershell", "-Command", ps_script], check=True)
    except Exception as e:
        print(f"\n❌ Error running installer: {e}")
        
    print("\n✅ কাজ শেষ! এবার ডেস্কটপ থেকে যেকোনো Chrome ওপেন করলেই এক্সটেনশনটি চালু হয়ে যাবে।")
    print("উইন্ডোটি বন্ধ করতে Enter চাপুন...")
    input()

if __name__ == "__main__":
    main()
