"""
IVAC Auto Fill — Hardware ID (Device Fingerprint)
Windows MachineGuid এবং আধুনিক হার্ডওয়্যার তথ্য মিলিয়ে স্থায়ী ও নির্ভরযোগ্য ইউনিক আইডি তৈরি করে।
পিসি রিস্টার্ট, নেটওয়ার্ক পরিবর্তন বা ওয়াইফাই বদলে গেলেও এটি সারাজীবন অপরিবর্তনশীল থাকে।
"""

import subprocess
import hashlib
import uuid
import platform
import os
import winreg


def get_machine_guid() -> str:
    """
    Windows Registry থেকে মেশিন ক্রিপ্টোগ্রাফিক ইউনিক গাইড সংগ্রহ করে (100% অপরিবর্তনীয়)।
    64-bit ও 32-bit উভয় ভিউ সাপোর্ট করে।
    """
    for flag in [winreg.KEY_WOW64_64KEY, 0]:
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ | flag) as k:
                guid, _ = winreg.QueryValueEx(k, "MachineGuid")
                if guid and len(guid.strip()) > 10:
                    return guid.strip().upper()
        except Exception:
            pass
    return ""


def _run_wmic(command: str) -> str:
    """Windows WMIC কমান্ড চালায় (যদি ওএসে ইনস্টল থাকে)।"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        )
        lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
        if len(lines) >= 2:
            return lines[1]
        return ""
    except Exception:
        return ""


def _run_ps(cmd: str) -> str:
    """PowerShell CIM কমান্ড চালায় আধুনিক Windows 11-এর জন্য।"""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        )
        res = result.stdout.strip()
        if res and "error" not in res.lower():
            return res
    except Exception:
        pass
    return ""


def get_cpu_id() -> str:
    """CPU Processor ID সংগ্রহ করে।"""
    val = _run_wmic("wmic cpu get ProcessorId")
    if not val:
        val = _run_ps("(Get-CimInstance Win32_Processor).ProcessorId")
    return val or ""


def get_motherboard_serial() -> str:
    """Motherboard Serial Number সংগ্রহ করে।"""
    serial = _run_wmic("wmic baseboard get SerialNumber")
    if not serial or "to be filled" in serial.lower() or "default" in serial.lower():
        serial = _run_ps("(Get-CimInstance Win32_BaseBoard).SerialNumber")
    if not serial or "to be filled" in serial.lower() or "default" in serial.lower():
        serial = _run_wmic("wmic bios get SerialNumber")
    if not serial or "to be filled" in serial.lower() or "default" in serial.lower():
        serial = _run_ps("(Get-CimInstance Win32_BIOS).SerialNumber")
    return serial or ""


def get_disk_serial() -> str:
    """Primary Disk Drive Serial Number সংগ্রহ করে।"""
    val = _run_wmic("wmic diskdrive where Index=0 get SerialNumber")
    if not val:
        val = _run_ps("(Get-CimInstance Win32_DiskDrive)[0].SerialNumber")
    return val or ""


def get_mac_address() -> str:
    """Primary MAC Address সংগ্রহ করে।"""
    mac_int = uuid.getnode()
    mac = ':'.join(f'{(mac_int >> (8 * i)) & 0xff:02x}' for i in range(5, -1, -1))
    return mac


def get_machine_name() -> str:
    """Machine/Computer Name সংগ্রহ করে।"""
    return platform.node()


def generate_hwid() -> str:
    """
    স্থায়ী ও অপরিবর্তনীয় Hardware ID (HWID) তৈরি করে।
    Windows MachineGuid এবং পার্মানেন্ট হার্ডওয়্যারের সমন্বয়ে তৈরি, যা রিস্টার্ট বা নেটওয়ার্ক পরিবর্তনে কখনোই পরিবর্তন হয় না।
    
    Returns:
        str: 32-character হেক্সাডেসিমাল HWID
    """
    components = []

    # 1. Primary Rock-Solid Anchor: Windows MachineGuid (100% অপরিবর্তনীয়)
    guid = get_machine_guid()
    if guid:
        components.append(f"GUID:{guid}")

    # 2. Motherboard Serial
    mb = get_motherboard_serial()
    if mb:
        components.append(f"MB:{mb}")

    # 3. CPU ID
    cpu = get_cpu_id()
    if cpu:
        components.append(f"CPU:{cpu}")

    # 4. Machine Name
    machine = get_machine_name()
    if machine:
        components.append(f"NAME:{machine}")

    # Fallback (যদি কোনো কারণে উপরেরগুলো না পাওয়া যায়)
    if not components:
        disk = get_disk_serial()
        if disk:
            components.append(f"DISK:{disk}")
        mac = get_mac_address()
        if mac:
            components.append(f"MAC:{mac}")

    if not components:
        raise RuntimeError("হার্ডওয়্যার তথ্য সংগ্রহ করা সম্ভব হয়নি!")

    combined = "|".join(sorted(components))
    hwid = hashlib.sha256(combined.encode('utf-8')).hexdigest()[:32].upper()
    return hwid


def get_hwid_display() -> str:
    """HWID কে মানুষের পড়ার উপযোগী ফরম্যাটে দেখায়।"""
    hwid = generate_hwid()
    return '-'.join(hwid[i:i+4] for i in range(0, len(hwid), 4))


# ==============================================================================
# Legacy Compatibility & Seamless Migration Helpers
# ==============================================================================

def get_legacy_hwid() -> str:
    """
    পূর্বের পুরনো অ্যালগরিদম অনুযায়ী HWID বের করে (বিদ্যমান গ্রাহকদের অটো-মাইগ্রেশনের জন্য)।
    """
    components = []
    cpu = _run_wmic("wmic cpu get ProcessorId")
    if cpu: components.append(f"CPU:{cpu}")
    
    mb = _run_wmic("wmic baseboard get SerialNumber")
    if mb and "to be filled" not in mb.lower() and "default" not in mb.lower():
        components.append(f"MB:{mb}")
    else:
        bios = _run_wmic("wmic bios get SerialNumber")
        if bios: components.append(f"MB:{bios}")
        
    disk = _run_wmic("wmic diskdrive where Index=0 get SerialNumber")
    if disk: components.append(f"DISK:{disk}")
    
    mac = get_mac_address()
    if mac: components.append(f"MAC:{mac}")
    
    machine = get_machine_name()
    if machine: components.append(f"NAME:{machine}")
    
    if not components:
        return ""
    combined = "|".join(sorted(components))
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()[:32].upper()


def get_all_candidate_legacy_hwids() -> list:
    """
    পিসির সকল নেটওয়ার্ক অ্যাডাপ্টারের MAC অ্যাড্রেসের ওপর ভিত্তি করে সম্ভাব্য সকল পুরনো HWID রিটার্ন করে।
    যাতে গ্রাহকের যেকোনো অ্যাডাপ্টারে লাইসেন্স আবদ্ধ থাকলেও তা অটো-ডিটেক্ট হতে পারে।
    """
    candidates = set()
    leg = get_legacy_hwid()
    if leg:
        candidates.add(leg)
        
    # সকল নেটওয়ার্ক অ্যাডাপ্টারের ম্যাক সংগ্রহ
    mac_list = []
    try:
        result = subprocess.run(["getmac", "/fo", "csv", "/nh"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.strip().splitlines():
            parts = line.replace('"', '').split(',')
            if parts and len(parts) >= 1:
                m = parts[0].strip().replace('-', ':').lower()
                if len(m) == 17 and m not in mac_list:
                    mac_list.append(m)
    except Exception:
        pass
        
    base_components = []
    cpu = _run_wmic("wmic cpu get ProcessorId")
    if cpu: base_components.append(f"CPU:{cpu}")
    mb = _run_wmic("wmic baseboard get SerialNumber")
    if mb and "to be filled" not in mb.lower() and "default" not in mb.lower():
        base_components.append(f"MB:{mb}")
    disk = _run_wmic("wmic diskdrive where Index=0 get SerialNumber")
    if disk: base_components.append(f"DISK:{disk}")
    machine = get_machine_name()
    if machine: base_components.append(f"NAME:{machine}")
    
    for m in mac_list:
        comps = list(base_components)
        comps.append(f"MAC:{m}")
        combined = "|".join(sorted(comps))
        h = hashlib.sha256(combined.encode('utf-8')).hexdigest()[:32].upper()
        candidates.add(h)
        
    return list(candidates)


def get_pairing_code() -> str:
    """
    মোবাইল পেয়ারিং কোড রিটার্ন করে।
    বিদ্যমান ইউজারদের পেয়ারিং কোড অক্ষুণ্ণ রাখতে এটি লোকাল ফাইল থেকে লোড করে,
    অথবা লিগ্যাসি অ্যালগরিদম দিয়ে বের করে চিরতরে সেভ করে রাখে।
    """
    app_data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
    os.makedirs(app_data_dir, exist_ok=True)
    pairing_file = os.path.join(app_data_dir, "pairing_code.dat")
    devices_file = os.path.join(app_data_dir, "devices.json")
    license_file = os.path.join(app_data_dir, "license.dat")
    
    # ১. যদি পূর্বে সেভ করা কোড থাকে, সরাসরি সেটি ব্যবহার করো
    if os.path.exists(pairing_file):
        try:
            with open(pairing_file, "r", encoding="utf-8") as f:
                code = f.read().strip()
                if len(code) == 6 and code.isdigit():
                    return code
        except Exception:
            pass
            
    # ২. যদি ফাইল না থাকে কিন্তু বিদ্যমান ইনস্টলেশন থাকে (devices.json বা license.dat আছে)
    code = None
    if os.path.exists(devices_file) or os.path.exists(license_file):
        try:
            legacy_h = get_legacy_hwid()
            if legacy_h:
                h_hex = hashlib.md5(legacy_h.encode('utf-8')).hexdigest()
                nums = "".join(filter(str.isdigit, h_hex))
                code = (nums + "123456")[:6]
        except Exception:
            pass
            
    # ৩. যদি একদম ব্র্যান্ড-নিউ ইনস্টলেশন হয়
    if not code:
        new_h = generate_hwid()
        h_hex = hashlib.md5(new_h.encode('utf-8')).hexdigest()
        nums = "".join(filter(str.isdigit, h_hex))
        code = (nums + "123456")[:6]
        
    # চিরতরে সেভ করে রাখো
    try:
        with open(pairing_file, "w", encoding="utf-8") as f:
            f.write(code)
    except Exception:
        pass
        
    return code


if __name__ == "__main__":
    print("=" * 50)
    print("  IVAC Hardware ID Generator (Upgraded)")
    print("=" * 50)
    print(f"  MachineGuid:  {get_machine_guid()}")
    print(f"  CPU ID:       {get_cpu_id()}")
    print(f"  Motherboard:  {get_motherboard_serial()}")
    print(f"  Disk Serial:  {get_disk_serial()}")
    print(f"  MAC Address:  {get_mac_address()}")
    print(f"  Machine Name: {get_machine_name()}")
    print("-" * 50)
    print(f"  Permanent HWID: {generate_hwid()}")
    print(f"  Legacy HWID:    {get_legacy_hwid()}")
    print(f"  Pairing Code:   {get_pairing_code()}")
    print("=" * 50)
