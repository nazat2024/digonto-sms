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

class OTPStore:
    def __init__(self):
        self._store: Dict[str, dict] = {}
        self._lock = threading.Lock()

    def add_otp(self, phone: str, digits: List[int], raw_sms: str = ""):
        with self._lock:
            otp_data = {
                "phone": phone,
                "digits": digits,
                "otp_string": digits_to_string(digits),
                "display": format_otp_display(digits),
                "raw_sms": raw_sms,
                "timestamp": datetime.now().isoformat(),
                "used": False
            }
            self._store[phone] = otp_data
            
            # Broadcast to dashboard and extensions
            socketio.emit("otp_received", otp_data)
            print(f"✅ OTP সংরক্ষিত: {phone} → {otp_data['display']}")
            return otp_data

    def get_otp(self, phone: str) -> Optional[dict]:
        with self._lock:
            # শুধুমাত্র এই নির্দিষ্ট নম্বরের অব্যবহৃত OTP ই দেবে
            if phone in self._store and not self._store[phone]["used"]:
                return self._store[phone]
                
            return None

    def mark_used(self, phone: str):
        with self._lock:
            if phone in self._store:
                self._store[phone]["used"] = True
                socketio.emit("otp_used", {"phone": phone})

    def get_all_status(self) -> List[dict]:
        with self._lock:
            return list(self._store.values())

    def clear(self, phone: str = None):
        with self._lock:
            if phone:
                self._store.pop(phone, None)
            else:
                self._store.clear()

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
    
    digits = parse_otp_from_sms(sms_body)
    if digits:
        last_otp_data = None
        for p in phones:
            last_otp_data = otp_store.add_otp(p, digits, sms_body)
            
        return jsonify({
            "success": True,
            "otp": last_otp_data["otp_string"] if last_otp_data else "",
            "display": last_otp_data["display"] if last_otp_data else "",
            "digits": digits
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": "OTP parse করা যায়নি",
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
    otp_data = otp_store.get_otp(phone)
    if otp_data:
        # Mark as used automatically when fetched by extension? 
        # Actually it's better if extension just fetches it, we can mark it used.
        return jsonify({"success": True, "data": otp_data}), 200
    return jsonify({"success": False, "error": "OTP পাওয়া যায়নি"}), 404

@app.route("/api/otp/<phone>/used", methods=["POST"])
def mark_otp_used(phone):
    """Extension calls this when OTP is filled successfully"""
    otp_store.mark_used(phone)
    return jsonify({"success": True}), 200

@app.route("/api/status", methods=["GET"])
def get_status():
    devices = []
    current_time = time.time()
    for dev_id, data in list(connected_devices.items()):
        if current_time - data["last_seen"] > 10:
            data["online"] = False
        devices.append(data)
        
    return jsonify({
        "otps": otp_store.get_all_status(),
        "devices": devices
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
    otp_store.clear(phone)
    socketio.emit("cleared", {"phone": phone})
    return jsonify({"success": True}), 200

@app.route("/api/payment", methods=["POST"])
def payment():
    from license_system.license_manager import record_payment
    data = request.get_json(force=True, silent=True) or {}
    amount = data.get("amount", 0)
    status = data.get("status", "initiated")
    stage = data.get("stage", "pay_clicked")
    rocket_account = data.get("rocket_account", "")
    description = data.get("description", "")
    
    payment_id = record_payment(amount, status, stage, rocket_account, description)
    return jsonify({"success": bool(payment_id), "payment_id": payment_id}), 200

@app.route("/api/payment/update", methods=["POST"])
def payment_update():
    from license_system.license_manager import update_payment_stage
    data = request.get_json(force=True, silent=True) or {}
    payment_id = data.get("payment_id")
    stage = data.get("stage")
    status = data.get("status")
    
    if not payment_id or not stage:
        return jsonify({"success": False, "error": "payment_id and stage are required"}), 400
        
    success = update_payment_stage(payment_id, stage, status)
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

last_license_status = None
last_license_check_time = 0

@app.route("/api/license-status", methods=["GET", "POST"])
def license_status():
    global last_license_status, last_license_check_time
    import time
    from license_system.license_manager import check_license
    
    # Cache for 10 minutes to prevent Firebase limit exhaustion
    if time.time() - last_license_check_time > 600 or last_license_status is None:
        info = check_license()
        last_license_status = info.is_valid
        last_license_check_time = time.time()
        
    return jsonify({"active": last_license_status}), 200

@app.route("/api/config", methods=["GET"])
def get_extension_config():
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
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                rocket_accounts = cfg.get("rocket_accounts", [])
        except Exception:
            pass
    return jsonify({"rocket_accounts": rocket_accounts}), 200

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
    
    connected_devices = {}

    def on_mqtt_connect(client, userdata, flags, rc):
        if rc == 0:
            print(f"[Cloud Sync] Connected. Listening on topics...")
            client.subscribe(MQTT_TOPIC)
            client.subscribe(MQTT_SYS_TOPIC)
        else:
            print(f"[Cloud Sync] Connect failed with code {rc}")

    def on_mqtt_message(client, userdata, msg):
        try:
            if msg.topic == MQTT_SYS_TOPIC:
                payload = msg.payload.decode('utf-8')
                sys_data = __import__('json').loads(payload)
                if sys_data.get("type") == "ping":
                    dev_id = sys_data.get("device_id", "Unknown Device")
                    connected_devices[dev_id] = {
                        "device_id": dev_id,
                        "sim1_name": sys_data.get("sim1_name", ""),
                        "sim2_name": sys_data.get("sim2_name", ""),
                        "last_seen": time.time(),
                        "online": True
                    }
                    # Send pong
                    pong = __import__('json').dumps({"type": "pong"}).encode('utf-8')
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
            
            data = __import__('json').loads(decrypted)
            
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
            digits = parse_otp_from_sms(sms_body)
            if digits:
                for target in set(target_phones):
                    otp_store.add_otp(target, digits, sms_body)
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


