"""
IVAC Auto Fill — Hardware ID (Device Fingerprint)
Windows MachineGuid এবং আধুনিক হার্ডওয়্যার তথ্য মিলিয়ে স্থায়ী ও নির্ভরযোগ্য ইউনিক আইডি তৈরি করে।
পিসি রিস্টার্ট, নেটওয়ার্ক পরিবর্তন বা ওয়াইফাই বদলে গেলেও এটি সারাজীবন অপরিবর্তনশীল থাকে।
Ultra-fast instant startup (< 1ms) with local caching.
"""

import subprocess
import hashlib
import uuid
import platform
import os
import winreg

_APP_DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), "IVAC_Auto_Fill")
_HWID_FILE = os.path.join(_APP_DATA_DIR, "hwid.dat")
_PAIRING_FILE = os.path.join(_APP_DATA_DIR, "pairing_code.dat")

_CACHED_GUID = None
_CACHED_HWID = None


def get_machine_guid() -> str:
    """
    Windows Registry থেকে মেশিন ক্রিপ্টোগ্রাফিক ইউনিক গাইড সংগ্রহ করে (100% অপরিবর্তনীয়)।
    Takes < 0.01ms.
    """
    global _CACHED_GUID
    if _CACHED_GUID:
        return _CACHED_GUID
        
    for flag in [winreg.KEY_WOW64_64KEY, 0]:
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ | flag) as k:
                guid, _ = winreg.QueryValueEx(k, "MachineGuid")
                if guid and len(guid.strip()) > 10:
                    _CACHED_GUID = guid.strip().upper()
                    return _CACHED_GUID
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
            timeout=3,
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
            timeout=4,
            creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        )
        res = result.stdout.strip()
        if res and "error" not in res.lower():
            return res
    except Exception:
        pass
    return ""


def _get_hardware_details():
    """সিপিইউ এবং মাদারবোর্ড সিরিয়াল দ্রুত সংগ্রহ করে।"""
    cpu, mb = "", ""
    # 1. দ্রুত WMIC চেষ্টা করো (যদি থাকে, 0.05 সেকেন্ডে আসবে)
    cpu = _run_wmic("wmic cpu get ProcessorId")
    mb = _run_wmic("wmic baseboard get SerialNumber")
    if mb and ("to be filled" in mb.lower() or "default" in mb.lower()):
        mb = _run_wmic("wmic bios get SerialNumber")
        
    if cpu and mb:
        return cpu, mb
        
    # 2. যদি WMIC না থাকে (উইন্ডোজ ১১), একটি মাত্র PowerShell কমান্ডে দুটোই নিয়ে এসো
    try:
        ps_cmd = '$c=(Get-CimInstance Win32_Processor).ProcessorId; $m=(Get-CimInstance Win32_BaseBoard).SerialNumber; Write-Output "$c|$m"'
        res = _run_ps(ps_cmd)
        if "|" in res:
            parts = res.split("|", 1)
            if not cpu and parts[0].strip():
                cpu = parts[0].strip()
            if not mb and parts[1].strip():
                mb = parts[1].strip()
    except Exception:
        pass
        
    return cpu, mb


def get_cpu_id() -> str:
    cpu, _ = _get_hardware_details()
    return cpu


def get_motherboard_serial() -> str:
    _, mb = _get_hardware_details()
    return mb


def get_disk_serial() -> str:
    val = _run_wmic("wmic diskdrive where Index=0 get SerialNumber")
    if not val:
        val = _run_ps("(Get-CimInstance Win32_DiskDrive)[0].SerialNumber")
    return val or ""


def get_mac_address() -> str:
    mac_int = uuid.getnode()
    mac = ':'.join(f'{(mac_int >> (8 * i)) & 0xff:02x}' for i in range(5, -1, -1))
    return mac


def get_machine_name() -> str:
    return platform.node()


def generate_hwid() -> str:
    """
    স্থায়ী ও অপরিবর্তনীয় Hardware ID (HWID) তৈরি করে।
    Ultra-fast instant lookup (< 1 millisecond via in-memory and disk cache).
    
    Returns:
        str: 32-character হেক্সাডেসিমাল HWID
    """
    global _CACHED_HWID
    if _CACHED_HWID:
        return _CACHED_HWID

    guid = get_machine_guid()

    # 1. লোকাল ক্যাশ চেক (Instant < 1ms)
    if os.path.exists(_HWID_FILE) and guid:
        try:
            with open(_HWID_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if "|" in content:
                    saved_guid, saved_hwid = content.split("|", 1)
                    if saved_guid == guid and len(saved_hwid) == 32:
                        _CACHED_HWID = saved_hwid
                        return _CACHED_HWID
        except Exception:
            pass

    # 2. প্রথমবার রান হলে হার্ডওয়্যার থেকে তৈরি করো
    components = []
    if guid:
        components.append(f"GUID:{guid}")

    cpu, mb = _get_hardware_details()
    if mb:
        components.append(f"MB:{mb}")
    if cpu:
        components.append(f"CPU:{cpu}")

    machine = get_machine_name()
    if machine:
        components.append(f"NAME:{machine}")

    if not components:
        mac = get_mac_address()
        if mac:
            components.append(f"MAC:{mac}")

    if not components:
        raise RuntimeError("হার্ডওয়্যার তথ্য সংগ্রহ করা সম্ভব হয়নি!")

    combined = "|".join(sorted(components))
    hwid = hashlib.sha256(combined.encode('utf-8')).hexdigest()[:32].upper()
    _CACHED_HWID = hwid

    # ডিস্কে ক্যাশ করে রাখো যাতে পরবর্তী সব স্টার্টআপ < 1ms এ ওপেন হয়
    if guid:
        try:
            os.makedirs(_APP_DATA_DIR, exist_ok=True)
            with open(_HWID_FILE, "w", encoding="utf-8") as f:
                f.write(f"{guid}|{hwid}")
        except Exception:
            pass

    return hwid


def get_hwid_display() -> str:
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
    """
    candidates = set()
    leg = get_legacy_hwid()
    if leg:
        candidates.add(leg)
        
    mac_list = []
    try:
        result = subprocess.run(["getmac", "/fo", "csv", "/nh"], capture_output=True, text=True, timeout=3)
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
    Takes < 1ms via local cache.
    """
    # ১. পূর্বে সেভ করা কোড থাকলে সরাসরি রিটার্ন করো (< 0.5ms)
    if os.path.exists(_PAIRING_FILE):
        try:
            with open(_PAIRING_FILE, "r", encoding="utf-8") as f:
                code = f.read().strip()
                if len(code) == 6 and code.isdigit():
                    return code
        except Exception:
            pass
            
    # ২. যদি ফাইল না থাকে কিন্তু বিদ্যমান ইনস্টলেশন থাকে (devices.json বা license.dat আছে)
    devices_file = os.path.join(_APP_DATA_DIR, "devices.json")
    license_file = os.path.join(_APP_DATA_DIR, "license.dat")
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
            
    # ৩. একদম নতুন ইনস্টলেশন
    if not code:
        new_h = generate_hwid()
        h_hex = hashlib.md5(new_h.encode('utf-8')).hexdigest()
        nums = "".join(filter(str.isdigit, h_hex))
        code = (nums + "123456")[:6]
        
    try:
        os.makedirs(_APP_DATA_DIR, exist_ok=True)
        with open(_PAIRING_FILE, "w", encoding="utf-8") as f:
            f.write(code)
    except Exception:
        pass
        
    return code
