"""
IVAC SMS Server — ফোন থেকে SMS গ্রহণ করে এবং OTP প্রসেস করে
"""

import json
import time
import threading
from datetime import datetime
from typing import Dict, List, Optional

from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS

import os
from otp_parser import parse_otp_from_sms, digits_to_string, format_otp_display

app = Flask(__name__, static_folder="dashboard", static_url_path="/dashboard")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

saved_devices = {}
connected_devices = {}

class OTPStore:
    def __init__(self):
        self._store: Dict[str, dict] = {} # latest per phone_source
        self._history: Dict[str, List[dict]] = {} # history per phone: [newest, older, ...]
        self._lock = threading.Lock()

    def _check_expiry(self, otp_dict: dict) -> dict:
        """Payment OTPs (Rocket, bKash, Nagad) stay UNUSED for 13.0 seconds from arrival, then automatically become USED.
        IVAC OTPs remain untouched (simple manual/fill lifecycle)."""
        if not otp_dict:
            return otp_dict
        source = otp_dict.get("source", "")
        if source in ("R", "B", "N"):
            created_at = otp_dict.get("created_at_ts", 0)
            if created_at > 0 and (time.time() - created_at) > 13.0:
                otp_dict["used"] = True
        return otp_dict

    def add_otp(self, phone: str, digits: List[int], raw_sms: str = "", source: str = None):
        with self._lock:
            clean_phone = (phone or "").strip()
            if not clean_phone:
                clean_phone = "Unknown"
                
            now_ts = time.time()
            now_dt = datetime.now()
            key = clean_phone + "_" + (source or "")
            
            # Rule 1: If a newer OTP arrives for the same gateway & phone, immediately mark the previous one as USED
            if source in ("R", "B", "N"):
                if key in self._store:
                    self._store[key]["used"] = True
                if clean_phone in self._history:
                    for h in self._history[clean_phone]:
                        if h.get("source") == source:
                            h["used"] = True
            
            otp_data = {
                "id": str(int(now_ts * 1000)),
                "phone": clean_phone,
                "digits": digits,
                "otp_string": digits_to_string(digits),
                "display": format_otp_display(digits, source),
                "source": source or "",
                "raw_sms": raw_sms,
                "timestamp": now_dt.strftime("%I:%M:%S %p"),
                "iso_time": now_dt.isoformat(),
                "created_at_ts": now_ts,
                "used": False
            }
            
            # Store in latest active map
            self._store[key] = otp_data
            
            # Store in history list for this phone
            if clean_phone not in self._history:
                self._history[clean_phone] = []
            # Prepend newest to top of history
            self._history[clean_phone].insert(0, dict(otp_data))
            # Keep max 50 items per phone history
            if len(self._history[clean_phone]) > 50:
                self._history[clean_phone] = self._history[clean_phone][:50]
            
            # Broadcast to dashboard and extensions
            socketio.emit("otp_received", otp_data)
            print(f"✅ OTP সংরক্ষিত: {clean_phone} [{source or '?'}] → {otp_data['display']}")
            return otp_data

    def get_otp(self, phone: str, source: str = None, unused_only: bool = False) -> Optional[dict]:
        with self._lock:
            clean_phone = (phone or "").strip()
            if source:
                key = clean_phone + "_" + source
                if key in self._store:
                    item = self._check_expiry(self._store[key])
                    if not unused_only or not item.get("used", False):
                        return item
                # Fallback search by source and phone
                for k, v in self._store.items():
                    if v.get("phone") == clean_phone and v.get("source") == source:
                        item = self._check_expiry(v)
                        if not unused_only or not item.get("used", False):
                            return item
            else:
                # Return latest OTP for this phone regardless of source
                candidates = [self._check_expiry(v) for k, v in self._store.items() if v.get("phone") == clean_phone]
                if candidates:
                    if unused_only:
                        unused = [c for c in candidates if not c.get("used", False)]
                        return unused[-1] if unused else None
                    return candidates[-1]
                    
            return None

    def mark_used(self, phone: str, source: str = None):
        with self._lock:
            clean_phone = (phone or "").strip()
            # If it's a payment OTP (R, B, N), preserve 5s multi-tab window (don't force used if age < 5.0s)
            if source in ("R", "B", "N"):
                key = clean_phone + "_" + source
                if key in self._store:
                    created_at = self._store[key].get("created_at_ts", 0)
                    if created_at > 0 and (time.time() - created_at) < 5.0:
                        return
            
            if source:
                key = clean_phone + "_" + source
                if key in self._store:
                    self._store[key]["used"] = True
            for k, v in self._store.items():
                if v.get("phone") == clean_phone and (not source or v.get("source") == source):
                    if v.get("source") in ("R", "B", "N"):
                        created_at = v.get("created_at_ts", 0)
                        if created_at > 0 and (time.time() - created_at) < 5.0:
                            continue
                    v["used"] = True
            if clean_phone in self._history and len(self._history[clean_phone]) > 0:
                h_item = self._history[clean_phone][0]
                if h_item.get("source") in ("R", "B", "N"):
                    created_at = h_item.get("created_at_ts", 0)
                    if created_at > 0 and (time.time() - created_at) < 5.0:
                        pass
                    else:
                        h_item["used"] = True
                else:
                    h_item["used"] = True
            socketio.emit("otp_used", {"phone": clean_phone, "source": source or ""})

    def get_all_status(self) -> List[dict]:
        with self._lock:
            result = []
            for phone, hist in self._history.items():
                if not hist:
                    continue
                latest = dict(self._check_expiry(hist[0]))
                latest["history"] = [dict(self._check_expiry(h)) for h in hist[1:]]
                latest["total_count"] = len(hist)
                result.append(latest)
            result.sort(key=lambda x: x.get("iso_time", ""), reverse=True)
            return result

    def clear(self, phone: str = None, source: str = None):
        with self._lock:
            if phone:
                clean_phone = phone.strip()
                self._history.pop(clean_phone, None)
                keys_to_remove = [k for k, v in self._store.items() if v.get("phone") == clean_phone and (not source or v.get("source") == source)]
                for k in keys_to_remove:
                    self._store.pop(k, None)
            else:
                self._store.clear()
                self._history.clear()

otp_store = OTPStore()

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/api/sms", methods=["POST", "GET"])
def receive_sms():
    import json
    raw_data = request.get_data(as_text=True)
    print(f"\n📲 [Incoming Request] Raw Payload: {raw_data}")
    
    data = {}
    try:
        # Try normal JSON parsing first
        data = request.get_json(force=True, silent=True)
        if not data and raw_data:
            # Android keyboards often use smart quotes, let's fix them and retry
            fixed_raw = raw_data.replace('“', '"').replace('”', '"').replace('‘', '"').replace('’', '"').replace("'", '"')
            import json
            # strict=False allows unescaped newlines/control characters inside JSON strings!
            data = json.loads(fixed_raw, strict=False)
    except Exception as e:
        print(f"⚠️ JSON Parse Error: {e}")
        
    if not data:
        # Fallback to form/query parameters
        data = request.values.to_dict()

    if not data:
        print("❌ Error: No valid data found in request")
        return jsonify({"error": "কোনো ডেটা পাওয়া যায়নি", "raw_received": raw_data}), 400

    sms_body = data.get("body") or data.get("sms_body") or data.get("message") or ""
    phone_raw = data.get("phone") or data.get("device_phone") or data.get("to") or ""
    sender = data.get("from") or data.get("sms_from") or ""

    # Check mapping first (e.g. P1_1 -> 01612703910)
    try:
        import os
        app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
        mapping_file = os.path.join(app_data_dir, "sim_mapping.json")
        if not os.path.exists(mapping_file):
            default_mapping = os.path.join(os.path.dirname(__file__), "sim_mapping.json")
            if os.path.exists(default_mapping):
                import shutil
                shutil.copy(default_mapping, mapping_file)
            else:
                with open(mapping_file, 'w', encoding='utf-8') as f: f.write("{}")
        if os.path.exists(mapping_file):
            with open(mapping_file, "r") as f:
                mapping = json.load(f)
                if phone_raw in mapping:
                    phone_raw = mapping[phone_raw]
    except Exception as e:
        print(f"⚠️ Error reading sim_mapping.json: {e}")

    # MacroDroid অনেক সময় phone ফিল্ডে ভুল করে পুরো মেসেজ ঢুকিয়ে দেয়, তাই শুধু আসল নম্বরটা বের করে নিচ্ছি
    # এখন আমরা একাধিক নম্বর (কমা দিয়ে) সাপোর্ট করব
    import re
    phones = re.findall(r'\b(01[3-9]\d{8})\b', phone_raw)
    
    if not phones:
        # If no valid Bangladeshi number found, fallback to raw string (might be a mapped string)
        phones = [phone_raw] if phone_raw else []

    if not sms_body:
        print("❌ Error: SMS body is empty")
        return jsonify({"error": "SMS body খালি", "received_data": data}), 400

    print(f"📨 SMS প্রাপ্ত: {phones} (Sender: {sender}) -> Body: {sms_body}")
    
    digits, source = parse_otp_from_sms(sms_body)
    if digits and source:
        last_otp_data = None
        for p in phones:
            last_otp_data = otp_store.add_otp(p, digits, sms_body, source)
            
        return jsonify({
            "success": True,
            "otp": last_otp_data["otp_string"] if last_otp_data else "",
            "display": last_otp_data["display"] if last_otp_data else "",
            "source": last_otp_data["source"] if last_otp_data else "",
            "digits": digits
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": "OTP parse করা যায়নি অথবা এটি কোনো পরিচিত সার্ভিস (IVAC/Rocket/bKash/Nagad) নয়",
            "sms_body": sms_body
        }), 422

@app.route("/api/manual-otp", methods=["POST"])
def manual_otp():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "JSON body প্রয়োজন"}), 400

    phone = data.get("phone", "")
    otp_string = data.get("otp", "")

    if not phone or not otp_string:
        return jsonify({"error": "phone ও otp প্রয়োজন"}), 400

    digits = [int(d) for d in otp_string if d.isdigit()]
    if len(digits) != 6:
        return jsonify({"error": "OTP ৬ ডিজিটের হতে হবে"}), 400

    otp_data = otp_store.add_otp(phone, digits, f"[MANUAL] {otp_string}")
    return jsonify({
        "success": True,
        "otp": otp_data["otp_string"]
    }), 200

@app.route("/api/otp/<phone>", methods=["GET"])
def get_otp(phone):
    """Extension will poll this or use SocketIO"""
    source = request.args.get("source")
    unused_only = request.args.get("unused_only", "").lower() in ("true", "1")
    otp_data = otp_store.get_otp(phone, source, unused_only=unused_only)
    if otp_data:
        return jsonify({"success": True, "data": otp_data}), 200
    return jsonify({"success": False, "error": "OTP পাওয়া যায়নি"}), 404

@app.route("/api/otp/<phone>/used", methods=["POST"])
def mark_otp_used(phone):
    """Extension calls this when OTP is filled successfully"""
    source = request.args.get("source")
    otp_store.mark_used(phone, source)
    return jsonify({"success": True}), 200

@app.route("/api/device/update", methods=["POST"])
def update_device():
    data = request.get_json(force=True, silent=True) or {}
    dev_id = data.get("device_id")
    custom_name = data.get("custom_name")
    is_active = data.get("is_active")
    
    if dev_id and dev_id in saved_devices:
        if custom_name is not None:
            saved_devices[dev_id]["custom_name"] = custom_name
            if dev_id in connected_devices:
                connected_devices[dev_id]["custom_name"] = custom_name
        if is_active is not None:
            saved_devices[dev_id]["is_active"] = is_active
            if dev_id in connected_devices:
                connected_devices[dev_id]["is_active"] = is_active
                
        # To avoid circular import/local scoping issues, we save it here
        import json, os
        app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
        config_path = os.path.join(app_data_dir, "devices.json")
        try:
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(saved_devices, f, indent=2)
        except:
            pass
            
        return jsonify({"success": True})
    return jsonify({"success": False})

last_config_ts = time.time()



active_profile_data = {}

_cached_config_mtime = 0
_cached_rocket_accounts = []

def get_cached_rocket_accounts():
    global _cached_config_mtime, _cached_rocket_accounts
    try:
        app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
        config_path = os.path.join(app_data_dir, "config.json")
        if os.path.exists(config_path):
            mtime = os.path.getmtime(config_path)
            if mtime != _cached_config_mtime:
                with open(config_path, "r", encoding="utf-8") as f:
                    c = json.load(f)
                    _cached_rocket_accounts = c.get("rocket_accounts", [])
                    _cached_config_mtime = mtime
    except Exception:
        pass
    return _cached_rocket_accounts

@app.route("/api/status", methods=["GET"])
def get_status():
    global last_config_ts, active_profile_data
    devices = []
    current_time = time.time()
    online_count = 0
    online_phones = []
    offline_phones = []
    
    # Ultra-fast in-memory iteration without disk I/O or redundant regex
    for dev_id, data in list(connected_devices.items()):
        # Mark online if seen within 12 seconds
        is_seen = (current_time - data.get("last_seen", 0) <= 5)
        data["online"] = is_seen
        
        is_on = bool(is_seen and data.get("is_active", True))
        if is_on:
            online_count += 1
            
        # Use pre-cached phones list on device if available
        phone_matches = data.get("phones")
        if phone_matches is None:
            import re
            phone_matches = re.findall(r'\b(01[3-9]\d{8})\b', f"{data.get('sim1_name','')} {data.get('sim2_name','')} {data.get('custom_name','')} {data.get('device_name','')}")
            data["phones"] = phone_matches
            
        if is_on:
            online_phones.extend(phone_matches)
        else:
            offline_phones.extend(phone_matches)
            
        devices.append(data)
        
    total_count = len(devices)
    online_phones = list(set(online_phones))
    offline_phones = list(set(offline_phones))
    rocket_accounts = get_cached_rocket_accounts()

    return jsonify({
        "licensed": is_license_active(),
        "auth_token": generate_auth_token() if is_license_active() else "",
        "otps": otp_store.get_all_status() if is_license_active() else [],
        "devices": devices,
        "online_devices": online_count,
        "total_devices": total_count,
        "devices_status": f"{online_count}/{total_count}",
        "online_phones": online_phones,
        "offline_phones": offline_phones,
        "config_version": last_config_ts,
        "active_profile": active_profile_data,
        "rocket_accounts": rocket_accounts
    }), 200

@app.route("/api/ip", methods=["GET"])
def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return jsonify({"ip": ip}), 200

@app.route("/api/clear", methods=["POST", "GET"])
def clear_all():
    otp_store.clear()
    socketio.emit("cleared", {})
    return jsonify({"success": True}), 200

@app.route("/api/clear/<phone>", methods=["GET", "POST"])
def clear_phone(phone):
    source = request.args.get("source")
    otp_store.clear(phone, source)
    socketio.emit("cleared", {"phone": phone, "source": source or ""})
    return jsonify({"success": True}), 200

@app.route("/api/payment", methods=["POST"])
def payment():
    from license_system.license_manager import record_payment
    data = request.get_json(force=True, silent=True) or {}
    amount = data.get("amount", 0)
    amount_1 = data.get("amount_1", 0)
    amount_2 = data.get("amount_2", 0)
    amount_3 = data.get("amount_3", 0)
    status = data.get("status", "initiated")
    stage = data.get("stage", "pay_clicked")
    rocket_account = data.get("rocket_account", "")
    description = data.get("description", "")
    profile_id = data.get("profile_id", "default")
    profile_label = data.get("profile_label", "")
    
    # Auto-resolve profile label from active in-memory tracker if missing
    if (not profile_label or profile_label == "Profile" or profile_label.startswith("Profile #")) and profile_id in profile_tracker:
        profile_label = profile_tracker[profile_id].get("label", profile_label)
        
    payment_id = record_payment(amount, status, stage, rocket_account, description, profile_id, profile_label, amount_1, amount_2, amount_3)
    return jsonify({"success": bool(payment_id), "payment_id": payment_id}), 200

@app.route("/api/payment/update", methods=["POST"])
def payment_update():
    from license_system.license_manager import update_payment_stage
    data = request.get_json(force=True, silent=True) or {}
    payment_id = data.get("payment_id")
    stage = data.get("stage")
    status = data.get("status")
    amount = data.get("amount")
    
    if not payment_id or not stage:
        return jsonify({"success": False, "error": "payment_id and stage are required"}), 400
        
    success = update_payment_stage(payment_id, stage, status, amount)
    return jsonify({"success": success}), 200

@app.route("/api/payment-success", methods=["POST", "GET"])
def payment_success():
    # For backward compatibility and fallback for custom sites
    from license_system.license_manager import record_payment
    
    amount = 0
    rocket_account = "Unknown"
    
    try:
        data = request.get_json(silent=True)
        if data:
            amount = data.get("amount", 0)
            rocket_account = data.get("rocket_account", "Unknown")
    except:
        pass
        
    success = bool(record_payment(amount, "success", "otp_submitted", rocket_account, "Custom Site"))
    return jsonify({"success": success}), 200

def get_installed_license_key():
    try:
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

last_license_status = None
last_license_check_time = 0

# ===== PROFILE HEARTBEAT & OFFLINE MONITOR =====
profile_tracker = {}

def update_profile_tracker(profile_id, profile_label, is_active=True):
    now = time.time()
    if profile_id not in profile_tracker:
        profile_tracker[profile_id] = {
            "last_seen": now,
            "label": profile_label,
            "is_active": is_active,
            "offline_logged": not is_active
        }
    else:
        entry = profile_tracker[profile_id]
        entry["last_seen"] = now
        entry["label"] = profile_label
        # If it was offline and is now sending active heartbeats again
        if is_active and entry.get("offline_logged", False):
            entry["offline_logged"] = False
            entry["is_active"] = True
            try:
                from license_system.license_manager import record_activity, update_profile_heartbeat
                record_activity('ext_enabled', profile_id, profile_label, 'Extension চালু (Active)', 'এক্সটেনশন পুনরায় সক্রিয় হয়েছে', 0, 'success')
                update_profile_heartbeat(profile_id, profile_label, True, 'Active')
            except Exception:
                pass
        elif not is_active:
            entry["is_active"] = False

def _profile_offline_checker_loop():
    while True:
        try:
            now = time.time()
            for prof_id, info in list(profile_tracker.items()):
                # If active but no heartbeat for > 35 seconds
                if info.get("is_active", True) and not info.get("offline_logged", False):
                    if now - info.get("last_seen", 0) > 35:
                        info["offline_logged"] = True
                        info["is_active"] = False
                        try:
                            from license_system.license_manager import record_activity, update_profile_heartbeat
                            lbl = info.get("label", f"Profile #{prof_id[-4:]}")
                            record_activity(
                                'ext_disabled',
                                prof_id,
                                lbl,
                                'Extension বন্ধ (Off)',
                                'গ্রাহক ব্রাউজারে এক্সটেনশন বন্ধ করেছেন বা সংযোগ বিচ্ছিন্ন',
                                0,
                                'warning'
                            )
                            update_profile_heartbeat(
                                prof_id,
                                lbl,
                                is_active=False,
                                last_step='Extension বন্ধ (Offline)'
                            )
                        except Exception as e:
                            print(f"Offline monitor error: {e}")
        except Exception as e:
            pass
        time.sleep(8)

_offline_thread = threading.Thread(target=_profile_offline_checker_loop, daemon=True)
_offline_thread.start()

@app.route("/api/activity", methods=["POST"])
def receive_activity():
    try:
        from license_system.license_manager import record_activity
        data = request.get_json(silent=True) or {}
        event_type = data.get("event_type", "unknown")
        profile_id = data.get("profile_id", "default")
        profile_label = data.get("profile_label", "Profile")
        title = data.get("title", "")
        details = data.get("details", "")
        amount = data.get("amount", 0)
        status = data.get("status", "info")
        metadata = data.get("metadata", {})
        
        is_active = event_type not in ["ext_disabled", "ext_inactive", "ext_off"]
        update_profile_tracker(profile_id, profile_label, is_active=is_active)
        
        success = bool(record_activity(
            event_type=event_type,
            profile_id=profile_id,
            profile_label=profile_label,
            title=title,
            details=details,
            amount=amount,
            status=status,
            metadata=metadata
        ))
        return jsonify({"success": success}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/activity/heartbeat", methods=["POST"])
def receive_heartbeat():
    try:
        from license_system.license_manager import update_profile_heartbeat
        data = request.get_json(silent=True) or {}
        profile_id = data.get("profile_id", "default")
        profile_label = data.get("profile_label", "Profile")
        is_active = data.get("is_active", True)
        last_step = data.get("last_step", "")
        
        update_profile_tracker(profile_id, profile_label, is_active=is_active)
        
        success = bool(update_profile_heartbeat(
            profile_id=profile_id,
            profile_label=profile_label,
            is_active=is_active,
            last_step=last_step
        ))
        return jsonify({"success": success}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


last_license_status = None
last_license_check_time = 0

def is_license_active():
    global last_license_status, last_license_check_time
    import time
    if time.time() - last_license_check_time > 60 or last_license_status is None:
        try:
            from license_system.license_manager import check_license
            # Force cloud check once every 60s while active as safety net (only 60 reads/hr, 0.1% quota)
            info = check_license(force_cloud=True)
            last_license_status = bool(info.is_valid)
        except Exception:
            last_license_status = False
        last_license_check_time = time.time()
    return bool(last_license_status)

def generate_auth_token():
    import hashlib, time
    window = int(time.time() // 10)
    raw = f"DigontoQuickFill_SecSalt_2026_{window}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

@app.route("/api/license-status", methods=["GET", "POST"])
def license_status():
    active = is_license_active()
    token = generate_auth_token() if active else ""
    return jsonify({"active": active, "token": token}), 200

def _normalize_prof(p_str):
    if not p_str: return ""
    s = str(p_str).strip().lower()
    if s.startswith("profile "): s = s.replace("profile ", "")
    return s

@app.route("/api/profile/active", methods=["POST", "GET"])
def active_profile_endpoint():
    global active_profile_data, last_config_ts
    if request.method == "POST":
        data = request.get_json(force=True, silent=True) or {}
        if data:
            if not isinstance(active_profile_data, dict):
                active_profile_data = {}
            active_profile_data.update(data)
            
            # Save updated profile data to config.json
            import json, os
            app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
            config_path = os.path.join(app_data_dir, "config.json")
            if os.path.exists(config_path):
                try:
                    with open(config_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                    
                    cfg["active_profile"] = active_profile_data
                    
                    # Also update matching profile in profiles list
                    prof_dir = active_profile_data.get("chrome_profile", "")
                    norm_prof = _normalize_prof(prof_dir)
                    
                    updated = False
                    if "profiles" in cfg and isinstance(cfg["profiles"], list) and len(cfg["profiles"]) > 0:
                        # 1. Match by chrome_profile if known
                        if norm_prof:
                            for p in cfg["profiles"]:
                                if _normalize_prof(p.get("chrome_profile")) == norm_prof:
                                    if "phone" in active_profile_data:
                                        p["phone"] = active_profile_data["phone"]
                                    if "password" in active_profile_data:
                                        p["password"] = active_profile_data["password"]
                                    updated = True
                        
                        # 2. If not updated and only 1 profile exists, update it
                        if not updated and len(cfg["profiles"]) == 1:
                            if "phone" in active_profile_data:
                                cfg["profiles"][0]["phone"] = active_profile_data["phone"]
                            if "password" in active_profile_data:
                                cfg["profiles"][0]["password"] = active_profile_data["password"]
                            updated = True
                            
                        # 3. If multiple profiles and no prof_dir matched, update first enabled profile
                        if not updated:
                            for p in cfg["profiles"]:
                                if p.get("enabled", True):
                                    if "phone" in active_profile_data:
                                        p["phone"] = active_profile_data["phone"]
                                    if "password" in active_profile_data:
                                        p["password"] = active_profile_data["password"]
                                    break
                    
                    with open(config_path, "w", encoding="utf-8") as f:
                        json.dump(cfg, f, ensure_ascii=False, indent=2)
                        
                    last_config_ts = time.time()



                except Exception as e:
                    print(f"Error persisting profile to config.json: {e}")
                    
        return jsonify({"success": True, "active_profile": active_profile_data, "config_version": last_config_ts}), 200
    return jsonify({"active_profile": active_profile_data, "config_version": last_config_ts}), 200

@app.route("/api/config", methods=["GET"])
def get_extension_config():
    global active_profile_data, last_config_ts
    import json, os
    app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
    config_path = os.path.join(app_data_dir, "config.json")
    if not os.path.exists(config_path):
        default_config = os.path.join(os.path.dirname(__file__), "config.json")
        if os.path.exists(default_config):
            import shutil
            shutil.copy(default_config, config_path)
        else:
            with open(config_path, 'w', encoding='utf-8') as f: f.write("{}")
    
    rocket_accounts = []
    profiles = []
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                rocket_accounts = cfg.get("rocket_accounts", [])
                profiles = cfg.get("profiles", [])
                if not active_profile_data and cfg.get("active_profile"):
                    active_profile_data = cfg.get("active_profile")
        except Exception:
            pass
    return jsonify({
        "rocket_accounts": rocket_accounts,
        "profiles": profiles,
        "active_profile": active_profile_data,
        "config_version": last_config_ts
    }), 200

@socketio.on("connect")
def handle_connect():
    print("🔌 Client সংযুক্ত হয়েছে")
    socketio.emit("status_update", {
        "otps": otp_store.get_all_status()
    })

# ===== CLOUD SMS SYNC (MQTT) =====
try:
    import paho.mqtt.client as mqtt
    import hashlib
    from license_system.hwid import generate_hwid
    from license_system.crypto import decrypt_data
    import threading

    def get_pairing_code():
        hwid = generate_hwid()
        hash_hex = hashlib.md5(hwid.encode('utf-8')).hexdigest()
        nums = "".join(filter(str.isdigit, hash_hex))
        if len(nums) < 6:
            nums = nums + "123456"
        return nums[:6]

    PAIRING_CODE = get_pairing_code()
    MQTT_TOPIC = f"digonto_ivac_sms_{PAIRING_CODE}"
    MQTT_SYS_TOPIC = f"digonto_ivac_sms_{PAIRING_CODE}_sys"
    

    def load_device_config():
        import json, os
        app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
        config_path = os.path.join(app_data_dir, "devices.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except:
                pass
        return {}

    def save_device_config(config_data):
        import json, os
        app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
        os.makedirs(app_data_dir, exist_ok=True)
        config_path = os.path.join(app_data_dir, "devices.json")
        try:
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config_data, f, indent=2)
        except:
            pass

    saved_devices.update(load_device_config())

    def on_mqtt_connect(client, userdata, flags, rc):
        if rc == 0:
            print(f"[Cloud Sync] Connected. Listening on topics...")
            client.subscribe(MQTT_TOPIC)
            client.subscribe(MQTT_SYS_TOPIC)
            installed_key = get_installed_license_key()
            if installed_key:
                client.subscribe(f"digonto_kill_{installed_key}")
            client.subscribe("digonto_license_event")
        else:
            print(f"[Cloud Sync] Connect failed with code {rc}")

    def on_mqtt_message(client, userdata, msg):
        import json
        global last_license_status
        try:
            installed_key = get_installed_license_key()
            if msg.topic == f"digonto_kill_{installed_key}" or msg.topic == "digonto_license_event":
                data = json.loads(msg.payload.decode('utf-8'))
                target_key = data.get("key")
                action = data.get("action")
                if target_key == installed_key:
                    if action == "block":
                        print(f"[KILL SWITCH] Instant block received for {installed_key}!")
                        last_license_status = False
                        from license_system.license_manager import mark_license_blocked_locally
                        mark_license_blocked_locally(installed_key)
                        otp_store.clear_all()
                    elif action == "unblock":
                        last_license_status = True
                return
            if msg.topic == MQTT_SYS_TOPIC:
                payload = msg.payload.decode('utf-8')
                sys_data = json.loads(payload)
                if sys_data.get("type") == "ping":
                    dev_id = sys_data.get("device_id", "Unknown Device")
                    dev_model = sys_data.get("device_name", "Unknown Model")
                    
                    if dev_id not in saved_devices:
                        saved_devices[dev_id] = {
                            "custom_name": dev_model,
                            "is_active": True
                        }
                        save_device_config(saved_devices)
                        
                    sim1 = sys_data.get("sim1_name", "")
                    sim2 = sys_data.get("sim2_name", "")
                    c_name = saved_devices[dev_id].get("custom_name", dev_model)
                    import re
                    phone_matches = re.findall(r'\b(01[3-9]\d{8})\b', f"{sim1} {sim2} {c_name} {dev_model}")
                    
                    connected_devices[dev_id] = {
                        "device_id": dev_id,
                        "device_name": dev_model,
                        "custom_name": c_name,
                        "is_active": saved_devices[dev_id].get("is_active", True),
                        "sim1_name": sim1,
                        "sim2_name": sim2,
                        "phones": phone_matches,
                        "last_seen": time.time(),
                        "online": True
                    }
                elif sys_data.get("type") == "offline":
                    dev_id = sys_data.get("device_id")
                    if dev_id and dev_id in connected_devices:
                        connected_devices[dev_id]["online"] = False
                        connected_devices[dev_id]["last_seen"] = 0
                    # Send pong
                    pong = json.dumps({"type": "pong"}).encode('utf-8')
                    client.publish(MQTT_SYS_TOPIC, pong)
                return

            import base64
            payload = msg.payload.decode('utf-8')
            
            # Base64 Decode
            raw = base64.b64decode(payload)
            # XOR with pairing code
            key_bytes = PAIRING_CODE.encode('utf-8')
            decrypted_bytes = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(raw))
            decrypted = decrypted_bytes.decode('utf-8')
            
            data = json.loads(decrypted)
            
            dev_id = data.get("device_id", "Unknown")
            # If the device is explicitly turned off by the user, ignore the SMS
            if dev_id in saved_devices and not saved_devices[dev_id].get("is_active", True):
                print(f"[Cloud Sync] Ignored SMS from disabled device: {dev_id}")
                return
                
            phone = data.get("phone", "Unknown")
            sms_body = data.get("sms", "")
            sim_name = data.get("sim", "")
            
            print(f"[Cloud Sync] Received SMS via {sim_name} from {phone}")
            
            # Identify the actual destination Rocket Account number
            # Android sends the sender's number in "phone" and the SIM name in "sim_name".
            # The user names their SIM with the Rocket number (e.g., 01959166796).
            import re
            target_phones = []
            
            # Check if sim_name is a valid BD number
            sim_nums = re.findall(r'\b(01[3-9]\d{8})\b', sim_name)
            if sim_nums:
                target_phones.extend(sim_nums)
            
            # Fallback: check if the sender number is somehow the mapped one
            if not target_phones:
                phone_nums = re.findall(r'\b(01[3-9]\d{8})\b', phone)
                if phone_nums:
                    target_phones.extend(phone_nums)
                    
            if not target_phones:
                target_phones = [sim_name] if sim_name and sim_name != "Unknown SIM" else [phone]
            
            # Parse OTP
            digits, source = parse_otp_from_sms(sms_body)
            if digits and source:
                for target in set(target_phones):
                    otp_store.add_otp(target, digits, sms_body, source)
        except Exception as e:
            print("[Cloud Sync] Error processing message:", e)
            import traceback
            import os
            app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
            with open(os.path.join(app_data_dir, "mqtt_error.log"), "a", encoding="utf-8") as f:
                f.write(f"{time.time()} Error processing message: {e}\n{traceback.format_exc()}\n")

    def start_mqtt_client():
        try:
            client = mqtt.Client()
            client.on_connect = on_mqtt_connect
            client.on_message = on_mqtt_message
            client.connect_async("broker.emqx.io", 1883, 60)
            client.loop_start()
        except Exception as e:
            print("[Cloud Sync] Failed to start MQTT client:", e)

    # Start it automatically
    start_mqtt_client()
except ImportError as e:
    print("[Cloud Sync] Dependency missing:", e)
except Exception as e:
    print("[Cloud Sync] Init error:", e)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)


