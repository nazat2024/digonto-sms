"""
IVAC Auto Fill — Hardware ID (Device Fingerprint)
প্রতিটি কম্পিউটারের ইউনিক আইডি তৈরি করে।
CPU, Motherboard, Disk, MAC Address মিলিয়ে একটি অনন্য ফিঙ্গারপ্রিন্ট তৈরি হয়।
"""

import subprocess
import hashlib
import uuid
import platform
import os


def _run_wmic(command):
    """Windows WMIC কমান্ড চালায় এবং আউটপুট রিটার্ন করে।"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        )
        lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
        # প্রথম লাইন হেডার, দ্বিতীয় লাইন ডেটা
        if len(lines) >= 2:
            return lines[1]
        return ""
    except Exception:
        return ""


def get_cpu_id():
    """CPU Processor ID সংগ্রহ করে।"""
    return _run_wmic("wmic cpu get ProcessorId")


def get_motherboard_serial():
    """Motherboard Serial Number সংগ্রহ করে।"""
    serial = _run_wmic("wmic baseboard get SerialNumber")
    # কিছু মাদারবোর্ডে "To be filled by O.E.M." লেখা থাকে
    if serial and "to be filled" not in serial.lower() and "default" not in serial.lower():
        return serial
    # Fallback: BIOS Serial
    return _run_wmic("wmic bios get SerialNumber")


def get_disk_serial():
    """Primary Disk Drive Serial Number সংগ্রহ করে।"""
    return _run_wmic("wmic diskdrive where Index=0 get SerialNumber")


def get_mac_address():
    """Primary MAC Address সংগ্রহ করে।"""
    mac_int = uuid.getnode()
    mac = ':'.join(f'{(mac_int >> (8 * i)) & 0xff:02x}' for i in range(5, -1, -1))
    return mac


def get_machine_name():
    """Machine/Computer Name সংগ্রহ করে।"""
    return platform.node()


def generate_hwid():
    """
    সকল হার্ডওয়্যার তথ্য মিলিয়ে একটি ইউনিক Hardware ID (HWID) তৈরি করে।
    
    Returns:
        str: 32-character হেক্সাডেসিমাল HWID
    """
    components = []

    # CPU ID
    cpu = get_cpu_id()
    if cpu:
        components.append(f"CPU:{cpu}")

    # Motherboard Serial
    mb = get_motherboard_serial()
    if mb:
        components.append(f"MB:{mb}")

    # Disk Serial
    disk = get_disk_serial()
    if disk:
        components.append(f"DISK:{disk}")

    # MAC Address
    mac = get_mac_address()
    if mac:
        components.append(f"MAC:{mac}")

    # Machine Name (fallback component)
    machine = get_machine_name()
    if machine:
        components.append(f"NAME:{machine}")

    if not components:
        raise RuntimeError("হার্ডওয়্যার তথ্য সংগ্রহ করা সম্ভব হয়নি!")

    # সবকিছু মিলিয়ে SHA-256 হ্যাশ তৈরি
    combined = "|".join(sorted(components))
    hwid = hashlib.sha256(combined.encode('utf-8')).hexdigest()[:32].upper()

    return hwid


def get_hwid_display():
    """
    HWID কে মানুষের পড়ার উপযোগী ফরম্যাটে দেখায়।
    
    Returns:
        str: ফরম্যাটেড HWID (e.g., "A3F7-K9M2-X5P8-J1C4-B2D6-E8G0-H4I7-L5N3")
    """
    hwid = generate_hwid()
    return '-'.join(hwid[i:i+4] for i in range(0, len(hwid), 4))


if __name__ == "__main__":
    print("=" * 50)
    print("  IVAC Hardware ID Generator")
    print("=" * 50)
    print(f"  CPU ID:       {get_cpu_id()}")
    print(f"  Motherboard:  {get_motherboard_serial()}")
    print(f"  Disk Serial:  {get_disk_serial()}")
    print(f"  MAC Address:  {get_mac_address()}")
    print(f"  Machine Name: {get_machine_name()}")
    print("-" * 50)
    print(f"  HWID: {generate_hwid()}")
    print(f"  Display: {get_hwid_display()}")
    print("=" * 50)
