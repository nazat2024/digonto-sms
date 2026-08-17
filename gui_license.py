import customtkinter as ctk
from tkinter import messagebox
from license_system.license_manager import activate_license, LicenseStatus, LicenseInfo
from license_system.hwid import get_hwid_display

APP_VERSION = "3.0.0"
APP_AUTHOR = "DiGonto Tech"

class LicenseActivationWindow(ctk.CTkToplevel):
    """লাইসেন্স অ্যাক্টিভেশন উইন্ডো — প্রথমবার বা মেয়াদ শেষে দেখাবে।"""
    
    def __init__(self, parent, license_info: LicenseInfo, on_success_callback):
        super().__init__(parent)
        self.parent = parent
        self.on_success = on_success_callback
        self.license_info = license_info
        
        self.title("🔑 License Activation")
        self.geometry("480x420")
        self.resizable(False, False)
        self.grab_set()  # Modal window
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        
        # Center on screen
        self.update_idletasks()
        x = (self.winfo_screenwidth() - 480) // 2
        y = (self.winfo_screenheight() - 420) // 2
        self.geometry(f"480x420+{x}+{y}")
        
        self._build_ui()
    
    def _build_ui(self):
        # Header
        header = ctk.CTkFrame(self, fg_color="#1a1a2e", corner_radius=0, height=80)
        header.pack(fill="x")
        header.pack_propagate(False)
        
        ctk.CTkLabel(
            header, text="🇮🇳 IVAC Auto Fill Assistant",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color="#00d2ff"
        ).pack(pady=(15, 2))
        
        ctk.CTkLabel(
            header, text=f"v{APP_VERSION} | © {APP_AUTHOR}",
            font=ctk.CTkFont(size=11),
            text_color="#8892b0"
        ).pack()
        
        # Status message
        status_frame = ctk.CTkFrame(self, fg_color="transparent")
        status_frame.pack(fill="x", padx=20, pady=(15, 5))
        
        if self.license_info.status == LicenseStatus.EXPIRED:
            msg = "⏰ আপনার লাইসেন্সের মেয়াদ শেষ হয়ে গেছে!"
            color = "#ff6b6b"
        elif self.license_info.status == LicenseStatus.INVALID_DEVICE:
            msg = "🚫 এই লাইসেন্স অন্য কম্পিউটারে অ্যাক্টিভেট করা!"
            color = "#ff6b6b"
        else:
            msg = "🔑 সফটওয়্যার ব্যবহার করতে লাইসেন্স কোড দিন"
            color = "#ffd93d"
        
        ctk.CTkLabel(
            status_frame, text=msg,
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=color
        ).pack()
        
        # License Key Input
        input_frame = ctk.CTkFrame(self, fg_color="transparent")
        input_frame.pack(fill="x", padx=20, pady=(15, 5))
        
        ctk.CTkLabel(
            input_frame, text="License Key:",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#ccd6f6"
        ).pack(anchor="w")
        
        self.key_entry = ctk.CTkEntry(
            input_frame,
            placeholder_text="IVAC-XXXX-XXXX-XXXX-XXXX-XXXX",
            font=ctk.CTkFont(size=14, family="Consolas"),
            height=45,
            corner_radius=8,
            border_color="#233554"
        )
        self.key_entry.pack(fill="x", pady=(5, 0))
        
        # Activate Button
        self.activate_btn = ctk.CTkButton(
            self,
            text="✅ Activate License",
            font=ctk.CTkFont(size=14, weight="bold"),
            height=45,
            corner_radius=8,
            fg_color="#059669",
            hover_color="#047857",
            command=self._activate
        )
        self.activate_btn.pack(fill="x", padx=20, pady=(15, 5))
        
        # Result label
        self.result_label = ctk.CTkLabel(
            self, text="",
            font=ctk.CTkFont(size=12),
            text_color="#8892b0",
            wraplength=420
        )
        self.result_label.pack(padx=20, pady=(10, 5))
        
        # HWID Info
        hwid_frame = ctk.CTkFrame(self, fg_color="#1a1a2e", corner_radius=8)
        hwid_frame.pack(fill="x", padx=20, pady=(10, 15))
        
        ctk.CTkLabel(
            hwid_frame,
            text=f"💻 Device ID: {get_hwid_display()[:23]}...",
            font=ctk.CTkFont(size=10, family="Consolas"),
            text_color="#495670"
        ).pack(pady=8)
    
    def _activate(self):
        key = self.key_entry.get().strip()
        if not key:
            self.result_label.configure(text="❌ লাইসেন্স কোড দিন!", text_color="#ff6b6b")
            return
        
        self.activate_btn.configure(state="disabled", text="⏳ যাচাই করা হচ্ছে...")
        self.update()
        
        result = activate_license(key)
        
        if result.is_valid:
            self.result_label.configure(
                text=f"✅ সফল! প্ল্যান: {result.plan} | মেয়াদ: {result.expiry_date} ({result.remaining_text})",
                text_color="#059669"
            )
            self.after(1500, lambda: self._success(result))
        else:
            self.result_label.configure(
                text=result.error_message,
                text_color="#ff6b6b"
            )
            self.activate_btn.configure(state="normal", text="✅ Activate License")
    
    def _success(self, info):
        self.grab_release()
        self.destroy()
        self.on_success(info)
    
    def _on_close(self):
        self.grab_release()
        self.destroy()
        self.parent.destroy()
