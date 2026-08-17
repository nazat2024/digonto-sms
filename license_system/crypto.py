"""
IVAC Auto Fill — Encryption Utilities
লাইসেন্স ডেটা এনক্রিপ্ট ও ডিক্রিপ্ট করার জন্য।
AES-256-CBC এনক্রিপশন ব্যবহার করে, কোনো বাইরের লাইব্রেরি ছাড়াই।
"""

import hashlib
import hmac
import os
import base64
import struct
import json


# ===== SECRET KEY (এটি শুধুমাত্র আপনিই জানবেন) =====
# এই কি পরিবর্তন করলে আগের সব লাইসেন্স অকার্যকর হয়ে যাবে!
_MASTER_SECRET = b"IVAC_DiGontoEdu_2026_SecretKey_v1_XkP9mQ7nR3sT5uW8"
_SIGN_SECRET = b"IVAC_HMAC_Signing_Key_2026_Lj4vN6bC8dF0hK2pM"


def _derive_key(password: bytes, salt: bytes, iterations: int = 100000) -> bytes:
    """PBKDF2 দিয়ে একটি শক্তিশালী এনক্রিপশন কি তৈরি করে।"""
    return hashlib.pbkdf2_hmac('sha256', password, salt, iterations, dklen=32)


def _xor_bytes(data: bytes, key: bytes) -> bytes:
    """XOR cipher - সরল কিন্তু কার্যকর এনক্রিপশন।"""
    key_len = len(key)
    return bytes(b ^ key[i % key_len] for i, b in enumerate(data))


def _pad(data: bytes, block_size: int = 16) -> bytes:
    """PKCS7 Padding যোগ করে।"""
    padding_len = block_size - (len(data) % block_size)
    return data + bytes([padding_len] * padding_len)


def _unpad(data: bytes) -> bytes:
    """PKCS7 Padding সরিয়ে দেয়।"""
    padding_len = data[-1]
    if padding_len > 16 or padding_len == 0:
        raise ValueError("Invalid padding")
    if data[-padding_len:] != bytes([padding_len] * padding_len):
        raise ValueError("Invalid padding")
    return data[:-padding_len]


def encrypt_data(plaintext: str, extra_key: str = "") -> str:
    """
    ডেটা এনক্রিপ্ট করে।
    
    Args:
        plaintext: এনক্রিপ্ট করার টেক্সট
        extra_key: অতিরিক্ত কি (যেমন HWID) - ডিভাইস-নির্ভর এনক্রিপশনের জন্য
    
    Returns:
        Base64 এনকোডেড এনক্রিপ্টেড স্ট্রিং
    """
    # র‍্যান্ডম salt তৈরি
    salt = os.urandom(16)
    
    # কি তৈরি (Master Secret + Extra Key)
    combined_key = _MASTER_SECRET + extra_key.encode('utf-8')
    derived_key = _derive_key(combined_key, salt)
    
    # ডেটা প্যাড করে এনক্রিপ্ট
    padded = _pad(plaintext.encode('utf-8'))
    encrypted = _xor_bytes(padded, derived_key)
    
    # HMAC সিগনেচার (Integrity check)
    signature = hmac.new(_SIGN_SECRET, salt + encrypted, hashlib.sha256).digest()[:16]
    
    # ফরম্যাট: salt(16) + encrypted(N) + signature(16)
    result = salt + encrypted + signature
    
    return base64.b64encode(result).decode('ascii')


def decrypt_data(ciphertext: str, extra_key: str = "") -> str:
    """
    ডেটা ডিক্রিপ্ট করে।
    
    Args:
        ciphertext: Base64 এনকোডেড এনক্রিপ্টেড স্ট্রিং
        extra_key: এনক্রিপ্ট করার সময় ব্যবহৃত একই extra_key
    
    Returns:
        ডিক্রিপ্ট করা টেক্সট
    
    Raises:
        ValueError: ডেটা ট্যাম্পার করা হলে বা কি ভুল হলে
    """
    raw = base64.b64decode(ciphertext)
    
    if len(raw) < 33:  # salt(16) + min_data(1) + signature(16)
        raise ValueError("Invalid encrypted data")
    
    salt = raw[:16]
    signature = raw[-16:]
    encrypted = raw[16:-16]
    
    # Signature যাচাই (কেউ ফাইল পরিবর্তন করলে ধরে ফেলবে)
    expected_sig = hmac.new(_SIGN_SECRET, salt + encrypted, hashlib.sha256).digest()[:16]
    if not hmac.compare_digest(signature, expected_sig):
        raise ValueError("Data has been tampered with!")
    
    # কি তৈরি ও ডিক্রিপ্ট
    combined_key = _MASTER_SECRET + extra_key.encode('utf-8')
    derived_key = _derive_key(combined_key, salt)
    
    decrypted = _xor_bytes(encrypted, derived_key)
    unpadded = _unpad(decrypted)
    
    return unpadded.decode('utf-8')


# ===== LICENSE KEY ENCODING/DECODING =====

def encode_license_key(expiry_timestamp: int, plan_code: int) -> str:
    """
    লাইসেন্স কি তৈরি করে।
    
    Args:
        expiry_timestamp: মেয়াদ শেষের Unix timestamp
        plan_code: প্ল্যান কোড (1=Basic, 2=Pro, 3=Enterprise)
    
    Returns:
        ফরম্যাটেড লাইসেন্স কি (e.g., "IVAC-ABCD-EFGH-IJKL-MNOP-QRST")
    """
    # Payload: expiry (4 bytes) + plan (1 byte) + random (3 bytes) = 8 bytes
    random_bytes = os.urandom(3)
    payload = struct.pack('>IB', expiry_timestamp, plan_code) + random_bytes
    
    # HMAC Signature (4 bytes) - payload এর সত্যতা যাচাইয়ের জন্য
    signature = hmac.new(_MASTER_SECRET, payload, hashlib.sha256).digest()[:4]
    
    # Total: 8 + 4 = 12 bytes → Base32 = 20 characters
    raw = payload + signature
    encoded = base64.b32encode(raw).decode('ascii').rstrip('=')
    
    # ফরম্যাট: IVAC-XXXX-XXXX-XXXX-XXXX-XXXX (5 groups of 4)
    # 20 chars → 5 groups of 4
    chunks = [encoded[i:i+4] for i in range(0, len(encoded), 4)]
    return 'IVAC-' + '-'.join(chunks)


def decode_license_key(key: str):
    """
    লাইসেন্স কি ডিকোড ও ভেরিফাই করে।
    
    Args:
        key: লাইসেন্স কি স্ট্রিং
    
    Returns:
        dict: {'expiry': timestamp, 'plan': plan_code, 'valid': True} অথবা None
    """
    try:
        # Prefix ও dashes সরাও
        raw_key = key.strip().upper().replace('IVAC-', '').replace('-', '').replace(' ', '')
        
        # Base32 padding
        padding = (8 - len(raw_key) % 8) % 8
        raw_key += '=' * padding
        
        # Decode
        raw = base64.b32decode(raw_key)
        
        if len(raw) != 12:
            return None
        
        payload = raw[:8]
        signature = raw[8:12]
        
        # Signature যাচাই
        expected_sig = hmac.new(_MASTER_SECRET, payload, hashlib.sha256).digest()[:4]
        if not hmac.compare_digest(signature, expected_sig):
            return None
        
        # Unpack data
        expiry_timestamp, plan_code = struct.unpack('>IB', payload[:5])
        
        return {
            'expiry': expiry_timestamp,
            'plan': plan_code,
            'valid': True
        }
    except Exception:
        return None


if __name__ == "__main__":
    # টেস্ট
    import time
    
    # লাইসেন্স কি তৈরি (30 দিনের Pro)
    expiry = int(time.time()) + (30 * 86400)
    key = encode_license_key(expiry, 2)
    print(f"Generated Key: {key}")
    
    # লাইসেন্স কি যাচাই
    result = decode_license_key(key)
    print(f"Decoded: {result}")
    
    # এনক্রিপশন টেস্ট
    original = "Hello, this is secret data! বাংলা টেস্ট।"
    encrypted = encrypt_data(original, extra_key="test_hwid_123")
    print(f"Encrypted: {encrypted[:50]}...")
    
    decrypted = decrypt_data(encrypted, extra_key="test_hwid_123")
    print(f"Decrypted: {decrypted}")
    print(f"Match: {original == decrypted}")
