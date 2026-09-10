"""
🖥️ Digonto QuickFill — Desktop GUI Application
CustomTkinter দিয়ে তৈরি প্রফেশনাল Windows সফটওয়্যার।

এটিই সফটওয়্যারের মূল এন্ট্রি পয়েন্ট।
ব্যবহার: python gui_app.py
"""

import os
import sys
import json
import time
import threading
import webbrowser
from datetime import datetime

# Windows console UTF-8
if sys.platform == "win32":
    import ctypes
    try:
        myappid = 'ivacmasterpro.desktop.v4'
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
    except Exception:
        pass
        
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import customtkinter as ctk
from tkinter import messagebox, StringVar, BooleanVar

# IVAC modules
from license_system.license_manager import (
    check_license, activate_license, deactivate_license,
    LicenseStatus, LicenseInfo, get_masked_key
)
from license_system.hwid import generate_hwid, get_hwid_display
import chrome_profile_manager as cpm

# ===== App Constants =====
APP_NAME = "IVAC Master Pro"
APP_VERSION = "4.0.0"
APP_AUTHOR = "IVAC Master Pro"
UPDATE_URL = "https://digontoedu.com/api/update"

if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
import shutil
APP_DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
os.makedirs(APP_DATA_DIR, exist_ok=True)
CONFIG_FILE = os.path.join(APP_DATA_DIR, "config.json")
if not os.path.exists(CONFIG_FILE):
    default_config = os.path.join(BASE_DIR, "config.json")
    if os.path.exists(default_config):
        shutil.copy(default_config, CONFIG_FILE)
    else:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            f.write("{}")

# Theme
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


from gui_license import LicenseActivationWindow

class SmoothScrollableFrame(ctk.CTkScrollableFrame):
    """
    High-performance, zero-latency scrollable frame with responsive
    scroll velocity on Windows & macOS. No laggy timers.
    """
    def __init__(self, *args, scroll_speed=60, **kwargs):
        super().__init__(*args, **kwargs)
        self.scroll_speed = scroll_speed
        if sys.platform.startswith("win"):
            try:
                self._parent_canvas.configure(yscrollincrement=1)
            except Exception:
                pass

    def _mouse_wheel_all(self, event):
        if self._check_if_valid_scroll(event.widget):
            if sys.platform.startswith("win"):
                if self._shift_pressed:
                    if self._parent_canvas.xview() != (0.0, 1.0):
                        step = -int(event.delta / 6) or (-1 if event.delta > 0 else 1)
                        self._parent_canvas.xview("scroll", step, "units")
                else:
                    y_view = self._parent_canvas.yview()
                    if y_view[0] > 0.001 or y_view[1] < 0.999:
                        # 60 pixels per 120-delta notch = 1 full card height! Instant, responsive, 0ms lag!
                        step = -int(event.delta / 2) or (-1 if event.delta > 0 else 1)
                        if step < 0 and y_view[0] <= 0.0:
                            self._parent_canvas.yview_moveto(0)
                            return
                        if step > 0 and y_view[1] >= 1.0:
                            return
                        self._parent_canvas.yview("scroll", step, "units")
            elif sys.platform == "darwin":
                self._parent_canvas.yview("scroll", -event.delta, "units")
            else:
                super()._mouse_wheel_all(event)

    def ensure_mouse_wheel(self):
        """Ensures global mouse wheel and touchpad bindings are active."""
        try:
            self.bind_all("<Button-4>", self._mouse_wheel_all, add=True)
            self.bind_all("<Button-5>", self._mouse_wheel_all, add=True)
            self.bind_all("<MouseWheel>", self._mouse_wheel_all, add=True)
        except Exception:
            pass

class IVACApp(ctk.CTk):
    def _apply_crisp_icon(self):
        """Ultra-crisp high-DPI window & taskbar icon setup"""
        icon_path = os.path.join(BASE_DIR, 'digonto_icon.ico')
        png_path = os.path.join(BASE_DIR, 'logo App Light.png')
        
        # 1. Tkinter iconphoto (provides high-res image to Windows taskbar)
        try:
            from PIL import Image, ImageTk
            if os.path.exists(png_path):
                pil_img = Image.open(png_path)
                img_big = ImageTk.PhotoImage(pil_img.resize((64, 64), Image.Resampling.LANCZOS))
                img_small = ImageTk.PhotoImage(pil_img.resize((32, 32), Image.Resampling.LANCZOS))
                self.iconphoto(True, img_big, img_small)
                self._icon_photo_ref = (img_big, img_small)
        except Exception:
            pass

        # 2. Tkinter iconbitmap fallback
        if os.path.exists(icon_path):
            try:
                self.iconbitmap(icon_path)
            except Exception:
                pass

        # 3. Direct Win32 WM_SETICON with DPI-matched sizes
        try:
            import ctypes
            from ctypes import wintypes
            
            hwnd = self.winfo_id()
            parent_hwnd = ctypes.windll.user32.GetParent(hwnd)
            target_hwnd = parent_hwnd if parent_hwnd else hwnd

            WM_SETICON = 0x0080
            ICON_SMALL = 0
            ICON_BIG = 1
            IMAGE_ICON = 1
            LR_LOADFROMFILE = 0x00000010

            LoadImageW = ctypes.windll.user32.LoadImageW
            LoadImageW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR, wintypes.UINT, ctypes.c_int, ctypes.c_int, wintypes.UINT]
            LoadImageW.restype = wintypes.HANDLE

            SendMessageW = ctypes.windll.user32.SendMessageW
            SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
            SendMessageW.restype = wintypes.LPARAM

            GetSystemMetrics = ctypes.windll.user32.GetSystemMetrics
            cx_small = GetSystemMetrics(49)  # SM_CXSMICON
            cy_small = GetSystemMetrics(50)
            cx_big = GetSystemMetrics(11)    # SM_CXICON
            cy_big = GetSystemMetrics(12)

            h_big = LoadImageW(None, icon_path, IMAGE_ICON, cx_big, cy_big, LR_LOADFROMFILE)
            h_small = LoadImageW(None, icon_path, IMAGE_ICON, cx_small, cy_small, LR_LOADFROMFILE)

            if h_big:
                SendMessageW(target_hwnd, WM_SETICON, ICON_BIG, h_big)
                if parent_hwnd:
                    SendMessageW(hwnd, WM_SETICON, ICON_BIG, h_big)
            if h_small:
                SendMessageW(target_hwnd, WM_SETICON, ICON_SMALL, h_small)
                if parent_hwnd:
                    SendMessageW(hwnd, WM_SETICON, ICON_SMALL, h_small)
        except Exception:
            pass

    def run_in_background(self, task_fn, on_done_fn=None):
        """
        Executes task_fn on a background worker thread and safely delivers the result
        to on_done_fn on the Tkinter main thread with zero lockups or thread collision.
        """
        result_box = []
        err_box = []
        
        def _thread_worker():
            try:
                res = task_fn()
                result_box.append(res)
            except Exception as e:
                err_box.append(e)
                
        t = threading.Thread(target=_thread_worker, daemon=True)
        t.start()
        
        if on_done_fn:
            def _poll():
                if result_box:
                    try:
                        on_done_fn(result_box[0])
                    except Exception as ex:
                        print(f"Callback error: {ex}")
                elif err_box:
                    try:
                        on_done_fn({"success": False, "error": str(err_box[0])})
                    except Exception:
                        pass
                elif self.winfo_exists():
                    self.after(15, _poll)
                    
            self.after(15, _poll)

    """মূল অ্যাপ্লিকেশন উইন্ডো।"""
    
    def __init__(self):
        super().__init__()
        
        self.title(f"{APP_NAME} v{APP_VERSION}")
        self.geometry("700x580")
        self.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        self._apply_crisp_icon()
        self.after(100, self._apply_crisp_icon)
        self.after(500, self._apply_crisp_icon)
            
        # Center on screen
        self.update_idletasks()
        x = (self.winfo_screenwidth() - 700) // 2
        y = (self.winfo_screenheight() - 580) // 2
        self.geometry(f"700x580+{x}+{y}")
        
        # State
        self.license_info = None
        self.server_running = False
        self.server_thread = None
        self.config = self._load_config()
        self._last_config_version = os.path.getmtime(CONFIG_FILE) if os.path.exists(CONFIG_FILE) else 0
        self.otp_data = {}
        self._expanded_phones = set()
        
        # Instant UI Launch (< 50ms) - No slow loading screen!
        self.loading_label = None
        self._check_license_and_start()
        self.after(50, self._start_gui_mqtt_listener)
        self.after(300, self._cleanup_legacy_installation)

    def _cleanup_legacy_installation(self):
        """Removes leftover desktop shortcut and Start Menu folder from older 'Digonto QuickFill'."""
        try:
            for dt in [
                os.path.expandvars(r'%USERPROFILE%\Desktop'),
                os.path.expandvars(r'%PUBLIC%\Desktop')
            ]:
                old_lnk = os.path.join(dt, "Digonto QuickFill.lnk")
                if os.path.exists(old_lnk):
                    try:
                        os.remove(old_lnk)
                    except Exception:
                        pass

            for sm in [
                os.path.expandvars(r'%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs'),
                os.path.expandvars(r'%APPDATA%\Microsoft\Windows\Start Menu\Programs')
            ]:
                old_sm_dir = os.path.join(sm, "Digonto QuickFill")
                if os.path.exists(old_sm_dir):
                    try:
                        shutil.rmtree(old_sm_dir, ignore_errors=True)
                    except Exception:
                        pass
        except Exception:
            pass
    
    def _load_config(self):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
                
            # Data Migration for older rocket accounts
            accounts = self.config.get("rocket_accounts", [])
            for acc in accounts:
                if "rocket_extra" not in acc:
                    num = acc.get("number", "")
                    if len(num) == 12:
                        acc["number"] = num[:11]
                        acc["rocket_extra"] = num[11]
                    else:
                        acc["rocket_extra"] = ""
                    
                    old_pin = acc.get("pin", "")
                    acc["rocket_pin"] = old_pin
                    acc["bkash_pin"] = old_pin
                    acc["nagad_pin"] = old_pin
                    
                    if "pin" in acc:
                        del acc["pin"]
            if "chrome_bookmarks" not in self.config:
                self.config["chrome_bookmarks"] = []
            if "chrome_extension_path" not in self.config or "1.6_0" in str(self.config.get("chrome_extension_path", "")):
                self.config["chrome_extension_path"] = cpm.get_default_extension_path(BASE_DIR)
            return self.config
        except Exception:
            self.config = {
                "profiles": [], "sim_mapping": {}, "rocket_accounts": [],
                "chrome_bookmarks": [],
                "chrome_extension_path": cpm.get_default_extension_path(BASE_DIR)
            }
            return self.config
    
    def _save_config(self):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
            if os.path.exists(CONFIG_FILE):
                self._last_config_version = os.path.getmtime(CONFIG_FILE)
        except Exception:
            pass
    def _lockout_license(self, error_msg="আপনার লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!", status="blocked"):
        self._is_locked_out = True
        self._poller_running = False
        
        # Stop background server process
        if hasattr(self, 'server_process') and self.server_process:
            try:
                self.server_process.terminate()
            except Exception:
                pass
        self.server_running = False
        
        for w in self.winfo_children():
            try:
                w.destroy()
            except Exception:
                pass
                
        lock_frame = ctk.CTkFrame(self, fg_color="#0a192f")
        lock_frame.pack(fill="both", expand=True)

        is_new = (status == "not_activated" or "কোনো লাইসেন্স" in error_msg)
        is_expired = (status == "expired" or "মেয়াদ" in error_msg)
        is_dev_mismatch = (status == "invalid_device" or "অন্য ডিভাইসের" in error_msg or "অন্য কম্পিউটারে" in error_msg)
        
        if is_new:
            icon_char = "✨"
            title_text = "লাইসেন্স অ্যাক্টিভেশন (Activation)"
            title_color = "#38bdf8"
            subtitle_text = "IVAC Master Pro-এ আপনাকে স্বাগতম!"
            guide_text = "সফটওয়্যারটি চালু করতে আপনার ক্রয়কৃত লাইসেন্স কী (License Key) প্রদান করুন:"
            key_label_text = "আপনার লাইসেন্স কী (License Key):"
            btn_text = "🔑 লাইসেন্স অ্যাক্টিভেট করুন"
            show_unblock_btn = False
            initial_status = "লাইসেন্স কোড লিখে অ্যাক্টিভেট বাটনে ক্লিক করুন"
            initial_status_color = "#94a3b8"
        elif is_expired:
            icon_char = "⏰"
            title_text = "লাইসেন্সের মেয়াদ শেষ হয়ে গেছে!"
            title_color = "#f59e0b"
            subtitle_text = error_msg
            guide_text = "চালিয়ে যেতে আপনার লাইসেন্স রিনিউ করুন বা নতুন লাইসেন্স কী দিন:"
            key_label_text = "নতুন লাইসেন্স কী (License Key):"
            btn_text = "🔑 নতুন কী দিয়ে অ্যাক্টিভেট করুন"
            show_unblock_btn = False
            initial_status = "নতুন কোড দিয়ে অ্যাক্টিভেট করুন"
            initial_status_color = "#f59e0b"
        elif is_dev_mismatch:
            icon_char = "🔒"
            title_text = "ডিভাইস অমিল (Device Mismatch)!"
            title_color = "#f97316"
            subtitle_text = "এই লাইসেন্সটি অন্য কম্পিউটারে সক্রিয় রয়েছে!"
            guide_text = "এই কম্পিউটারে চালাতে এডমিনকে HWID রিসেট করতে বলুন, অথবা নতুন লাইসেন্স কী দিন:"
            key_label_text = "নতুন লাইসেন্স কী (License Key):"
            btn_text = "🔑 নতুন কী দিয়ে অ্যাক্টিভেট করুন"
            show_unblock_btn = True
            initial_status = "⏳ এডমিন HWID রিসেট করলে আনব্লক স্ট্যাটাস চেক করুন..."
            initial_status_color = "#f59e0b"
        else: # Blocked
            icon_char = "🚫"
            title_text = "লাইসেন্স সাময়িক নিষ্ক্রিয় / ব্লক করা হয়েছে!"
            title_color = "#ef4444"
            subtitle_text = error_msg
            guide_text = "এডমিন আনব্লক করামাত্রই সফটওয়্যারটি স্বয়ংক্রিয়ভাবে চালু হবে, অথবা নতুন লাইসেন্স কী দিন:"
            key_label_text = "নতুন লাইসেন্স কী (License Key):"
            btn_text = "🔑 অ্যাক্টিভেট করুন"
            show_unblock_btn = True
            initial_status = "⏳ এডমিন আনব্লক করার অপেক্ষায়..."
            initial_status_color = "#f59e0b"
        
        ctk.CTkLabel(lock_frame, text=icon_char, font=ctk.CTkFont(size=44)).pack(pady=(22, 4))
        ctk.CTkLabel(
            lock_frame, text=title_text,
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=title_color
        ).pack(pady=3)
        
        self.lock_msg_label = ctk.CTkLabel(
            lock_frame, text=subtitle_text,
            font=ctk.CTkFont(size=13),
            text_color="#cbd5e1"
        )
        self.lock_msg_label.pack(pady=4)
        
        ctk.CTkLabel(
            lock_frame, text=guide_text,
            font=ctk.CTkFont(size=11),
            text_color="#8892b0"
        ).pack(pady=(0, 10))
        
        # IN-WINDOW LICENSE ACTIVATION CARD
        card = ctk.CTkFrame(lock_frame, fg_color="#112240", corner_radius=10)
        card.pack(padx=25, pady=5, fill="x")
        
        ctk.CTkLabel(
            card, text=key_label_text,
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=20, pady=(12, 4))
        
        self.new_key_entry = ctk.CTkEntry(
            card,
            placeholder_text="IVAC-XXXX-XXXX-XXXX-XXXX",
            font=ctk.CTkFont(size=13, family="Consolas"),
            height=38,
            corner_radius=6
        )
        self.new_key_entry.pack(fill="x", padx=20, pady=4)
        
        btn_row = ctk.CTkFrame(card, fg_color="transparent")
        btn_row.pack(fill="x", padx=20, pady=(10, 8))
        
        self.activate_inline_btn = ctk.CTkButton(
            btn_row, text=btn_text,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#059669", hover_color="#047857",
            height=36,
            command=self._activate_new_key_inline
        )
        if show_unblock_btn:
            self.activate_inline_btn.pack(side="left", fill="x", expand=True, padx=(0, 5))
            self.recheck_unblock_btn = ctk.CTkButton(
                btn_row, text="🔄 আনব্লক স্ট্যাটাস চেক",
                font=ctk.CTkFont(size=12, weight="bold"),
                fg_color="#2563eb", hover_color="#1d4ed8",
                height=36,
                command=self._recheck_unblock_manually
            )
            self.recheck_unblock_btn.pack(side="right", fill="x", expand=True, padx=(5, 0))
        else:
            self.activate_inline_btn.pack(fill="x", expand=True)
            self.recheck_unblock_btn = None
        
        self.activate_status_label = ctk.CTkLabel(
            card, text=initial_status,
            font=ctk.CTkFont(size=11),
            text_color=initial_status_color
        )
        self.activate_status_label.pack(pady=(0, 10))
        
        # Device ID Display
        try:
            from license_system.hwid import generate_hwid
            hwid_str = generate_hwid()
            id_row = ctk.CTkFrame(lock_frame, fg_color="transparent")
            id_row.pack(pady=8)
            ctk.CTkLabel(
                id_row, text=f"📱 আপনার Device ID: {hwid_str[:20]}...",
                font=ctk.CTkFont(size=11, family="Consolas"),
                text_color="#64748b"
            ).pack(side="left", padx=5)
            
            ctk.CTkButton(
                id_row, text="📋 কপি", width=45, height=22,
                font=ctk.CTkFont(size=10), fg_color="#1e293b", hover_color="#334155",
                command=lambda: (self.clipboard_clear(), self.clipboard_append(hwid_str))
            ).pack(side="left")
        except Exception:
            pass
            
        # Exit Button
        ctk.CTkButton(
            lock_frame, text="❌ সফটওয়্যার বন্ধ করুন", font=ctk.CTkFont(size=11),
            fg_color="#334155", hover_color="#475569",
            command=self.destroy
        ).pack(pady=6)
        
        # Start Auto-Unblock Poller (Polls every 3 seconds to auto-restore when unblocked!)
        # Poller removed: 100% Zero Firebase reads! Handled via MQTT

    def _activate_new_key_inline(self):
        key = self.new_key_entry.get().strip()
        if not key:
            self.activate_status_label.configure(text="দয়া করে লাইসেন্স কী দিন!", text_color="#ef4444")
            return
        self.activate_inline_btn.configure(state="disabled", text="যাচাই হচ্ছে...")
        self.activate_status_label.configure(text="সার্ভারে লাইসেন্স চেক করা হচ্ছে...", text_color="#38bdf8")
        self.update()
        
        from license_system.license_manager import activate_license
        info = activate_license(key)
        self.activate_inline_btn.configure(state="normal", text="🔑 অ্যাক্টিভেট করুন")
        if info.is_valid:
            self.activate_status_label.configure(text="✅ লাইসেন্স সফলভাবে অ্যাক্টিভেট হয়েছে!", text_color="#10b981")
            self.after(400, lambda: self._restore_from_lockout(info))
        else:
            self.activate_status_label.configure(text=f"❌ {info.error_message or 'অ্যাক্টিভেশন ব্যর্থ'}", text_color="#ef4444")

    def _recheck_unblock_manually(self):
        # Prevent rapid spamming
        self.recheck_unblock_btn.configure(state="disabled")
        self.activate_status_label.configure(text="🔄 সার্ভার থেকে স্ট্যাটাস চেক করা হচ্ছে...", text_color="#38bdf8")
        self.update()
        
        from license_system.license_manager import check_license
        info = check_license(force_cloud=True)
        if info.is_valid:
            self.activate_status_label.configure(text="✅ লাইসেন্স আনব্লক শনাক্ত হয়েছে! চালু করা হচ্ছে...", text_color="#10b981")
            self.after(300, lambda: self._restore_from_lockout(info))
        else:
            self.activate_status_label.configure(text="❌ লাইসেন্স এখনও আনব্লক করা হয়নি! (১০ সেকেন্ড পর আবার চেষ্টা করুন)", text_color="#ef4444")
            self.after(10000, lambda: getattr(self, 'recheck_unblock_btn') and self.recheck_unblock_btn.configure(state="normal"))

    def _get_raw_saved_license_key(self):
        try:
            import os, json
            app_data = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
            lic_path = os.path.join(app_data, "license.dat")
            if os.path.exists(lic_path):
                from license_system.hwid import generate_hwid
                from license_system.crypto import decrypt_data
                with open(lic_path, 'r', encoding='utf-8') as f:
                    enc = f.read().strip()
                dec = decrypt_data(enc, extra_key=generate_hwid())
                return json.loads(dec).get("license_key", "")
        except Exception:
            pass
        return ""

    def _start_gui_mqtt_listener(self):
        """100% Zero Firebase Reads: Persistent MQTT kill-switch & instant unblock listener (50ms latency)"""
        try:
            import paho.mqtt.client as mqtt
            import time
            
            def on_connect(client, userdata, flags, rc):
                if rc == 0:
                    key = self._get_raw_saved_license_key()
                    if key:
                        client.subscribe(f"digonto_kill_{key}")
                    client.subscribe("digonto_license_event")
                    
            def on_message(client, userdata, msg):
                import json
                try:
                    payload = json.loads(msg.payload.decode('utf-8'))
                    action = payload.get("action")
                    target_key = payload.get("key")
                    my_key = self._get_raw_saved_license_key()
                    
                    if target_key and target_key == my_key:
                        if action == "block":
                            print(f"[GUI MQTT] Instant block received for {my_key}!")
                            from license_system.license_manager import mark_license_blocked_locally
                            mark_license_blocked_locally(my_key)
                            self.after(0, lambda: self._lockout_license("আপনার লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!"))
                        elif action == "unblock":
                            print(f"[GUI MQTT] Instant unblock received for {my_key} with ZERO Firebase reads!")
                            # Restore directly from MQTT payload - ZERO Firebase reads!
                            import os, time
                            from license_system.hwid import generate_hwid
                            from license_system.crypto import encrypt_data
                            from license_system.license_manager import LICENSE_FILE, LicenseInfo, LicenseStatus
                            
                            current_hwid = generate_hwid()
                            bound_at = payload.get("bound_at") or int(time.time() * 1000)
                            days = payload.get("duration_days", 30)
                            expiry_ms = bound_at + (days * 24 * 60 * 60 * 1000)
                            plan = payload.get("plan", "Standard")
                            
                            # Update local license.dat so subsequent starts are active
                            new_data = {
                                "license_key": my_key,
                                "hwid": current_hwid,
                                "status": "active",
                                "expiry_ms": expiry_ms,
                                "plan": plan
                            }
                            try:
                                enc = encrypt_data(json.dumps(new_data), extra_key=current_hwid)
                                with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
                                    f.write(enc)
                            except Exception:
                                pass
                                
                            info = LicenseInfo()
                            info.license_key = my_key
                            info.hwid = current_hwid
                            info.status = LicenseStatus.ACTIVE
                            info.plan = plan
                            diff_ms = max(0, expiry_ms - int(time.time() * 1000))
                            info.days_remaining = diff_ms // (1000 * 60 * 60 * 24)
                            
                            self.after(0, lambda: self._restore_from_lockout(info))
                except Exception as e:
                    pass
                    
            client = mqtt.Client(client_id=f"gui_app_{int(time.time()*1000)%100000}")
            client.on_connect = on_connect
            client.on_message = on_message
            client.connect_async("broker.emqx.io", 1883, 60)
            client.loop_start()
            self._gui_mqtt_client = client
        except Exception:
            pass

    def _restore_from_lockout(self, info):
        """Cleanly restore main dashboard when license is unblocked or activated"""
        self._is_locked_out = False
        self.license_info = info
        for w in self.winfo_children():
            try:
                w.destroy()
            except Exception:
                pass
        self._build_main_ui()
        self._start_server()

    def _check_license_and_start(self):
        info = check_license()
        self.license_info = info
        
        if getattr(self, 'loading_label', None) is not None:
            try:
                if self.loading_label.winfo_exists():
                    self.loading_label.destroy()
            except Exception:
                pass
        
        if not info.is_valid:
            self._lockout_license(info.error_message or "আপনার লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!", status=getattr(info, 'status', 'blocked'))
            return
            
        self._build_main_ui()
        self._start_server()

    def _on_license_activated(self, info):
        self.license_info = info
        self.deiconify()  # Main window দেখাও
        self._build_main_ui()
        self._start_server()
    
    def _build_main_ui(self):
        """মূল UI তৈরি।"""
        # Clear existing
        for widget in self.winfo_children():
            widget.destroy()
        
        # ===== TOP HEADER =====
        header = ctk.CTkFrame(self, fg_color="#0a192f", corner_radius=0, height=55)
        header.pack(fill="x")
        header.pack_propagate(False)
        
        header_inner = ctk.CTkFrame(header, fg_color="transparent")
        header_inner.pack(fill="both", expand=True, padx=15)
        
        # Custom App Logo in Header
        try:
            from PIL import Image
            logo_path = os.path.join(BASE_DIR, "logo App Light.png")
            if os.path.exists(logo_path):
                pil_logo = Image.open(logo_path)
                ctk_logo = ctk.CTkImage(light_image=pil_logo, dark_image=pil_logo, size=(28, 28))
                ctk.CTkLabel(header_inner, image=ctk_logo, text="").pack(side="left", padx=(0, 8), pady=10)
        except Exception:
            pass

        ctk.CTkLabel(
            header_inner,
            text=APP_NAME,
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#64ffda"
        ).pack(side="left", pady=10)
        
        # License badge
        badge_color = "#059669" if self.license_info.days_remaining > 7 else "#f59e0b"
        ctk.CTkLabel(
            header_inner,
            text=f"🔑 {self.license_info.plan} | {self.license_info.remaining_short}",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="white",
            fg_color=badge_color,
            corner_radius=12,
            padx=10, pady=2
        ).pack(side="right", pady=10)
        
        # ===== TABVIEW =====
        self.tabview = ctk.CTkTabview(
            self,
            corner_radius=8,
            segmented_button_fg_color="#1a1a2e",
            segmented_button_selected_color="#059669",
            segmented_button_unselected_color="#233554",
            command=self._on_tab_changed
        )
        self.tabview.pack(fill="both", expand=True, padx=10, pady=(5, 0))
        
        # Create tabs
        self.tab_home = self.tabview.add("🏠 Home")
        self.tab_otps = self.tabview.add("📨 Recent OTPs")
        self.tab_extension = self.tabview.add("🔌 Extension")
        self.tab_profiles = self.tabview.add("👥 Profiles")
        self.tab_payment = self.tabview.add("💳 Payment")
        self.tab_settings = self.tab_payment
        self.tab_license = self.tabview.add("🔑 License")
        
        # Permanently grid and map all tabs in OS memory (prevents unmap/remap lag and zero blank screen)
        for name, tab in self.tabview._tab_dict.items():
            tab.grid(
                row=3, column=0, sticky="nsew",
                padx=self.tabview._apply_widget_scaling(max(self.tabview._corner_radius, self.tabview._border_width)),
                pady=self.tabview._apply_widget_scaling(max(self.tabview._corner_radius, self.tabview._border_width))
            )
            
        # 0ms Instant Tab Switcher via hardware Z-stacking (tkraise)
        def _raise_tab(name: str):
            if name in self.tabview._tab_dict:
                self.tabview._current_name = name
                self.tabview._segmented_button.set(name)
                self.tabview._tab_dict[name].tkraise()
                self._on_tab_changed()
            else:
                raise ValueError(f"CTkTabview has no tab named '{name}'")

        self.tabview._segmented_button.configure(command=_raise_tab)
        self.tabview._segmented_button_callback = _raise_tab
        self.tabview.set = _raise_tab
        self.tabview._grid_forget_all_tabs = lambda *args, **kwargs: None
        self.tabview._set_grid_current_tab = lambda *args, **kwargs: None
        
        # Auto sync hidden extension directory asynchronously (0ms UI impact)
        def _sync_ext():
            try:
                cpm.get_safe_extension_dir(BASE_DIR)
            except Exception as e:
                print(f"Extension startup sync error: {e}")
        threading.Thread(target=_sync_ext, daemon=True).start()

        # ===== FOOTER =====
        footer = ctk.CTkFrame(self, fg_color="#0a192f", corner_radius=0, height=30)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        
        self.footer_label = ctk.CTkLabel(
            footer,
            text="🟢 Server Ready  |  v" + APP_VERSION + "  |  © " + APP_AUTHOR,
            font=ctk.CTkFont(size=10),
            text_color="#495670"
        )
        self.footer_label.pack(pady=5)

        # Pre-build Home and Profiles immediately: BOTH are 100% pre-rendered and ready at launch!
        self._loaded_tabs = {"🏠 Home", "👥 Profiles"}
        self._build_home_tab()
        self._build_profiles_tab()
        self.tabview._tab_dict["🏠 Home"].tkraise()

        # Background idle pre-warming: pre-renders secondary tabs silently so clicks are 0ms instant!
        self.after(20, lambda: self._prewarm_tab("🔌 Extension"))
        self.after(50, lambda: self._prewarm_tab("📨 Recent OTPs"))
        self.after(80, lambda: self._prewarm_tab("💳 Payment"))
        self.after(110, lambda: self._prewarm_tab("🔑 License"))

    def _prewarm_tab(self, tab_name: str):
        if not hasattr(self, '_loaded_tabs'):
            self._loaded_tabs = set()
        if tab_name in self._loaded_tabs:
            return
        self._loaded_tabs.add(tab_name)
        try:
            if tab_name == "👥 Profiles":
                self._build_profiles_tab()
            elif tab_name == "📨 Recent OTPs":
                self._build_otps_tab()
            elif tab_name in ("💳 Payment", "⚙️ Settings"):
                self._build_settings_tab()
            elif tab_name == "🔌 Extension":
                self._build_extension_tab()
            elif tab_name == "🔑 License":
                self._build_license_tab()
        except Exception as e:
            print(f"Prewarm tab {tab_name} error: {e}")

    def _on_tab_changed(self):
        selected = self.tabview.get()
        if not hasattr(self, '_loaded_tabs'):
            self._loaded_tabs = set()
            
        if selected not in self._loaded_tabs:
            self._prewarm_tab(selected)
            self.update_idletasks()
        elif selected == "👥 Profiles":
            if getattr(self, "_profiles_tab_dirty", False):
                self._profiles_tab_dirty = False
                if hasattr(self, "_refresh_profiles_tab"):
                    self._refresh_profiles_tab()
        elif selected == "🔌 Extension":
            if getattr(self, "_ext_profiles_dirty", False):
                self._ext_profiles_dirty = False
                if hasattr(self, "_refresh_extension_profiles_list"):
                    self._refresh_extension_profiles_list()

    def select_tab(self, name: str):
        self.tabview.set(name)

    # ===== HOME TAB =====
    def _build_home_tab(self):
        tab = self.tab_home
        for w in tab.winfo_children():
            w.destroy()
        
        # Cloud SMS Sync
        cloud_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        cloud_card.pack(fill="x", padx=5, pady=(5, 5))
        
        ctk.CTkLabel(
            cloud_card, text="☁️ Cloud SMS Forwarder",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00d2ff"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        from license_system.hwid import get_pairing_code
        pairing_code = get_pairing_code()
        
        ctk.CTkLabel(
            cloud_card, 
            text=f"আপনার মোবাইলে 'SMS Forwarder' অ্যাপটি ওপেন করে নিচের কোডটি দিন:\nযেকোনো নেটওয়ার্ক থেকে অটোমেটিক মেসেজ আসবে।",
            font=ctk.CTkFont(size=12), text_color="#8892b0", justify="left"
        ).pack(anchor="w", padx=15, pady=(0, 5))
        
        code_frame = ctk.CTkFrame(cloud_card, fg_color="#0a192f", corner_radius=5)
        code_frame.pack(anchor="w", padx=15, pady=(5, 15))
        
        ctk.CTkLabel(
            code_frame, text=f"Pairing Code: {pairing_code}",
            font=ctk.CTkFont(family="Consolas", size=18, weight="bold"),
            text_color="#64ffda"
        ).pack(padx=15, pady=10)
        
        # Connected Devices Card (Expanded with full height)
        device_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        device_card.pack(fill="both", expand=True, padx=5, pady=(0, 5))
        
        device_header = ctk.CTkFrame(device_card, fg_color="transparent")
        device_header.pack(fill="x", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            device_header, text="📱 Connected Mobiles",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(side="left")
        
        self.device_list_frame = SmoothScrollableFrame(device_card, fg_color="transparent", scroll_speed=60)
        self.device_list_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self._device_rows = {}
        self._has_device_placeholder = True
        
        self.device_placeholder = ctk.CTkLabel(
            self.device_list_frame,
            text="⏳ Waiting for mobile connection...",
            font=ctk.CTkFont(size=11),
            text_color="#495670"
        )
        self.device_placeholder.pack(pady=20)
        
        # Start ultra-fast background poller (decoupled from GUI thread)
        self._start_background_poller()

    # ===== RECENT OTPS TAB =====
    def _build_otps_tab(self):
        tab = self.tab_otps
        for w in tab.winfo_children():
            w.destroy()
        
        # Recent OTPs Card
        otp_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        otp_card.pack(fill="both", expand=True, padx=5, pady=5)
        
        otp_header = ctk.CTkFrame(otp_card, fg_color="transparent")
        otp_header.pack(fill="x", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            otp_header, text="📨 Recent OTPs",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(side="left")
        
        # Reset Button for GUI
        ctk.CTkButton(
            otp_header, text="🗑️ Reset Data", width=80, height=24,
            font=ctk.CTkFont(size=11, weight="bold"), fg_color="#e11d48", hover_color="#be123c",
            command=self._clear_all_data
        ).pack(side="left", padx=15)
        
        self.otp_count_label = ctk.CTkLabel(
            otp_header, text="0 টি",
            font=ctk.CTkFont(size=11),
            text_color="#8892b0"
        )
        self.otp_count_label.pack(side="right", padx=10)
        
        # OTP Scrollable list
        self.otp_list_frame = SmoothScrollableFrame(
            otp_card, fg_color="transparent", corner_radius=5, scroll_speed=60
        )
        self.otp_list_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        
        self.otp_placeholder = ctk.CTkLabel(
            self.otp_list_frame,
            text="⏳ কোনো OTP আসেনি...\nSMS Forwarder অ্যাপটি ওপেন করে SMS পাঠাতে দিন",
            font=ctk.CTkFont(size=12),
            text_color="#495670",
            justify="center"
        )
        self.otp_placeholder.pack(pady=40)
        
    def _refresh_ip(self):
        self.server_info_label.configure(text=f"Port: 5000  |  SMS Endpoint: POST http://{get_local_ip()}:5000/api/sms")
        
    def _copy_ip(self):
        ip = get_local_ip()
        url = f"http://{ip}:5000/api/sms"
        self.clipboard_clear()
        self.clipboard_append(url)
        from tkinter import messagebox
        messagebox.showinfo("Copied", f"Endpoint URL copied to clipboard:\n{url}")

    def _copy_payload(self):
        self.clipboard_clear()
        self.clipboard_append(self.payload_text)
        from tkinter import messagebox
        messagebox.showinfo("Copied", "JSON Payload copied to clipboard!")

    def _clear_all_data(self):
        from tkinter import messagebox
        import requests, threading
        if messagebox.askyesno("Clear All", "আপনি কি নিশ্চিত যে সব OTP মুছে ফেলতে চান?"):
            def clear_task():
                try:
                    requests.post("http://127.0.0.1:5000/api/clear", timeout=2)
                    self._last_otp_state_key = None
                except Exception:
                    pass
            threading.Thread(target=clear_task, daemon=True).start()

    def _start_background_poller(self):
        """Dedicated background daemon thread to fetch status without blocking GUI"""
        if getattr(self, '_poller_running', False):
            return
        self._poller_running = True
        
        def poller_loop():
            import requests, time
            session = requests.Session()
            while getattr(self, '_poller_running', True):
                try:
                    resp = session.get("http://127.0.0.1:5000/api/status", timeout=1)
                    if resp.ok:
                        data = resp.json()
                        self.after(0, lambda d=data: self._apply_status_update(d))
                    else:
                        self.after(0, lambda: self.server_status_label.configure(text="⚠️ Error", text_color="#ff6b6b"))
                except Exception:
                    pass
                time.sleep(0.5)
                
        threading.Thread(target=poller_loop, daemon=True).start()

    def _refresh_otps(self):
        """Compatibility trigger to invalidate OTP cache"""
        self._last_otp_state_key = None

    def _apply_status_update(self, data):
        """Apply status update on the Tkinter main thread with ZERO destruction and ZERO lag"""
        try:
            # REAL-TIME INSTANT KILL SWITCH: If server indicates license blocked/invalid, lock immediately!
            if data.get("licensed") is False:
                self._lockout_license("আপনার লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!")
                return
            otps = data.get("otps", [])
            devices = data.get("devices", [])
            
            # 1. INCREMENTAL DEVICE UPDATE (ZERO DESTROY LAG FOR 20-30 MOBILES)
            if not hasattr(self, '_device_rows'):
                self._device_rows = {}
                
            current_dev_ids = set()
            
            if not devices:
                if not getattr(self, '_has_device_placeholder', False):
                    for w in self.device_list_frame.winfo_children():
                        w.destroy()
                    self._device_rows.clear()
                    self.device_placeholder = ctk.CTkLabel(
                        self.device_list_frame,
                        text="⏳ Waiting for mobile connection...",
                        font=ctk.CTkFont(size=11),
                        text_color="#495670"
                    )
                    self.device_placeholder.pack(pady=5)
                    self._has_device_placeholder = True
            else:
                if hasattr(self, 'device_placeholder') and self.device_placeholder:
                    try:
                        self.device_placeholder.destroy()
                        self.device_placeholder = None
                    except:
                        pass
                self._has_device_placeholder = False
                    
                for dev in devices:
                    dev_id = dev.get("device_id")
                    if not dev_id:
                        continue
                    current_dev_ids.add(dev_id)
                    
                    is_online = dev.get("online", False)
                    dev_name = dev.get("custom_name", dev.get("device_name", "Device"))
                    is_active = dev.get("is_active", True)
                    sims = []
                    if dev.get("sim1_name"): sims.append(dev["sim1_name"])
                    if dev.get("sim2_name"): sims.append(dev["sim2_name"])
                    sim_text = " | ".join(sims) if sims else "No SIM set"
                    
                    status_icon = "🟢" if is_online else "⚪"
                    color = "#059669" if is_online else "#495670"
                    display_text = f"  {status_icon}  {dev_name}"
                    
                    if dev_id in self._device_rows:
                        entry = self._device_rows[dev_id]
                        # Only update if changed - ZERO canvas redraw if unchanged!
                        if entry.get("display_text") != display_text or entry.get("color") != color:
                            entry["name_label"].configure(text=display_text, text_color=color)
                            entry["display_text"] = display_text
                            entry["color"] = color
                        if entry.get("sim_text") != sim_text:
                            entry["sim_label"].configure(text=f"SIMs: {sim_text}  ")
                            entry["sim_text"] = sim_text
                        if entry.get("is_active") != is_active:
                            if is_active: entry["switch"].select()
                            else: entry["switch"].deselect()
                            entry["is_active"] = is_active
                        entry["dev_name"] = dev_name
                    else:
                        # First time seeing this device: create row once
                        self._add_device_row_incremental(dev, dev_id, display_text, color, sim_text, is_active, dev_name)
                        
                # Clean up removed devices
                for old_id in list(self._device_rows.keys()):
                    if old_id not in current_dev_ids:
                        row_data = self._device_rows.pop(old_id, {})
                        if "row" in row_data and row_data["row"]:
                            try:
                                row_data["row"].destroy()
                            except:
                                pass
                            
            # 2. OTP UPDATE (Only update GUI if OTP tab has been loaded)
            if hasattr(self, 'otp_list_frame') and self.otp_list_frame.winfo_exists():
                expanded_tuple = tuple(sorted(getattr(self, '_expanded_phones', set())))
                import json
                otps_snapshot = json.dumps(otps, sort_keys=True)
                current_otp_state_key = (otps_snapshot, expanded_tuple)
                
                if current_otp_state_key != getattr(self, '_last_otp_state_key', None):
                    self._last_otp_state_key = current_otp_state_key
                    self._current_otps_cache = otps
                    
                    for widget in self.otp_list_frame.winfo_children():
                        widget.destroy()
                    
                    if otps:
                        if hasattr(self, 'otp_count_label') and self.otp_count_label.winfo_exists():
                            self.otp_count_label.configure(text=f"{len(otps)} টি")
                        for otp in otps:
                            self._add_otp_row(otp)
                    else:
                        if hasattr(self, 'otp_count_label') and self.otp_count_label.winfo_exists():
                            self.otp_count_label.configure(text="0 টি")
                        self.otp_placeholder = ctk.CTkLabel(
                            self.otp_list_frame,
                            text="⏳ কোনো OTP আসেনি...\nSMS Forwarder অ্যাপটি ওপেন করে SMS পাঠাতে দিন",
                            font=ctk.CTkFont(size=12),
                            text_color="#495670",
                            justify="center"
                        )
                        self.otp_placeholder.pack(pady=30)
            
            if hasattr(self, 'server_status_label') and self.server_status_label.winfo_exists():
                self.server_status_label.configure(text="🟢 Running", text_color="#64ffda")
            
            # 3. Check for real-time config updates
            try:
                server_cfg_version = data.get("config_version", 0)
                if server_cfg_version and server_cfg_version != getattr(self, '_last_config_version', 0):
                    self._last_config_version = server_cfg_version
                    old_profiles = list(self.config.get("profiles", []))
                    self._load_config()
                    new_profiles = self.config.get("profiles", [])
                    if old_profiles != new_profiles:
                        if hasattr(self, 'tabview') and self.tabview.get() == "👥 Profiles":
                            if hasattr(self, '_refresh_profiles_tab'):
                                self._refresh_profiles_tab()
                        else:
                            self._profiles_tab_dirty = True
                    if hasattr(self, 'tabview') and self.tabview.get() in ("💳 Payment", "⚙️ Settings"):
                        if hasattr(self, '_refresh_rocket_list'):
                            self._refresh_rocket_list()
            except Exception as ce:
                print(f"Config sync error: {ce}")
        except Exception:
            pass

    def _add_otp_row(self, otp_data):
        phone = (otp_data.get("phone") or "Unknown").strip() or "Unknown"
        display = otp_data.get("display", "?")
        used = otp_data.get("used", False)
        otp_str = otp_data.get("otp_string", "")
        history = otp_data.get("history", [])
        timestamp = otp_data.get("timestamp", "")
        
        if not hasattr(self, '_expanded_phones'):
            self._expanded_phones = set()
            
        is_expanded = phone in self._expanded_phones
        has_history = len(history) > 0
        
        # Outer group container
        group_container = ctk.CTkFrame(self.otp_list_frame, fg_color="transparent")
        group_container.pack(fill="x", pady=2)
        
        # Main latest row
        main_row = ctk.CTkFrame(group_container, fg_color="#1a1a2e", corner_radius=6, height=44)
        main_row.pack(fill="x")
        main_row.pack_propagate(False)
        
        status_text = "Used" if used else "Unused"
        status_color = "#64748b" if used else "#10b981"
        icon = "🔒" if used else "⚡"
        
        # Left frame
        left_frame = ctk.CTkFrame(main_row, fg_color="transparent")
        left_frame.pack(side="left", padx=8)
        
        def toggle_dropdown(p=phone):
            if p in self._expanded_phones:
                self._expanded_phones.remove(p)
            else:
                self._expanded_phones.add(p)
            self._last_otp_state_key = None
            self._refresh_otps()

        if has_history:
            arrow_icon = "▲" if is_expanded else "▼"
            hist_count = len(history)
            toggle_btn = ctk.CTkButton(
                left_frame, text=f"{arrow_icon} ({hist_count})", width=48, height=22,
                font=ctk.CTkFont(size=10, weight="bold"),
                fg_color="#2563eb" if is_expanded else "#0f172a",
                hover_color="#1d4ed8" if is_expanded else "#1e293b",
                command=toggle_dropdown
            )
            toggle_btn.pack(side="left", padx=(0, 6))
        else:
            ctk.CTkLabel(
                left_frame, text="  ",
                font=ctk.CTkFont(size=10)
            ).pack(side="left", padx=(0, 4))
        
        ctk.CTkLabel(
            left_frame, text=f"{icon}  📱 {phone}",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        ).pack(side="left")
        
        ctk.CTkLabel(
            left_frame, text=f" [{status_text}]",
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color=status_color
        ).pack(side="left", padx=(4, 0))
        
        if timestamp:
            ctk.CTkLabel(
                left_frame, text=f" • {timestamp}",
                font=ctk.CTkFont(size=9),
                text_color="#64748b"
            ).pack(side="left", padx=(4, 0))
        
        # Right frame
        right_frame = ctk.CTkFrame(main_row, fg_color="transparent")
        right_frame.pack(side="right", padx=8)
        
        copy_btn = ctk.CTkButton(
            right_frame, text="📋 Copy", width=62, height=26,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#334155", hover_color="#475569"
        )
        
        def do_copy(text_to_copy=otp_str, btn=copy_btn):
            self.clipboard_clear()
            self.clipboard_append(text_to_copy)
            btn.configure(text="✓ Copied", fg_color="#059669")
            self.after(1200, lambda: btn.configure(text="📋 Copy", fg_color="#334155"))
            
        copy_btn.configure(command=do_copy)
        copy_btn.pack(side="right", padx=(6, 0))
        
        color = "#64ffda" if not used else "#94a3b8"
        ctk.CTkLabel(
            right_frame, text=f" {display} ",
            font=ctk.CTkFont(size=13, weight="bold", family="Consolas"),
            text_color=color
        ).pack(side="right")
        
        # Expandable History Box
        if has_history and is_expanded:
            hist_box = ctk.CTkFrame(group_container, fg_color="#0b1329", corner_radius=6, border_width=1, border_color="#1e293b")
            hist_box.pack(fill="x", padx=12, pady=(2, 4))
            
            hdr = ctk.CTkFrame(hist_box, fg_color="transparent")
            hdr.pack(fill="x", padx=10, pady=(6, 2))
            ctk.CTkLabel(
                hdr, text=f"📜 এই নম্বরের পূর্বের SMS / OTP ইতিহাস ({len(history)} টি):",
                font=ctk.CTkFont(size=10, weight="bold"),
                text_color="#94a3b8"
            ).pack(side="left")
            
            for item in history:
                h_row = ctk.CTkFrame(hist_box, fg_color="#111c38", corner_radius=4, height=32)
                h_row.pack(fill="x", padx=8, pady=2)
                h_row.pack_propagate(False)
                
                h_disp = item.get("display", "?")
                h_used = item.get("used", True)
                h_time = item.get("timestamp", "")
                h_otp_str = item.get("otp_string", "")
                h_raw = item.get("raw_sms", "")
                h_status = "Used" if h_used else "Unused"
                h_color = "#64748b" if h_used else "#10b981"
                
                h_left = ctk.CTkFrame(h_row, fg_color="transparent")
                h_left.pack(side="left", padx=8)
                
                ctk.CTkLabel(
                    h_left, text=f"⏱️ {h_time}",
                    font=ctk.CTkFont(size=10),
                    text_color="#64748b"
                ).pack(side="left")
                
                ctk.CTkLabel(
                    h_left, text=f" [{h_status}]",
                    font=ctk.CTkFont(size=9, weight="bold"),
                    text_color=h_color
                ).pack(side="left", padx=4)
                
                if h_raw:
                    snippet = h_raw[:35] + ("..." if len(h_raw) > 35 else "")
                    ctk.CTkLabel(
                        h_left, text=f'"{snippet}"',
                        font=ctk.CTkFont(size=9),
                        text_color="#475569"
                    ).pack(side="left", padx=6)
                
                h_right = ctk.CTkFrame(h_row, fg_color="transparent")
                h_right.pack(side="right", padx=8)
                
                h_copy_btn = ctk.CTkButton(
                    h_right, text="📋 Copy", width=52, height=22,
                    font=ctk.CTkFont(size=9, weight="bold"),
                    fg_color="#1e293b", hover_color="#334155"
                )
                
                def make_copy_handler(s=h_otp_str, b=h_copy_btn):
                    return lambda: do_copy(s, b)
                    
                h_copy_btn.configure(command=make_copy_handler())
                h_copy_btn.pack(side="right", padx=(4, 0))
                
                ctk.CTkLabel(
                    h_right, text=f" {h_disp} ",
                    font=ctk.CTkFont(size=11, weight="bold", family="Consolas"),
                    text_color="#94a3b8" if h_used else "#64ffda"
                ).pack(side="right")

    def _toggle_device_status(self, dev_id, is_active):
        import requests, threading
        def toggle_task():
            try:
                requests.post("http://127.0.0.1:5000/api/device/update", json={"device_id": dev_id, "is_active": is_active}, timeout=1)
            except Exception:
                pass
        threading.Thread(target=toggle_task, daemon=True).start()

    def _rename_device(self, dev_id):
        from tkinter import simpledialog
        import requests, threading
        
        current = "Device"
        if hasattr(self, '_device_rows') and dev_id in self._device_rows:
            current = self._device_rows[dev_id].get("dev_name", "Device")
            
        new_name = simpledialog.askstring("Rename Device", "Enter new name for mobile:", initialvalue=current)
        if new_name:
            def update_task():
                try:
                    requests.post("http://127.0.0.1:5000/api/device/update", json={"device_id": dev_id, "custom_name": new_name}, timeout=1)
                except Exception:
                    pass
            threading.Thread(target=update_task, daemon=True).start()

    def _add_device_row_incremental(self, dev_data, dev_id, display_text, color, sim_text, is_active, dev_name):
        row = ctk.CTkFrame(self.device_list_frame, fg_color="#1a1a2e", corner_radius=6, height=30)
        row.pack(fill="x", pady=2)
        row.pack_propagate(False)
        
        name_label = ctk.CTkLabel(
            row, text=display_text,
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=color
        )
        name_label.pack(side="left", padx=5)
        
        switch = ctk.CTkSwitch(
            row, text="", width=40,
            command=lambda: self._toggle_device_status(dev_id, switch.get())
        )
        if is_active: switch.select()
        else: switch.deselect()
        switch.pack(side="right", padx=(5, 10))
        
        ctk.CTkButton(
            row, text="✏️ Edit Name", width=50, height=22,
            font=ctk.CTkFont(size=10), fg_color="#233554", hover_color="#2a4365",
            command=lambda: self._rename_device(dev_id)
        ).pack(side="right", padx=5)
        
        sim_label = ctk.CTkLabel(
            row, text=f"SIMs: {sim_text}  ",
            font=ctk.CTkFont(size=10),
            text_color="#8892b0"
        )
        sim_label.pack(side="right", padx=10)
        
        self._device_rows[dev_id] = {
            "row": row,
            "name_label": name_label,
            "switch": switch,
            "sim_label": sim_label,
            "display_text": display_text,
            "color": color,
            "sim_text": sim_text,
            "is_active": is_active,
            "dev_name": dev_name
        }

    def _add_device_row(self, dev_data):
        dev_id = dev_data.get('device_id')
        dev_name = dev_data.get('custom_name', dev_data.get('device_name', 'Device'))
        is_active = dev_data.get('is_active', True)
        is_online = dev_data.get("online", False)
        status_icon = "🟢" if is_online else "⚪"
        color = "#059669" if is_online else "#495670"
        sims = []
        if dev_data.get("sim1_name"): sims.append(dev_data["sim1_name"])
        if dev_data.get("sim2_name"): sims.append(dev_data["sim2_name"])
        sim_text = " | ".join(sims) if sims else "No SIM set"
        display_text = f"  {status_icon}  {dev_name}"
        self._add_device_row_incremental(dev_data, dev_id, display_text, color, sim_text, is_active, dev_name)

    
    # ===== PROFILES TAB =====
    def _build_profiles_tab(self):
        import tkinter as tk
        tab = self.tab_profiles
        for w in tab.winfo_children():
            w.destroy()
        
        # Header Container
        header_container = tk.Frame(tab, bg="#0a192f")
        header_container.pack(fill="x", padx=10, pady=(6, 4))
        
        # Left: Title & Count Badge
        title_frame = tk.Frame(header_container, bg="#0a192f")
        title_frame.pack(side="left")
        
        tk.Label(
            title_frame, text="🧩 Chrome Profiles",
            font=("Segoe UI", 13, "bold"),
            fg="#64ffda", bg="#0a192f"
        ).pack(side="left")
        
        self.lbl_profile_count = tk.Label(
            title_frame, text="0 টি প্রোফাইল",
            font=("Segoe UI", 9, "bold"),
            fg="#38bdf8", bg="#1e293b",
            padx=8, pady=2
        )
        self.lbl_profile_count.pack(side="left", padx=10)
        
        # Right: Action Buttons
        btn_box = tk.Frame(header_container, bg="#0a192f")
        btn_box.pack(side="right")
        
        def _make_hdr_btn(parent, text, bg, hover, cmd):
            btn = tk.Label(
                parent, text=text,
                font=("Segoe UI", 9, "bold"),
                bg=bg, fg="white",
                padx=12, pady=5,
                cursor="hand2", relief="flat"
            )
            btn.pack(side="left", padx=3)
            btn.bind("<Enter>", lambda e: btn.configure(bg=hover))
            btn.bind("<Leave>", lambda e: btn.configure(bg=bg))
            btn.bind("<Button-1>", lambda e: cmd())
            return btn
            
        _make_hdr_btn(btn_box, "🔄 রিলোড", "#334155", "#475569", self._refresh_profiles_tab)
        _make_hdr_btn(btn_box, "➕ নতুন প্রোফাইল", "#2563eb", "#1d4ed8", self._open_add_profile_dialog)
        _make_hdr_btn(btn_box, "🚀 সব ওপেন করুন", "#059669", "#047857", self._launch_all_profiles)
        
        # Sub Bar: Search Bar + Select All
        sub_bar = tk.Frame(tab, bg="#0a192f")
        sub_bar.pack(fill="x", padx=10, pady=(2, 6))
        
        search_wrap = tk.Frame(sub_bar, bg="#112240", highlightbackground="#233554", highlightthickness=1)
        search_wrap.pack(side="left", fill="x", expand=True, padx=(0, 10))
        
        tk.Label(search_wrap, text="🔍", font=("Segoe UI", 10), fg="#8892b0", bg="#112240").pack(side="left", padx=(8, 4))
        
        self.search_entry = tk.Entry(
            search_wrap,
            font=("Segoe UI", 10),
            bg="#112240", fg="#f8fafc",
            insertbackground="#64ffda",
            relief="flat", bd=0
        )
        self.search_entry.pack(side="left", fill="x", expand=True, ipady=6, padx=(0, 8))
        self.search_entry.bind("<KeyRelease>", lambda *_: self._filter_profiles_search())
        
        self._all_selected_state = True
        self.btn_select_all = tk.Label(
            sub_bar,
            text="☑️ সব আনসিলেক্ট",
            font=("Segoe UI", 9, "bold"),
            bg="#1e293b", fg="#ffffff",
            padx=14, pady=5,
            cursor="hand2", relief="flat"
        )
        self.btn_select_all.pack(side="right")
        self.btn_select_all.bind("<Enter>", lambda e: self.btn_select_all.configure(bg="#334155"))
        self.btn_select_all.bind("<Leave>", lambda e: self.btn_select_all.configure(bg="#1e293b"))
        self.btn_select_all.bind("<Button-1>", lambda e: self._toggle_select_all_profiles())
        
        # Native High-Speed Scroll Container for Profiles Tab (Zero-lag, perfectly mapped)
        scroll_wrap = tk.Frame(tab, bg="#0a192f", highlightbackground="#233554", highlightthickness=1)
        scroll_wrap.pack(fill="both", expand=True, padx=10, pady=(0, 8))
        
        self._profiles_canvas = tk.Canvas(scroll_wrap, bg="#0a192f", highlightthickness=0)
        self._profiles_scrollbar = tk.Scrollbar(scroll_wrap, orient="vertical", command=self._profiles_canvas.yview)
        self._profiles_canvas.configure(yscrollcommand=self._profiles_scrollbar.set)
        
        self._profiles_scrollbar.pack(side="right", fill="y")
        self._profiles_canvas.pack(side="left", fill="both", expand=True)
        
        self._profiles_container = tk.Frame(self._profiles_canvas, bg="#0a192f")
        self._profiles_canvas_win = self._profiles_canvas.create_window((0, 0), window=self._profiles_container, anchor="nw")
        
        def _on_profiles_configure(event=None):
            if not hasattr(self, "_profiles_canvas") or not self._profiles_canvas.winfo_exists():
                return
            bbox = self._profiles_canvas.bbox("all")
            if not bbox:
                return
            content_h = bbox[3] - bbox[1]
            canvas_h = self._profiles_canvas.winfo_height()
            eff_h = max(content_h, canvas_h)
            self._profiles_canvas.configure(scrollregion=(0, 0, bbox[2], eff_h))
            if hasattr(self, "_profiles_canvas_win"):
                canvas_w = self._profiles_canvas.winfo_width()
                if canvas_w > 1:
                    self._profiles_canvas.itemconfig(self._profiles_canvas_win, width=canvas_w)
            
            # Auto-hide scrollbar when content fits
            if content_h <= canvas_h:
                if self._profiles_scrollbar.winfo_ismapped():
                    self._profiles_scrollbar.pack_forget()
                self._profiles_canvas.yview_moveto(0)
            else:
                if not self._profiles_scrollbar.winfo_ismapped():
                    self._profiles_scrollbar.pack(side="right", fill="y")
                    
        self._profiles_container.bind("<Configure>", _on_profiles_configure)
        self._profiles_canvas.bind("<Configure>", lambda e: _on_profiles_configure())
        self._on_profiles_configure = _on_profiles_configure
        
        def _on_profiles_mousewheel(event):
            if not hasattr(self, "_profiles_canvas") or not self._profiles_canvas.winfo_exists():
                return
            bbox = self._profiles_canvas.bbox("all")
            if not bbox:
                return
            content_h = bbox[3] - bbox[1]
            canvas_h = self._profiles_canvas.winfo_height()
            if content_h <= canvas_h:
                return "break"
                
            y_view = self._profiles_canvas.yview()
            if event.delta > 0:
                if y_view[0] <= 0.001:
                    return "break"
                self._profiles_canvas.yview_scroll(-2, "units")
            else:
                if y_view[1] >= 0.999:
                    return "break"
                self._profiles_canvas.yview_scroll(2, "units")
            return "break"
            
        def _bind_profiles_wheel(widget):
            widget.bind("<MouseWheel>", _on_profiles_mousewheel, add="+")
            
        _bind_profiles_wheel(self._profiles_canvas)
        _bind_profiles_wheel(self._profiles_scrollbar)
        _bind_profiles_wheel(self._profiles_container)
        self._bind_profiles_wheel = _bind_profiles_wheel
        
        self._build_profile_cards()

    def _build_profile_cards(self):
        import tkinter as tk
        if not hasattr(self, "_profiles_container") or not self._profiles_container.winfo_exists():
            return
            
        for w in self._profiles_container.winfo_children():
            w.destroy()
            
        all_profiles = self.config.get("profiles", [])
        self._profile_row_items = []
        
        if hasattr(self, "lbl_profile_count") and self.lbl_profile_count.winfo_exists():
            self.lbl_profile_count.configure(text=f"{len(all_profiles)} টি প্রোফাইল")
            
        if not all_profiles:
            empty_card = tk.Frame(self._profiles_container, bg="#112240", padx=20, pady=30)
            empty_card.pack(fill="x", padx=15, pady=20)
            tk.Label(
                empty_card,
                text="🧩 কোনো প্রোফাইল যুক্ত করা হয়নি\n\nউপরে 'নতুন প্রোফাইল' বাটনে ক্লিক করে প্রোফাইল যুক্ত করুন",
                font=("Segoe UI", 11),
                fg="#94a3b8",
                bg="#112240",
                justify="center"
            ).pack()
            if hasattr(self, "_on_profiles_configure"):
                self._on_profiles_configure()
            return
            
        # Fast Synchronous Direct Render - Instant response for all profiles!
        for i, p in enumerate(all_profiles):
            self._create_fast_profile_row(self._profiles_container, p, i)
            
        if hasattr(self, "_on_profiles_configure"):
            self._on_profiles_configure()
            
        if hasattr(self, "search_entry") and self.search_entry.winfo_exists():
            if self.search_entry.get().strip():
                self._filter_profiles_search()

    def _create_fast_profile_row(self, parent, p, index):
        import tkinter as tk
        name = p.get("name", f"Profile {index + 1}")
        chrome_profile = p.get("chrome_profile", "")
        phone = str(p.get("phone", "") or "").strip()
        password = str(p.get("password", "") or "").strip()
        enabled = p.get("enabled", True)
        
        row = tk.Frame(parent, bg="#112240", height=48)
        row.pack(fill="x", pady=2, padx=4)
        row.pack_propagate(False)
        
        # Left Accent Status Indicator Bar
        accent = tk.Frame(row, bg="#10b981" if enabled else "#334155", width=4)
        accent.pack(side="left", fill="y", padx=(0, 8))
        
        # Checkbox with instant status update
        cb = tk.Label(
            row, text="✓" if enabled else "",
            font=("Segoe UI Symbol", 10, "bold"),
            bg="#059669" if enabled else "#1e293b",
            fg="white", width=2, height=1,
            cursor="hand2", relief="flat"
        )
        cb.pack(side="left", padx=(0, 8))
        
        def toggle_cb(event=None):
            new_val = not p.get("enabled", True)
            p["enabled"] = new_val
            cb.configure(
                text="✓" if new_val else "",
                bg="#059669" if new_val else "#1e293b"
            )
            accent.configure(bg="#10b981" if new_val else "#334155")
            self._save_config()
            
        cb.bind("<Button-1>", toggle_cb)
        
        # Actions Frame - Packed side="right" FIRST so buttons are ALWAYS visible
        def make_btn(btn_parent, text, bg, hover, cmd):
            lbl = tk.Label(
                btn_parent, text=text,
                font=("Segoe UI", 9, "bold"),
                bg=bg, fg="white",
                padx=10, pady=3,
                cursor="hand2", relief="flat"
            )
            lbl.pack(side="right", padx=3)
            lbl.bind("<Enter>", lambda e: lbl.configure(bg=hover))
            lbl.bind("<Leave>", lambda e: lbl.configure(bg=bg))
            lbl.bind("<Button-1>", lambda e: cmd())
            return lbl
            
        btn_hide = make_btn(row, "Hide", "#dc2626", "#b91c1c", lambda: self._delete_profile(index))
        btn_open = make_btn(row, "Open", "#059669", "#047857", lambda: self._launch_profile(p))
        btn_edit = make_btn(row, "Edit", "#1e3a8a", "#2563eb", lambda: self._open_edit_profile_dialog(p, index))
        
        # Center Info Column
        info = tk.Frame(row, bg="#112240")
        info.pack(side="left", fill="x", expand=True, padx=4)
        
        l1 = tk.Label(info, text=name, font=("Segoe UI", 10, "bold"), fg="#f8fafc", bg="#112240", anchor="w")
        l1.pack(anchor="w")
        
        details_parts = [f"📁 {chrome_profile}"]
        if phone: details_parts.append(f"📱 {phone}")
        if password: details_parts.append(f"🔑 {password}")
        details_str = "   •   ".join(details_parts)
        
        l2 = tk.Label(info, text=details_str, font=("Segoe UI", 8), fg="#8892b0", bg="#112240", anchor="w")
        l2.pack(anchor="w")
        
        if hasattr(self, "_bind_profiles_wheel"):
            for elem in (row, accent, cb, btn_hide, btn_open, btn_edit, info, l1, l2):
                self._bind_profiles_wheel(elem)
                
        item_record = {
            "row": row,
            "profile": p,
            "search_text": f"{name} {phone} {chrome_profile} {password}".lower(),
            "visible": True,
            "cb": cb,
            "accent": accent
        }
        self._profile_row_items.append(item_record)

    def _filter_profiles_search(self):
        if not hasattr(self, "_profile_row_items") or not self._profile_row_items:
            return
            
        query = ""
        if hasattr(self, "search_entry") and self.search_entry.winfo_exists():
            query = self.search_entry.get().strip().lower()
            
        count = 0
        for item in self._profile_row_items:
            match = not query or (query in item["search_text"])
            if match:
                if not item["visible"]:
                    item["row"].pack(fill="x", pady=2, padx=4)
                    item["visible"] = True
                count += 1
            else:
                if item["visible"]:
                    item["row"].pack_forget()
                    item["visible"] = False
                    
        total = len(self._profile_row_items)
        if hasattr(self, "lbl_profile_count") and self.lbl_profile_count.winfo_exists():
            if query:
                self.lbl_profile_count.configure(text=f"{count}/{total} টি প্রোফাইল")
            else:
                self.lbl_profile_count.configure(text=f"{total} টি প্রোফাইল")
                
        if hasattr(self, "_on_profiles_configure"):
            self._on_profiles_configure()

    def _toggle_select_all_profiles(self):
        if not hasattr(self, "_profile_row_items") or not self._profile_row_items:
            return
            
        self._all_selected_state = not getattr(self, "_all_selected_state", True)
        new_state = self._all_selected_state
        
        for item in self._profile_row_items:
            p = item["profile"]
            p["enabled"] = new_state
            item["cb"].configure(
                text="✓" if new_state else "",
                bg="#059669" if new_state else "#1e293b"
            )
            item["accent"].configure(bg="#10b981" if new_state else "#334155")
            
        self._save_config()
        if hasattr(self, "btn_select_all") and self.btn_select_all.winfo_exists():
            self.btn_select_all.configure(text="☑️ সব আনসিলেক্ট" if new_state else "☐ সব সিলেক্ট")

    def _refresh_profiles_tab(self):
        try:
            self._load_config()
        except Exception:
            pass
            
        if hasattr(self, "_profiles_container") and self._profiles_container.winfo_exists():
            self._build_profile_cards()
        else:
            self._build_profiles_tab()
            
    def _toggle_profile(self, index, enabled):
        try:
            self.config["profiles"][index]["enabled"] = enabled
            self._save_config()
        except Exception:
            pass
    
    def _delete_profile(self, index):
        if messagebox.askyesno("Hide Profile", "আপনি কি নিশ্চিত যে এই প্রোফাইলটি তালিকা থেকে হাইড করতে চান?\n(এটি কম্পিউটার থেকে ডিলিট হবে না, শুধু এই তালিকা থেকে সরবে)"):
            try:
                self.config["profiles"].pop(index)
                self._save_config()
                self._refresh_profiles_tab()
                if hasattr(self, "_refresh_extension_profiles_list"):
                    self._refresh_extension_profiles_list()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to hide profile: {e}")
                
    def _open_add_profile_dialog(self):
        dialog = ctk.CTkToplevel(self)
        dialog.title("নতুন প্রোফাইল যুক্ত করুন")
        dialog.geometry("460x520")
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()
        
        ctk.CTkLabel(
            dialog, text="গ্রাহকের নাম (Profile Name):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(15, 2))
        
        name_entry = ctk.CTkEntry(dialog, width=420, placeholder_text="যেমন: MD REZHANUL HAQUE")
        name_entry.pack(padx=20, pady=(0, 8))
        
        ctk.CTkLabel(
            dialog, text="Chrome Profile ফোল্ডারের নাম:",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(0, 2))
        
        dir_entry = ctk.CTkEntry(dialog, width=420, placeholder_text="যেমন: 1, 2, 3 বা Default")
        dir_entry.pack(padx=20, pady=(0, 6))
        
        # IVAC Login Mobile Number
        ctk.CTkLabel(
            dialog, text="📱 IVAC মোবাইল নম্বর (Login Mobile Number):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(0, 2))
        
        phone_entry = ctk.CTkEntry(dialog, width=420, placeholder_text="যেমন: 01912345678")
        phone_entry.pack(padx=20, pady=(0, 8))
        
        # IVAC Login Password
        ctk.CTkLabel(
            dialog, text="🔒 IVAC পাসওয়ার্ড (Login Password):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(0, 2))
        
        pass_entry = ctk.CTkEntry(dialog, width=420, placeholder_text="IVAC সাইন-ইন পাসওয়ার্ড দিন")
        pass_entry.pack(padx=20, pady=(0, 8))
        
        def toggle_pass_vis():
            if pass_entry.cget("show") == "":
                pass_entry.configure(show="*")
                show_pass_btn.configure(text="👁️ Show Password")
            else:
                pass_entry.configure(show="")
                show_pass_btn.configure(text="🙈 Hide Password")
                
        show_pass_btn = ctk.CTkButton(
            dialog, text="🙈 Hide Password", width=120, height=22,
            font=ctk.CTkFont(size=10), fg_color="#1f2937", hover_color="#374151",
            command=toggle_pass_vis
        )
        show_pass_btn.pack(anchor="w", padx=20, pady=(0, 8))
        
        tip_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        tip_frame.pack(fill="x", padx=20, pady=(0, 5))
        
        ctk.CTkLabel(
            tip_frame, 
            text="💡 সঠিক Profile Name জানতে ক্রোম ব্রাউজারে নিচের\nURL টি ওপেন করুন এবং 'Profile Path' এর শেষের নাম দিন:",
            font=ctk.CTkFont(size=10),
            text_color="#9ca3af",
            justify="left"
        ).pack(anchor="w", pady=(0, 2))
        
        url_frame = ctk.CTkFrame(tip_frame, fg_color="#112240", corner_radius=5)
        url_frame.pack(fill="x", pady=2)
        
        ctk.CTkLabel(
            url_frame, text="chrome://version/",
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color="#64ffda"
        ).pack(side="left", padx=10, pady=3)
        
        def copy_url():
            dialog.clipboard_clear()
            dialog.clipboard_append("chrome://version/")
            copy_btn.configure(text="✅ Copied", fg_color="#059669")
            dialog.after(2000, lambda: copy_btn.configure(text="📋 Copy", fg_color="#233554"))
            
        copy_btn = ctk.CTkButton(
            url_frame, text="📋 Copy", width=60, height=22,
            font=ctk.CTkFont(size=10), fg_color="#233554", hover_color="#059669",
            command=copy_url
        )
        copy_btn.pack(side="right", padx=5, pady=3)
        
        def save_new():
            name = name_entry.get().strip()
            chrome_profile = dir_entry.get().strip()
            
            if chrome_profile.isdigit():
                chrome_profile = f"Profile {chrome_profile}"
                
            phone = phone_entry.get().strip()
            password = pass_entry.get().strip()
            
            if not name or not chrome_profile:
                messagebox.showwarning("Warning", "গ্রাহকের নাম ও ক্রোম প্রোফাইল ফোল্ডারের নাম দিন!")
                return
            
            if "profiles" not in self.config:
                self.config["profiles"] = []
                
            new_id = len(self.config["profiles"]) + 1
            new_prof = {
                "id": new_id,
                "name": name,
                "chrome_profile": chrome_profile,
                "phone": phone,
                "password": password,
                "enabled": True
            }
            self.config["profiles"].append(new_prof)
            self._save_config()
            
            try:
                import requests
                requests.post("http://127.0.0.1:5000/api/profile/active", json=new_prof, timeout=1)
            except Exception:
                pass
                
            self._refresh_profiles_tab()
            dialog.destroy()
            
        ctk.CTkButton(
            dialog, text="✅ সেভ করুন", height=32,
            fg_color="#059669", hover_color="#047857",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=save_new
        ).pack(pady=(12, 10))

    def _open_edit_profile_dialog(self, profile, index):
        dialog = ctk.CTkToplevel(self)
        dialog.title("প্রোফাইল এডিট করুন")
        dialog.geometry("460x520")
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()
        
        ctk.CTkLabel(
            dialog, text="গ্রাহকের নাম (Profile Name):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(15, 2))
        
        name_entry = ctk.CTkEntry(dialog, width=420)
        name_entry.insert(0, profile.get("name", ""))
        name_entry.pack(padx=20, pady=(0, 8))
        
        ctk.CTkLabel(
            dialog, text="Chrome Profile ফোল্ডারের নাম:",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(0, 2))
        
        dir_entry = ctk.CTkEntry(dialog, width=420)
        dir_entry.insert(0, profile.get("chrome_profile", ""))
        dir_entry.pack(padx=20, pady=(0, 8))
        
        ctk.CTkLabel(
            dialog, text="📱 IVAC মোবাইল নম্বর (Login Mobile Number):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(0, 2))
        
        phone_entry = ctk.CTkEntry(dialog, width=420)
        phone_entry.insert(0, profile.get("phone", ""))
        phone_entry.pack(padx=20, pady=(0, 8))
        
        ctk.CTkLabel(
            dialog, text="🔒 IVAC পাসওয়ার্ড (Login Password):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(0, 2))
        
        pass_entry = ctk.CTkEntry(dialog, width=420)
        pass_entry.insert(0, profile.get("password", ""))
        pass_entry.pack(padx=20, pady=(0, 8))
        
        def toggle_pass_vis():
            if pass_entry.cget("show") == "":
                pass_entry.configure(show="*")
                show_pass_btn.configure(text="👁️ Show Password")
            else:
                pass_entry.configure(show="")
                show_pass_btn.configure(text="🙈 Hide Password")
                
        show_pass_btn = ctk.CTkButton(
            dialog, text="🙈 Hide Password", width=120, height=22,
            font=ctk.CTkFont(size=10), fg_color="#1f2937", hover_color="#374151",
            command=toggle_pass_vis
        )
        show_pass_btn.pack(anchor="w", padx=20, pady=(0, 8))
        
        def save_edit():
            name = name_entry.get().strip()
            chrome_profile = dir_entry.get().strip()
            
            if chrome_profile.isdigit():
                chrome_profile = f"Profile {chrome_profile}"
                
            phone = phone_entry.get().strip()
            password = pass_entry.get().strip()
            
            if not name or not chrome_profile:
                messagebox.showwarning("Warning", "গ্রাহকের নাম ও ক্রোম প্রোফাইল ফোল্ডারের নাম দিন!")
                return
            
            self.config["profiles"][index]["name"] = name
            self.config["profiles"][index]["chrome_profile"] = chrome_profile
            self.config["profiles"][index]["phone"] = phone
            self.config["profiles"][index]["password"] = password
            self._save_config()
            
            try:
                import requests
                requests.post("http://127.0.0.1:5000/api/profile/sync", json={
                    "chrome_profile": chrome_profile,
                    "name": name,
                    "phone": phone,
                    "password": password
                }, timeout=1)
            except Exception:
                pass
                
            self._refresh_profiles_tab()
            dialog.destroy()
            
        ctk.CTkButton(
            dialog, text="💾 আপডেট করুন", height=32,
            fg_color="#059669", hover_color="#047857",
            font=ctk.CTkFont(size=12, weight="bold"),
            command=save_edit
        ).pack(pady=(12, 10))
        
    def _format_profile_dir(self, p_dir):
        p_dir = str(p_dir).strip()
        if p_dir.isdigit():
            if p_dir == "0":
                return "Default"
            return f"Profile {p_dir}"
        if p_dir.lower() == "default":
            return "Default"
        return p_dir

    def _launch_profile(self, profile):
        import subprocess, urllib.parse
        ext_path = cpm.get_safe_extension_dir(BASE_DIR)
        profile_dir = profile.get("chrome_profile", "")
        phone = profile.get("phone", "")
        password = profile.get("password", "")
        name = profile.get("name", "")
        
        # Asynchronously notify local server without blocking UI
        def _notify():
            try:
                import requests
                requests.post("http://127.0.0.1:5000/api/profile/sync", json={
                    "chrome_profile": profile_dir,
                    "name": name,
                    "phone": phone,
                    "password": password
                }, timeout=1)
            except Exception:
                pass
        threading.Thread(target=_notify, daemon=True).start()
            
        self.config["active_profile"] = profile
        self._save_config()
        
        if profile_dir:
            profile_dir = self._format_profile_dir(profile_dir)
            encoded_prof = urllib.parse.quote(profile_dir)
            target_url = f"https://appointment.ivacbd.com/signin#profile={encoded_prof}"
            chrome_exe = cpm.get_chrome_exe_path() or "chrome.exe"
            cmd = f'start "" "{chrome_exe}" --profile-directory="{profile_dir}" --disable-features=PrivateNetworkAccessPermissionPrompt --load-extension="{ext_path}" "{target_url}"'
            subprocess.Popen(cmd, shell=True)
    
    def _launch_all_profiles(self):
        profiles = self.config.get("profiles", [])
        active = [p for p in profiles if p.get("enabled", True)]
        
        if not active:
            messagebox.showinfo("Info", "কোনো সক্রিয় প্রোফাইল নেই!")
            return
            
        def _launch_runner():
            for p in active:
                self._launch_profile(p)
                time.sleep(0.8)
                
        threading.Thread(target=_launch_runner, daemon=True).start()
    
    def _add_rocket_account(self):
        num = self.pay_num_entry.get().strip()
        r_ext = self.rocket_extra_entry.get().strip()
        r_pin = self.rocket_pin_entry.get().strip()
        b_pin = self.bkash_pin_entry.get().strip()
        n_pin = self.nagad_pin_entry.get().strip()
        
        if len(num) != 11 or not num.isdigit():
            from tkinter import messagebox
            messagebox.showerror("Error", "মোবাইল নম্বর ১১ ডিজিটের হতে হবে!")
            return
        
        accounts = self.config.get("rocket_accounts", [])
        if any(a.get("number") == num for a in accounts):
            from tkinter import messagebox
            messagebox.showerror("Error", "এই নম্বরটি আগেই যোগ করা হয়েছে!")
            return
            
        import uuid
        accounts.append({
            "id": str(uuid.uuid4()),
            "number": num,
            "rocket_extra": r_ext,
            "rocket_pin": r_pin,
            "bkash_pin": b_pin,
            "nagad_pin": n_pin
        })
        self.config["rocket_accounts"] = accounts
        self._save_config()
        self.pay_num_entry.delete(0, 'end')
        self.rocket_extra_entry.delete(0, 'end')
        self.rocket_pin_entry.delete(0, 'end')
        self.bkash_pin_entry.delete(0, 'end')
        self.nagad_pin_entry.delete(0, 'end')
        self._refresh_rocket_list()
        
    def _delete_rocket_account(self, acc_id):
        accounts = self.config.get("rocket_accounts", [])
        self.config["rocket_accounts"] = [a for a in accounts if a.get("id") != acc_id]
        self._save_config()
        self._refresh_rocket_list()
        
    def _build_rocket_row(self, acc):
        row = ctk.CTkFrame(self.rocket_list_frame, fg_color="transparent")
        row.pack(fill="x", pady=2)
        
        display_num = acc['number']
        if acc.get('rocket_extra'):
            display_num += f"-{acc['rocket_extra']}"
            
        lbl = ctk.CTkLabel(row, text=f"{display_num} (R: *** | B: *** | N: ***)", text_color="#ccd6f6")
        lbl.pack(side="left", padx=5)
        
        is_hidden = [True]
        
        def toggle_vis():
            if is_hidden[0]:
                r_pin = acc.get('rocket_pin', '')
                b_pin = acc.get('bkash_pin', '')
                n_pin = acc.get('nagad_pin', '')
                lbl.configure(text=f"{display_num} (R:{r_pin} | B:{b_pin} | N:{n_pin})")
                eye_btn.configure(text="🙈")
                is_hidden[0] = False
            else:
                lbl.configure(text=f"{display_num} (R: *** | B: *** | N: ***)")
                eye_btn.configure(text="👁️")
                is_hidden[0] = True
                
        eye_btn = ctk.CTkButton(
            row, text="👁️", width=30, height=24,
            fg_color="transparent", text_color="#8892b0", hover_color="#112240",
            command=toggle_vis
        )
        eye_btn.pack(side="left", padx=5)
        
        ctk.CTkButton(
            row, text="Delete", width=50, fg_color="#ef4444", hover_color="#dc2626", height=24,
            command=lambda aid=acc['id']: self._delete_rocket_account(aid)
        ).pack(side="right", padx=5)
        
    def _refresh_rocket_list(self):
        for w in self.rocket_list_frame.winfo_children():
            w.destroy()
        
        accounts = self.config.get("rocket_accounts", [])
        if not accounts:
            ctk.CTkLabel(self.rocket_list_frame, text="No accounts added yet", text_color="#495670").pack(pady=10)
            return
            
        for acc in accounts:
            self._build_rocket_row(acc)
    # ===== SETTINGS TAB =====
    def _build_settings_tab(self):
        tab = self.tab_settings
        for w in tab.winfo_children():
            w.destroy()
        
        # Rocket Config (Moved from Extension Tab) -> Now Payment Accounts
        rocket_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        rocket_card.pack(fill="x", padx=5, pady=(5, 5))
        
        ctk.CTkLabel(
            rocket_card, text="💳 Payment Accounts",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            rocket_card, text="আপনার মোবাইল নম্বর এবং পিন সেভ করুন। রকেটের জন্য ১২তম ডিজিটটি আলাদা বক্সে দিন।",
            font=ctk.CTkFont(size=11), text_color="#8892b0"
        ).pack(anchor="w", padx=15, pady=(0, 10))
        
        # Row 1
        input_frame1 = ctk.CTkFrame(rocket_card, fg_color="transparent")
        input_frame1.pack(fill="x", padx=15, pady=(0, 5))
        
        self.pay_num_entry = ctk.CTkEntry(input_frame1, placeholder_text="Base Phone Number (11 digit)", width=200)
        self.pay_num_entry.pack(side="left", padx=(0, 10))
        
        self.rocket_extra_entry = ctk.CTkEntry(input_frame1, placeholder_text="Rocket Extra (1 digit)", width=130)
        self.rocket_extra_entry.pack(side="left", padx=(0, 10))
        
        # Row 2
        input_frame2 = ctk.CTkFrame(rocket_card, fg_color="transparent")
        input_frame2.pack(fill="x", padx=15, pady=(0, 10))
        
        self.rocket_pin_entry = ctk.CTkEntry(input_frame2, placeholder_text="Rocket PIN", show="*", width=90)
        self.rocket_pin_entry.pack(side="left", padx=(0, 10))
        
        self.bkash_pin_entry = ctk.CTkEntry(input_frame2, placeholder_text="bKash PIN", show="*", width=90)
        self.bkash_pin_entry.pack(side="left", padx=(0, 10))
        
        self.nagad_pin_entry = ctk.CTkEntry(input_frame2, placeholder_text="Nagad PIN", show="*", width=90)
        self.nagad_pin_entry.pack(side="left", padx=(0, 10))
        
        ctk.CTkButton(
            input_frame2, text="Add", width=60,
            fg_color="#233554", hover_color="#059669",
            command=self._add_rocket_account
        ).pack(side="left")
        
        self.rocket_list_frame = SmoothScrollableFrame(rocket_card, height=100, fg_color="#0a192f", scroll_speed=55)
        self.rocket_list_frame.pack(fill="x", padx=15, pady=(0, 15))
        
        self._refresh_rocket_list()
    
    # ===== LICENSE TAB =====
    def _build_license_tab(self):
        tab = self.tab_license
        for w in tab.winfo_children():
            w.destroy()
        
        # Current License Card
        lic_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        lic_card.pack(fill="x", padx=5, pady=(5, 5))
        
        ctk.CTkLabel(
            lic_card, text="🔑 বর্তমান লাইসেন্স",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        info = self.license_info
        masked_key = get_masked_key(info.license_key) if info else "N/A"
        
        details = ctk.CTkFrame(lic_card, fg_color="transparent")
        details.pack(fill="x", padx=15, pady=(0, 10))
        
        rows = [
            ("Status:", "✅ সক্রিয়" if info and info.is_valid else "❌ নিষ্ক্রিয়"),
            ("License Key:", masked_key),
            ("Plan:", info.plan if info else "N/A"),
            ("Expiry:", info.expiry_date if info else "N/A"),
            ("Remaining:", info.remaining_text if info else "N/A"),
            ("Device ID:", get_hwid_display()[:23] + "..."),
        ]
        
        for label, value in rows:
            row = ctk.CTkFrame(details, fg_color="transparent")
            row.pack(fill="x", pady=1)
            ctk.CTkLabel(row, text=label, font=ctk.CTkFont(size=11, weight="bold"),
                        text_color="#8892b0", width=100, anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=value, font=ctk.CTkFont(size=11),
                        text_color="#ccd6f6", anchor="w").pack(side="left", padx=5)
                        
        # About
        about_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        about_card.pack(fill="x", padx=5, pady=5)
        
        ctk.CTkLabel(
            about_card, text="ℹ️ About",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            about_card,
            text=f"{APP_NAME} v{APP_VERSION}\n© 2026 {APP_AUTHOR}\nAll Rights Reserved.",
            font=ctk.CTkFont(size=11),
            text_color="#8892b0",
            justify="left"
        ).pack(anchor="w", padx=15, pady=(0, 10))
    
    # ===== EXTENSION TAB =====
    def _build_extension_tab(self):
        tab = self.tab_extension
        
        for child in tab.winfo_children():
            child.destroy()
            
        scroll = SmoothScrollableFrame(tab, fg_color="transparent", scroll_speed=65)
        self._ext_main_scroll = scroll
        scroll.pack(fill="both", expand=True, padx=5, pady=5)
        
        # --- Card 1: 1-Click Chrome Profile Generator ---
        gen_card = ctk.CTkFrame(scroll, fg_color="#112240", corner_radius=10)
        gen_card.pack(fill="x", padx=5, pady=(5, 10))
        
        ctk.CTkLabel(
            gen_card, text="⚡ 1-Click Chrome Profile Generator",
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color="#64ffda"
        ).pack(anchor="w", padx=15, pady=(12, 3))
        
        ctk.CTkLabel(
            gen_card,
            text="নতুন Chrome Profile তৈরি, নাম নির্ধারণ, অটো-বুকমার্ক (Search + IVAC) এবং Extension Auto-Pin এক ক্লিকেই!\nতৈরি হওয়া প্রোফাইলটি স্বয়ংক্রিয়ভাবে Profiles ট্যাবে যুক্ত হবে।",
            font=ctk.CTkFont(size=11), text_color="#8892b0", justify="left"
        ).pack(anchor="w", padx=15, pady=(0, 10))
        
        gen_row = ctk.CTkFrame(gen_card, fg_color="transparent")
        gen_row.pack(fill="x", padx=15, pady=(0, 8))
        
        ctk.CTkLabel(
            gen_row, text="Profile Name:",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        ).pack(side="left", padx=(0, 10))
        
        self.entry_chrome_profile_name = ctk.CTkEntry(
            gen_row, placeholder_text="e.g. 30. MOHIR বা Counter 1",
            font=ctk.CTkFont(size=13), height=38, width=280
        )
        self.entry_chrome_profile_name.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self.entry_chrome_profile_name.bind("<Return>", lambda e: self._create_and_launch_chrome_profile())
        
        self.btn_create_profile = ctk.CTkButton(
            gen_row, text="🚀 Create & Launch Profile",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#0284c7", hover_color="#0369a1", height=38,
            command=self._create_and_launch_chrome_profile
        )
        self.btn_create_profile.pack(side="right")
        
        self.lbl_profile_status = ctk.CTkLabel(
            gen_card, text="", font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#10b981"
        )
        self.lbl_profile_status.pack(anchor="w", padx=15, pady=(0, 10))
        
        # --- Card 2: Bookmarks Configuration ---
        bm_card = ctk.CTkFrame(scroll, fg_color="#112240", corner_radius=10)
        bm_card.pack(fill="x", padx=5, pady=(0, 10))
        
        ctk.CTkLabel(
            bm_card, text="📌 Auto Bookmarks Configuration",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(12, 4))
        
        ctk.CTkLabel(
            bm_card,
            text="প্রতিটি নতুন প্রোফাইলে ডিফল্টভাবে নিচের ২ টি বুকমার্ক যুক্ত হয় এবং Show Bookmarks Bar চালু থাকে:\n  ⭐ 1. {Profile Name} - Google Search\n  ⭐ 2. Indian Visa Application Center (https://appointment.ivacbd.com/signin)",
            font=ctk.CTkFont(size=11), text_color="#38bdf8", justify="left"
        ).pack(anchor="w", padx=15, pady=(0, 10))
        
        ctk.CTkLabel(
            bm_card, text="অতিরিক্ত কাস্টম বুকমার্ক লিংক (ঐচ্ছিক):",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(0, 4))
        
        self.bm_list_frame = ctk.CTkFrame(bm_card, fg_color="#0a192f", corner_radius=8)
        self.bm_list_frame.pack(fill="x", padx=15, pady=(0, 8))
        self._refresh_bookmarks_ui()
        
        add_bm_row = ctk.CTkFrame(bm_card, fg_color="transparent")
        add_bm_row.pack(fill="x", padx=15, pady=(0, 12))
        
        self.entry_new_bm_url = ctk.CTkEntry(
            add_bm_row, placeholder_text="বুকমার্ক লিংক লিখুন (e.g. https://mail.proton.me)",
            height=34
        )
        self.entry_new_bm_url.pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.entry_new_bm_url.bind("<Return>", lambda e: self._add_custom_bookmark())
        
        ctk.CTkButton(
            add_bm_row, text="+ Add Link",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#059669", hover_color="#047857", height=34, width=100,
            command=self._add_custom_bookmark
        ).pack(side="right")
        
        # --- Card 3: Bulk Extension Update in All Profiles ---
        update_card = ctk.CTkFrame(scroll, fg_color="#112240", corner_radius=10)
        update_card.pack(fill="x", padx=5, pady=(0, 15))
        
        ctk.CTkLabel(
            update_card, text="🔄 Update Extension in All Profiles",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(12, 4))
        
        ctk.CTkLabel(
            update_card,
            text="সফটওয়্যারের সর্বশেষ IVAC Master Pro এক্সটেনশনটি এক ক্লিকেই আপনার কম্পিউটারের সকল Chrome Profile-এ আপডেট, সক্রিয় এবং পিন করে নিন।",
            font=ctk.CTkFont(size=11), text_color="#8892b0", justify="left"
        ).pack(anchor="w", padx=15, pady=(0, 10))
        
        btn_update_row = ctk.CTkFrame(update_card, fg_color="transparent")
        btn_update_row.pack(fill="x", padx=15, pady=(0, 8))
        
        self.btn_bulk_update_ext = ctk.CTkButton(
            btn_update_row, text="🔄 সব প্রোফাইলে এক্সটেনশন আপডেট করুন",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#0284c7", hover_color="#0369a1", height=38,
            command=self._update_all_profiles_extension
        )
        self.btn_bulk_update_ext.pack(side="left")
        
        self.lbl_bulk_update_status = ctk.CTkLabel(
            update_card, text="", font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#10b981"
        )
        self.lbl_bulk_update_status.pack(anchor="w", padx=15, pady=(0, 8))

        # Profiles List Header
        p_list_header = ctk.CTkFrame(update_card, fg_color="transparent")
        p_list_header.pack(fill="x", padx=15, pady=(0, 6))
        
        self.lbl_ext_profiles_count = ctk.CTkLabel(
            p_list_header, text="👥 Chrome Profiles:",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        )
        self.lbl_ext_profiles_count.pack(side="left")
        
        ctk.CTkButton(
            p_list_header, text="🔄 তালিকা রিফ্রেশ",
            font=ctk.CTkFont(size=11),
            fg_color="#1e293b", hover_color="#334155", height=26, width=100,
            command=self._refresh_extension_profiles_list
        ).pack(side="right")
        
        self.btn_add_all_profiles = ctk.CTkButton(
            p_list_header, text="➕ সব Profiles-এ যুক্ত করুন",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#0369a1", hover_color="#0284c7", height=26,
            command=self._add_all_unadded_profiles_to_tab
        )
        self.btn_add_all_profiles.pack(side="right", padx=(0, 8))
        
        # Native High-Speed Scroll Container for Chrome Profiles (Zero-lag, 0.4ms init)
        import tkinter as tk
        scroll_wrap = tk.Frame(update_card, bg="#0a192f", highlightbackground="#233554", highlightthickness=1)
        scroll_wrap.pack(fill="x", padx=15, pady=(0, 15))
        
        self._ext_canvas = tk.Canvas(scroll_wrap, bg="#0a192f", highlightthickness=0, height=120)
        self._ext_scrollbar = tk.Scrollbar(scroll_wrap, orient="vertical", command=self._ext_canvas.yview)
        self._ext_canvas.configure(yscrollcommand=self._ext_scrollbar.set)
        
        self._ext_canvas.pack(side="left", fill="both", expand=True)
        
        self._ext_profiles_container = tk.Frame(self._ext_canvas, bg="#0a192f")
        self._ext_canvas_window = self._ext_canvas.create_window((0, 0), window=self._ext_profiles_container, anchor="nw")
        
        MAX_CANVAS_HEIGHT = 380
        MIN_CANVAS_HEIGHT = 86
        
        def _on_ext_configure(e=None):
            if not hasattr(self, "_ext_canvas") or not self._ext_canvas.winfo_exists():
                return
            c_w = self._ext_canvas.winfo_width()
            bbox = self._ext_canvas.bbox("all")
            if not bbox:
                return
            content_h = bbox[3] - bbox[1]
            
            # Dynamic height so few profiles (e.g. 3) fit snugly without giant empty void!
            desired_h = min(max(content_h + 4, MIN_CANVAS_HEIGHT), MAX_CANVAS_HEIGHT)
            cur_h = self._ext_canvas.winfo_height()
            if abs(cur_h - desired_h) > 2:
                self._ext_canvas.configure(height=desired_h)
                cur_h = desired_h
                
            eff_h = max(content_h, cur_h)
            self._ext_canvas.configure(scrollregion=(0, 0, c_w, eff_h))
            
            if c_w > 10:
                self._ext_canvas.itemconfig(self._ext_canvas_window, width=c_w)
                
            if content_h <= cur_h:
                self._ext_canvas.yview_moveto(0)
                if hasattr(self, "_ext_scrollbar") and self._ext_scrollbar.winfo_ismapped():
                    self._ext_scrollbar.pack_forget()
            else:
                if hasattr(self, "_ext_scrollbar") and not self._ext_scrollbar.winfo_ismapped():
                    self._ext_scrollbar.pack(side="right", fill="y")
                    
        self._on_ext_configure = _on_ext_configure
        self._ext_profiles_container.bind("<Configure>", _on_ext_configure)
        self._ext_canvas.bind("<Configure>", lambda e: self._ext_canvas.itemconfig(self._ext_canvas_window, width=e.width))
        
        def _on_ext_mousewheel(e):
            if not hasattr(self, "_ext_canvas") or not self._ext_canvas.winfo_exists():
                return "break"
            bbox = self._ext_canvas.bbox("all")
            if bbox and (bbox[3] - bbox[1]) <= self._ext_canvas.winfo_height():
                self._ext_canvas.yview_moveto(0)
                return "break"
                
            y_view = self._ext_canvas.yview()
            if y_view[0] <= 0.001 and y_view[1] >= 0.999:
                self._ext_canvas.yview_moveto(0)
                return "break"
                
            if hasattr(e, "num") and e.num == 4:
                step = -2
            elif hasattr(e, "num") and e.num == 5:
                step = 2
            elif sys.platform == "darwin":
                step = -int(e.delta)
            else:
                step = -int(e.delta / 40) or (-1 if e.delta > 0 else 1)
                
            # Prevent scrolling past top or bottom
            if step < 0 and y_view[0] <= 0.0:
                self._ext_canvas.yview_moveto(0)
                return "break"
            if step > 0 and y_view[1] >= 1.0:
                return "break"
                
            self._ext_canvas.yview_scroll(step, "units")
            return "break"
            
        self._on_ext_mousewheel = _on_ext_mousewheel
            
        def _bind_ext_wheel(widget):
            try:
                widget.bind("<MouseWheel>", _on_ext_mousewheel)
                if sys.platform != "win32":
                    widget.bind("<Button-4>", _on_ext_mousewheel)
                    widget.bind("<Button-5>", _on_ext_mousewheel)
            except Exception:
                pass
                
        _bind_ext_wheel(scroll_wrap)
        _bind_ext_wheel(self._ext_canvas)
        _bind_ext_wheel(self._ext_scrollbar)
        _bind_ext_wheel(self._ext_profiles_container)
        self._bind_ext_wheel = _bind_ext_wheel
        
        self._refresh_extension_profiles_list()

    def _refresh_extension_profiles_list(self):
        if not hasattr(self, "_ext_profiles_container") or not self._ext_profiles_container.winfo_exists():
            return
            
        def _update_ui(statuses):
            import tkinter as tk
            if not hasattr(self, "_ext_profiles_container") or not self._ext_profiles_container.winfo_exists():
                return
            for w in self._ext_profiles_container.winfo_children():
                w.destroy()
                
            self._last_ext_statuses = statuses
            self._ext_profile_row_widgets = {}
            
            if hasattr(self, "lbl_ext_profiles_count") and self.lbl_ext_profiles_count.winfo_exists():
                self.lbl_ext_profiles_count.configure(text=f"👥 Chrome Profiles ({len(statuses)}টি পাওয়া গেছে):")
            
            added_dirs = {p.get("chrome_profile") for p in self.config.get("profiles", [])}
            unadded_count = sum(1 for s in statuses if s.get("dir") not in added_dirs)
            
            if hasattr(self, "btn_add_all_profiles") and self.btn_add_all_profiles.winfo_exists():
                if unadded_count > 0:
                    self.btn_add_all_profiles.configure(
                        state="normal",
                        text=f"➕ বাকি {unadded_count}টি Profiles-এ যুক্ত করুন",
                        fg_color="#0369a1"
                    )
                else:
                    self.btn_add_all_profiles.configure(
                        state="disabled",
                        text="✓ সব Profiles-এ যুক্ত",
                        fg_color="#1e293b"
                    )
            
            if not statuses:
                empty_box = tk.Frame(self._ext_profiles_container, bg="#112240", padx=15, pady=15)
                empty_box.pack(fill="x", padx=5, pady=10)
                empty_lbl = tk.Label(
                    empty_box, text="কোনো Chrome প্রোফাইল পাওয়া যায়নি।",
                    font=("Segoe UI", 10), fg="#64748b", bg="#112240"
                )
                empty_lbl.pack()
                if hasattr(self, "_on_ext_configure"):
                    self._on_ext_configure()
                return

            def _render_row(s):
                has_ext = s.get("has_ext", False)
                name = s.get("name", "")
                p_dir = s.get("dir", "")
                is_added = p_dir in added_dirs
                
                row = tk.Frame(self._ext_profiles_container, bg="#112240", height=38)
                row.pack(fill="x", pady=2, padx=4)
                row.pack_propagate(False)
                
                # Left accent indicator
                accent = tk.Frame(row, bg="#10b981" if has_ext else "#334155", width=3)
                accent.pack(side="left", fill="y", padx=(0, 8))
                
                # Left text info directly inside row for maximum performance
                lbl_title = tk.Label(
                    row, text=name,
                    font=("Segoe UI", 9, "bold"),
                    fg="#f8fafc", bg="#112240", anchor="w"
                )
                lbl_title.pack(side="left")
                
                lbl_dir = tk.Label(
                    row, text=f"({p_dir})",
                    font=("Segoe UI", 8),
                    fg="#64ffda" if has_ext else "#8892b0", bg="#112240", anchor="w"
                )
                lbl_dir.pack(side="left", padx=(6, 0))
                
                # Status badge (packed side="right" first)
                badge_bg = "#064e3b" if has_ext else "#1e293b"
                badge_fg = "#34d399" if has_ext else "#94a3b8"
                badge_txt = "Active" if has_ext else "Not Added"
                badge = tk.Label(
                    row, text=badge_txt,
                    font=("Segoe UI", 8, "bold"),
                    bg=badge_bg, fg=badge_fg,
                    padx=10, pady=2, relief="flat"
                )
                badge.pack(side="right", padx=10)

                # Profiles Tab Status / Action Button (packed side="right")
                if is_added:
                    btn_tab = tk.Label(
                        row, text="✓ Profiles-এ যুক্ত",
                        font=("Segoe UI", 8),
                        bg="#1e293b", fg="#64748b",
                        padx=8, pady=2, relief="flat"
                    )
                else:
                    btn_tab = tk.Label(
                        row, text="+ Profiles-এ যুক্ত করুন",
                        font=("Segoe UI", 8, "bold"),
                        bg="#0284c7", fg="#ffffff",
                        padx=8, pady=2, relief="flat",
                        cursor="hand2"
                    )
                    def _bind_btn_events(widget, p_d=p_dir, p_n=name):
                        widget.bind("<Enter>", lambda e: widget.configure(bg="#0369a1") if str(widget.cget("cursor")) == "hand2" else None)
                        widget.bind("<Leave>", lambda e: widget.configure(bg="#0284c7") if str(widget.cget("cursor")) == "hand2" else None)
                        widget.bind("<Button-1>", lambda e: self._add_existing_chrome_profile_to_tab(p_d, p_n, widget))
                    _bind_btn_events(btn_tab)
                    
                btn_tab.pack(side="right", padx=(0, 6))
                self._ext_profile_row_widgets[p_dir] = btn_tab
                
                if hasattr(self, "_bind_ext_wheel"):
                    for elem in (row, badge, btn_tab, lbl_title, lbl_dir):
                        self._bind_ext_wheel(elem)

            # Direct smooth render without chunk popping or flickering
            for s in statuses:
                _render_row(s)
                
            if hasattr(self, "_on_ext_configure"):
                self._on_ext_configure()
                
        self.run_in_background(cpm.get_profiles_extension_status, _update_ui)

    def _add_existing_chrome_profile_to_tab(self, p_dir, name, btn_widget=None):
        existing_p = self.config.get("profiles", [])
        if not any(p.get("chrome_profile") == p_dir for p in existing_p):
            max_id = max([p.get("id", 0) for p in existing_p], default=0)
            existing_p.append({
                "id": max_id + 1,
                "name": name or p_dir,
                "chrome_profile": p_dir,
                "enabled": True,
                "phone": "",
                "password": ""
            })
            self.config["profiles"] = existing_p
            self._save_config()
            self._profiles_tab_dirty = True
            
        if btn_widget and btn_widget.winfo_exists():
            btn_widget.configure(
                text="✓ Profiles-এ যুক্ত",
                bg="#1e293b",
                fg="#34d399",
                cursor="arrow"
            )
            btn_widget.unbind("<Button-1>")
            btn_widget.unbind("<Enter>")
            btn_widget.unbind("<Leave>")
            
        if hasattr(self, "btn_add_all_profiles") and self.btn_add_all_profiles.winfo_exists() and hasattr(self, "_last_ext_statuses"):
            added_dirs = {p.get("chrome_profile") for p in self.config.get("profiles", [])}
            rem = sum(1 for s in self._last_ext_statuses if s.get("dir") not in added_dirs)
            if rem > 0:
                self.btn_add_all_profiles.configure(text=f"➕ বাকি {rem}টি Profiles-এ যুক্ত করুন", state="normal")
            else:
                self.btn_add_all_profiles.configure(text="✓ সব Profiles-এ যুক্ত", state="disabled")

    def _add_all_unadded_profiles_to_tab(self):
        if not hasattr(self, "_last_ext_statuses") or not self._last_ext_statuses:
            return
        existing_p = self.config.get("profiles", [])
        existing_dirs = {p.get("chrome_profile") for p in existing_p}
        max_id = max([p.get("id", 0) for p in existing_p], default=0)
        
        added_count = 0
        for s in self._last_ext_statuses:
            p_dir = s.get("dir", "")
            p_name = s.get("name", "")
            if p_dir and p_dir not in existing_dirs:
                max_id += 1
                existing_p.append({
                    "id": max_id,
                    "name": p_name or p_dir,
                    "chrome_profile": p_dir,
                    "enabled": True,
                    "phone": "",
                    "password": ""
                })
                existing_dirs.add(p_dir)
                added_count += 1
                
        if added_count > 0:
            self.config["profiles"] = existing_p
            self._save_config()
            self._profiles_tab_dirty = True
            
            # Instantly update all existing buttons in-place (0.1ms, no reload)
            for p_dir, btn_widget in getattr(self, "_ext_profile_row_widgets", {}).items():
                if btn_widget and btn_widget.winfo_exists() and str(btn_widget.cget("cursor")) == "hand2":
                    btn_widget.configure(
                        text="✓ Profiles-এ যুক্ত",
                        bg="#1e293b",
                        fg="#34d399",
                        cursor="arrow"
                    )
                    btn_widget.unbind("<Button-1>")
                    btn_widget.unbind("<Enter>")
                    btn_widget.unbind("<Leave>")
                    
            if hasattr(self, "btn_add_all_profiles") and self.btn_add_all_profiles.winfo_exists():
                self.btn_add_all_profiles.configure(text="✓ সব Profiles-এ যুক্ত", state="disabled")

    def _create_and_launch_chrome_profile(self):
        name = self.entry_chrome_profile_name.get().strip()
        if not name:
            from tkinter import messagebox
            messagebox.showwarning("Warning", "অনুগ্রহ করে প্রোফাইলের নাম লিখুন (যেমন: 30. MOHIR বা Counter 1)!")
            return
            
        if hasattr(self, "btn_create_profile"):
            self.btn_create_profile.configure(state="disabled", text="⏳ তৈরি হচ্ছে...")
        self.lbl_profile_status.configure(text="⚡ Chrome Profile ও বুকমার্ক তৈরি হচ্ছে...", text_color="#f59e0b")
        
        custom_bms = self.config.get("chrome_bookmarks", [])
        
        def _task():
            ext_path = cpm.get_default_extension_path(BASE_DIR)
            return cpm.create_chrome_profile(
                profile_name=name,
                custom_bookmarks=custom_bms,
                extension_path=ext_path,
                launch_now=True
            )
            
        def _on_done(res):
            if hasattr(self, "btn_create_profile"):
                self.btn_create_profile.configure(state="normal", text="🚀 Create & Launch Profile")
                
            if res.get("success"):
                p_name = res.get("profile_name")
                p_dir = res.get("profile_dir")
                
                # Automatically add to config["profiles"] so it appears in the Profiles tab!
                existing_p = self.config.get("profiles", [])
                if not any(p.get("chrome_profile") == p_dir for p in existing_p):
                    max_id = max([p.get("id", 0) for p in existing_p], default=0)
                    existing_p.append({
                        "id": max_id + 1,
                        "name": p_name,
                        "chrome_profile": p_dir,
                        "enabled": True,
                        "phone": "",
                        "password": ""
                    })
                    self.config["profiles"] = existing_p
                    self._save_config()
                    self._profiles_tab_dirty = True
                    
                status_msg = f"✅ প্রোফাইল '{p_name}' ({p_dir}) সফলভাবে তৈরি ও ওপেন হয়েছে! প্রোফাইল ট্যাবে যুক্ত হয়েছে।"
                self.lbl_profile_status.configure(
                    text=status_msg,
                    text_color="#10b981"
                )
                self.entry_chrome_profile_name.delete(0, "end")
                if hasattr(self, "_refresh_extension_profiles_list"):
                    self._refresh_extension_profiles_list()
            else:
                from tkinter import messagebox
                err = res.get("error", "Unknown error")
                self.lbl_profile_status.configure(text=f"❌ Error: {err}", text_color="#ef4444")
                messagebox.showerror("Error", f"Failed to create profile: {err}")
                
        self.run_in_background(_task, _on_done)

    def _refresh_bookmarks_ui(self):
        import tkinter as tk
        if not hasattr(self, "bm_list_frame") or not self.bm_list_frame.winfo_exists():
            return
            
        for w in self.bm_list_frame.winfo_children():
            w.destroy()
            
        bms = self.config.get("chrome_bookmarks", [])
        if not bms:
            tk.Label(
                self.bm_list_frame,
                text="কোনো অতিরিক্ত বুকমার্ক নেই। (উপরে উল্লিখিত ২ টি ডিফল্ট লিংক সবসময় থাকবে)",
                font=("Segoe UI", 9), fg="#64748b", bg="#0a192f"
            ).pack(anchor="w", padx=10, pady=8)
            return
            
        for idx, bm in enumerate(bms):
            row = tk.Frame(self.bm_list_frame, bg="#0a192f")
            row.pack(fill="x", padx=10, pady=3)
            
            tk.Label(
                row, text=f"🔗 {bm.get('name', '')}:",
                font=("Segoe UI", 9, "bold"), fg="#ccd6f6", bg="#0a192f"
            ).pack(side="left")
            
            tk.Label(
                row, text=bm.get("url", ""),
                font=("Segoe UI", 9), fg="#94a3b8", bg="#0a192f"
            ).pack(side="left", padx=(5, 10), fill="x", expand=True)
            
            del_btn = tk.Label(
                row, text="✕", font=("Segoe UI", 9, "bold"),
                bg="#ef4444", fg="white", padx=8, pady=2,
                cursor="hand2", relief="flat"
            )
            del_btn.pack(side="right")
            del_btn.bind("<Enter>", lambda e, b=del_btn: b.configure(bg="#dc2626"))
            del_btn.bind("<Leave>", lambda e, b=del_btn: b.configure(bg="#ef4444"))
            del_btn.bind("<Button-1>", lambda e, i=idx: self._delete_custom_bookmark(i))

    def _add_custom_bookmark(self):
        url = self.entry_new_bm_url.get().strip()
        if not url:
            from tkinter import messagebox
            messagebox.showwarning("Warning", "বুকমার্ক লিংক (URL) লিখুন!")
            return
            
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
            
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc or parsed.path
        if netloc.startswith("www."):
            netloc = netloc[4:]
        clean_name = netloc
        path_part = parsed.path.strip("/")
        if path_part and len(path_part) < 20:
            clean_name = f"{netloc}/{path_part}"
            
        if "chrome_bookmarks" not in self.config:
            self.config["chrome_bookmarks"] = []
            
        self.config["chrome_bookmarks"].append({"name": clean_name, "url": url})
        self._save_config()
        self.entry_new_bm_url.delete(0, "end")
        self._refresh_bookmarks_ui()

    def _delete_custom_bookmark(self, index: int):
        bms = self.config.get("chrome_bookmarks", [])
        if 0 <= index < len(bms):
            bms.pop(index)
            self._save_config()
            self._refresh_bookmarks_ui()

    def _update_all_profiles_extension(self):
        if cpm.is_chrome_running():
            from tkinter import messagebox
            ans = messagebox.askyesno(
                "Chrome ব্রাউজার বন্ধ করতে হবে",
                "Chrome ব্রাউজার বর্তমানে খোলা রয়েছে!\n\nসকল Chrome প্রোফাইলে এক্সটেনশন সফলভাবে আপডেট ও সক্রিয় করার জন্য খোলা থাকা Chrome বন্ধ করা আবশ্যক।\n\nআপনি কি এখনই খোলা থাকা Chrome বন্ধ করে সব প্রোফাইলে আপডেট নিশ্চিত করতে চান?"
            )
            if not ans:
                self.lbl_bulk_update_status.configure(
                    text="⚠️ Chrome বন্ধ করে আবার বাটনে চাপুন।", text_color="#f59e0b"
                )
                return

        if hasattr(self, "btn_bulk_update_ext"):
            self.btn_bulk_update_ext.configure(state="disabled", text="⏳ আপডেট হচ্ছে...")
        self.lbl_bulk_update_status.configure(text="🔄 সকল প্রোফাইলে এক্সটেনশন সিঙ্ক ও আপডেট হচ্ছে...", text_color="#f59e0b")

        def _task():
            if cpm.is_chrome_running():
                import subprocess, time
                subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True)
                time.sleep(1)
            return cpm.update_extension_in_all_profiles(BASE_DIR)
            
        def _on_done(res):
            if hasattr(self, "btn_bulk_update_ext"):
                self.btn_bulk_update_ext.configure(state="normal", text="🔄 সব প্রোফাইলে এক্সটেনশন আপডেট করুন")
                
            if hasattr(self, "_refresh_extension_profiles_list"):
                self._refresh_extension_profiles_list()
                
            if res.get("success"):
                count = res.get("count", 0)
                added = res.get("added", 0)
                reloaded = res.get("reloaded", 0)
                msg = f"✅ মোট {count}টি Chrome Profile: {added}টিতে নতুন যুক্ত এবং {reloaded}টিতে রিলোড ও সিঙ্ক করা হয়েছে!"
                self.lbl_bulk_update_status.configure(text=msg, text_color="#10b981")
                from tkinter import messagebox
                messagebox.showinfo("Success", f"{msg}\n\nএখন যেকোনো Chrome প্রোফাইল ওপেন করলে IVAC Master Pro এক্সটেনশনটি সরাসরি সক্রিয় দেখতে পাবেন।")
            else:
                from tkinter import messagebox
                err = res.get("error", "Unknown error")
                self.lbl_bulk_update_status.configure(text=f"❌ Error: {err}", text_color="#ef4444")
                messagebox.showerror("Error", f"আপডেট ব্যর্থ হয়েছে: {err}")

        self.run_in_background(_task, _on_done)

    
    # ===== SERVER =====
    def _start_server(self):
        """Flask SMS সার্ভার ব্যাকগ্রাউন্ডে চালু করে।"""
        if self.server_running:
            return
            
        def _bg_start():
            # Check if server is already running and healthy
            try:
                import requests
                r = requests.get("http://127.0.0.1:5000/api/status", timeout=0.3)
                if r.ok:
                    self.server_running = True
                    return
            except Exception:
                pass
                
            import subprocess, sys, os
            CREATE_NO_WINDOW = 0x08000000
            
            if getattr(sys, 'frozen', False):
                cmd = [sys.executable, "--run-server"]
            else:
                cmd = [sys.executable, os.path.abspath(__file__), "--run-server"]
                
            try:
                self.server_process = subprocess.Popen(
                    cmd,
                    creationflags=CREATE_NO_WINDOW
                )
                self.server_running = True
            except Exception as e:
                print(f"Subprocess start failed: {e}")
                
            # Fail-safe background thread check
            def ensure_server():
                import time, requests, threading
                time.sleep(1.5)
                try:
                    r = requests.get("http://127.0.0.1:5000/api/status", timeout=0.5)
                    if not r.ok:
                        raise Exception("Server not responding")
                except Exception:
                    try:
                        from sms_server import socketio, app
                        threading.Thread(
                            target=lambda: socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True, log_output=False),
                            daemon=True
                        ).start()
                    except Exception as ex:
                        print(f"Fallback thread failed: {ex}")

            threading.Thread(target=ensure_server, daemon=True).start()

        threading.Thread(target=_bg_start, daemon=True).start()

    def on_closing(self):
        if hasattr(self, 'server_process') and self.server_process:
            try:
                import subprocess
                # Use taskkill to kill the entire process tree, avoiding orphan background processes
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self.server_process.pid)],
                    creationflags=0x08000000,
                    check=False
                )
            except:
                pass
        self.destroy()

def main():
    import sys
    if "--run-server" in sys.argv:
        try:
            from sms_server import socketio, app
            socketio.run(
                app, host="0.0.0.0", port=5000,
                debug=False, allow_unsafe_werkzeug=True, log_output=False
            )
        except Exception as e:
            import traceback, os
            log_path = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill", "server_error.log")
            with open(log_path, "a") as f:
                f.write(traceback.format_exc() + "\\n")
        return

    app = IVACApp()
    app.mainloop()


if __name__ == "__main__":
    main()
