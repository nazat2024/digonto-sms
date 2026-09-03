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
        myappid = 'digontotech.digontoquickfill.v4'
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

# ===== App Constants =====
APP_NAME = "Digonto QuickFill"
APP_VERSION = "4.0.0"
APP_AUTHOR = "DiGonto Tech"
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
        self.otp_data = {}
        self._expanded_phones = set()
        
        # Instant UI Launch (< 50ms) - No slow loading screen!
        self.loading_label = None
        self._start_gui_mqtt_listener()
        self._check_license_and_start()
    
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
            return self.config
        except Exception:
            self.config = {"profiles": [], "sim_mapping": {}, "rocket_accounts": []}
            return self.config
    
    def _save_config(self):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    def _lockout_license(self, error_msg="আপনার লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!"):
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
        
        ctk.CTkLabel(lock_frame, text="🚫", font=ctk.CTkFont(size=46)).pack(pady=(25, 4))
        ctk.CTkLabel(
            lock_frame, text="লাইসেন্স নিষ্ক্রিয় / ব্লক করা হয়েছে!",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#ef4444"
        ).pack(pady=3)
        
        self.lock_msg_label = ctk.CTkLabel(
            lock_frame, text=error_msg,
            font=ctk.CTkFont(size=13),
            text_color="#cbd5e1"
        )
        self.lock_msg_label.pack(pady=4)
        
        ctk.CTkLabel(
            lock_frame, text="এডমিন আনব্লক করামাত্রই সফটওয়্যারটি স্বয়ংক্রিয়ভাবে চালু হবে, অথবা নতুন লাইসেন্স কী দিন:",
            font=ctk.CTkFont(size=11),
            text_color="#8892b0"
        ).pack(pady=(0, 10))
        
        # IN-WINDOW LICENSE ACTIVATION CARD (NO SEPARATE POPUP!)
        card = ctk.CTkFrame(lock_frame, fg_color="#112240", corner_radius=10)
        card.pack(padx=25, pady=5, fill="x")
        
        ctk.CTkLabel(
            card, text="নতুন লাইসেন্স কী (License Key):",
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
            btn_row, text="🔑 অ্যাক্টিভেট করুন",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#059669", hover_color="#047857",
            height=34,
            command=self._activate_new_key_inline
        )
        self.activate_inline_btn.pack(side="left", fill="x", expand=True, padx=(0, 5))
        
        self.recheck_unblock_btn = ctk.CTkButton(
            btn_row, text="🔄 আনব্লক স্ট্যাটাস চেক",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#2563eb", hover_color="#1d4ed8",
            height=34,
            command=self._recheck_unblock_manually
        )
        self.recheck_unblock_btn.pack(side="right", fill="x", expand=True, padx=(5, 0))
        
        self.activate_status_label = ctk.CTkLabel(
            card, text="⏳ এডমিন আনব্লক করার অপেক্ষায়...",
            font=ctk.CTkFont(size=11),
            text_color="#f59e0b"
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
            self._lockout_license(info.error_message or "আপনার লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!")
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
            segmented_button_unselected_color="#233554"
        )
        self.tabview.pack(fill="both", expand=True, padx=10, pady=(5, 0))
        
        # Create tabs
        self.tab_home = self.tabview.add("🏠 Home")
        self.tab_otps = self.tabview.add("📨 Recent OTPs")
        self.tab_profiles = self.tabview.add("👥 Profiles")
        self.tab_settings = self.tabview.add("⚙️ Settings")
        self.tab_extension = self.tabview.add("🔌 Extension")
        self.tab_license = self.tabview.add("🔑 License")
        
        self._build_home_tab()
        self._build_otps_tab()
        self._build_profiles_tab()
        self._build_settings_tab()
        self._build_extension_tab()
        self._build_license_tab()
        
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
    
    # ===== HOME TAB =====
    def _build_home_tab(self):
        tab = self.tab_home
        
        # Cloud SMS Sync
        cloud_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        cloud_card.pack(fill="x", padx=5, pady=(5, 5))
        
        ctk.CTkLabel(
            cloud_card, text="☁️ Cloud SMS Forwarder",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00d2ff"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        import hashlib
        from license_system.hwid import generate_hwid
        hwid = generate_hwid()
        hash_hex = hashlib.md5(hwid.encode('utf-8')).hexdigest()
        nums = "".join(filter(str.isdigit, hash_hex))
        pairing_code = (nums + "123456")[:6]
        
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
        
        self.device_list_frame = ctk.CTkScrollableFrame(device_card, fg_color="transparent")
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
        self.otp_list_frame = ctk.CTkScrollableFrame(
            otp_card, fg_color="transparent", corner_radius=5
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
                time.sleep(1.0)
                
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
                            
            # 2. OTP UPDATE (Only re-render when OTPs or expanded state changes)
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
                    self.otp_count_label.configure(text=f"{len(otps)} টি")
                    for otp in otps:
                        self._add_otp_row(otp)
                else:
                    self.otp_count_label.configure(text="0 টি")
                    self.otp_placeholder = ctk.CTkLabel(
                        self.otp_list_frame,
                        text="⏳ কোনো OTP আসেনি...\nSMS Forwarder অ্যাপটি ওপেন করে SMS পাঠাতে দিন",
                        font=ctk.CTkFont(size=12),
                        text_color="#495670",
                        justify="center"
                    )
                    self.otp_placeholder.pack(pady=30)
            
            self.server_status_label.configure(text="🟢 Running", text_color="#64ffda")
            
            # 3. Check for real-time config updates
            server_cfg_version = data.get("config_version", 0)
            if server_cfg_version and server_cfg_version != getattr(self, '_last_config_version', 0):
                self._last_config_version = server_cfg_version
                self._load_config()
                if hasattr(self, '_refresh_profiles_tab'):
                    self._refresh_profiles_tab()
                if hasattr(self, '_refresh_rocket_list'):
                    self._refresh_rocket_list()
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
        tab = self.tab_profiles
        
        # Header
        header_frame = ctk.CTkFrame(tab, fg_color="transparent")
        header_frame.pack(fill="x", padx=5, pady=(5, 5))
        
        ctk.CTkLabel(
            header_frame, text="🧩 Chrome Profiles",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(side="left")
        
        # Launch All Button
        ctk.CTkButton(
            header_frame, text="🚀 সব ওপেন করুন",
            font=ctk.CTkFont(size=12, weight="bold"),
            width=120, height=32,
            fg_color="#059669", hover_color="#047857",
            command=self._launch_all_profiles
        ).pack(side="right")
        
        # Add Profile Button
        ctk.CTkButton(
            header_frame, text="➕ নতুন প্রোফাইল",
            font=ctk.CTkFont(size=12, weight="bold"),
            width=120, height=32,
            fg_color="#2563eb", hover_color="#1d4ed8",
            command=self._open_add_profile_dialog
        ).pack(side="right", padx=10)
        
        # Refresh Profiles Button
        ctk.CTkButton(
            header_frame, text="🔄 রিলোড",
            font=ctk.CTkFont(size=12, weight="bold"),
            width=80, height=32,
            fg_color="#4b5563", hover_color="#374151",
            command=self._refresh_profiles_tab
        ).pack(side="right")
        
        # Profile List Scrollable Frame
        self.profile_scroll = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        self.profile_scroll.pack(fill="both", expand=True, padx=5, pady=5)
        
        self._refresh_profiles_tab()
        
    def _refresh_profiles_tab(self):
        try:
            self._load_config()
        except Exception:
            pass
            
        for widget in self.profile_scroll.winfo_children():
            widget.destroy()
            
        profiles = self.config.get("profiles", [])
        if not profiles:
            ctk.CTkLabel(
                self.profile_scroll,
                text="কোনো প্রোফাইল যুক্ত করা হয়নি\n\nউপরে 'নতুন প্রোফাইল' বাটনে ক্লিক করে প্রোফাইল যুক্ত করুন",
                font=ctk.CTkFont(size=12),
                text_color="#495670",
                justify="center"
            ).pack(pady=40)
        else:
            for i, p in enumerate(profiles):
                self._add_profile_row(self.profile_scroll, p, i)
                
    def _add_profile_row(self, parent, profile, index):
        enabled = profile.get("enabled", True)
        name = profile.get("name", f"Profile {index + 1}")
        chrome_profile = profile.get("chrome_profile", "")
        phone = profile.get("phone", "")
        password = profile.get("password", "")
        
        row = ctk.CTkFrame(parent, fg_color="#112240", corner_radius=8, height=54)
        row.pack(fill="x", pady=3)
        row.pack_propagate(False)
        
        # Checkbox
        var = BooleanVar(value=enabled)
        ctk.CTkCheckBox(
            row, text="", variable=var,
            width=20,
            command=lambda: self._toggle_profile(index, var.get())
        ).pack(side="left", padx=(10, 5))
        
        # Name & Profile Dir & Mobile/Pass
        info_frame = ctk.CTkFrame(row, fg_color="transparent")
        info_frame.pack(side="left", fill="x", expand=True, padx=5)
        
        ctk.CTkLabel(
            info_frame, text=name,
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w")
        
        details_text = f"📁 {chrome_profile}"
        if phone:
            details_text += f"  •  📱 {phone}"
        if password:
            details_text += f"  •  🔓 {password}"
            
        ctk.CTkLabel(
            info_frame, text=details_text,
            font=ctk.CTkFont(size=10),
            text_color="#8892b0"
        ).pack(anchor="w")
        
        # Actions Frame
        actions_frame = ctk.CTkFrame(row, fg_color="transparent")
        actions_frame.pack(side="right", padx=10)
        
        # Edit Button
        ctk.CTkButton(
            actions_frame, text="✏️ Edit",
            width=55, height=28,
            font=ctk.CTkFont(size=11),
            fg_color="#1e3a8a", hover_color="#2563eb",
            command=lambda p=profile, i=index: self._open_edit_profile_dialog(p, i)
        ).pack(side="left", padx=(0, 5))
        
        # Launch Button
        ctk.CTkButton(
            actions_frame, text="🚀 Open",
            width=65, height=28,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#059669", hover_color="#047857",
            command=lambda p=profile: self._launch_profile(p)
        ).pack(side="left", padx=(0, 5))
        
        # Delete Button
        ctk.CTkButton(
            actions_frame, text="🗑️",
            width=28, height=28,
            font=ctk.CTkFont(size=13),
            fg_color="#991b1b", hover_color="#7f1d1d",
            command=lambda i=index: self._delete_profile(i)
        ).pack(side="left")
    
    def _toggle_profile(self, index, enabled):
        try:
            self.config["profiles"][index]["enabled"] = enabled
            self._save_config()
        except Exception:
            pass
    
    def _delete_profile(self, index):
        if messagebox.askyesno("Delete Profile", "আপনি কি নিশ্চিত যে এই প্রোফাইলটি ডিলিট করতে চান?"):
            try:
                self.config["profiles"].pop(index)
                self._save_config()
                self._refresh_profiles_tab()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to delete profile: {e}")
                
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
                requests.post("http://127.0.0.1:5000/api/profile/active", json={
                    "chrome_profile": chrome_profile,
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
        import subprocess, requests
        ext_path = os.path.join(BASE_DIR, "chrome_extension")
        profile_dir = profile.get("chrome_profile", "")
        phone = profile.get("phone", "")
        password = profile.get("password", "")
        
        # Notify local server about active launch credentials
        try:
            requests.post("http://127.0.0.1:5000/api/profile/active", json={
                "chrome_profile": profile_dir,
                "phone": phone,
                "password": password
            }, timeout=1)
        except Exception:
            pass
            
        self.config["active_profile"] = profile
        self._save_config()
        
        if profile_dir:
            profile_dir = self._format_profile_dir(profile_dir)
            cmd = f'start chrome.exe --profile-directory="{profile_dir}" --load-extension="{ext_path}" "https://appointment.ivacbd.com/signin"'
            subprocess.Popen(cmd, shell=True)
    
    def _launch_all_profiles(self):
        profiles = self.config.get("profiles", [])
        active = [p for p in profiles if p.get("enabled", True)]
        
        if not active:
            messagebox.showinfo("Info", "কোনো সক্রিয় প্রোফাইল নেই!")
            return
        
        import subprocess
        ext_path = os.path.join(BASE_DIR, "chrome_extension")
        
        for p in active:
            self._launch_profile(p)
            time.sleep(1)
    
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
        
        self.rocket_list_frame = ctk.CTkScrollableFrame(rocket_card, height=100, fg_color="#0a192f")
        self.rocket_list_frame.pack(fill="x", padx=15, pady=(0, 15))
        
        self._refresh_rocket_list()
    
    # ===== LICENSE TAB =====
    def _build_license_tab(self):
        tab = self.tab_license
        
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
        
        # Export Extension
        export_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        export_card.pack(fill="x", padx=5, pady=(5, 10))
        
        ctk.CTkLabel(
            export_card, text="📤 Chrome Extension",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            export_card, 
            text="এক্সটেনশন ফাইলটি ডেক্সটপে সেভ করুন এবং Chrome-এ 'Load unpacked' দিয়ে অ্যাড করুন।\n(সফটওয়্যারটি ব্যাকগ্রাউন্ডে চালু থাকলেই এক্সটেনশনটি কাজ করবে।)",
            font=ctk.CTkFont(size=11), text_color="#8892b0", justify="left"
        ).pack(anchor="w", padx=15, pady=(0, 10))
        
        ctk.CTkButton(
            export_card, text="Export Extension to Desktop",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#059669", hover_color="#047857",
            command=self._export_extension
        ).pack(fill="x", padx=15, pady=(0, 15))

    def _export_extension(self):
        import shutil, os
        from tkinter import messagebox
        from customtkinter import filedialog
        dest_dir = filedialog.askdirectory(title="এক্সটেনশন সেভ করার ফোল্ডার বেছে নিন")
        if not dest_dir:
            return
            
        ext_src = os.path.join(BASE_DIR, "chrome_extension")
        ext_dest = os.path.join(dest_dir, "IVAC_Chrome_Extension")
        
        try:
            if os.path.exists(ext_dest):
                shutil.rmtree(ext_dest)
            shutil.copytree(ext_src, ext_dest)
            messagebox.showinfo("Success", f"এক্সটেনশন সফলভাবে সেভ হয়েছে:\n{ext_dest}\n\nএখন Chrome-এ 'Load unpacked' দিয়ে এটি অ্যাড করুন।")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to export extension: {e}")
    
    # ===== SERVER =====
    def _start_server(self):
        """Flask SMS সার্ভার ব্যাকগ্রাউন্ডে চালু করে।"""
        if self.server_running:
            return
        
        # Check if server is already running and healthy
        try:
            import requests
            r = requests.get("http://127.0.0.1:5000/api/status", timeout=0.5)
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

        import threading
        threading.Thread(target=ensure_server, daemon=True).start()

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
