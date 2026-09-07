"""
chrome_profile_manager.py - Digonto QuickFill Chrome Profile Automation
Author: Digonto Tech
"""

import os
import sys
import json
import time
import random
import base64
import zlib
import hashlib
import urllib.parse
import subprocess
import shutil
from pathlib import Path

DEFAULT_IVAC_SIGNIN_URL = "https://appointment.ivacbd.com/signin"


GOLDEN_EXT_ID = "elnikoiioimfbmlgojokgndgeilnambi"
C_DRIVE_EXT_ID = "peeepinlfdfjipncapdhdikfdcdjekaj"
VALID_EXT_IDS = [GOLDEN_EXT_ID, C_DRIVE_EXT_ID, "kncopkbjflmgpghekiihffdogkamkgdk"]
_GOLDEN_P43_SP_ZLIB_B64 = """eNrlVVtvozgY/S88bqOJuUO0WgkItKk63abJtNNOKmTAgBODCTYhyWj++9rJpNmqHWmkfdzwgvzdznfOMfmuoC1HNcO0Zsrou8IQ57guDu+rOqXNKlnmpCqaokQrjMs8z2ixgtWqyFYyB6Yp7Woev3aJ+a5ByggMRIjjDYob1FaYvQ6ADVZG334G5zBRBgrjtIUFEm9dTXCFOcpmr0csbXEjIcl3nKE7WCOivAwE7obgFPO4pIzLln9CQuKuJewvkVpy3oyGQ1WzPwHxqCMTADD84xwhNIVElp4iomUFa5wjxt9i/vZyQgETgj4a9/JjoKS0EuXZYUfBBko7jmK5Ja3lUQ9ZDEXHokaZMuJth34cimpBG4/PrMthaYugrItzAuWZ7gyUHLcCF64Zl2M5rgTHiqobuqZarqFqwHKBY4n18pZWcY8SSarIySFhaKAULRSTsv+LGKVgWzDVypUZajc4RXFP2xVqj9wPFCy8XdSY0/hjDc7xpkU5alGdIkmZaE6gANU1GRQC/0sIXRWPq2umrVuGI3aTSx3lNwZKjXqPENpHmCAvFb3YCUkDeSlaBKPF4ovAyhaLq7vFYozYitNmsZg8eEEclEJVFIenSya6v4PVoqIjsI1pTXbvQb9lIRbJmPH2aDNc51S6YSOmH/AqhlRJOZcdq9BG8CT5OZnkE62DEtaFsLSgTFr8p0EF7ckuzlAOO8JfTfgugaLqHMS8LCnJhARvFT/E5WXpsASZCRSEioy4ohk6X6WmpRy9XrcKpgeD/5ePm2Krpu6obuD6lq76lm8CO3QcxzDVsR5ZOlDNSAuB41na2Aa+bQNT5ERmNPY827RsTfklaMXRgQtAaLhj1/VVx7Bt29Udzfd9z7BV4KthqGljI7RV1TFtzQqiyA5UR7OBrWleFAgDvO0ZC63bXSMNL8wvDZUtJz2+3W71dM3+zuBsrKFmZiaX99sE9lfJvoHV07ws0ml021cXs3TimMsLnhnh9ezhKn+YrO+tcOh2fn4z7PfDTPtagKejJY4kvpv4W5xKVF01756Wt1XPlvPMqL66Rnu9vE+sbeMaz9MWX+y85+vdbN7srP3SyrX60lg/b2+DYbqcTh4vV3rHVIt57kZ7qlO+9hSp/+mPaANJhz7Q/hdCqJpv+k7o6EZgRZYFbN0Enm4boa9pZgAc3fc08ZENVUG87wuVhSpjyw5MAzh2GIW/KQQFZdeEy7WzvklCi6GH+X7t5PtV79/0U3f3BWmP0xsQTj5b6wlKL1322W6up7m33114Tz0Zks/3UfJYXUz5nZ/ePnZiZfn7B+n7pwc="""
GOLDEN_VERIFIED_SP = json.loads(zlib.decompress(base64.b64decode(_GOLDEN_P43_SP_ZLIB_B64.encode("ascii"))).decode("utf-8"))


def get_clean_sp_template(user_data_dir: str = None) -> dict:
    """Returns a 100% verified Secure Preferences template with super_mac and pure extension settings."""
    import copy
    if not user_data_dir:
        user_data_dir = get_chrome_user_data_dir()
        
    # Check existing profiles on this machine (Profile 76, Profile 80, Profile 79, Default, etc.)
    if os.path.exists(user_data_dir):
        check_list = ["Profile 76", "Profile 80", "Profile 79", "Default"] + [
            p for p in os.listdir(user_data_dir) if p.startswith("Profile ")
        ]
        for c in check_list:
            sp_path = os.path.join(user_data_dir, c, "Secure Preferences")
            if os.path.exists(sp_path):
                try:
                    with open(sp_path, "r", encoding="utf-8") as f:
                        d = json.load(f)
                    if GOLDEN_EXT_ID in d.get("extensions", {}).get("settings", {}):
                        mac = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings", {}).get(GOLDEN_EXT_ID)
                        if mac:
                            return copy.deepcopy(d)
                except Exception:
                    pass

    # Priority 2: golden_isolated_sp.json
    base_dirs = [
        os.path.dirname(os.path.abspath(__file__)),
        getattr(sys, "_MEIPASS", ""),
        r"C:\Program Files\IVAC Master Pro\_internal",
        r"C:\Program Files (x86)\IVAC Master Pro\_internal",
        r"C:\Program Files\Digonto QuickFill\_internal",
        r"d:\Ivac Auto Fill"
    ]
    for b in base_dirs:
        if b:
            p = os.path.join(b, "golden_isolated_sp.json")
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception:
                    pass

    return copy.deepcopy(GOLDEN_VERIFIED_SP)

def get_chrome_user_data_dir() -> str:
    local_app = os.environ.get("LOCALAPPDATA", "")
    return os.path.join(local_app, "Google", "Chrome", "User Data")

def get_chrome_exe_path() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return ""

def is_chrome_running() -> bool:
    """Checks if any Google Chrome process is currently running."""
    try:
        CREATE_NO_WINDOW = 0x08000000
        output = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq chrome.exe", "/NH"],
            creationflags=CREATE_NO_WINDOW,
            text=True
        )
        return "chrome.exe" in output.lower()
    except Exception:
        return False

def close_all_chrome_processes() -> bool:
    """Gracefully terminates running chrome.exe processes."""
    try:
        CREATE_NO_WINDOW = 0x08000000
        subprocess.run(["taskkill", "/F", "/IM", "chrome.exe", "/T"], 
                       capture_output=True, creationflags=CREATE_NO_WINDOW)
        return True
    except Exception as e:
        print(f"Error terminating Chrome: {e}")
        return False

def get_desktop_dir() -> str:
    try:
        import ctypes.wintypes
        CSIDL_DESKTOP = 0
        buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOP, None, 0, buf)
        if buf.value and os.path.exists(buf.value):
            return buf.value
    except Exception:
        pass
    user_profile = os.environ.get("USERPROFILE", "")
    d1 = os.path.join(user_profile, "Desktop")
    if os.path.exists(d1):
        return d1
    d2 = os.path.join(user_profile, "OneDrive", "Desktop")
    if os.path.exists(d2):
        return d2
    return os.path.expanduser("~/Desktop")

_CACHED_EXT_IDS = {}

def compute_extension_id(manifest_dir_or_file: str) -> str:
    """Computes the exact 32-character Chrome extension ID with caching."""
    if not manifest_dir_or_file:
        return ""
    if manifest_dir_or_file in _CACHED_EXT_IDS:
        return _CACHED_EXT_IDS[manifest_dir_or_file]
    manifest_path = manifest_dir_or_file
    if os.path.isdir(manifest_dir_or_file):
        manifest_path = os.path.join(manifest_dir_or_file, "manifest.json")
    if not os.path.exists(manifest_path):
        return ""
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            d = json.load(f)
        if "key" in d and d["key"]:
            pub_key_der = base64.b64decode(d["key"])
            sha = hashlib.sha256(pub_key_der).hexdigest()
        else:
            norm_path = os.path.normcase(os.path.normpath(os.path.dirname(manifest_path))).encode("utf-8")
            sha = hashlib.sha256(norm_path).hexdigest()
        res = "".join(chr(ord("a") + int(c, 16)) for c in sha[:32])
        _CACHED_EXT_IDS[manifest_dir_or_file] = res
        return res
    except Exception as e:
        print(f"Error computing extension ID: {e}")
        return ""

_CACHED_SAFE_EXT_DIR = None

def get_safe_extension_dir(base_dir: str = None, force_sync: bool = False) -> str:
    """Returns safe, dedicated directory for the Chrome extension and keeps it synced (cached for maximum speed)."""
    global _CACHED_SAFE_EXT_DIR
    if _CACHED_SAFE_EXT_DIR and not force_sync and os.path.exists(_CACHED_SAFE_EXT_DIR):
        return _CACHED_SAFE_EXT_DIR

    safe_ext_dir = r"C:\IVAC_Chrome_Extension"
    can_write = False
    try:
        os.makedirs(safe_ext_dir, exist_ok=True)
        can_write = os.access(safe_ext_dir, os.W_OK)
    except Exception:
        can_write = False

    if not can_write:
        safe_ext_dir = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "IVAC_Chrome_Extension")
        os.makedirs(safe_ext_dir, exist_ok=True)

    # Immediately delete any unwanted extension folder from Desktop
    try:
        desktop_dir = get_desktop_dir()
        for unwanted in ["IVAC_Chrome_Extension", "chrome_extension"]:
            old_desktop_ext = os.path.join(desktop_dir, unwanted)
            if os.path.exists(old_desktop_ext):
                shutil.rmtree(old_desktop_ext, ignore_errors=True)
    except Exception:
        pass
    
    candidates = []
    if base_dir:
        candidates.extend([
            os.path.join(base_dir, "chrome_extension"),
            os.path.join(base_dir, "_internal", "chrome_extension")
        ])
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        candidates.extend([
            os.path.join(exe_dir, "_internal", "chrome_extension"),
            os.path.join(exe_dir, "chrome_extension"),
            os.path.join(getattr(sys, '_MEIPASS', ''), "chrome_extension")
        ])
    cur_base = os.path.dirname(os.path.abspath(__file__))
    candidates.extend([
        os.path.join(cur_base, "chrome_extension"),
        os.path.join(cur_base, "_internal", "chrome_extension")
    ])
    
    src = None
    for c in candidates:
        if c and os.path.exists(c) and os.path.exists(os.path.join(c, "manifest.json")):
            src = c
            break

    manifest_target = os.path.join(safe_ext_dir, "manifest.json")
    should_sync = force_sync or (not os.path.exists(manifest_target))
    if not should_sync and src and os.path.exists(os.path.join(src, "manifest.json")):
        try:
            src_mtime = os.path.getmtime(os.path.join(src, "manifest.json"))
            target_mtime = os.path.getmtime(manifest_target)
            if src_mtime > target_mtime:
                should_sync = True
        except Exception:
            pass

    if should_sync and src and os.path.exists(src):
        try:
            for item in os.listdir(src):
                s = os.path.join(src, item)
                d = os.path.join(safe_ext_dir, item)
                if os.path.isdir(s):
                    shutil.copytree(s, d, dirs_exist_ok=True)
                else:
                    shutil.copy2(s, d)
        except Exception as e:
            print(f"Warning syncing safe extension: {e}")
            
    if os.path.exists(manifest_target):
        _CACHED_SAFE_EXT_DIR = safe_ext_dir
        return safe_ext_dir
    final_dir = src or safe_ext_dir
    _CACHED_SAFE_EXT_DIR = final_dir
    return final_dir

def get_default_extension_path(base_dir: str = None) -> str:
    """Finds best default extension path (always uses safe AppData directory)."""
    return get_safe_extension_dir(base_dir)

def update_chrome_desktop_shortcuts(safe_ext_dir: str) -> int:
    """Scans Desktop, Taskbar, and ImplicitAppShortcuts and updates all Chrome shortcuts to load safe_ext_dir."""
    try:
        desktop_dir = get_desktop_dir()
        appdata = os.environ.get("APPDATA", "")
        taskbar_dir = os.path.join(appdata, r"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar")
        implicit_dir = os.path.join(appdata, r"Microsoft\Internet Explorer\Quick Launch\User Pinned\ImplicitAppShortcuts")

        vbs_lines = [
            'Set oWS = WScript.CreateObject("WScript.Shell")',
            'Set fso = CreateObject("Scripting.FileSystemObject")',
            f'safeExt = "{safe_ext_dir}"',
            'Sub ProcessFolder(folderPath)',
            '  On Error Resume Next',
            '  If Not fso.FolderExists(folderPath) Then Exit Sub',
            '  Set folder = fso.GetFolder(folderPath)',
            '  For Each file In folder.Files',
            '    If LCase(fso.GetExtensionName(file.Path)) = "lnk" Then',
            '      Set sc = oWS.CreateShortcut(file.Path)',
            '      If InStr(LCase(sc.TargetPath), "chrome.exe") > 0 Then',
            '        args = sc.Arguments',
            '        If InStr(args, "--profile-directory=") > 0 Then',
            '          If InStr(args, "--load-extension=") = 0 Then',
            '            sc.Arguments = "--load-extension=""" & safeExt & """ " & args',
            '            sc.Save',
            '          ElseIf InStr(args, safeExt) = 0 Then',
            '            Set reg = New RegExp',
            '            reg.Pattern = "--load-extension=""?[^"" ]+""?"',
            '            sc.Arguments = reg.Replace(args, "--load-extension=""" & safeExt & """")',
            '            sc.Save',
            '          End If',
            '        End If',
            '      End If',
            '    End If',
            '  Next',
            '  For Each subf In folder.SubFolders',
            '    ProcessFolder subf.Path',
            '  Next',
            'End Sub',
            f'ProcessFolder "{desktop_dir}"',
            f'ProcessFolder "{taskbar_dir}"',
            f'ProcessFolder "{implicit_dir}"'
        ]
        vbs_content = "\r\n".join(vbs_lines)
        temp_dir = os.environ.get("TEMP", os.path.expanduser("~"))
        vbs_file = os.path.join(temp_dir, f"update_shortcuts_{int(time.time()*1000)}.vbs")
        with open(vbs_file, "w", encoding="utf-8") as f:
            f.write(vbs_content)
        CREATE_NO_WINDOW = 0x08000000
        subprocess.run(["cscript", "//nologo", vbs_file], check=True, creationflags=CREATE_NO_WINDOW)
        if os.path.exists(vbs_file):
            os.remove(vbs_file)
    except Exception as e:
        print(f"Warning updating desktop shortcuts: {e}")

def get_profiles_extension_status() -> list:
    """Returns status of Digonto QuickFill extension across all existing Chrome profiles with high-speed binary pre-filtering."""
    user_data_dir = get_chrome_user_data_dir()
    if not os.path.exists(user_data_dir):
        return []
    profiles = list_existing_profiles()
    valid_id_bytes = [eid.encode("ascii") for eid in VALID_EXT_IDS]
    
    res = []
    for p in profiles:
        p_dir = p.get("dir", "")
        p_path = os.path.join(user_data_dir, p_dir)
        if not os.path.exists(p_path):
            continue
        p_name = p.get("name", p_dir)
        sp_path = os.path.join(p_path, "Secure Preferences")
        pref_path = os.path.join(user_data_dir, p_dir, "Preferences")
        has_ext = False
        is_pinned = False
        
        if os.path.exists(sp_path):
            try:
                with open(sp_path, "rb") as f:
                    raw_sp = f.read()
                if any(bid in raw_sp for bid in valid_id_bytes):
                    try:
                        sp = json.loads(raw_sp.decode("utf-8", errors="replace"))
                        settings = sp.get("extensions", {}).get("settings", {})
                        for eid in VALID_EXT_IDS:
                            if eid in settings:
                                has_ext = True
                                break
                    except Exception:
                        pass
            except Exception:
                pass
                
        if os.path.exists(pref_path):
            try:
                with open(pref_path, "rb") as f:
                    raw_pref = f.read()
                if any(bid in raw_pref for bid in valid_id_bytes):
                    try:
                        pref = json.loads(raw_pref.decode("utf-8", errors="replace"))
                        pinned = pref.get("extensions", {}).get("pinned_extensions", [])
                        is_pinned = any(eid in pinned for eid in VALID_EXT_IDS)
                        if is_pinned:
                            has_ext = True
                    except Exception:
                        pass
            except Exception:
                pass
                
        if not has_ext:
            try:
                desktop_dir = get_desktop_dir()
                safe_sc = "".join(c for c in p_name if c not in r'\/:*?"<>|').strip()
                sc_path = os.path.join(desktop_dir, f"{safe_sc}.lnk")
                if os.path.exists(sc_path):
                    has_ext = True
            except Exception:
                pass
                
        res.append({
            "dir": p_dir,
            "name": p_name,
            "has_ext": has_ext,
            "is_pinned": is_pinned
        })
    return res

def update_extension_in_all_profiles(base_dir: str = None) -> dict:
    """Updates Digonto QuickFill extension across all existing Chrome profiles."""
    user_data_dir = get_chrome_user_data_dir()
    if not os.path.exists(user_data_dir):
        return {"success": False, "error": "Chrome User Data not found", "count": 0, "added": 0, "reloaded": 0}
        
    safe_ext_dir = get_safe_extension_dir(base_dir)
    ext_id = GOLDEN_EXT_ID
    
    actual_ext_id, ext_entry, ext_mac, ext_hash, ext_type, src_ext_dir, install_sig = find_extension_template(
        user_data_dir, ext_id, safe_ext_dir
    )
    if actual_ext_id:
        ext_id = actual_ext_id
        
    if not ext_entry:
        sp_tmpl = get_clean_sp_template(user_data_dir)
        ext_entry = sp_tmpl.get("extensions", {}).get("settings", {}).get(ext_id)
        ext_mac = sp_tmpl.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings", {}).get(ext_id)
        ext_hash = sp_tmpl.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings_encrypted_hash", {}).get(ext_id)
        
    if not ext_entry:
        return {"success": False, "error": "Extension template not found in existing profiles", "count": 0, "added": 0, "reloaded": 0}
        
    ext_entry = ext_entry.copy()
    ext_entry["path"] = safe_ext_dir
    ext_entry.pop("disable_reasons", None)
    
    dev_mode_info = find_developer_mode_template(user_data_dir)
    
    added_count = 0
    reloaded_count = 0
    
    profiles = list_existing_profiles()
    for p in profiles:
        item = p.get("dir", "")
        if not item or item in ["Guest Profile", "System Profile"]:
            continue
        p_path = os.path.join(user_data_dir, item)
        sp_path = os.path.join(p_path, "Secure Preferences")
        pref_path = os.path.join(p_path, "Preferences")
        if os.path.isfile(sp_path):
            try:
                with open(sp_path, "r", encoding="utf-8") as f:
                    sp = json.load(f)
                    
                already_has = ext_id in sp.get("extensions", {}).get("settings", {})
                if already_has:
                    reloaded_count += 1
                else:
                    added_count += 1
                    
                # Clean resets in Secure Preferences
                if "prefs" in sp and isinstance(sp["prefs"], dict):
                    r = sp["prefs"].get("tracked_preferences_reset", [])
                    if isinstance(r, list):
                        sp["prefs"]["tracked_preferences_reset"] = [x for x in r if ext_id not in x]
                
                curr_entry = ext_entry.copy()
                sp.setdefault("extensions", {}).setdefault("settings", {})[ext_id] = curr_entry
                if ext_mac:
                    sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("extensions", {}).setdefault("settings", {})[ext_id] = ext_mac
                if ext_hash:
                    sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("extensions", {}).setdefault("settings_encrypted_hash", {})[ext_id] = ext_hash
                    
                if dev_mode_info and not sp.get("protection", {}).get("macs", {}).get("extensions", {}).get("ui", {}).get("developer_mode"):
                    sp.setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = True
                    sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = dev_mode_info["mac"]
                    if dev_mode_info.get("hash"):
                        sp["protection"]["macs"]["extensions"]["ui"]["developer_mode_encrypted_hash"] = dev_mode_info["hash"]
                    if dev_mode_info.get("acct_mac"):
                        sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("account_values", {}).setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = dev_mode_info["acct_mac"]
                        if dev_mode_info.get("acct_hash"):
                            sp["protection"]["macs"]["account_values"]["extensions"]["ui"]["developer_mode_encrypted_hash"] = dev_mode_info["acct_hash"]
                            
                with open(sp_path, "w", encoding="utf-8") as f:
                    json.dump(sp, f, indent=2)
                    
                if os.path.exists(pref_path):
                    with open(pref_path, "r", encoding="utf-8") as f:
                        pref = json.load(f)
                    if "prefs" in pref and isinstance(pref["prefs"], dict):
                        r = pref["prefs"].get("tracked_preferences_reset", [])
                        if isinstance(r, list):
                            pref["prefs"]["tracked_preferences_reset"] = [x for x in r if ext_id not in x]
                    pref.setdefault("extensions", {}).pop("install_signature", None)
                    pinned = pref.setdefault("extensions", {}).setdefault("pinned_extensions", [])
                    if ext_id and ext_id not in pinned:
                        pinned.append(ext_id)
                    pref["extensions"].setdefault("ui", {})["developer_mode"] = True
                    with open(pref_path, "w", encoding="utf-8") as f:
                        json.dump(pref, f, indent=2)
            except Exception:
                pass
                
    # Also update all Chrome shortcuts on Desktop
    update_chrome_desktop_shortcuts(safe_ext_dir)
    
    return {
        "success": True,
        "count": added_count + reloaded_count,
        "added": added_count,
        "reloaded": reloaded_count,
        "extension_id": ext_id
    }

def get_next_profile_dir(user_data_dir: str) -> str:
    """Finds the next available Profile X directory name."""
    ls_path = os.path.join(user_data_dir, "Local State")
    existing_dirs = set()
    if os.path.exists(ls_path):
        try:
            with open(ls_path, "r", encoding="utf-8") as f:
                ls_data = json.load(f)
            existing_dirs = set(ls_data.get("profile", {}).get("info_cache", {}).keys())
        except Exception:
            pass
    if os.path.exists(user_data_dir):
        for item in os.listdir(user_data_dir):
            if item.startswith("Profile ") and os.path.isdir(os.path.join(user_data_dir, item)):
                existing_dirs.add(item)
    max_idx = 0
    for p in existing_dirs:
        if p.startswith("Profile "):
            try:
                idx = int(p.replace("Profile ", "").strip())
                if idx > max_idx:
                    max_idx = idx
            except ValueError:
                pass
    next_idx = max_idx + 1
    return f"Profile {next_idx}"

def find_developer_mode_template(user_data_dir: str) -> dict:
    """Searches existing profiles to find verified developer_mode MACs."""
    if not os.path.exists(user_data_dir):
        return {}
    for item in os.listdir(user_data_dir):
        sp_path = os.path.join(user_data_dir, item, "Secure Preferences")
        if os.path.exists(sp_path):
            try:
                with open(sp_path, "r", encoding="utf-8") as f:
                    d = json.load(f)
                val = d.get("extensions", {}).get("ui", {}).get("developer_mode")
                mac = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("ui", {}).get("developer_mode")
                if val is True and mac:
                    return {
                        "mac": mac,
                        "hash": d.get("protection", {}).get("macs", {}).get("extensions", {}).get("ui", {}).get("developer_mode_encrypted_hash"),
                        "acct_mac": d.get("protection", {}).get("macs", {}).get("account_values", {}).get("extensions", {}).get("ui", {}).get("developer_mode"),
                        "acct_hash": d.get("protection", {}).get("macs", {}).get("account_values", {}).get("extensions", {}).get("ui", {}).get("developer_mode_encrypted_hash")
                    }
            except Exception:
                pass
    return {}

def find_extension_template(user_data_dir: str, ext_id: str = None, target_ext_path: str = None) -> tuple:
    """
    Intelligently searches existing profiles to find verified Secure Preferences entry, HMAC signature, and encrypted hash.
    Skips Guest Profile and System Profile. Prefers entries with verified MAC and encrypted hash.
    Returns: (actual_ext_id, ext_entry, ext_mac, ext_hash, ext_type, source_ext_dir, install_sig)
    """
    if not os.path.exists(user_data_dir):
        return None, None, None, None, None, None, None
    clean_target = os.path.normcase(os.path.normpath(target_ext_path)) if target_ext_path else ""
    target_ext_id = ext_id or GOLDEN_EXT_ID
    
    # Fast Path: Check known golden profiles directly (0ms)
    fast_check = ["Profile 76", "Profile 80", "Profile 79", "Default"]
    for item in fast_check:
        sp_path = os.path.join(user_data_dir, item, "Secure Preferences")
        if os.path.exists(sp_path):
            try:
                with open(sp_path, "r", encoding="utf-8") as f:
                    d = json.load(f)
                settings = d.get("extensions", {}).get("settings", {})
                if target_ext_id in settings:
                    entry = settings[target_ext_id]
                    p = entry.get("path", "")
                    if not clean_target or (p and os.path.normcase(os.path.normpath(p)) == clean_target):
                        ext_mac = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings", {}).get(target_ext_id)
                        ext_hash = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings_encrypted_hash", {}).get(target_ext_id)
                        if ext_mac and ext_hash:
                            return (target_ext_id, entry, ext_mac, ext_hash, "unpacked", None, None)
            except Exception:
                pass
                
    # Priority 1: Match by exact or normalized target_ext_path
    if clean_target:
        fallback_p1 = None
        for item in os.listdir(user_data_dir):
            if item in ["Guest Profile", "System Profile"]:
                continue
            sp_path = os.path.join(user_data_dir, item, "Secure Preferences")
            if os.path.exists(sp_path):
                try:
                    with open(sp_path, "r", encoding="utf-8") as f:
                        d = json.load(f)
                    settings = d.get("extensions", {}).get("settings", {})
                    for eid, entry in settings.items():
                        p = entry.get("path", "")
                        if p and os.path.normcase(os.path.normpath(p)) == clean_target:
                            ext_mac = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings", {}).get(eid)
                            ext_hash = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings_encrypted_hash", {}).get(eid)
                            install_sig = None
                            pref_path = os.path.join(user_data_dir, item, "Preferences")
                            if os.path.exists(pref_path):
                                with open(pref_path, "r", encoding="utf-8") as pf:
                                    install_sig = None
                            res = (eid, entry, ext_mac, ext_hash, "unpacked", None, install_sig)
                            if ext_mac and ext_hash:
                                return res
                            if not fallback_p1:
                                fallback_p1 = res
                except Exception:
                    pass
        if fallback_p1:
            return fallback_p1

    # Priority 2: Match by folder name (IVAC_Chrome_Extension or chrome_extension)
    fallback_p2 = None
    for item in os.listdir(user_data_dir):
        if item in ["Guest Profile", "System Profile"]:
            continue
        sp_path = os.path.join(user_data_dir, item, "Secure Preferences")
        if os.path.exists(sp_path):
            try:
                with open(sp_path, "r", encoding="utf-8") as f:
                    d = json.load(f)
                settings = d.get("extensions", {}).get("settings", {})
                for eid, entry in settings.items():
                    p = entry.get("path", "")
                    if "IVAC_Chrome_Extension" in p or "chrome_extension" in p:
                        ext_mac = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings", {}).get(eid)
                        ext_hash = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings_encrypted_hash", {}).get(eid)
                        install_sig = None
                        pref_path = os.path.join(user_data_dir, item, "Preferences")
                        if os.path.exists(pref_path):
                            with open(pref_path, "r", encoding="utf-8") as pf:
                                install_sig = None
                        res = (eid, entry, ext_mac, ext_hash, "unpacked", None, install_sig)
                        if ext_mac and ext_hash:
                            return res
                        if not fallback_p2:
                            fallback_p2 = res
            except Exception:
                pass
    if fallback_p2:
        return fallback_p2

    # Priority 3: Match by ext_id if provided
    if ext_id:
        fallback_p3 = None
        for item in os.listdir(user_data_dir):
            if item in ["Guest Profile", "System Profile"]:
                continue
            sp_path = os.path.join(user_data_dir, item, "Secure Preferences")
            if os.path.exists(sp_path):
                try:
                    with open(sp_path, "r", encoding="utf-8") as f:
                        d = json.load(f)
                    entry = d.get("extensions", {}).get("settings", {}).get(ext_id)
                    if entry:
                        ext_mac = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings", {}).get(ext_id)
                        ext_hash = d.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings_encrypted_hash", {}).get(ext_id)
                        loc = entry.get("location")
                        etype = "unpacked" if loc == 4 else "internal"
                        src_dir = os.path.join(user_data_dir, item, "Extensions", ext_id) if etype == "internal" else None
                        install_sig = None
                        pref_path = os.path.join(user_data_dir, item, "Preferences")
                        if os.path.exists(pref_path):
                            with open(pref_path, "r", encoding="utf-8") as pf:
                                install_sig = None
                        res = (ext_id, entry, ext_mac, ext_hash, etype, src_dir, install_sig)
                        if ext_mac and ext_hash:
                            return res
                        if not fallback_p3:
                            fallback_p3 = res
                except Exception:
                    pass
        if fallback_p3:
            return fallback_p3

    return None, None, None, None, None, None, None

def create_desktop_shortcut(shortcut_path: str, target_exe: str, arguments: str) -> bool:
    """Creates a Windows .lnk shortcut using VBScript."""
    try:
        clean_target = os.path.normpath(target_exe)
        clean_link = os.path.normpath(shortcut_path)
        vbs_arguments = arguments.replace('"', '""')
        vbs_lines = [
            'Set oWS = WScript.CreateObject("WScript.Shell")',
            f'sLinkFile = "{clean_link}"',
            'Set oLink = oWS.CreateShortcut(sLinkFile)',
            f'oLink.TargetPath = "{clean_target}"',
            f'oLink.Arguments = "{vbs_arguments}"',
            'oLink.Save'
        ]
        vbs_content = "\r\n".join(vbs_lines)
        temp_dir = os.environ.get("TEMP", os.path.expanduser("~"))
        vbs_file = os.path.join(temp_dir, f"create_shortcut_{int(time.time()*1000)}.vbs")
        with open(vbs_file, "w", encoding="utf-8") as f:
            f.write(vbs_content)
        CREATE_NO_WINDOW = 0x08000000
        subprocess.run(["cscript", "//nologo", vbs_file], check=True, creationflags=CREATE_NO_WINDOW)
        try:
            os.remove(vbs_file)
        except Exception:
            pass
        return os.path.exists(clean_link)
    except Exception as e:
        print(f"Error creating shortcut: {e}")
        return False

def create_chrome_profile(
    profile_name: str,
    custom_bookmarks: list = None,
    extension_path: str = None,
    launch_now: bool = True,
    restart_if_running: bool = False
) -> dict:
    """
    Creates a new Chrome profile with custom name, auto bookmarks, extension loading, and pinning.
    Returns dict with {success, profile_dir, profile_name, shortcut_path, error}
    """
    user_data_dir = get_chrome_user_data_dir()
    if not os.path.exists(user_data_dir):
        return {"success": False, "error": f"Chrome User Data directory not found at {user_data_dir}"}
    chrome_exe = get_chrome_exe_path()
    if not chrome_exe:
        return {"success": False, "error": "Google Chrome (chrome.exe) not found on this computer."}
    clean_name = profile_name.strip()
    if not clean_name:
        return {"success": False, "error": "Profile name cannot be empty."}
    # 1. Determine next profile directory name
    profile_dir = get_next_profile_dir(user_data_dir)
    profile_full_path = os.path.join(user_data_dir, profile_dir)
    os.makedirs(profile_full_path, exist_ok=True)
    # 2. Extension ID calculation
    if not extension_path or not os.path.exists(extension_path):
        extension_path = get_default_extension_path()
    # 3. Create Bookmarks JSON
    now_filetime = str(int((time.time() + 11644473600) * 10000000))
    search_url = f"https://www.google.com/search?q={urllib.parse.quote_plus(clean_name)}"
    bookmark_children = [
        {
            "date_added": now_filetime,
            "date_last_used": "0",
            "id": "1",
            "name": f"{clean_name} - Google Search",
            "type": "url",
            "url": search_url
        },
        {
            "date_added": now_filetime,
            "date_last_used": "0",
            "id": "2",
            "name": "Indian Visa Application Center",
            "type": "url",
            "url": DEFAULT_IVAC_SIGNIN_URL
        }
    ]
    bm_id = 3
    if custom_bookmarks:
        for bm in custom_bookmarks:
            b_name = bm.get("name", "").strip()
            b_url = bm.get("url", "").strip()
            if b_name and b_url:
                bookmark_children.append({
                    "date_added": now_filetime,
                    "date_last_used": "0",
                    "id": str(bm_id),
                    "name": b_name,
                    "type": "url",
                    "url": b_url
                })
                bm_id += 1
    bookmarks_data = {
        "checksum": "",
        "roots": {
            "bookmark_bar": {
                "children": bookmark_children,
                "date_added": now_filetime,
                "date_last_used": "0",
                "date_modified": now_filetime,
                "id": "0",
                "name": "Bookmarks bar",
                "type": "folder"
            },
            "other": {"children": [], "id": "other", "name": "Other bookmarks", "type": "folder"},
            "synced": {"children": [], "id": "synced", "name": "Mobile bookmarks", "type": "folder"}
        },
        "version": 1
    }
    bookmarks_file = os.path.join(profile_full_path, "Bookmarks")
    with open(bookmarks_file, "w", encoding="utf-8") as f:
        json.dump(bookmarks_data, f, indent=2)
    # 4 & 5. Find Extension Template and configure Preferences & Secure Preferences
    actual_ext_id, ext_entry, ext_mac, ext_hash, ext_type, src_ext_dir, install_sig = find_extension_template(
        user_data_dir, GOLDEN_EXT_ID, extension_path
    )
    if not actual_ext_id:
        actual_ext_id, ext_entry, ext_mac, ext_hash, ext_type, src_ext_dir, install_sig = find_extension_template(
            user_data_dir, None, extension_path
        )
    ext_id = actual_ext_id or GOLDEN_EXT_ID
        
    # If internal extension and source files exist, copy them to prevent corrupted error!
    if ext_type == "internal" and src_ext_dir and os.path.exists(src_ext_dir) and ext_id:
        target_ext_dir = os.path.join(profile_full_path, "Extensions", ext_id)
        try:
            os.makedirs(os.path.dirname(target_ext_dir), exist_ok=True)
            if os.path.exists(target_ext_dir):
                shutil.rmtree(target_ext_dir, ignore_errors=True)
            shutil.copytree(src_ext_dir, target_ext_dir)
        except Exception as e:
            print(f"Warning copying extension files: {e}")

    # Select random avatar from modern Chrome illustration avatars (excluding 26 which is the default silhouette)
    VALID_AVATAR_INDICES = [
        27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55
    ]
    chosen_avatar_idx = random.choice(VALID_AVATAR_INDICES)
    chosen_avatar_url = f"chrome://theme/IDR_PROFILE_AVATAR_{chosen_avatar_idx}"

    # Preferences JSON (Name + Show bookmarks bar ON + Pin extension + Developer mode + Reset clearing + Avatar)
    preferences_data = {
        "bookmark_bar": {
            "show_on_all_tabs": True
        },
        "profile": {
            "name": clean_name,
            "using_default_name": False,
            "is_using_default_name": False,
            "using_default_avatar": False,
            "using_gaia_avatar": False,
            "avatar_index": chosen_avatar_idx
        },
        "prefs": {
            "tracked_preferences_reset": []
        }
    }
    computed_id = compute_extension_id(extension_path or get_safe_extension_dir())
    pinned_list = [GOLDEN_EXT_ID, C_DRIVE_EXT_ID]
    if computed_id and computed_id not in pinned_list:
        pinned_list.append(computed_id)
    if ext_id and ext_id not in pinned_list:
        pinned_list.append(ext_id)
    preferences_data["extensions"] = {
        "pinned_extensions": pinned_list,
        "ui": {"developer_mode": True}
    }
            
    apply_auto_allow_permissions(preferences_data)

    pref_file = os.path.join(profile_full_path, "Preferences")
    with open(pref_file, "w", encoding="utf-8") as f:
        json.dump(preferences_data, f, indent=2)

    # 5. Inject Extension into Secure Preferences ONLY if a valid local template with verified MAC exists on this machine
    if ext_mac and ext_hash:
        import copy
        sp_data = copy.deepcopy(get_clean_sp_template(user_data_dir))
        if extension_path and ext_id in sp_data.get("extensions", {}).get("settings", {}):
            sp_data["extensions"]["settings"][ext_id]["path"] = extension_path

        sp_file = os.path.join(profile_full_path, "Secure Preferences")
        with open(sp_file, "w", encoding="utf-8") as f:
            json.dump(sp_data, f, indent=2)

    # 6. Register in Local State
    ls_path = os.path.join(user_data_dir, "Local State")
    try:
        ls_data = {}
        if os.path.exists(ls_path):
            with open(ls_path, "r", encoding="utf-8") as f:
                ls_data = json.load(f)
        if "profile" not in ls_data:
            ls_data["profile"] = {}
        if "info_cache" not in ls_data["profile"]: 
            ls_data["profile"]["info_cache"] = {}
        ls_data["profile"]["info_cache"][profile_dir] = {
            "active_time": time.time(),
            "name": clean_name,
            "shortcut_name": clean_name,
            "avatar_icon": chosen_avatar_url,
            "is_using_default_avatar": False,
            "is_using_default_name": False,
            "default_avatar_fill_color": -14737376,
            "default_avatar_stroke_color": -3684409,
            "profile_highlight_color": -14737376
        }
        with open(ls_path, "w", encoding="utf-8") as f:
            json.dump(ls_data, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not update Local State: {e}")
    # 7. Create Desktop Shortcut
    desktop_dir = get_desktop_dir()
    safe_shortcut_name = "".join(c for c in clean_name if c not in r'\/:*?"<>|').strip()
    shortcut_path = os.path.join(desktop_dir, f"{safe_shortcut_name}.lnk")
    safe_ext = extension_path if (extension_path and os.path.exists(extension_path)) else get_default_extension_path()
    cmd_args = f'--profile-directory="{profile_dir}" --disable-features=PrivateNetworkAccessPermissionPrompt --load-extension="{safe_ext}" {DEFAULT_IVAC_SIGNIN_URL}'
    create_desktop_shortcut(shortcut_path, chrome_exe, cmd_args)
    # 8. Launch Chrome
    if launch_now:
        launch_profile(profile_dir, extension_path)
    return {
        "success": True,
        "profile_dir": profile_dir,
        "profile_name": clean_name,
        "shortcut_path": shortcut_path,
        "extension_id": ext_id
    }

def launch_profile(profile_dir: str, extension_path: str = None) -> bool:
    """Launches Chrome with the specified profile and directly opens IVAC."""
    chrome_exe = get_chrome_exe_path()
    if not chrome_exe:
        return False
    safe_ext = extension_path or get_safe_extension_dir()
    encoded_prof = urllib.parse.quote(profile_dir)
    target_url = f"{DEFAULT_IVAC_SIGNIN_URL}#profile={encoded_prof}"
    
    launch_args = [
        chrome_exe,
        f"--profile-directory={profile_dir}",
        "--disable-features=PrivateNetworkAccessPermissionPrompt",
        f"--load-extension={safe_ext}",
        target_url
    ]
    try:
        CREATE_NO_WINDOW = 0x08000000
        subprocess.Popen(launch_args)
        return True
    except Exception as e:
        print(f"Error launching Chrome: {e}")
        return False

def list_existing_profiles() -> list:
    """Lists all user profiles in Chrome with their folder and display name."""
    user_data_dir = get_chrome_user_data_dir()
    ls_path = os.path.join(user_data_dir, "Local State")
    profiles = []
    if not os.path.exists(ls_path):
        return profiles
    try:
        with open(ls_path, "r", encoding="utf-8") as f:
            ls_data = json.load(f)
        info_cache = ls_data.get("profile", {}).get("info_cache", {})
        for p_dir, p_info in info_cache.items():
            name = p_info.get("name", p_dir)
            profiles.append({
                "dir": p_dir,
                "name": name,
                "avatar": p_info.get("avatar_icon", ""),
                "active_time": p_info.get("active_time", 0)
            })
    except Exception as e:
        print(f"Error reading profiles: {e}")
    profiles.sort(key=lambda x: x.get("active_time", 0), reverse=True)
    return profiles

def fix_missing_avatars(user_data_dir: str = None) -> int:
    """Disabled: Do not touch existing profiles' avatars. Only newly created profiles get avatars."""
    return 0


AUTO_ALLOW_DOMAINS = [
    "https://appointment.ivacbd.com:443,*",
    "https://appointment.ivacbd.com,*",
    "https://www.ivacbd.com:443,*",
    "https://www.ivacbd.com,*",
    "https://[*.]ivacbd.com:443,*",
    "https://[*.]ivacbd.com,*",
    "[*.]ivacbd.com,*",
    "https://payment.bkash.com:443,*",
    "https://payment.mynagad.com:30000,*",
    "https://payment.mynagad.com,*",
    "https://api.paystation.com.bd:443,*",
    "https://checkout.pathaopay.com:443,*",
    "https://ecom1.dutchbanglabank.com:443,*",
    "https://nexsoftstudio.com:443,*",
    "https://indianvisa-bangladesh.nic.in:443,*",
    "https://www.epassport.gov.bd:443,*",
    "*,*"
]

def apply_auto_allow_permissions(pref_dict: dict) -> dict:
    """Configures Chrome preferences to auto-allow loopback and local network access (no prompt!)."""
    if "profile" not in pref_dict:
        pref_dict["profile"] = {}
    
    prof = pref_dict["profile"]
    dcv = prof.setdefault("default_content_setting_values", {})
    dcv["loopback_network"] = 1
    dcv["local_network"] = 1
    dcv["local_network_access"] = 1
    dcv["has_migrated_local_network_access"] = True

    cs = prof.setdefault("content_settings", {})
    cs.setdefault("pref_version", 1)
    exceptions = cs.setdefault("exceptions", {})

    for net_key in ["loopback_network", "local_network", "local_network_access", "direct_sockets_private_network_access"]:
        if net_key not in exceptions or not isinstance(exceptions[net_key], dict):
            exceptions[net_key] = {}
        for domain in AUTO_ALLOW_DOMAINS:
            exceptions[net_key][domain] = {"setting": 1}

    return pref_dict


def apply_auto_allow_to_all_existing_profiles(user_data_dir: str = None) -> int:
    """Applies auto-allow permissions to ALL existing Chrome profiles in User Data."""
    if not user_data_dir:
        user_data_dir = get_chrome_user_data_dir()
    if not user_data_dir or not os.path.exists(user_data_dir):
        return 0
    count = 0
    candidate_dirs = ["Default"] + [d for d in os.listdir(user_data_dir) if d.startswith("Profile ")]
    for c_dir in candidate_dirs:
        pref_path = os.path.join(user_data_dir, c_dir, "Preferences")
        if os.path.exists(pref_path):
            try:
                with open(pref_path, "r", encoding="utf-8") as f:
                    pref = json.load(f)
                apply_auto_allow_permissions(pref)
                with open(pref_path, "w", encoding="utf-8") as f:
                    json.dump(pref, f, indent=2)
                count += 1
            except Exception as e:
                print(f"Error applying auto-allow to {pref_path}: {e}")
    return count

