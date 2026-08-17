"""
Direct Chrome visual test - check if Chrome window appears on screen.
Opens Chrome, goes to Google, stays open 30 seconds.
"""
import os, time, sys

# Fix Unicode output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

print("=" * 50)
print("Chrome Visual Test Starting...")
print("=" * 50)

options = Options()

# Isolated profile directory
profile_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chrome_profiles", "test_visual")
os.makedirs(profile_dir, exist_ok=True)
options.add_argument(f"--user-data-dir={profile_dir}")

options.add_argument("--no-first-run")
options.add_argument("--no-default-browser-check")
options.add_argument("--start-maximized")
options.add_experimental_option("excludeSwitches", ["enable-automation"])

print("Launching Chrome...")
driver = webdriver.Chrome(options=options)

print("Chrome launched!")
print(f"   Title: {driver.title}")

# Navigate to Google
driver.get("https://www.google.com")
time.sleep(2)
print(f"   Google loaded: {driver.title}")

# ChromeDriver PID
chrome_pid = driver.service.process.pid
print(f"   ChromeDriver PID: {chrome_pid}")

# Use Windows API to find and bring Chrome window to front
if sys.platform == "win32":
    import ctypes
    import ctypes.wintypes
    user32 = ctypes.windll.user32

    found_windows = []
    def enum_cb(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value
                if "google" in title.lower() or "chrome" in title.lower():
                    found_windows.append((hwnd, title))
                    print(f"   Window found: hwnd={hwnd}, title='{title}'")
                    # Force to front
                    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                    user32.SetForegroundWindow(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)

    if not found_windows:
        print("   WARNING: No Chrome/Google window found!")
    else:
        print(f"   Found {len(found_windows)} Chrome window(s)!")

print()
print("Chrome will stay open for 30 seconds - CHECK YOUR SCREEN NOW!")
print("(If you don't see it, click the Chrome icon in your taskbar)")

time.sleep(30)

print()
print("Closing Chrome...")
driver.quit()
print("Test complete!")
