import threading
"""
IVAC Auto Fill — License Manager (Cloud Version)
Firebase Firestore এর সাথে রিয়েল-টাইম লাইসেন্স অ্যাক্টিভেশন এবং পেমেন্ট ট্র্যাকিং।
"""

import os
import json
import time
import requests
from datetime import datetime

from license_system.hwid import generate_hwid, get_legacy_hwid, get_all_candidate_legacy_hwids
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

def _bg_cloud_sync(license_key, current_hwid):
    """Silent background check to keep license cache fresh without blocking startup"""
    try:
        res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
        if res.status_code == 200:
            cloud_data = _parse_firestore_doc(res.json())
            bound_at = cloud_data.get("bound_at")
            days = cloud_data.get("duration_days")
            if days is None:
                months = cloud_data.get("duration_months", 1)
                days = months * 30
            if bound_at:
                expiry_ms = bound_at + (days * 24 * 60 * 60 * 1000)
                plan = cloud_data.get("plan", "Standard")
                status = cloud_data.get("status", "active")
                new_data = {
                    "license_key": license_key,
                    "hwid": current_hwid,
                    "expiry_ms": expiry_ms,
                    "plan": plan,
                    "status": status
                }
                encrypted = encrypt_data(json.dumps(new_data), extra_key=current_hwid)
                with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
                    f.write(encrypted)
    except Exception:
        pass

def _sync_with_cloud(license_key, current_hwid, license_data):
    info = LicenseInfo()
    info.license_key = license_key
    info.hwid = current_hwid
    try:
        res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
        if res.status_code == 200:
            cloud_data = _parse_firestore_doc(res.json())
            if cloud_data.get("status") == "blocked":
                info.status = LicenseStatus.BLOCKED
                info.error_message = "এই লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!"
                return info
                
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
                    info.error_message = "আপনার লাইসেন্সের মেয়াদ শেষ হয়ে গেছে!"
                    return info
                
                diff_ms = expiry_ms - now_ms
                rem_days = max(0, diff_ms // (1000 * 60 * 60 * 24))
                info.days_remaining = rem_days
                info.status = LicenseStatus.ACTIVE
                info.license_key = license_key
                info.hwid = current_hwid
                info.plan = cloud_data.get("plan", "Standard")
                info.expiry_date = datetime.fromtimestamp(expiry_ms / 1000).strftime("%Y-%m-%d")
                
                if diff_ms <= 0:
                    info.remaining_text = "0 দিন"
                    info.remaining_short = "0d"
                elif rem_days == 0:
                    hours = diff_ms // (1000 * 60 * 60)
                    minutes = (diff_ms % (1000 * 60 * 60)) // (1000 * 60)
                    if hours > 0:
                        info.remaining_text = f"{hours} ঘন্টা {minutes} মিনিট"
                        info.remaining_short = f"{hours}h {minutes}m"
                    else:
                        info.remaining_text = f"{minutes} মিনিট"
                        info.remaining_short = f"{minutes}m"
                else:
                    info.remaining_text = f"{rem_days} দিন"
                    info.remaining_short = f"{rem_days}d"
                
                # Cache expiry_ms so next launch is instant!
                license_data["expiry_ms"] = expiry_ms
                license_data["plan"] = info.plan
                license_data["status"] = "active" 
                try:
                    encrypted = encrypt_data(json.dumps(license_data), extra_key=current_hwid)
                    with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
                        f.write(encrypted)
                except Exception:
                    pass
                return info
        elif res.status_code == 404:
            info.status = LicenseStatus.TAMPERED
            info.error_message = "লাইসেন্সটি ডাটাবেজে পাওয়া যায়নি!"
            return info
    except Exception:
        pass
        
    # Offline fallback
    info.status = LicenseStatus.ACTIVE
    info.license_key = license_key
    info.hwid = current_hwid
    info.days_remaining = 1
    info.remaining_text = "1 দিন"
    info.remaining_short = "1d"
    return info

def mark_license_blocked_locally(license_key: str):
    """Instantly mark local license.dat as blocked"""
    try:
        current_hwid = generate_hwid()
        data = {
            "license_key": license_key,
            "hwid": current_hwid,
            "status": "blocked",
            "expiry_ms": 0
        }
        encrypted = encrypt_data(json.dumps(data), extra_key=current_hwid)
        with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
            f.write(encrypted)
    except Exception:
        pass

def check_license(force_cloud: bool = False) -> LicenseInfo:
    """Ultra-fast instant local license check (< 1ms) with asynchronous cloud sync"""
    info = LicenseInfo()
    
    if not os.path.exists(LICENSE_FILE):
        info.status = LicenseStatus.NOT_ACTIVATED
        info.error_message = "কোনো লাইসেন্স অ্যাক্টিভেট করা নেই!"
        return info
        
    try:
        with open(LICENSE_FILE, 'r', encoding='utf-8') as f:
            encrypted_data = f.read().strip()
            
        current_hwid = generate_hwid()
        decrypted = None
        migrated_from_legacy = False
        
        # 1. চেষ্টা করো বর্তমান স্থায়ী HWID দিয়ে ডিক্রিপ্ট করতে
        try:
            decrypted = decrypt_data(encrypted_data, extra_key=current_hwid)
        except ValueError:
            pass
            
        # 2. যদি ব্যর্থ হয়, লিগ্যাসি (পুরনো) HWID বা কোনো অল্টারনেটিভ অ্যাডাপ্টারের HWID দিয়ে চেষ্টা করো
        if not decrypted:
            candidate_hwids = get_all_candidate_legacy_hwids()
            for cand in candidate_hwids:
                try:
                    decrypted = decrypt_data(encrypted_data, extra_key=cand)
                    if decrypted:
                        migrated_from_legacy = True
                        break
                except ValueError:
                    continue
                    
        # 3. যদি এখনো ডিক্রিপ্ট না হয়, তবে এটি সত্যিই অন্য ডিভাইসের লাইসেন্স
        if not decrypted:
            info.status = LicenseStatus.INVALID_DEVICE
            info.error_message = "এই লাইসেন্স অন্য ডিভাইসের জন্য ইস্যু করা হয়েছিল!"
            return info
            
        license_data = json.loads(decrypted)
        license_key = license_data.get("license_key", "")
        info.license_key = license_key
        info.hwid = current_hwid
        plan = license_data.get("plan", "Standard")
        expiry_ms = license_data.get("expiry_ms")
        status = license_data.get("status", "active")
        
        # 4. লিগ্যাসি থেকে স্বয়ংক্রিয়ভাবে নতুন স্থায়ী HWID-তে মাইগ্রেট করো
        if migrated_from_legacy:
            license_data["hwid"] = current_hwid
            try:
                new_encrypted = encrypt_data(json.dumps(license_data), extra_key=current_hwid)
                with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
                    f.write(new_encrypted)
                    
                def _update_cloud_hwid(key, nhwid):
                    try:
                        payload = {"fields": {"hwid": {"stringValue": nhwid}}}
                        params = {"key": API_KEY, "updateMask.fieldPaths": ["hwid"]}
                        requests.patch(f"{BASE_URL}/{key}", json=payload, params=params, timeout=5)
                    except Exception:
                        pass
                threading.Thread(target=_update_cloud_hwid, args=(license_key, current_hwid), daemon=True).start()
            except Exception:
                pass
        
        if status == "blocked" or force_cloud:
            # Always check with cloud if blocked locally, in case admin unblocked it!
            return _sync_with_cloud(license_key, current_hwid, license_data)
            
        now_ms = int(time.time() * 1000)
        
        # 1. INSTANT LOCAL VALIDATION (Takes < 1 millisecond!)
        if expiry_ms and not force_cloud:
            if now_ms > expiry_ms:
                info.status = LicenseStatus.EXPIRED
                info.days_remaining = 0
                info.error_message = "আপনার লাইসেন্সের মেয়াদ শেষ হয়ে গেছে!"
                return info
                
            diff_ms = expiry_ms - now_ms
            days = max(0, diff_ms // (1000 * 60 * 60 * 24))
            info.days_remaining = days
            info.plan = plan
            info.expiry_date = datetime.fromtimestamp(expiry_ms / 1000).strftime("%Y-%m-%d")
            info.status = LicenseStatus.ACTIVE
            info.license_key = license_key
            info.hwid = current_hwid
            
            if diff_ms <= 0:
                info.remaining_text = "0 দিন"
                info.remaining_short = "0d"
            elif days == 0:
                hours = diff_ms // (1000 * 60 * 60)
                minutes = (diff_ms % (1000 * 60 * 60)) // (1000 * 60)
                if hours > 0:
                    info.remaining_text = f"{hours} ঘন্টা {minutes} মিনিট"
                    info.remaining_short = f"{hours}h {minutes}m"
                else:
                    info.remaining_text = f"{minutes} মিনিট"
                    info.remaining_short = f"{minutes}m"
            else:
                info.remaining_text = f"{days} দিন"
                info.remaining_short = f"{days}d"
                
            # Silent async background sync (App launches instantly without waiting for cloud)
            threading.Thread(target=_bg_cloud_sync, args=(license_key, current_hwid), daemon=True).start()
            return info
            
        # 2. CLOUD SYNC (Only if expiry_ms not yet cached)
        return _sync_with_cloud(license_key, current_hwid, license_data)
        
    except Exception as e:
        info.status = LicenseStatus.TAMPERED
        info.error_message = f"লাইসেন্স ফাইল নষ্ট: {str(e)}"
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
            candidate_hwids = get_all_candidate_legacy_hwids()
            if db_hwid in candidate_hwids:
                # এই পিসিরই পুরনো লিগ্যাসি HWID ছিল, স্বয়ংক্রিয়ভাবে নতুন স্থায়ী HWID তে মাইগ্রেট করো!
                try:
                    payload = {"fields": {"hwid": {"stringValue": current_hwid}}}
                    params = {"key": API_KEY, "updateMask.fieldPaths": ["hwid"]}
                    requests.patch(f"{BASE_URL}/{license_key}", json=payload, params=params, timeout=10)
                    db_hwid = current_hwid
                except Exception:
                    pass
            else:
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
            "expiry_ms": expiry_ms,
            "plan": cloud_data.get("plan", "Standard"),
            "bound_at": bound_at,
            "duration_days": days
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

def record_payment(amount: float, status: str, stage: str, rocket_account: str, description: str, profile_id: str = 'default', profile_label: str = '', amount_1: float = 0, amount_2: float = 0, amount_3: float = 0):
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
                "amount": {"doubleValue": float(amount_3 or amount or 0)},
                "amount_1": {"doubleValue": float(amount_1 or 0)},
                "amount_2": {"doubleValue": float(amount_2 or 0)},
                "amount_3": {"doubleValue": float(amount_3 or amount or 0)},
                "status": {"stringValue": status},
                "stage": {"stringValue": stage},
                "rocket_account": {"stringValue": rocket_account},
                "description": {"stringValue": description},
                "profile_id": {"stringValue": profile_id or "prof_default"},
                "profile_label": {"stringValue": profile_label or (f"Profile #{profile_id[-4:]}" if profile_id and profile_id != 'default' else "Profile")},
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

def update_payment_stage(payment_id: str, stage: str, status: str = None, amount: float = None):
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
        
        if amount and amount > 0:
            update_fields["amount"] = {"doubleValue": float(amount)}
            update_mask.append("amount")
            
        payload = {
            "fields": update_fields
        }
        params = {
            "key": API_KEY,
            "updateMask.fieldPaths": update_mask
        }
        
        res = requests.patch(payment_doc_url, json=payload, params=params, timeout=5)
        
        # যদি amount আপডেট হয় এবং এটি নতুন amount (আগে 0 ছিল), তাহলে main doc এর total_amount আপডেট করো
        if amount and amount > 0:
            try:
                main_res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
                if main_res.status_code == 200:
                    cloud_data = _parse_firestore_doc(main_res.json())
                    current_total = cloud_data.get("total_amount", 0.0)
                    
                    update_total_payload = {
                        "fields": {
                            "total_amount": {"doubleValue": float(current_total + amount)}
                        }
                    }
                    total_params = {
                        "key": API_KEY,
                        "updateMask.fieldPaths": ["total_amount"]
                    }
                    requests.patch(f"{BASE_URL}/{license_key}", json=update_total_payload, params=total_params, timeout=5)
            except Exception as inner_e:
                print(f"Failed to update total_amount: {inner_e}")
        
        return res.status_code == 200
        
    except Exception as e:
        print(f"Payment update error: {e}")
        return False



def record_activity(event_type: str, profile_id: str = "default", profile_label: str = "Profile", title: str = "", details: str = "", amount: float = 0, status: str = "info", metadata: dict = None):
    """Records an activity log event into Firebase Firestore under ivac_licenses/{license_key}/activities"""
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
        time_str = now.strftime("%I:%M:%S %p")
        
        # 1. Post to activities sub-collection
        activities_url = f"{BASE_URL}/{license_key}/activities"
        fields = {
            "event_type": {"stringValue": str(event_type)},
            "profile_id": {"stringValue": str(profile_id or "default")},
            "profile_label": {"stringValue": str(profile_label or "Profile")},
            "title": {"stringValue": str(title)},
            "details": {"stringValue": str(details or "")},
            "amount": {"doubleValue": float(amount or 0)},
            "status": {"stringValue": str(status or "info")},
            "timestamp": {"integerValue": timestamp_ms},
            "datetime": {"stringValue": datetime_str},
            "time_formatted": {"stringValue": time_str}
        }
        if metadata and isinstance(metadata, dict):
            fields["metadata_json"] = {"stringValue": json.dumps(metadata)}
            
        payload = {"fields": fields}
        res = requests.post(f"{activities_url}?key={API_KEY}", json=payload, timeout=5)
        
        # 2. Update profile state in active_profiles sub-collection
        try:
            prof_url = f"{BASE_URL}/{license_key}/active_profiles/{profile_id or 'default'}"
            is_active_flag = event_type not in ["ext_inactive", "ext_disabled", "ext_off"]
            prof_fields = {
                "profile_id": {"stringValue": str(profile_id or "default")},
                "profile_label": {"stringValue": str(profile_label or "Profile")},
                "last_event": {"stringValue": str(event_type)},
                "last_title": {"stringValue": str(title)},
                "last_seen": {"integerValue": timestamp_ms},
                "is_active": {"booleanValue": is_active_flag}
            }
            requests.patch(f"{prof_url}?key={API_KEY}", json={"fields": prof_fields}, timeout=3)
        except Exception:
            pass
            
        return res.status_code == 200
    except Exception as e:
        print(f"Activity recording error: {e}")
        return False

def update_profile_heartbeat(profile_id: str = "default", profile_label: str = "Profile", is_active: bool = True, last_step: str = ""):
    """Updates profile heartbeat in Firebase Firestore active_profiles"""
    if not os.path.exists(LICENSE_FILE):
        return False
    try:
        with open(LICENSE_FILE, 'r', encoding='utf-8') as f:
            encrypted_data = f.read().strip()
        current_hwid = generate_hwid()
        decrypted = decrypt_data(encrypted_data, extra_key=current_hwid)
        license_key = json.loads(decrypted).get("license_key", "")
        if not license_key:
            return False
            
        now = datetime.now()
        timestamp_ms = int(now.timestamp() * 1000)
        
        prof_url = f"{BASE_URL}/{license_key}/active_profiles/{profile_id or 'default'}"
        prof_fields = {
            "profile_id": {"stringValue": str(profile_id or "default")},
            "profile_label": {"stringValue": str(profile_label or "Profile")},
            "last_seen": {"integerValue": timestamp_ms},
            "is_active": {"booleanValue": is_active}
        }
        if last_step:
            prof_fields["last_title"] = {"stringValue": str(last_step)}
            
        res = requests.patch(f"{prof_url}?key={API_KEY}", json={"fields": prof_fields}, timeout=3)
        return res.status_code == 200
    except Exception as e:
        return False
