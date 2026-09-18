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
import uuid

from license_system.hwid import generate_hwid, get_legacy_hwid, get_all_candidate_legacy_hwids
from license_system.crypto import encrypt_data, decrypt_data

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
os.makedirs(APP_DATA_DIR, exist_ok=True)
LICENSE_FILE = os.path.join(APP_DATA_DIR, "license.dat")

LOCAL_PAYMENTS_FILE = os.path.join(APP_DATA_DIR, "payments_local.json")
_local_payments_lock = threading.Lock()
_payment_dedup_lock = threading.Lock()
_payment_dedup_cache = {}  # key -> {"id": payment_id, "time": float, "stage": stage, "status": status}


def _load_local_payments() -> list:
    if not os.path.exists(LOCAL_PAYMENTS_FILE):
        return []
    try:
        with open(LOCAL_PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def _save_local_payments(payments: list):
    try:
        tmp_file = LOCAL_PAYMENTS_FILE + ".tmp"
        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(payments, f, ensure_ascii=False, indent=2)
        os.replace(tmp_file, LOCAL_PAYMENTS_FILE)
    except Exception as e:
        print(f"[LocalPayments] Error saving: {e}")

def get_local_payments_summary():
    """Returns local payments list and summary metrics"""
    with _local_payments_lock:
        records = _load_local_payments()
        total_count = len(records)
        synced_count = sum(1 for r in records if r.get("synced"))
        unsynced_count = total_count - synced_count
        total_revenue = sum(float(r.get("amount") or 0) for r in records if r.get("status") == "success" or r.get("stage") == "payment_success")
        return {
            "total_count": total_count,
            "synced_count": synced_count,
            "unsynced_count": unsynced_count,
            "total_revenue": total_revenue,
            "records": records
        }

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

def _format_expiry_details(info: LicenseInfo, expiry_ms: int, now_ms: int):
    """Format precise days, hours, remaining text, short badge, and expiry datetime"""
    diff_ms = expiry_ms - now_ms
    if diff_ms <= 0:
        info.days_remaining = 0
        info.remaining_text = "0 দিন"
        info.remaining_short = "0d"
    else:
        days = max(0, diff_ms // (1000 * 60 * 60 * 24))
        hours = max(0, (diff_ms % (1000 * 60 * 60 * 24)) // (1000 * 60 * 60))
        minutes = max(0, (diff_ms % (1000 * 60 * 60)) // (1000 * 60))
        info.days_remaining = days
        
        if days > 0:
            if hours > 0:
                info.remaining_text = f"{days} দিন {hours} ঘণ্টা"
                info.remaining_short = f"{days}d {hours}h"
            else:
                info.remaining_text = f"{days} দিন"
                info.remaining_short = f"{days}d"
        elif hours > 0:
            info.remaining_text = f"{hours} ঘণ্টা {minutes} মিনিট"
            info.remaining_short = f"{hours}h {minutes}m"
        else:
            info.remaining_text = f"{minutes} মিনিট"
            info.remaining_short = f"{minutes}m"

    try:
        dt = datetime.fromtimestamp(expiry_ms / 1000)
        info.expiry_date = dt.strftime("%Y-%m-%d %I:%M %p")
    except Exception:
        info.expiry_date = ""

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
            status = cloud_data.get("status", "active")
            if status == "blocked":
                mark_license_blocked_locally(license_key)
                return
            bound_at = cloud_data.get("bound_at")
            days = cloud_data.get("duration_days")
            if days is None:
                months = cloud_data.get("duration_months", 1)
                days = (int(months) if months else 1) * 30
            if bound_at:
                bound_at = int(bound_at)
                days = int(days)
                expiry_ms = bound_at + (days * 24 * 60 * 60 * 1000)
                plan = cloud_data.get("plan", "Standard")
                new_data = {
                    "license_key": license_key,
                    "hwid": current_hwid,
                    "expiry_ms": expiry_ms,
                    "plan": plan,
                    "status": "active",
                    "bound_at": bound_at,
                    "duration_days": days
                }
                encrypted = encrypt_data(json.dumps(new_data), extra_key=current_hwid)
                with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
                    f.write(encrypted)
        elif res.status_code == 404:
            # License was permanently deleted by admin in dashboard! Instantly revoke locally!
            mark_license_blocked_locally(license_key)
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
                mark_license_blocked_locally(license_key)
                info.status = LicenseStatus.BLOCKED
                info.error_message = "এই লাইসেন্সটি অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!"
                return info
                
            bound_at = cloud_data.get("bound_at")
            days = cloud_data.get("duration_days")
            if days is None:
                months = cloud_data.get("duration_months", 1)
                days = months * 30
            
            if bound_at:
                bound_at = int(bound_at)
                days = int(days)
                expiry_ms = bound_at + (days * 24 * 60 * 60 * 1000)
                now_ms = int(time.time() * 1000)
                if now_ms > expiry_ms:
                    info.status = LicenseStatus.EXPIRED
                    info.days_remaining = 0
                    info.error_message = "আপনার লাইসেন্সের মেয়াদ শেষ হয়ে গেছে!"
                    return info
                
                info.status = LicenseStatus.ACTIVE
                info.license_key = license_key
                info.hwid = current_hwid
                info.plan = cloud_data.get("plan", "Standard")
                _format_expiry_details(info, expiry_ms, now_ms)
                
                # Cache expiry_ms so next launch is instant!
                license_data["expiry_ms"] = expiry_ms
                license_data["plan"] = info.plan
                license_data["status"] = "active"
                license_data["bound_at"] = bound_at
                license_data["duration_days"] = days
                try:
                    encrypted = encrypt_data(json.dumps(license_data), extra_key=current_hwid)
                    with open(LICENSE_FILE, 'w', encoding='utf-8') as f:
                        f.write(encrypted)
                except Exception:
                    pass
                return info
        elif res.status_code == 404:
            mark_license_blocked_locally(license_key)
            info.status = LicenseStatus.TAMPERED
            info.error_message = "লাইসেন্সটি বাতিল বা ডাটাবেজ থেকে মুছে দেওয়া হয়েছে!"
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

_cached_license_info = None
_cached_license_mtime = 0
_cached_license_timestamp = 0

def mark_license_blocked_locally(license_key: str):
    """Instantly mark local license.dat as blocked"""
    global _cached_license_info
    _cached_license_info = None
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
    global _cached_license_info, _cached_license_mtime, _cached_license_timestamp
    info = LicenseInfo()
    
    if not os.path.exists(LICENSE_FILE):
        info.status = LicenseStatus.NOT_ACTIVATED
        info.error_message = "কোনো লাইসেন্স অ্যাক্টিভেট করা নেই!"
        return info
        
    try:
        mtime = os.path.getmtime(LICENSE_FILE)
        now = time.time()
        if not force_cloud and _cached_license_info is not None and mtime == _cached_license_mtime and (now - _cached_license_timestamp < 15):
            return _cached_license_info

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
                
            info.plan = plan
            info.status = LicenseStatus.ACTIVE
            info.license_key = license_key
            info.hwid = current_hwid
            _format_expiry_details(info, expiry_ms, now_ms)
                
            # Silent async background sync (App launches instantly without waiting for cloud)
            threading.Thread(target=_bg_cloud_sync, args=(license_key, current_hwid), daemon=True).start()
            _cached_license_info = info
            _cached_license_mtime = mtime
            _cached_license_timestamp = time.time()
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
        info.plan = cloud_data.get("plan", "Standard")
        _format_expiry_details(info, expiry_ms, now_ms)
        
        global _cached_license_info
        _cached_license_info = info
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
    global _cached_license_info
    _cached_license_info = None
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

def record_payment(amount: float, status: str, stage: str, rocket_account: str, description: str, profile_id: str = 'default', profile_label: str = '', amount_1: float = 0, amount_2: float = 0, amount_3: float = 0, payment_session_id: str = ''):
    """পেমেন্ট শুরু হলে বা সম্পন্ন হলে লোকাল স্টোরেজে এবং ক্লাউডে রেকর্ড তৈরি করে।
    সম্পূর্ণ Idempotent ও ডুপ্লিকেট-প্রুফ: মেমোরি উইন্ডো ও ডিটারমিনিস্টিক আইডির সাহায্যে একাধিক বার্স্ট কলেও ১টির বেশি রেকর্ড তৈরি হতে পারবে না।"""
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
        final_amount = float(amount_3 or amount or 0)
        
        # --- ১. মেমোরি ডিডুপ্লিকেশন উইন্ডো (Sliding Window Dedup Check) ---
        import re
        clean_acc = re.sub(r'[^0-9]', '', str(rocket_account or ''))
        prof_key = str(profile_id or 'default').replace(' ', '_')
        now_sec = time.time()
        
        # ডিটারমিনিস্টিক পেমেন্ট আইডি তৈরি
        if payment_session_id and len(payment_session_id.strip()) > 3:
            clean_id = re.sub(r'[^a-zA-Z0-9_-]', '_', payment_session_id.strip())[:64]
            dedup_key = clean_id
        else:
            time_bucket = int(timestamp_ms // 60000)  # ১ মিনিটের ইউনিক বাকেট
            clean_id = f"pay_{prof_key[:10]}_{clean_acc[-6:] or 'def'}_{time_bucket}"
            dedup_key = f"{prof_key}_{clean_acc}_{final_amount:.2f}"

        with _payment_dedup_lock:
            # ১২০ সেকেন্ডের বেশি পুরনো ক্যাশ আইটেম রিমুভ করো
            expired_keys = [k for k, v in _payment_dedup_cache.items() if now_sec - v.get("time", 0) > 120]
            for k in expired_keys:
                _payment_dedup_cache.pop(k, None)

            # গত ৬০ সেকেন্ডের মধ্যে একই পেমেন্ট থাকলে নতুন রেকর্ড না তৈরি করে রিটার্ন করো
            if dedup_key in _payment_dedup_cache:
                existing = _payment_dedup_cache[dedup_key]
                if now_sec - existing.get("time", 0) < 60:
                    existing_id = existing.get("id")
                    print(f"[PaymentDedup] Duplicate hit for {dedup_key}. Reusing existing ID: {existing_id}")
                    if (stage and stage != existing.get("stage")) or (status and status != existing.get("status")):
                        update_payment_stage(existing_id, stage, status, final_amount)
                        existing["stage"] = stage
                        existing["status"] = status
                    return existing_id

            # নতুন পেমেন্ট মেমোরিতে রেজিস্টার করো
            _payment_dedup_cache[dedup_key] = {
                "id": clean_id,
                "time": now_sec,
                "stage": stage,
                "status": status
            }

        payment_record = {
            "id": clean_id,
            "local_id": clean_id,
            "cloud_id": clean_id,
            "amount": final_amount,
            "amount_1": float(amount_1 or 0),
            "amount_2": float(amount_2 or 0),
            "amount_3": final_amount,
            "status": status,
            "stage": stage,
            "rocket_account": rocket_account,
            "description": description,
            "profile_id": profile_id or "prof_default",
            "profile_label": profile_label or (f"Profile #{profile_id[-4:]}" if profile_id and profile_id != 'default' else "Profile"),
            "timestamp": timestamp_ms,
            "datetime": datetime_str,
            "license_key": license_key,
            "synced": False,
            "sync_error": None
        }
        
        # ২. লোকাল স্টোরেজে সেভ / আপডেট করো
        with _local_payments_lock:
            local_list = _load_local_payments()
            idx = next((i for i, r in enumerate(local_list) if r.get("id") == clean_id or r.get("local_id") == clean_id), -1)
            if idx >= 0:
                local_list[idx] = payment_record
            else:
                local_list.insert(0, payment_record)
            _save_local_payments(local_list)
            
        # ৩. Turso Database-এ সেভ করো (Dual-Cloud Failsafe: id=clean_id হওয়ায় ১০০% গ্যারান্টি ১টি রো হবে)
        insert_turso_payment_async(payment_record)
            
        # ৪. ক্লাউড ফায়ারবেসে Idempotent PATCH পাঠানো (কোনো ডুপ্লিকেট ডকুমেন্ট হবে না)
        payments_doc_url = f"{BASE_URL}/{license_key}/payments/{clean_id}"
        payload = {
            "fields": {
                "amount": {"doubleValue": final_amount},
                "amount_1": {"doubleValue": float(amount_1 or 0)},
                "amount_2": {"doubleValue": float(amount_2 or 0)},
                "amount_3": {"doubleValue": final_amount},
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
        
        try:
            # চেক করো এই ডকুমেন্ট ইতিমধ্যে ক্লাউডে আছে কি না (যাতে টোটাল কাউন্ট ডুপ্লিকেট না বাড়ে)
            doc_already_exists = False
            try:
                check_res = requests.get(f"{payments_doc_url}?key={API_KEY}", timeout=4)
                if check_res.status_code == 200:
                    doc_already_exists = True
            except Exception:
                pass

            res = requests.patch(f"{payments_doc_url}?key={API_KEY}", json=payload, timeout=6)
            if res.status_code in [200, 201]:
                payment_record["cloud_id"] = clean_id
                payment_record["synced"] = True
                payment_record["sync_error"] = None
                
                # শুধুমাত্র নতুন ডকুমেন্টের জন্য মোট কাউন্ট ও মোট অ্যামাউন্ট বাড়াও
                if not doc_already_exists:
                    try:
                        main_res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
                        if main_res.status_code == 200:
                            cloud_data = _parse_firestore_doc(main_res.json())
                            current_count = cloud_data.get("payment_count", 0)
                            current_total = cloud_data.get("total_amount", 0.0)
                            
                            update_payload = {
                                "fields": {
                                    "payment_count": {"integerValue": current_count + 1},
                                    "total_amount": {"doubleValue": float(current_total + final_amount)}
                                }
                            }
                            params = {
                                "key": API_KEY,
                                "updateMask.fieldPaths": ["payment_count", "total_amount"]
                            }
                            requests.patch(f"{BASE_URL}/{license_key}", json=update_payload, params=params, timeout=5)
                    except Exception as inner_e:
                        print(f"Failed to update total count/amount: {inner_e}")
            else:
                payment_record["sync_error"] = f"HTTP {res.status_code}: {res.text[:80]}"
                print(f"[PaymentCloud] Firebase write failed (Quota/Network): {res.text[:80]}")
        except Exception as net_err:
            payment_record["sync_error"] = str(net_err)
            print(f"[PaymentCloud] Network error: {net_err}")
            
        with _local_payments_lock:
            local_list = _load_local_payments()
            for r in local_list:
                if r.get("id") == clean_id:
                    r["cloud_id"] = payment_record.get("cloud_id")
                    r["synced"] = payment_record.get("synced", False)
                    r["sync_error"] = payment_record.get("sync_error")
                    break
            _save_local_payments(local_list)
            
        return clean_id
        
    except Exception as e:
        print(f"Payment tracking error: {e}")
        return None

def update_payment_stage(payment_id: str, stage: str, status: str = None, amount: float = None):
    """ইতিমধ্যে তৈরি করা একটি পেমেন্ট রেকর্ডের স্টেজ এবং স্ট্যাটাস লোকাল, ফায়ারবেস ও Turso ডাটাবেজে আপডেট করে।"""
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
            
        cloud_target_id = payment_id
        with _local_payments_lock:
            local_list = _load_local_payments()
            for r in local_list:
                if r.get("local_id") == payment_id or r.get("cloud_id") == payment_id or r.get("id") == payment_id:
                    r["stage"] = stage
                    if status:
                        r["status"] = status
                    if amount and amount > 0:
                        r["amount"] = float(amount)
                        r["amount_3"] = float(amount)
                    cloud_target_id = r.get("cloud_id") or r.get("id") or payment_id
                    break
            _save_local_payments(local_list)

        # Turso Database-এও স্টেজ, স্ট্যাটাস ও অ্যামাউন্ট সিঙ্ক করো
        try:
            update_turso_payment_async(payment_id, stage, status, amount)
        except Exception as turso_err:
            print(f"[Turso Sync Error] {turso_err}")
            
        if cloud_target_id:
            try:
                payment_doc_url = f"{BASE_URL}/{license_key}/payments/{cloud_target_id}"
                update_fields = {"stage": {"stringValue": stage}}
                update_mask = ["stage"]
                if status:
                    update_fields["status"] = {"stringValue": status}
                    update_mask.append("status")
                if amount and amount > 0:
                    update_fields["amount"] = {"doubleValue": float(amount)}
                    update_mask.append("amount")
                    
                payload = {"fields": update_fields}
                params = {"key": API_KEY, "updateMask.fieldPaths": update_mask}
                res = requests.patch(payment_doc_url, json=payload, params=params, timeout=5)
                
                if amount and amount > 0 and res.status_code == 200:
                    try:
                        main_res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
                        if main_res.status_code == 200:
                            cloud_data = _parse_firestore_doc(main_res.json())
                            current_total = cloud_data.get("total_amount", 0.0)
                            update_total_payload = {
                                "fields": {"total_amount": {"doubleValue": float(current_total + amount)}}
                            }
                            total_params = {"key": API_KEY, "updateMask.fieldPaths": ["total_amount"]}
                            requests.patch(f"{BASE_URL}/{license_key}", json=update_total_payload, params=total_params, timeout=5)
                    except Exception:
                        pass
                return res.status_code == 200
            except Exception as net_e:
                print(f"[PaymentCloud] Update failed: {net_e}")
                
        return True
    except Exception as e:
        print(f"Payment update error: {e}")
        return False


_presence_client = None
_presence_lock = threading.Lock()

def _get_presence_client():
    global _presence_client
    with _presence_lock:
        if _presence_client is None:
            try:
                import paho.mqtt.client as mqtt  # type: ignore
                import uuid
                client_id = f"pres_{uuid.uuid4().hex[:8]}"
                _presence_client = mqtt.Client(client_id=client_id)
                _presence_client.connect("broker.emqx.io", 1883, 30)
                _presence_client.loop_start()
            except Exception as e:
                print(f"[MQTT Presence] Init error: {e}")
                _presence_client = None
    return _presence_client


TURSO_DB_URL = "https://ivac-master-pro-ivacmasterpro.aws-ap-south-1.turso.io/v2/pipeline"
TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk1NjkwNTMsImlkIjoiMDFhMGFhYTAtOTAwMS03M2QwLWEwY2YtMDU1YTA1MjIzMTEyIiwia2lkIjoiSks1VmYtT1BqX0lRVFBOd3R3QlhfNXkzMk43YVRwdXhsX0RIRmtrNHRzdyIsInJpZCI6ImNlOGUzYzk1LTI0ZjAtNDY3ZC1iNjkzLWI4MDVkZWY4ZWIzZiJ9.RA6Gd_8XSSFesSdqB8E_SqbWQTrqgbbl_0Q2vExxUE3H0USdkscTa0Dfs7NWaYcT0-S9WhPREpmdmbQKbilgAg"


def _insert_turso_worker(record: dict):
    """Background worker thread to insert activity records into Turso Database (zero impact on main thread)"""
    try:
        sql = """
            INSERT INTO activities 
            (id, license_key, profile_id, profile_label, event_type, off_source, title, details, amount, status, timestamp, datetime, time_formatted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        body = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": sql,
                        "args": [
                            {"type": "text", "value": str(record.get("id", ""))},
                            {"type": "text", "value": str(record.get("license_key", ""))},
                            {"type": "text", "value": str(record.get("profile_id", "default"))},
                            {"type": "text", "value": str(record.get("profile_label", "Profile"))},
                            {"type": "text", "value": str(record.get("event_type", ""))},
                            {"type": "text", "value": str(record.get("off_source", "popup"))},
                            {"type": "text", "value": str(record.get("title", ""))},
                            {"type": "text", "value": str(record.get("details", ""))},
                            {"type": "float", "value": float(record.get("amount", 0))},
                            {"type": "text", "value": str(record.get("status", "warning"))},
                            {"type": "integer", "value": str(int(record.get("timestamp", 0)))},
                            {"type": "text", "value": str(record.get("datetime", ""))},
                            {"type": "text", "value": str(record.get("time_formatted", ""))}
                        ]
                    }
                },
                {"type": "close"}
            ]
        }
        headers = {
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json"
        }
        requests.post(TURSO_DB_URL, json=body, headers=headers, timeout=5)
    except Exception as e:
        print(f"[Turso Insert Error] {e}")


def insert_turso_activity_async(record: dict):
    """Dispatches Turso insert to a non-blocking daemon thread"""
    threading.Thread(target=_insert_turso_worker, args=(record,), daemon=True).start()


def _insert_turso_payment_worker(payment_data: dict):
    """Background worker thread to insert payment records into Turso Database (zero impact on main thread)"""
    try:
        sql = """
            INSERT OR REPLACE INTO payments 
            (id, license_key, profile_id, profile_label, amount, amount_1, amount_2, amount_3, status, stage, rocket_account, description, timestamp, datetime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        body = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": sql,
                        "args": [
                            {"type": "text", "value": str(payment_data.get("id") or payment_data.get("local_id") or "")},
                            {"type": "text", "value": str(payment_data.get("license_key", ""))},
                            {"type": "text", "value": str(payment_data.get("profile_id", "prof_default"))},
                            {"type": "text", "value": str(payment_data.get("profile_label", "Profile"))},
                            {"type": "float", "value": float(payment_data.get("amount", 0))},
                            {"type": "float", "value": float(payment_data.get("amount_1", 0))},
                            {"type": "float", "value": float(payment_data.get("amount_2", 0))},
                            {"type": "float", "value": float(payment_data.get("amount_3", 0))},
                            {"type": "text", "value": str(payment_data.get("status", "initiated"))},
                            {"type": "text", "value": str(payment_data.get("stage", ""))},
                            {"type": "text", "value": str(payment_data.get("rocket_account", ""))},
                            {"type": "text", "value": str(payment_data.get("description", ""))},
                            {"type": "integer", "value": str(int(payment_data.get("timestamp", 0)))},
                            {"type": "text", "value": str(payment_data.get("datetime", ""))}
                        ]
                    }
                },
                {"type": "close"}
            ]
        }
        headers = {
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json"
        }
        requests.post(TURSO_DB_URL, json=body, headers=headers, timeout=5)
    except Exception as e:
        print(f"[Turso Payment Insert Error] {e}")


def insert_turso_payment_async(payment_data: dict):
    """Dispatches Turso payment insert to a non-blocking daemon thread"""
    threading.Thread(target=_insert_turso_payment_worker, args=(payment_data,), daemon=True).start()


def _update_turso_payment_worker(payment_id: str, stage: str, status: str = None, amount: float = None):
    """Background worker thread to update payment record stage/status in Turso Database"""
    try:
        sql = """
            UPDATE payments 
            SET stage = ?,
                status = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE status END,
                amount = CASE WHEN ? > 0 THEN ? ELSE amount END,
                amount_3 = CASE WHEN ? > 0 THEN ? ELSE amount_3 END
            WHERE id = ?
        """
        amt_val = float(amount or 0)
        status_val = str(status) if status else ""
        body = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": sql,
                        "args": [
                            {"type": "text", "value": str(stage or "")},
                            {"type": "text", "value": status_val},
                            {"type": "text", "value": status_val},
                            {"type": "text", "value": status_val},
                            {"type": "float", "value": amt_val},
                            {"type": "float", "value": amt_val},
                            {"type": "float", "value": amt_val},
                            {"type": "float", "value": amt_val},
                            {"type": "text", "value": str(payment_id)}
                        ]
                    }
                },
                {"type": "close"}
            ]
        }
        headers = {
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json"
        }
        requests.post(TURSO_DB_URL, json=body, headers=headers, timeout=5)
    except Exception as e:
        print(f"[Turso Payment Update Error] {e}")


def update_turso_payment_async(payment_id: str, stage: str, status: str = None, amount: float = None):
    """Dispatches Turso payment stage update to a non-blocking daemon thread"""
    threading.Thread(target=_update_turso_payment_worker, args=(payment_id, stage, status, amount), daemon=True).start()



_activity_dedup_cache = {}

def record_activity(event_type: str, profile_id: str = "default", profile_label: str = "Profile", title: str = "", details: str = "", amount: float = 0, status: str = "info", metadata: dict = None, off_source: str = "popup"):
    """Records manual off events into Turso Database (0 Firebase writes) and broadcasts live via MQTT"""
    # 1. Ignore normal browser close or background unload (prevent false positives!)
    if off_source == "browser_unload":
        return True

    # 2. Update live presence via MQTT (0 database writes)
    is_active = (event_type != "ext_disabled" and event_type != "ext_off" and event_type != "manual_off")
    update_profile_heartbeat(profile_id, profile_label, is_active=is_active, last_step=title or details)

    # 3. We record genuine MANUAL ON/OFF toggle events (and payments/milestones) to Turso Database!
    is_manual_toggle = (event_type in ["ext_disabled", "ext_enabled", "manual_off", "ext_uninstalled"] and off_source in ["popup", "manage_extensions_page", "uninstalled"])
    is_payment = (event_type in ["payment_recorded", "payment_success"])

    # If it's not a manual on/off toggle and not a payment milestone, skip database insertion completely
    if not (is_manual_toggle or is_payment):
        return True

    # 4. Strict Deduplication Guard:
    # Discards duplicate/identical toggle events for the same profile within 4.0 seconds
    if is_manual_toggle:
        now_ts = time.time()
        dedup_key = f"{profile_id}_{event_type}"
        last_ts = _activity_dedup_cache.get(dedup_key, 0)
        if (now_ts - last_ts) < 4.0:
            return True
        _activity_dedup_cache[dedup_key] = now_ts

    license_key = get_active_license_key_fast()
    if not license_key:
        return None

    now = datetime.now()
    timestamp_ms = int(now.timestamp() * 1000)
    datetime_str = now.strftime("%Y-%m-%d %H:%M:%S")
    time_str = now.strftime("%I:%M:%S %p")
    record_id = f"act_{uuid.uuid4().hex[:12]}"

    record_data = {
        "id": record_id,
        "license_key": license_key,
        "profile_id": str(profile_id or "default"),
        "profile_label": str(profile_label or "Profile"),
        "event_type": str(event_type),
        "off_source": str(off_source or "popup"),
        "title": str(title),
        "details": str(details or ""),
        "amount": float(amount or 0),
        "status": str(status or "warning"),
        "timestamp": timestamp_ms,
        "datetime": datetime_str,
        "time_formatted": time_str
    }

    # Save to Turso Database in non-blocking background thread (0 Firebase writes!)
    insert_turso_activity_async(record_data)

    # Broadcast to MQTT Live Channel for 0-latency live streaming to Owner Panel
    try:
        mqtt_client = _get_presence_client()
        if mqtt_client:
            live_payload = json.dumps({
                "type": "activity_event",
                **record_data
            })
            mqtt_client.publish(f"ivac_live_{license_key}", live_payload, qos=0)
    except Exception as e:
        print(f"[MQTT Live Activity Broadcast] Error: {e}")

    return True


_cached_active_license_key = None
_cached_active_license_time = 0

def get_active_license_key_fast() -> str:
    """Returns license key with 60s in-memory caching for ultra-fast, zero-overhead heartbeats"""
    global _cached_active_license_key, _cached_active_license_time
    now = time.time()
    if _cached_active_license_key and (now - _cached_active_license_time < 60):
        return _cached_active_license_key
    if not os.path.exists(LICENSE_FILE):
        return ""
    try:
        with open(LICENSE_FILE, 'r', encoding='utf-8') as f:
            encrypted_data = f.read().strip()
        current_hwid = generate_hwid()
        decrypted = decrypt_data(encrypted_data, extra_key=current_hwid)
        key = json.loads(decrypted).get("license_key", "")
        if key:
            _cached_active_license_key = key
            _cached_active_license_time = now
            return key
    except Exception:
        pass
    return _cached_active_license_key or ""


def update_profile_heartbeat(profile_id: str = "default", profile_label: str = "Profile", is_active: bool = True, last_step: str = ""):
    """Publishes live profile presence via MQTT Live Tunnel (Zero Firebase Writes & <0.01ms latency!)"""
    try:
        license_key = get_active_license_key_fast()
        if not license_key:
            return False

        client = _get_presence_client()
        if client:
            payload = json.dumps({
                "profile_id": str(profile_id or "default"),
                "profile_label": str(profile_label or "Profile"),
                "is_active": bool(is_active),
                "last_title": str(last_step or "Active"),
                "last_seen": int(time.time() * 1000)
            })
            client.publish(f"ivac_live_{license_key}", payload, qos=0)
            return True
        return False
    except Exception:
        return False


def _sync_pending_payments_loop():
    """Background worker that pushes unsynced local payments to Firebase whenever online/quota resets"""
    time.sleep(10)
    while True:
        try:
            if not os.path.exists(LICENSE_FILE):
                time.sleep(30)
                continue
                
            with open(LICENSE_FILE, 'r', encoding='utf-8') as f:
                encrypted_data = f.read().strip()
            current_hwid = generate_hwid()
            decrypted = decrypt_data(encrypted_data, extra_key=current_hwid)
            license_key = json.loads(decrypted).get("license_key", "")
            
            if not license_key:
                time.sleep(30)
                continue
                
            with _local_payments_lock:
                local_list = _load_local_payments()
                unsynced = [r for r in local_list if not r.get("synced")]
                
            if unsynced:
                payments_url = f"{BASE_URL}/{license_key}/payments"
                for record in unsynced:
                    final_amount = float(record.get("amount") or 0)
                    payload = {
                        "fields": {
                            "amount": {"doubleValue": final_amount},
                            "amount_1": {"doubleValue": float(record.get("amount_1") or 0)},
                            "amount_2": {"doubleValue": float(record.get("amount_2") or 0)},
                            "amount_3": {"doubleValue": final_amount},
                            "status": {"stringValue": str(record.get("status", "initiated"))},
                            "stage": {"stringValue": str(record.get("stage", "pay_clicked"))},
                            "rocket_account": {"stringValue": str(record.get("rocket_account", ""))},
                            "description": {"stringValue": str(record.get("description", ""))},
                            "profile_id": {"stringValue": str(record.get("profile_id", "prof_default"))},
                            "profile_label": {"stringValue": str(record.get("profile_label", "Profile"))},
                            "timestamp": {"integerValue": int(record.get("timestamp", int(time.time()*1000)))},
                            "datetime": {"stringValue": str(record.get("datetime", ""))}
                        }
                    }
                    doc_id = record.get("id") or record.get("local_id")
                    payments_doc_url = f"{BASE_URL}/{license_key}/payments/{doc_id}"
                    try:
                        res = requests.patch(f"{payments_doc_url}?key={API_KEY}", json=payload, timeout=6)
                        if res.status_code in [200, 201]:
                            with _local_payments_lock:
                                for r in local_list:
                                    if (r.get("id") and r.get("id") == doc_id) or (r.get("local_id") and r.get("local_id") == doc_id):
                                        r["cloud_id"] = doc_id
                                        r["synced"] = True
                                        r["sync_error"] = None
                                        break
                                _save_local_payments(local_list)
                            print(f"[PaymentSync] Successfully synced pending payment {doc_id}")
                            
                            try:
                                main_res = requests.get(f"{BASE_URL}/{license_key}?key={API_KEY}", timeout=5)
                                if main_res.status_code == 200:
                                    cloud_data = _parse_firestore_doc(main_res.json())
                                    current_count = cloud_data.get("payment_count", 0)
                                    current_total = cloud_data.get("total_amount", 0.0)
                                    requests.patch(
                                        f"{BASE_URL}/{license_key}",
                                        json={
                                            "fields": {
                                                "payment_count": {"integerValue": current_count + 1},
                                                "total_amount": {"doubleValue": float(current_total + final_amount)}
                                            }
                                        },
                                        params={"key": API_KEY, "updateMask.fieldPaths": ["payment_count", "total_amount"]},
                                        timeout=5
                                    )
                            except Exception:
                                pass
                        else:
                            print(f"[PaymentSync] Cloud still rejecting: {res.text[:80]}")
                            break
                    except Exception as err:
                        print(f"[PaymentSync] Network error: {err}")
                        break
        except Exception:
            pass
        time.sleep(45)

_sync_thread = threading.Thread(target=_sync_pending_payments_loop, daemon=True)
_sync_thread.start()
