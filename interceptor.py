import paho.mqtt.client as mqtt  # type: ignore
import base64
import json
import time
import os

PAIRING_CODE = '656892'
log_file = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'IVAC_Auto_Fill', 'mqtt_interceptor.log')

def on_connect(client, userdata, flags, rc):
    print("Connected!")
    client.subscribe(f"digonto_ivac_sms_{PAIRING_CODE}")

def on_message(client, userdata, msg):
    try:
        raw = base64.b64decode(msg.payload.decode('utf-8'))
        key = PAIRING_CODE.encode('utf-8')
        dec = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw)).decode('utf-8', errors='replace')
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"[{time.time()}] {dec}\n")
    except Exception as e:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"[{time.time()}] ERROR: {e}\n")

c = mqtt.Client()
c.on_connect = on_connect
c.on_message = on_message
c.connect('broker.emqx.io', 1883, 60)
c.loop_forever()
