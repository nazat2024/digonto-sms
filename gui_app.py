"""
🖥️ IVAC Auto Fill Assistant — Desktop GUI Application
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
APP_NAME = "IVAC Auto Fill Assistant"
APP_VERSION = "3.0.0"
APP_AUTHOR = "DiGonto Tech"
UPDATE_URL = "https://digontoedu.com/api/update"

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
    """মূল অ্যাপ্লিকেশন উইন্ডো।"""
    
    def __init__(self):
        super().__init__()
        
        self.title(f"{APP_NAME} v{APP_VERSION}")
        self.geometry("700x580")
        self.protocol("WM_DELETE_WINDOW", self.on_closing)
        
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
        
        # License check first
        self._check_license_and_start()
    
    def _load_config(self):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {"profiles": [], "sim_mapping": {}}
    
    def _save_config(self):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    def _check_license_and_start(self):
        info = check_license()
        
        self.license_info = info
        self._build_main_ui()
        self._start_server()
        if not info.is_valid:
            # License window দেখাও
            self.withdraw()  # Main window লুকাও
            self.after(100, lambda: LicenseActivationWindow(
                self, info, self._on_license_activated
            ))
    
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
        
        ctk.CTkLabel(
            header_inner,
            text=f"🇮🇳 {APP_NAME}",
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
        self.tab_profiles = self.tabview.add("🧩 Profiles")
        self.tab_settings = self.tabview.add("⚙️ Settings")
        self.tab_extension = self.tabview.add("🔌 Extension")
        self.tab_license = self.tabview.add("🔑 License")
        
        self._build_home_tab()
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
        
        # Server Status Card
        server_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        server_card.pack(fill="x", padx=5, pady=(5, 5))
        
        card_header = ctk.CTkFrame(server_card, fg_color="transparent")
        card_header.pack(fill="x", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            card_header, text="📡 SMS Server",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(side="left")
        
        self.server_status_label = ctk.CTkLabel(
            card_header,
            text="🟢 Running",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#64ffda"
        )
        self.server_status_label.pack(side="right")
        
        server_details = ctk.CTkFrame(server_card, fg_color="transparent")
        server_details.pack(fill="x", padx=15, pady=(0, 10))
        
        self.server_info_label = ctk.CTkLabel(
            server_details,
            text=f"Port: 5000  |  SMS Endpoint: POST http://{get_local_ip()}:5000/api/sms",
            font=ctk.CTkFont(size=11),
            text_color="#8892b0"
        )
        self.server_info_label.pack(side="left")
        
        ctk.CTkButton(
            server_details, text="📋 Copy", width=50, height=24,
            font=ctk.CTkFont(size=10), fg_color="#233554", hover_color="#2a4365",
            command=self._copy_ip
        ).pack(side="right", padx=(5, 0))
        
        ctk.CTkButton(
            server_details, text="🔄 Refresh", width=50, height=24,
            font=ctk.CTkFont(size=10), fg_color="#233554", hover_color="#2a4365",
            command=self._refresh_ip
        ).pack(side="right")
        
        # JSON Payload Info
        payload_frame = ctk.CTkFrame(server_card, fg_color="#0a192f", corner_radius=6)
        payload_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        ctk.CTkLabel(
            payload_frame, text="📱 MacroDroid JSON Payload:",
            font=ctk.CTkFont(size=11, weight="bold"), text_color="#ccd6f6"
        ).pack(anchor="w", padx=10, pady=(5, 0))
        
        # Container for text and button side-by-side
        payload_inner = ctk.CTkFrame(payload_frame, fg_color="transparent")
        payload_inner.pack(fill="x", padx=10, pady=(0, 5))
        
        self.payload_text = '{\n  "phone": "01XXXXXXXXX",\n  "body": "{msg}"\n}'
        ctk.CTkLabel(
            payload_inner, text=self.payload_text,
            font=ctk.CTkFont(family="Consolas", size=12), text_color="#64ffda", justify="left"
        ).pack(side="left", pady=5)
        
        ctk.CTkButton(
            payload_inner, text="📋 Copy Code", width=80, height=24,
            font=ctk.CTkFont(size=11, weight="bold"), fg_color="#059669", hover_color="#047857",
            command=self._copy_payload
        ).pack(side="right", anchor="s", pady=5)
        
        # Recent OTPs Card
        otp_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        otp_card.pack(fill="both", expand=True, padx=5, pady=5)
        
        otp_header = ctk.CTkFrame(otp_card, fg_color="transparent")
        otp_header.pack(fill="x", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            otp_header, text="📊 Recent OTPs",
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
        self.otp_count_label.pack(side="right")
        
        # OTP Scrollable list
        self.otp_list_frame = ctk.CTkScrollableFrame(
            otp_card, fg_color="transparent", corner_radius=5
        )
        self.otp_list_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        
        self.otp_placeholder = ctk.CTkLabel(
            self.otp_list_frame,
            text="⏳ কোনো OTP আসেনি...\nSMS Forwarder অ্যাপ থেকে SMS পাঠান",
            font=ctk.CTkFont(size=12),
            text_color="#495670",
            justify="center"
        )
        self.otp_placeholder.pack(pady=30)
        
        # Auto-refresh OTP list
        self._refresh_otps()
        
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
        if messagebox.askyesno("Clear All", "আপনি কি নিশ্চিত যে সব OTP মুছে ফেলতে চান?"):
            import requests
            try:
                requests.post("http://127.0.0.1:5000/api/clear", timeout=2)
                self._refresh_otps()
            except:
                pass
    
    def _refresh_otps(self):
        """OTP তালিকা রিফ্রেশ করে (প্রতি ২ সেকেন্ডে)।"""
        try:
            import requests
            resp = requests.get("http://127.0.0.1:5000/api/status", timeout=1)
            if resp.ok:
                data = resp.json()
                otps = data.get("otps", [])
                
                # Clear old
                for widget in self.otp_list_frame.winfo_children():
                    widget.destroy()
                
                if otps:
                    self.otp_count_label.configure(text=f"{len(otps)} টি")
                    for otp in otps:
                        self._add_otp_row(otp)
                else:
                    self.otp_placeholder = ctk.CTkLabel(
                        self.otp_list_frame,
                        text="⏳ কোনো OTP আসেনি...",
                        font=ctk.CTkFont(size=12),
                        text_color="#495670"
                    )
                    self.otp_placeholder.pack(pady=30)
                
                self.server_status_label.configure(text="🟢 Running", text_color="#64ffda")
            else:
                self.server_status_label.configure(text="🔴 Error", text_color="#ff6b6b")
        except Exception:
            pass
        
        self.after(2000, self._refresh_otps)
    
    def _add_otp_row(self, otp_data):
        row = ctk.CTkFrame(self.otp_list_frame, fg_color="#1a1a2e", corner_radius=6, height=40)
        row.pack(fill="x", pady=2)
        row.pack_propagate(False)
        
        phone = otp_data.get("phone", "?")
        display = otp_data.get("display", "?")
        used = otp_data.get("used", False)
        
        icon = "✅" if not used else "⬜"
        color = "#64ffda" if not used else "#495670"
        
        ctk.CTkLabel(
            row, text=f"  {icon}  📱 {phone}",
            font=ctk.CTkFont(size=12),
            text_color="#8892b0"
        ).pack(side="left", padx=5)
        
        ctk.CTkLabel(
            row, text=f"  {display}  ",
            font=ctk.CTkFont(size=14, weight="bold", family="Consolas"),
            text_color=color
        ).pack(side="right", padx=10)
    
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
        
        # Profile List Scrollable Frame
        self.profile_scroll = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        self.profile_scroll.pack(fill="both", expand=True, padx=5, pady=5)
        
        self._refresh_profiles_tab()
        
    def _refresh_profiles_tab(self):
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
        
        row = ctk.CTkFrame(parent, fg_color="#112240", corner_radius=8, height=50)
        row.pack(fill="x", pady=3)
        row.pack_propagate(False)
        
        # Checkbox
        var = BooleanVar(value=enabled)
        ctk.CTkCheckBox(
            row, text="", variable=var,
            width=20,
            command=lambda: self._toggle_profile(index, var.get())
        ).pack(side="left", padx=(10, 5))
        
        # Name & Profile Dir
        info_frame = ctk.CTkFrame(row, fg_color="transparent")
        info_frame.pack(side="left", fill="x", expand=True, padx=5)
        
        ctk.CTkLabel(
            info_frame, text=name,
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w")
        
        ctk.CTkLabel(
            info_frame, text=chrome_profile,
            font=ctk.CTkFont(size=10),
            text_color="#495670"
        ).pack(anchor="w")
        
        # Actions Frame
        actions_frame = ctk.CTkFrame(row, fg_color="transparent")
        actions_frame.pack(side="right", padx=10)
        
        # Launch Button
        ctk.CTkButton(
            actions_frame, text="🚀 Open",
            width=70, height=30,
            font=ctk.CTkFont(size=11),
            fg_color="#233554", hover_color="#059669",
            command=lambda p=profile: self._launch_profile(p)
        ).pack(side="left", padx=(0, 5))
        
        # Delete Button
        ctk.CTkButton(
            actions_frame, text="🗑️",
            width=30, height=30,
            font=ctk.CTkFont(size=14),
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
        dialog.geometry("450x380")
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()
        
        ctk.CTkLabel(
            dialog, text="গ্রাহকের নাম (Profile Name):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(20, 5))
        
        name_entry = ctk.CTkEntry(dialog, width=400, placeholder_text="যেমন: MD REZHANUL HAQUE")
        name_entry.pack(padx=20, pady=5)
        
        ctk.CTkLabel(
            dialog, text="Chrome Profile ফোল্ডারের নাম:",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", padx=20, pady=(15, 5))
        
        dir_entry = ctk.CTkEntry(dialog, width=400, placeholder_text="যেমন: Profile 1, Profile 2, Default")
        dir_entry.pack(padx=20, pady=5)
        
        tip_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        tip_frame.pack(fill="x", padx=20, pady=(10, 5))
        
        ctk.CTkLabel(
            tip_frame, 
            text="💡 সঠিক Profile Name জানতে ক্রোম ব্রাউজারে নিচের\nURL টি ওপেন করুন এবং 'Profile Path' এর শেষের নাম দিন:",
            font=ctk.CTkFont(size=11),
            text_color="#9ca3af",
            justify="left"
        ).pack(anchor="w", pady=(0, 5))
        
        url_frame = ctk.CTkFrame(tip_frame, fg_color="#112240", corner_radius=5)
        url_frame.pack(fill="x", pady=2)
        
        ctk.CTkLabel(
            url_frame, text="chrome://version/",
            font=ctk.CTkFont(family="Consolas", size=12),
            text_color="#64ffda"
        ).pack(side="left", padx=10, pady=5)
        
        def copy_url():
            dialog.clipboard_clear()
            dialog.clipboard_append("chrome://version/")
            copy_btn.configure(text="✅ Copied", fg_color="#059669")
            dialog.after(2000, lambda: copy_btn.configure(text="📋 Copy", fg_color="#233554"))
            
        copy_btn = ctk.CTkButton(
            url_frame, text="📋 Copy", width=60, height=24,
            font=ctk.CTkFont(size=11), fg_color="#233554", hover_color="#059669",
            command=copy_url
        )
        copy_btn.pack(side="right", padx=5, pady=5)
        
        def save_new():
            name = name_entry.get().strip()
            chrome_profile = dir_entry.get().strip()
            if not name or not chrome_profile:
                messagebox.showwarning("Warning", "সবগুলো ফিল্ড পূরণ করুন!")
                return
            
            if "profiles" not in self.config:
                self.config["profiles"] = []
                
            new_id = len(self.config["profiles"]) + 1
            self.config["profiles"].append({
                "id": new_id,
                "name": name,
                "chrome_profile": chrome_profile,
                "enabled": True,
                "phone": "",
                "password": ""
            })
            self._save_config()
            self._refresh_profiles_tab()
            dialog.destroy()
            
        ctk.CTkButton(
            dialog, text="✅ সেভ করুন",
            fg_color="#059669", hover_color="#047857",
            command=save_new
        ).pack(pady=25)
        
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
        import subprocess
        ext_path = os.path.join(BASE_DIR, "chrome_extension")
        profile_dir = profile.get("chrome_profile", "")
        
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
            profile_dir = p.get("chrome_profile", "")
            if profile_dir:
                profile_dir = self._format_profile_dir(profile_dir)
                cmd = f'start chrome.exe --profile-directory="{profile_dir}" --load-extension="{ext_path}" "https://appointment.ivacbd.com/signin"'
                subprocess.Popen(cmd, shell=True)
                time.sleep(1)
    
    # ===== SETTINGS TAB =====
    def _build_settings_tab(self):
        tab = self.tab_settings
        
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
        
        # Rocket Config (Moved from Extension Tab)
        rocket_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        rocket_card.pack(fill="x", padx=5, pady=(5, 5))
        
        ctk.CTkLabel(
            rocket_card, text="📱 DBBL Rocket Accounts",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        ctk.CTkLabel(
            rocket_card, text="আপনার রকেট নম্বর এবং পিন সেভ করুন। এক্সটেনশন এখান থেকে নম্বর সিঙ্ক করে নেবে।",
            font=ctk.CTkFont(size=11), text_color="#8892b0"
        ).pack(anchor="w", padx=15, pady=(0, 10))
        
        input_frame = ctk.CTkFrame(rocket_card, fg_color="transparent")
        input_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        self.rocket_num_entry = ctk.CTkEntry(input_frame, placeholder_text="Rocket Number (12 digit)", width=200)
        self.rocket_num_entry.pack(side="left", padx=(0, 10))
        
        self.rocket_pin_entry = ctk.CTkEntry(input_frame, placeholder_text="PIN", show="*", width=100)
        self.rocket_pin_entry.pack(side="left", padx=(0, 10))
        
        ctk.CTkButton(
            input_frame, text="Add", width=60,
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

    def _add_rocket_account(self):
        num = self.rocket_num_entry.get().strip()
        pin = self.rocket_pin_entry.get().strip()
        if len(num) != 12 or not num.isdigit():
            messagebox.showerror("Error", "Rocket নম্বর ১২ ডিজিটের হতে হবে!")
            return
        if not pin:
            messagebox.showerror("Error", "PIN দিতে হবে!")
            return
        
        accounts = self.config.get("rocket_accounts", [])
        if any(a.get("number") == num for a in accounts):
            messagebox.showerror("Error", "এই নম্বরটি আগেই যোগ করা হয়েছে!")
            return
            
        import uuid
        accounts.append({
            "id": str(uuid.uuid4()),
            "number": num,
            "pin": pin
        })
        self.config["rocket_accounts"] = accounts
        self._save_config()
        self.rocket_num_entry.delete(0, 'end')
        self.rocket_pin_entry.delete(0, 'end')
        self._refresh_rocket_list()
        
    def _delete_rocket_account(self, acc_id):
        accounts = self.config.get("rocket_accounts", [])
        self.config["rocket_accounts"] = [a for a in accounts if a.get("id") != acc_id]
        self._save_config()
        self._refresh_rocket_list()
        
    def _refresh_rocket_list(self):
        for w in self.rocket_list_frame.winfo_children():
            w.destroy()
        
        accounts = self.config.get("rocket_accounts", [])
        if not accounts:
            ctk.CTkLabel(self.rocket_list_frame, text="No accounts added yet", text_color="#495670").pack(pady=10)
            return
            
        for acc in accounts:
            row = ctk.CTkFrame(self.rocket_list_frame, fg_color="transparent")
            row.pack(fill="x", pady=2)
            ctk.CTkLabel(row, text=f"{acc['number']} (***)", text_color="#ccd6f6").pack(side="left", padx=5)
            ctk.CTkButton(
                row, text="Delete", width=50, fg_color="#ef4444", hover_color="#dc2626", height=24,
                command=lambda aid=acc['id']: self._delete_rocket_account(aid)
            ).pack(side="right", padx=5)

    def _export_extension(self):
        import shutil, os
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
    
    # ===== UPDATE TAB =====
    def _build_update_tab(self):
        tab = self.tab_update
        
        # Current Version
        ver_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        ver_card.pack(fill="x", padx=5, pady=(5, 5))
        
        ctk.CTkLabel(
            ver_card, text="🔄 Software Update",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        self.update_version_label = ctk.CTkLabel(
            ver_card,
            text=f"বর্তমান ভার্সন: v{APP_VERSION}",
            font=ctk.CTkFont(size=12),
            text_color="#8892b0"
        )
        self.update_version_label.pack(anchor="w", padx=15, pady=(0, 5))
        
        self.update_status_label = ctk.CTkLabel(
            ver_card,
            text="আপডেট চেক করতে নিচের বাটনে ক্লিক করুন",
            font=ctk.CTkFont(size=11),
            text_color="#495670"
        )
        self.update_status_label.pack(anchor="w", padx=15, pady=(0, 10))
        
        # Check Update Button
        self.check_update_btn = ctk.CTkButton(
            tab, text="🔍 Check for Update",
            font=ctk.CTkFont(size=13, weight="bold"),
            height=42,
            fg_color="#059669", hover_color="#047857",
            command=self._check_update
        )
        self.check_update_btn.pack(fill="x", padx=5, pady=5)
        
        # Update Progress
        self.update_progress = ctk.CTkProgressBar(tab, mode="indeterminate")
        self.update_progress.pack(fill="x", padx=5, pady=5)
        self.update_progress.pack_forget()  # Hide initially
        
        # Changelog
        changelog_card = ctk.CTkFrame(tab, fg_color="#112240", corner_radius=10)
        changelog_card.pack(fill="both", expand=True, padx=5, pady=5)
        
        ctk.CTkLabel(
            changelog_card, text="📋 Changelog",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#8892b0"
        ).pack(anchor="w", padx=15, pady=(10, 5))
        
        self.changelog_text = ctk.CTkTextbox(
            changelog_card, font=ctk.CTkFont(size=11),
            fg_color="#0a192f", text_color="#8892b0",
            corner_radius=5, height=120
        )
        self.changelog_text.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.changelog_text.insert("end", "আপডেট চেক করলে এখানে পরিবর্তনের তালিকা দেখাবে।")
        self.changelog_text.configure(state="disabled")
    
    def _check_update(self):
        self.check_update_btn.configure(state="disabled", text="⏳ চেক করা হচ্ছে...")
        self.update_progress.pack(fill="x", padx=5, pady=5)
        self.update_progress.start()
        
        def check():
            try:
                import requests
                resp = requests.get(UPDATE_URL, timeout=10)
                if resp.ok:
                    data = resp.json()
                    latest = data.get("version", APP_VERSION)
                    changelog = data.get("changelog", "কোনো তথ্য নেই")
                    download_url = data.get("download_url", "")
                    
                    self.after(0, lambda: self._show_update_result(latest, changelog, download_url))
                else:
                    self.after(0, lambda: self._show_update_error("সার্ভার থেকে তথ্য আনা যায়নি।"))
            except Exception as e:
                self.after(0, lambda: self._show_update_error(f"আপডেট সার্ভারে সংযোগ করা যায়নি।\n({str(e)})"))
        
        threading.Thread(target=check, daemon=True).start()
    
    def _show_update_result(self, latest, changelog, download_url):
        self.update_progress.stop()
        self.update_progress.pack_forget()
        self.check_update_btn.configure(state="normal", text="🔍 Check for Update")
        
        if latest > APP_VERSION:
            self.update_status_label.configure(
                text=f"⬆️ নতুন ভার্সন পাওয়া গেছে: v{latest}",
                text_color="#64ffda"
            )
            if download_url:
                self.check_update_btn.configure(
                    text="📥 Download Update",
                    command=lambda: webbrowser.open(download_url)
                )
        else:
            self.update_status_label.configure(
                text="✅ আপনি সর্বশেষ ভার্সন ব্যবহার করছেন!",
                text_color="#059669"
            )
        
        self.changelog_text.configure(state="normal")
        self.changelog_text.delete("1.0", "end")
        self.changelog_text.insert("end", changelog)
        self.changelog_text.configure(state="disabled")
    
    def _show_update_error(self, msg):
        self.update_progress.stop()
        self.update_progress.pack_forget()
        self.check_update_btn.configure(state="normal", text="🔍 Check for Update")
        self.update_status_label.configure(text=f"❌ {msg}", text_color="#ff6b6b")
    
    # ===== SERVER =====
    def _start_server(self):
        """Flask SMS সার্ভার ব্যাকগ্রাউন্ডে চালু করে।"""
        if self.server_running:
            return
        
        import subprocess, sys
        # sys.executable is the PyInstaller .exe
        CREATE_NO_WINDOW = 0x08000000
        self.server_process = subprocess.Popen(
            [sys.executable, "--run-server"],
            creationflags=CREATE_NO_WINDOW
        )
        self.server_running = True

    def on_closing(self):
        if hasattr(self, 'server_process') and self.server_process:
            try:
                self.server_process.kill()
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
