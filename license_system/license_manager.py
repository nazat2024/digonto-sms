"""
IVAC Auto Fill — License Manager (Cloud Version)
Firebase Firestore এর সাথে রিয়েল-টাইম লাইসেন্স অ্যাক্টিভেশন এবং পেমেন্ট ট্র্যাকিং।
"""

import os
import json
import time
import requests
from datetime import datetime

from license_system.hwid import generate_hwid
from license_system.crypto import encrypt_data, decrypt_data

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
os.makedirs(APP_DATA_DIR, exist_ok=True)
LICENSE_FILE = os.path.join(APP_DATA_DIR, "license.dat")

# Firebase Configuration
PROJECT_ID = "ai-studio-applet-webapp-52a95"
DATABASE_ID = "ai-studio-90a5ddab-0968-4040-b54a-4863a2afafab"
API_KEY = "AIzaSyBR4sK1U3N_jwvO5Hr45lIv-0R_DM1kbMo"

BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents/ivac_licenses"

class LicenseStatus:
    NOT_ACTIVATED = "not_activated"
    ACTIVE = "active"
    EXPIRED = "expired"
    INVALID_DEVICE = "invalid_device"
    TAMPERED = "tampered"
    BLOCKED = "blocked"
    NETWORK_ERROR = "network_error"

class LicenseInfo:
    def __init__(self):
        self.status = LicenseStatus.NOT_ACTIVATED
        self.license_key = ""
        self.plan = "Standard"
        self.expiry_date = ""
        self.days_remaining = 0
        self.remaining_text = "0 দিন"
        self.remaining_short = "0d"
        self.hwid = ""
        self.payment_count = 0
        self.error_message = ""
    
    @property
    def is_valid(self):
        return self.status == LicenseStatus.ACTIVE
    
    def to_dict(self):
        return {
            "status": self.status,
            "license_key": self.license_key,
            "plan": self.plan,
            "expiry_date": self.expiry_date,
            "days_remaining": self.days_remaining,
            "is_valid": self.is_valid,
        }

def _parse_firestore_doc(data: dict) -> dict:
    """Firestore এর JSON রেসপন্সকে নরমাল ডিকশনারিতে কনভার্ট করে।"""
    fields = data.get("fields", {})
    result = {}
    for key, value in fields.items():
        if "stringValue" in value:
            result[key] = value["stringValue"]
        elif "integerValue" in value:
            result[key] = int(value["integerValue"])
        elif "nullValue" in value:
            result[key] = None
    return result

def check_license() -> LicenseInfo:
    """বর্তমান লাইসেন্স চেক করে (প্রথমে লোকাল ক্যাশ, পরে ক্লাউড)।"""
    info = LicenseInfo()
    
    if not os.path.exists(LICENSE_FILE):
        info.status = LicenseStatus.NOT_ACTIVATED
        info.error_message = "কোনো লাইসেন্স অ্যাক্টিভেট করা হয়নি।"
        return info
    
    try:
        with open(LICENSE_FILE, 'r', encoding='utf-8') as f:
            encrypted_data = f.read().strip()
        
        current_hwid = generate_hwid()
        
        try:
            decrypted = decrypt_data(encrypted_data, extra_key=current_hwid)
        except ValueError:
            info.status = LicenseStatus.INVALID_DEVICE
            info.error_message = "এই লাইসেন্স অন্য কম্পিউটারে অ্যাক্টিভেট করা হয়েছে!"
            return info
            
        license_data = json.loads(decrypted)
        license_key = license_data.get("license_key", "")
        
        # ক্লাউড থেকে লেটেস্ট স্ট্যাটাস চেক করো (যাতে ব্লক করা থাকলে ধরা পড়ে)
        try:
            res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
            if res.status_code == 200:
                cloud_data = _parse_firestore_doc(res.json())
                
                if cloud_data.get("status") == "blocked":
                    info.status = LicenseStatus.BLOCKED
                    info.error_message = "এই লাইসেন্সটি অ্যাডমিন দ্বারা ব্লক করা হয়েছে!"
                    return info
                    
                # Calculate expiry
                bound_at = cloud_data.get("bound_at")
                days = cloud_data.get("duration_days")
                if days is None:
                    months = cloud_data.get("duration_months", 1)
                    days = months * 30
                
                if bound_at:
                    expiry_ms = bound_at + (days * 24 * 60 * 60 * 1000)
                    now_ms = int(time.time() * 1000)
                    
                    if now_ms > expiry_ms:
                        info.status = LicenseStatus.EXPIRED
                        info.days_remaining = 0
                        info.error_message = "আপনার লাইসেন্সের মেয়াদ শেষ হয়ে গেছে।"
                        return info
                    
                    diff_ms = expiry_ms - now_ms
                    days = max(0, diff_ms // (1000 * 60 * 60 * 24))
                    info.days_remaining = days
                    
                    if diff_ms <= 0:
                        info.remaining_text = "0 দিন"
                        info.remaining_short = "0d"
                    elif days == 0:
                        hours = diff_ms // (1000 * 60 * 60)
                        minutes = (diff_ms % (1000 * 60 * 60)) // (1000 * 60)
                        if hours > 0:
                            info.remaining_text = f"{hours} ঘণ্টা {minutes} মিনিট"
                            info.remaining_short = f"{hours}h {minutes}m"
                        else:
                            info.remaining_text = f"{minutes} মিনিট"
                            info.remaining_short = f"{minutes}m"
                    else:
                        info.remaining_text = f"{days} দিন"
                        info.remaining_short = f"{days}d"
                    info.expiry_date = datetime.fromtimestamp(expiry_ms / 1000).strftime("%Y-%m-%d")
                    info.status = LicenseStatus.ACTIVE
                    info.license_key = license_key
                    info.hwid = current_hwid
                    return info
            elif res.status_code == 404:
                info.status = LicenseStatus.TAMPERED
                info.error_message = "লাইসেন্সটি সার্ভারে খুঁজে পাওয়া যায়নি।"
                return info
        except requests.exceptions.RequestException:
            pass # নেটওয়ার্ক না থাকলে লোকাল ক্যাশ ব্যবহার করবে
        
        # ফলব্যাক: লোকাল ক্যাশ (ইন্টারনেট না থাকলে)
        info.status = LicenseStatus.ACTIVE
        info.license_key = license_key
        info.hwid = current_hwid
        info.days_remaining = 1 # Temporary assume valid if offline
        info.remaining_text = "1 দিন"
        info.remaining_short = "1d"
        return info
        
    except Exception as e:
        info.status = LicenseStatus.TAMPERED
        info.error_message = f"লাইসেন্স যাচাই ব্যর্থ: {str(e)}"
        return info


def activate_license(license_key: str) -> LicenseInfo:
    """ক্লাউড থেকে লাইসেন্স অ্যাক্টিভেট করে এবং HWID বাইন্ড করে।"""
    info = LicenseInfo()
    current_hwid = generate_hwid()
    
    try:
        # ক্লাউড থেকে লাইসেন্স ফেচ করো
        res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=10)
        
        if res.status_code == 404:
            info.status = LicenseStatus.NOT_ACTIVATED
            info.error_message = "❌ ভুল লাইসেন্স কোড! দয়া করে সঠিক কোড দিন।"
            return info
            
        if res.status_code == 403:
            info.status = LicenseStatus.NETWORK_ERROR
            info.error_message = "❌ Firebase Permission Denied! দয়া করে Firestore Rules আপডেট করুন।"
            return info
            
        if res.status_code != 200:
            info.status = LicenseStatus.NETWORK_ERROR
            info.error_message = "❌ সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট কানেকশন চেক করুন।"
            return info
            
        cloud_data = _parse_firestore_doc(res.json())
        
        if cloud_data.get("status") == "blocked":
            info.status = LicenseStatus.BLOCKED
            info.error_message = "❌ এই লাইসেন্সটি ব্লক করা হয়েছে!"
            return info
            
        db_hwid = cloud_data.get("hwid")
        
        # যদি লাইসেন্সটি ইতিমধ্যে অন্য পিসিতে বাইন্ড করা থাকে
        if db_hwid and db_hwid != current_hwid:
            info.status = LicenseStatus.INVALID_DEVICE
            info.error_message = "❌ এই লাইসেন্সটি অন্য কম্পিউটারে ব্যবহার করা হচ্ছে!"
            return info
            
        now_ms = int(time.time() * 1000)
        bound_at = cloud_data.get("bound_at")
        days = cloud_data.get("duration_days")
        if days is None:
            months = cloud_data.get("duration_months", 1)
            days = months * 30
        
        # যদি এটি একদম নতুন লাইসেন্স হয় (HWID নেই)
        if not db_hwid:
            if not bound_at:
                bound_at = now_ms
            # Firestore এ HWID এবং bound_at আপডেট করো
            payload = {
                "fields": {
                    "hwid": {"stringValue": current_hwid},
                    "bound_at": {"integerValue": bound_at}
                }
            }
            params = {
                "key": API_KEY,
                "updateMask.fieldPaths": ["hwid", "bound_at"]
            }
            update_res = requests.patch(f"{BASE_URL}/{license_key}", json=payload, params=params, timeout=10)
            if update_res.status_code != 200:
                info.status = LicenseStatus.NETWORK_ERROR
                info.error_message = "❌ সার্ভারে ডিভাইস রেজিস্ট্রেশন ব্যর্থ হয়েছে!"
                return info
        
        # মেয়াদ চেক
        expiry_ms = bound_at + (days * 24 * 60 * 60 * 1000)
        if now_ms > expiry_ms:
            info.status = LicenseStatus.EXPIRED
            info.error_message = "⏰ এই লাইসেন্স কোডের মেয়াদ শেষ হয়ে গেছে!"
            return info
            
        # লোকাল ক্যাশে সেভ করো (যাতে অফলাইনেও কাজ করে)
        license_data = {
            "license_key": license_key,
            "hwid": current_hwid,
        }
        encrypted = encrypt_data(json.dumps(license_data), extra_key=current_hwid)
        
        with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
            f.write(encrypted)
            
        # সফল!
        info.status = LicenseStatus.ACTIVE
        info.license_key = license_key
        info.hwid = current_hwid
        
        diff_ms = expiry_ms - now_ms
        days = max(0, diff_ms // (1000 * 60 * 60 * 24))
        info.days_remaining = days
        
        if diff_ms <= 0:
            info.remaining_text = "0 দিন"
            info.remaining_short = "0d"
        elif days == 0:
            hours = diff_ms // (1000 * 60 * 60)
            minutes = (diff_ms % (1000 * 60 * 60)) // (1000 * 60)
            if hours > 0:
                info.remaining_text = f"{hours} ঘণ্টা {minutes} মিনিট"
                info.remaining_short = f"{hours}h {minutes}m"
            else:
                info.remaining_text = f"{minutes} মিনিট"
                info.remaining_short = f"{minutes}m"
        else:
            info.remaining_text = f"{days} দিন"
            info.remaining_short = f"{days}d"
            
        info.expiry_date = datetime.fromtimestamp(expiry_ms / 1000).strftime("%Y-%m-%d")
        
        return info
        
    except requests.exceptions.RequestException:
        info.status = LicenseStatus.NETWORK_ERROR
        info.error_message = "❌ ইন্টারনেট কানেকশন সমস্যা! লাইসেন্স অ্যাক্টিভেট করতে ইন্টারনেট প্রয়োজন।"
        return info
    except Exception as e:
        info.status = LicenseStatus.TAMPERED
        info.error_message = f"❌ অ্যাক্টিভেশন এরর: {str(e)}"
        return info


def deactivate_license():
    if os.path.exists(LICENSE_FILE):
        os.remove(LICENSE_FILE)
        return True
    return False

def get_masked_key(license_key: str) -> str:
    parts = license_key.split('-')
    if len(parts) >= 3:
        masked = parts[:2] + ['****'] * (len(parts) - 2)
        return '-'.join(masked)
    return license_key

def record_payment(amount: float, status: str, stage: str, rocket_account: str, description: str):
    """পেমেন্ট শুরু হলে বা সম্পন্ন হলে ক্লাউডে রেকর্ড তৈরি করে।"""
    if not os.path.exists(LICENSE_FILE):
        return None
        
    try:
        with open(LICENSE_FILE, 'r', encoding='utf-8') as f:
            encrypted_data = f.read().strip()
        current_hwid = generate_hwid()
        decrypted = decrypt_data(encrypted_data, extra_key=current_hwid)
        license_key = json.loads(decrypted).get("license_key", "")
        
        if not license_key:
            return None
            
        now = datetime.now()
        timestamp_ms = int(now.timestamp() * 1000)
        datetime_str = now.strftime("%Y-%m-%d %H:%M:%S")
        
        # 1. নতুন পেমেন্ট রেকর্ড তৈরি (Sub-collection: payments)
        payments_url = f"{BASE_URL}/{license_key}/payments"
        payload = {
            "fields": {
                "amount": {"doubleValue": float(amount)},
                "status": {"stringValue": status},
                "stage": {"stringValue": stage},
                "rocket_account": {"stringValue": rocket_account},
                "description": {"stringValue": description},
                "timestamp": {"integerValue": timestamp_ms},
                "datetime": {"stringValue": datetime_str}
            }
        }
        
        res = requests.post(f"{payments_url}?key={API_KEY}", json=payload, timeout=5)
        if res.status_code != 200:
            print(f"Failed to create payment record: {res.text}")
            return None
            
        doc_data = res.json()
        doc_name = doc_data.get("name") # e.g. projects/../databases/../documents/ivac_licenses/KEY/payments/AUTO_ID
        payment_id = doc_name.split("/")[-1] if doc_name else None
        
        # 2. Main document এর payment_count এবং total_amount আপডেট
        try:
            main_res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
            if main_res.status_code == 200:
                cloud_data = _parse_firestore_doc(main_res.json())
                current_count = cloud_data.get("payment_count", 0)
                current_total = cloud_data.get("total_amount", 0.0)
                
                update_payload = {
                    "fields": {
                        "payment_count": {"integerValue": current_count + 1},
                        "total_amount": {"doubleValue": float(current_total + amount)}
                    }
                }
                params = {
                    "key": API_KEY,
                    "updateMask.fieldPaths": ["payment_count", "total_amount"]
                }
                requests.patch(f"{BASE_URL}/{license_key}", json=update_payload, params=params, timeout=5)
        except Exception as inner_e:
            print(f"Failed to update total count/amount: {inner_e}")
            
        return payment_id
        
    except Exception as e:
        print(f"Payment tracking error: {e}")
        return None

def update_payment_stage(payment_id: str, stage: str, status: str = None):
    """ইতিমধ্যে তৈরি করা একটি পেমেন্ট রেকর্ডের স্টেজ এবং স্ট্যাটাস আপডেট করে।"""
    if not os.path.exists(LICENSE_FILE) or not payment_id:
        return False
        
    try:
        with open(LICENSE_FILE, 'r', encoding='utf-8') as f:
            encrypted_data = f.read().strip()
        current_hwid = generate_hwid()
        decrypted = decrypt_data(encrypted_data, extra_key=current_hwid)
        license_key = json.loads(decrypted).get("license_key", "")
        
        if not license_key:
            return False
            
        payment_doc_url = f"{BASE_URL}/{license_key}/payments/{payment_id}"
        
        update_fields = {
            "stage": {"stringValue": stage}
        }
        update_mask = ["stage"]
        
        if status:
            update_fields["status"] = {"stringValue": status}
            update_mask.append("status")
            
        payload = {
            "fields": update_fields
        }
        params = {
            "key": API_KEY,
            "updateMask.fieldPaths": update_mask
        }
        
        res = requests.patch(payment_doc_url, json=payload, params=params, timeout=5)
        return res.status_code == 200
        
    except Exception as e:
        print(f"Payment update error: {e}")
        return False

