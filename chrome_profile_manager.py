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
import hmac
import urllib.parse
import urllib.request
import socket
import tempfile
import subprocess
import shutil
from pathlib import Path

DEFAULT_IVAC_SIGNIN_URL = "https://appointment.ivacbd.com/signin"

GOLDEN_EXT_ID = "elnikoiioimfbmlgojokgndgeilnambi"
C_DRIVE_EXT_ID = "elnikoiioimfbmlgojokgndgeilnambi"
VALID_EXT_IDS = [GOLDEN_EXT_ID, "peeepinlfdfjipncapdhdikfdcdjekaj", "kncopkbjflmgpghekiihffdogkamkgdk"]

# ---------------------------------------------------------------------------
# Native Chromium PrefHashCalculator Implementation
# Keys: Chrome internal HMAC seed + Machine SID
# ---------------------------------------------------------------------------
_CHROME_SEED = bytes.fromhex(
    "e748f336d85ea5f9dcdf25d8f347a65b4cdf667600f02df6724a2af18a212d26"
    "b788a25086910cf3a90313696871f3dc05823730c91df8ba5c4fd9c884b505a8"
)

_CACHED_MACHINE_ID = None

def get_machine_id() -> str:
    """Returns machine ID (Windows user SID without relative ID) for Chrome HMAC computation."""
    global _CACHED_MACHINE_ID
    if _CACHED_MACHINE_ID is not None:
        return _CACHED_MACHINE_ID
    if sys.platform == "win32":
        try:
            CREATE_NO_WINDOW = 0x08000000
            out = subprocess.check_output(
                ["whoami", "/user", "/fo", "csv", "/nh"],
                creationflags=CREATE_NO_WINDOW,
                text=True
            ).strip()
            parts = [p.strip('"') for p in out.split(",")]
            if len(parts) >= 2:
                sid = parts[1]
                _CACHED_MACHINE_ID = sid.rsplit("-", 1)[0]
                return _CACHED_MACHINE_ID
        except Exception as e:
            print(f"Warning getting machine ID: {e}")
    _CACHED_MACHINE_ID = ""
    return _CACHED_MACHINE_ID

def copy_without_empty_children(value):
    """Port of Chromium CopyWithoutEmptyChildren from values.cc."""
    if isinstance(value, list):
        copy = []
        for child in value:
            c = copy_without_empty_children(child)
            if c is not None:
                copy.append(c)
        return copy if copy else None
    elif isinstance(value, dict):
        copy = {}
        for k, v in value.items():
            c = copy_without_empty_children(v)
            if c is not None:
                copy[k] = c
        return copy if copy else None
    else:
        return value

def chrome_json_ser(value) -> bytes:
    """Port of Chromium JSONWriter from json_writer.cc."""
    if value is None:
        return b"null"
    elif isinstance(value, bool):
        return b"true" if value else b"false"
    elif isinstance(value, int):
        return str(value).encode("ascii")
    elif isinstance(value, float):
        real = str(value)
        if "." not in real and "e" not in real and "E" not in real:
            real = real + ".0"
        elif real[0] == ".":
            real = "0" + real
        elif real[0] == "-" and real[0] == ".":
            real = "-0" + real[1:]
        return real.encode("ascii")
    elif isinstance(value, str):
        out = b'"'
        for cp in value:
            special = {
                "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r",
                "\t": "\\t", "\\": "\\\\", '"': '\\"', "<": "\\u003C",
                "\u2028": "\\u2028", "\u2029": "\\u2029",
            }.get(cp, None)
            if special is not None:
                out += special.encode("ascii")
            elif ord(cp) < 32:
                out += ("\\u00%02x" % (ord(cp),)).encode("ascii")
            else:
                out += cp.encode("utf-8")
        out += b'"'
        return out
    elif isinstance(value, list):
        out = b"["
        first = True
        for v in value:
            if not first:
                out += b","
            out += chrome_json_ser(v)
            first = False
        out += b"]"
        return out
    elif isinstance(value, dict):
        out = b"{"
        first = True
        for k, v in sorted(value.items()):
            if not first:
                out += b","
            out += chrome_json_ser(k)
            out += b":"
            out += chrome_json_ser(v)
            first = False
        out += b"}"
        return out
    raise TypeError(f"Unsupported value in JSON serializer: {type(value)}")

def value_as_string(value) -> bytes:
    """Port of Chromium ValueAsString from pref_hash_calculator.cc."""
    if isinstance(value, dict):
        value = copy_without_empty_children(value) or {}
    return chrome_json_ser(value)

def calculate_pref_mac(path: str, value) -> str:
    """Calculates Chrome HMAC-SHA256 signature for a preference path and value."""
    msg = get_machine_id().encode("utf-8") + path.encode("utf-8") + value_as_string(value)
    dgst = hmac.new(key=_CHROME_SEED, msg=msg, digestmod=hashlib.sha256)
    return dgst.hexdigest().upper()

def calculate_super_mac(macs_dict: dict) -> str:
    """Calculates Chrome super_mac for the protection.macs dictionary."""
    return calculate_pref_mac("", macs_dict)

def create_unpacked_extension_entry(extension_path: str) -> dict:
    """Returns a complete, genuine unpacked extension settings dictionary for Secure Preferences."""
    return {
        "account_extension_type": 0,
        "active_permissions": {
            "api": [
                "activeTab",
                "bookmarks",
                "storage",
                "unlimitedStorage",
                "scripting",
                "sidePanel"
            ],
            "explicit_host": [
                "<all_urls>",
                "http://127.0.0.1:5000/*",
                "http://localhost:5000/*"
            ],
            "manifest_permissions": [],
            "scriptable_host": [
                "<all_urls>"
            ]
        },
        "commands": {
            "_execute_action": {
                "was_assigned": True
            }
        },
        "content_settings": [],
        "creation_flags": 38,
        "first_install_time": "13369650000000000",
        "from_webstore": False,
        "granted_permissions": {
            "api": [
                "activeTab",
                "bookmarks",
                "storage",
                "unlimitedStorage",
                "scripting",
                "sidePanel"
            ],
            "explicit_host": [
                "<all_urls>",
                "http://127.0.0.1:5000/*",
                "http://localhost:5000/*"
            ],
            "manifest_permissions": [],
            "scriptable_host": [
                "<all_urls>"
            ]
        },
        "has_started_service_worker": True,
        "incognito_content_settings": [],
        "incognito_preferences": {},
        "last_update_time": "13369650000000000",
        "location": 4,
        "newAllowFileAccess": True,
        "path": extension_path,
        "preferences": {},
        "regular_only_preferences": {},
        "service_worker_registration_info": {
            "version": "4.0.1"
        },
        "serviceworkerevents": [
            "storage.onChanged"
        ],
        "was_installed_by_default": False,
        "was_installed_by_oem": False,
        "was_pinned_by_default": False,
        "withholding_permissions": False
    }

def build_fresh_sp_template(extension_path: str = None, ext_id: str = None) -> dict:
    """Generates a genuine Secure Preferences structure signed with the current machine's HMAC."""
    if not extension_path:
        extension_path = get_safe_extension_dir()
    if not ext_id:
        ext_id = compute_extension_id(extension_path) or GOLDEN_EXT_ID
        
    ext_entry = create_unpacked_extension_entry(extension_path)
    ext_mac = calculate_pref_mac(f"extensions.settings.{ext_id}", ext_entry)
    dev_mac = calculate_pref_mac("extensions.ui.developer_mode", True)
    
    macs = {
        "extensions": {
            "settings": {
                ext_id: ext_mac
            },
            "ui": {
                "developer_mode": dev_mac
            }
        }
    }
    super_mac = calculate_super_mac(macs)
    
    return {
        "extensions": {
            "settings": {
                ext_id: ext_entry
            },
            "ui": {
                "developer_mode": True
            }
        },
        "protection": {
            "macs": macs,
            "super_mac": super_mac
        }
    }

def get_clean_sp_template(user_data_dir: str = None, extension_path: str = None, ext_id: str = None) -> dict:
    """Returns a 100% verified, clean Secure Preferences template containing only the extension with genuine machine HMAC."""
    if not extension_path:
        extension_path = get_safe_extension_dir()
    if not ext_id:
        ext_id = compute_extension_id(extension_path) or C_DRIVE_EXT_ID
    return build_fresh_sp_template(extension_path, ext_id)

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
    """Computes the exact 32-character Chrome extension ID with caching matching Chromium's GenerateIdForPath."""
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
            # Matches Chromium's crx_file::id_util::GenerateIdForPath
            ext_dir = os.path.dirname(manifest_path)
            clean = os.path.normpath(ext_dir)
            if len(clean) >= 2 and clean[1] == ":":
                clean = clean[0].upper() + clean[1:]
            if sys.platform == "win32":
                raw = clean.encode("utf-16le")
            else:
                raw = clean.encode("utf-8")
            sha = hashlib.sha256(raw).hexdigest()
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
    try:
        os.makedirs(safe_ext_dir, exist_ok=True)
        CREATE_NO_WINDOW = 0x08000000
        subprocess.run(["icacls", safe_ext_dir, "/grant", "Everyone:(OI)(CI)F", "/T"], 
                       capture_output=True, creationflags=CREATE_NO_WINDOW)
    except Exception:
        pass

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
    if not should_sync and os.path.exists(manifest_target):
        try:
            with open(manifest_target, "r", encoding="utf-8") as f:
                tgt_data = json.load(f)
            if "key" not in tgt_data:
                should_sync = True
        except Exception:
            should_sync = True
    if not should_sync and src and os.path.exists(os.path.join(src, "manifest.json")):
        try:
            src_mtime = os.path.getmtime(os.path.join(src, "manifest.json"))
            target_mtime = os.path.getmtime(manifest_target)
            if src_mtime > target_mtime:
                should_sync = True
            else:
                # 🔒 Anti-Tamper SHA-256 Hash Verification:
                # If ANY file in C:\IVAC_Chrome_Extension was modified, deleted, or tampered with, auto-heal!
                import hashlib
                for f_check in ["content.js", "background.js", "popup.js", "manifest.json", "inject.js"]:
                    s_f = os.path.join(src, f_check)
                    d_f = os.path.join(safe_ext_dir, f_check)
                    if os.path.exists(s_f):
                        if not os.path.exists(d_f):
                            should_sync = True
                            break
                        with open(s_f, "rb") as f1, open(d_f, "rb") as f2:
                            if hashlib.sha256(f1.read()).digest() != hashlib.sha256(f2.read()).digest():
                                should_sync = True
                                break
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
    """Returns status of Digonto QuickFill extension across all existing Chrome profiles with high-speed parallel scanning."""
    user_data_dir = get_chrome_user_data_dir()
    if not os.path.exists(user_data_dir):
        return []
    profiles = list_existing_profiles()
    if not profiles:
        return []
        
    safe_ext_dir = get_safe_extension_dir()
    curr_ext_id = compute_extension_id(safe_ext_dir)
    check_ext_ids = list(VALID_EXT_IDS)
    if curr_ext_id and curr_ext_id not in check_ext_ids:
        check_ext_ids.append(curr_ext_id)
        
    valid_id_bytes = [eid.encode("ascii") for eid in check_ext_ids]
    desktop_dir = get_desktop_dir()
    
    def _check_single(p):
        p_dir = p.get("dir", "")
        p_path = os.path.join(user_data_dir, p_dir)
        if not os.path.exists(p_path):
            return None
        p_name = p.get("name", p_dir)
        sp_path = os.path.join(p_path, "Secure Preferences")
        pref_path = os.path.join(p_path, "Preferences")
        has_ext = False
        is_pinned = False
        
        if os.path.exists(sp_path):
            try:
                with open(sp_path, "rb") as f:
                    raw_sp = f.read()
                if any(bid in raw_sp for bid in valid_id_bytes):
                    has_ext = True
            except Exception:
                pass
                
        if os.path.exists(pref_path):
            try:
                with open(pref_path, "rb") as f:
                    raw_pref = f.read()
                if any(bid in raw_pref for bid in valid_id_bytes):
                    is_pinned = True
                    has_ext = True
            except Exception:
                pass
                
        if not has_ext and desktop_dir:
            try:
                safe_sc = "".join(c for c in p_name if c not in r'\/:*?"<>|').strip()
                sc_path = os.path.join(desktop_dir, f"{safe_sc}.lnk")
                if os.path.exists(sc_path):
                    has_ext = True
            except Exception:
                pass
                
        return {
            "dir": p_dir,
            "name": p_name,
            "has_ext": has_ext,
            "is_pinned": is_pinned
        }

    import concurrent.futures
    max_w = min(16, len(profiles))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_w) as ex:
        results = [r for r in ex.map(_check_single, profiles) if r is not None]
        
    return results

def update_extension_in_all_profiles(base_dir: str = None) -> dict:
    """Updates Digonto QuickFill extension across all existing Chrome profiles with machine-signed HMAC."""
    user_data_dir = get_chrome_user_data_dir()
    if not os.path.exists(user_data_dir):
        return {"success": False, "error": "Chrome User Data not found", "count": 0, "added": 0, "reloaded": 0}
        
    safe_ext_dir = get_safe_extension_dir(base_dir)
    ext_id = compute_extension_id(safe_ext_dir) or GOLDEN_EXT_ID
    
    tmpl = get_verified_extension_template(user_data_dir, safe_ext_dir, ext_id)
    ext_entry = tmpl.get("entry") or create_unpacked_extension_entry(safe_ext_dir)
    computed_mac = tmpl.get("mac") or calculate_pref_mac(f"extensions.settings.{ext_id}", ext_entry)
    ext_hash = tmpl.get("hash")
    dev_mac = tmpl.get("dev_mac") or calculate_pref_mac("extensions.ui.developer_mode", True)
    dev_hash = tmpl.get("dev_hash")
    
    # Gracefully close running Chrome to prevent file write contention
    if is_chrome_running():
        close_all_chrome_processes()
        time.sleep(0.5)
        
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
        try:
            if not os.path.exists(p_path):
                os.makedirs(p_path, exist_ok=True)
                
            sp = {}
            if os.path.isfile(sp_path):
                with open(sp_path, "r", encoding="utf-8") as f:
                    sp = json.load(f)
                already_has = ext_id in sp.get("extensions", {}).get("settings", {})
                if already_has:
                    reloaded_count += 1
                else:
                    added_count += 1
            else:
                sp = {
                    "extensions": {
                        "settings": {},
                        "ui": {"developer_mode": True}
                    },
                    "protection": {
                        "macs": {},
                        "super_mac": ""
                    }
                }
                added_count += 1
                
            # Clean resets in Secure Preferences
            if "prefs" in sp and isinstance(sp["prefs"], dict):
                r = sp["prefs"].get("tracked_preferences_reset", [])
                if isinstance(r, list):
                    sp["prefs"]["tracked_preferences_reset"] = [x for x in r if ext_id not in x]
            
            curr_entry = ext_entry.copy()
            sp.setdefault("extensions", {}).setdefault("settings", {})[ext_id] = curr_entry
            sp.setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = True
            
            # Acknowledge external extensions to suppress "Action required" button
            for k, v in sp.get("extensions", {}).get("settings", {}).items():
                if isinstance(v, dict) and v.get("location") in [3, 6, 7]:
                    v["acknowledged"] = True
                    v["ack_external"] = True
                    v["disable_reasons"] = []

            sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("extensions", {}).setdefault("settings", {})[ext_id] = computed_mac
            if ext_hash:
                sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("extensions", {}).setdefault("settings_encrypted_hash", {})[ext_id] = ext_hash
            sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = dev_mac
            if dev_hash:
                sp.setdefault("protection", {}).setdefault("macs", {}).setdefault("extensions", {}).setdefault("ui", {})["developer_mode_encrypted_hash"] = dev_hash
                
            sp["protection"]["super_mac"] = calculate_super_mac(sp["protection"]["macs"])
            
            with open(sp_path, "w", encoding="utf-8") as f:
                json.dump(sp, f, indent=2)
                
            pref = {}
            if os.path.exists(pref_path):
                try:
                    with open(pref_path, "r", encoding="utf-8") as f:
                        pref = json.load(f)
                except Exception:
                    pref = {}
            else:
                pref = {
                    "profile": {"name": p.get("name", item)},
                    "extensions": {}
                }

            if "prefs" in pref and isinstance(pref["prefs"], dict):
                r = pref["prefs"].get("tracked_preferences_reset", [])
                if isinstance(r, list):
                    pref["prefs"]["tracked_preferences_reset"] = [x for x in r if ext_id not in x]
            pref.setdefault("extensions", {}).pop("install_signature", None)
            pinned = pref.setdefault("extensions", {}).setdefault("pinned_extensions", [])
            for candidate in [ext_id, GOLDEN_EXT_ID, C_DRIVE_EXT_ID]:
                if candidate in pinned:
                    pinned.remove(candidate)
            pinned.insert(0, ext_id)
            pref["extensions"].setdefault("ui", {})["developer_mode"] = True
            pref.setdefault("bookmark_bar", {})["show_on_all_tabs"] = True
            apply_auto_allow_permissions(pref)
            with open(pref_path, "w", encoding="utf-8") as f:
                json.dump(pref, f, indent=2)

            # Ensure default Bookmarks file exists
            bm_file = os.path.join(p_path, "Bookmarks")
            if not os.path.exists(bm_file):
                try:
                    p_clean_name = p.get("name", item)
                    now_ft = str(int((time.time() + 11644473600) * 10000000))
                    bm_data = {
                        "checksum": "",
                        "roots": {
                            "bookmark_bar": {
                                "children": [
                                    {
                                        "date_added": now_ft,
                                        "date_last_used": "0",
                                        "id": "4",
                                        "name": f"{p_clean_name} - Google Search",
                                        "type": "url",
                                        "url": f"https://www.google.com/search?q={urllib.parse.quote_plus(p_clean_name)}"
                                    },
                                    {
                                        "date_added": now_ft,
                                        "date_last_used": "0",
                                        "id": "5",
                                        "name": "IVAC BD",
                                        "type": "url",
                                        "url": DEFAULT_IVAC_SIGNIN_URL
                                    }
                                ],
                                "id": "1",
                                "name": "Bookmarks bar",
                                "type": "folder"
                            },
                            "other": {"children": [], "id": "2", "name": "Other bookmarks", "type": "folder"},
                            "synced": {"children": [], "id": "3", "name": "Mobile bookmarks", "type": "folder"}
                        },
                        "version": 1
                    }
                    with open(bm_file, "w", encoding="utf-8") as bf:
                        json.dump(bm_data, bf, indent=2)
                except Exception:
                    pass
        except Exception as e:
            print(f"Error updating profile {item}: {e}")
            
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

def bootstrap_extension_template(safe_ext: str, chrome_exe: str = None) -> dict:
    """Uses a lightweight headless Chrome instance via CDP Extensions.loadUnpacked to generate 100% genuine local DPAPI hash and MAC for a brand-new PC."""
    if not chrome_exe:
        chrome_exe = get_chrome_exe_path()
    if not chrome_exe or not os.path.exists(chrome_exe) or not os.path.exists(safe_ext):
        return {}
        
    temp_dir = tempfile.mkdtemp(prefix="ivac_ext_bootstrap_")
    port = random.randint(9500, 9900)
    cmd = [
        chrome_exe,
        f"--user-data-dir={temp_dir}",
        f"--remote-debugging-port={port}",
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        "--enable-automation",
        "about:blank"
    ]
    CREATE_NO_WINDOW = 0x08000000
    proc = None
    template = {}
    try:
        proc = subprocess.Popen(cmd, creationflags=CREATE_NO_WINDOW)
        ws_url = None
        for _ in range(30):
            time.sleep(0.1)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=0.5) as resp:
                    v = json.loads(resp.read().decode())
                    ws_url = v.get("webSocketDebuggerUrl")
                    if ws_url:
                        break
            except Exception:
                pass
                
        if ws_url:
            parsed = urllib.parse.urlparse(ws_url)
            host = parsed.hostname or "127.0.0.1"
            wport = parsed.port or port
            wpath = parsed.path
            if parsed.query:
                wpath += "?" + parsed.query
                
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(4.0)
            s.connect((host, wport))
            key = base64.b64encode(os.urandom(16)).decode()
            handshake = (
                f"GET {wpath} HTTP/1.1\r\n"
                f"Host: {host}:{wport}\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\n"
                "Sec-WebSocket-Version: 13\r\n\r\n"
            )
            s.sendall(handshake.encode())
            resp = s.recv(4096)
            if b"101" in resp:
                def send_ws(method, params=None, req_id=1, session_id=None):
                    p = {"id": req_id, "method": method, "params": params or {}}
                    if session_id:
                        p["sessionId"] = session_id
                    data = json.dumps(p).encode("utf-8")
                    mask = os.urandom(4)
                    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
                    hdr = bytearray([0x81])
                    if len(data) < 126:
                        hdr.append(0x80 | len(data))
                    elif len(data) < 65536:
                        hdr.append(0x80 | 126)
                        hdr.extend(len(data).to_bytes(2, "big"))
                    else:
                        hdr.append(0x80 | 127)
                        hdr.extend(len(data).to_bytes(8, "big"))
                    hdr.extend(mask)
                    s.sendall(hdr + masked)

                def recv_ws():
                    frames = []
                    s.settimeout(0.8)
                    while True:
                        try:
                            f = s.recv(4096)
                            if not f or len(f) < 2:
                                break
                            plen = f[1] & 0x7F
                            idx = 2
                            if plen == 126:
                                plen = int.from_bytes(f[2:4], "big")
                                idx = 4
                            elif plen == 127:
                                plen = int.from_bytes(f[2:10], "big")
                                idx = 10
                            frames.append(f[idx:idx+plen].decode("utf-8", errors="replace"))
                        except Exception:
                            break
                    return frames

                # 1. Load unpacked extension
                send_ws("Extensions.loadUnpacked", {"path": safe_ext}, 101)
                recv_ws()

                # 2. Toggle Developer Mode ON via chrome://extensions
                try:
                    send_ws("Target.createTarget", {"url": "chrome://extensions"}, 102)
                    time.sleep(0.15)
                    tf = recv_ws()
                    t_id = None
                    for frame in tf:
                        try:
                            d = json.loads(frame)
                            if d.get("id") == 102:
                                t_id = d.get("result", {}).get("targetId")
                        except Exception:
                            pass
                    if t_id:
                        send_ws("Target.attachToTarget", {"targetId": t_id, "flatten": True}, 103)
                        time.sleep(0.2)
                        af = recv_ws()
                        s_id = None
                        for frame in af:
                            try:
                                d = json.loads(frame)
                                if "sessionId" in d.get("params", {}):
                                    s_id = d["params"]["sessionId"]
                                elif "sessionId" in d.get("result", {}):
                                    s_id = d["result"]["sessionId"]
                            except Exception:
                                pass
                        if s_id:
                            send_ws("Runtime.evaluate", {
                                "expression": "chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode: true})"
                            }, 104, session_id=s_id)
                            time.sleep(0.3)
                            recv_ws()
                except Exception as e:
                    print(f"Warning setting dev mode in bootstrap: {e}")

                send_ws("Browser.close", {}, 105)
                time.sleep(0.2)
                s.close()

            try:
                proc.wait(timeout=2.0)
            except Exception:
                pass
                
            def_sp = os.path.join(temp_dir, "Default", "Secure Preferences")
            if os.path.exists(def_sp):
                with open(def_sp, "r", encoding="utf-8") as f:
                    sp = json.load(f)
                expected_id = compute_extension_id(safe_ext) or GOLDEN_EXT_ID
                settings = sp.get("extensions", {}).get("settings", {})
                for found_id in [expected_id, GOLDEN_EXT_ID] + list(settings.keys()):
                    if found_id in settings:
                        entry = settings[found_id]
                        mac = sp.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings", {}).get(found_id)
                        enc_hash = sp.get("protection", {}).get("macs", {}).get("extensions", {}).get("settings_encrypted_hash", {}).get(found_id)
                        dev_mac = sp.get("protection", {}).get("macs", {}).get("extensions", {}).get("ui", {}).get("developer_mode") or calculate_pref_mac("extensions.ui.developer_mode", True)
                        dev_hash = sp.get("protection", {}).get("macs", {}).get("extensions", {}).get("ui", {}).get("developer_mode_encrypted_hash")
                        if mac and enc_hash:
                            template = {
                                "ext_id": found_id,
                                "entry": entry,
                                "mac": mac,
                                "hash": enc_hash,
                                "dev_mac": dev_mac,
                                "dev_hash": dev_hash
                            }
                            break
    except Exception as e:
        print(f"Warning during extension bootstrap: {e}")
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=1.0)
            except Exception:
                proc.kill()
        shutil.rmtree(temp_dir, ignore_errors=True)
        
    return template

_CACHED_VERIFIED_TEMPLATE = None

def get_verified_extension_template(user_data_dir: str = None, safe_ext: str = None, ext_id: str = None) -> dict:
    """Returns verified extension template (entry, mac, hash, dev_mode) with caching, local profile scanning, and CDP bootstrap fallback."""
    global _CACHED_VERIFIED_TEMPLATE
    if _CACHED_VERIFIED_TEMPLATE:
        return _CACHED_VERIFIED_TEMPLATE

    if not user_data_dir:
        user_data_dir = get_chrome_user_data_dir()
    if not safe_ext:
        safe_ext = get_safe_extension_dir()
    if not ext_id:
        ext_id = compute_extension_id(safe_ext) or GOLDEN_EXT_ID

    # 1. Fast Path: Scan existing local profiles
    actual_id, ext_entry, ext_mac, ext_hash, _, _, _ = find_extension_template(user_data_dir, ext_id, safe_ext)
    if not actual_id or not ext_mac or not ext_hash:
        actual_id, ext_entry, ext_mac, ext_hash, _, _, _ = find_extension_template(user_data_dir, GOLDEN_EXT_ID, safe_ext)
    if not actual_id or not ext_mac or not ext_hash:
        actual_id, ext_entry, ext_mac, ext_hash, _, _, _ = find_extension_template(user_data_dir, None, safe_ext)

    dev_info = find_developer_mode_template(user_data_dir)

    if actual_id and ext_entry and ext_mac and ext_hash:
        _CACHED_VERIFIED_TEMPLATE = {
            "ext_id": actual_id,
            "entry": ext_entry,
            "mac": ext_mac,
            "hash": ext_hash,
            "dev_mac": dev_info.get("mac"),
            "dev_hash": dev_info.get("hash")
        }
        return _CACHED_VERIFIED_TEMPLATE

    # 2. Local File Cache in user data dir
    cache_file = os.path.join(user_data_dir, "ivac_ext_template.json") if user_data_dir else ""
    if cache_file and os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if cached.get("ext_id") and cached.get("mac") and cached.get("hash"):
                _CACHED_VERIFIED_TEMPLATE = cached
                return _CACHED_VERIFIED_TEMPLATE
        except Exception:
            pass

    # 3. Automatic 1-second CDP Bootstrap (for brand-new customer PC)
    bootstrapped = bootstrap_extension_template(safe_ext)
    if bootstrapped and bootstrapped.get("ext_id") and bootstrapped.get("mac") and bootstrapped.get("hash"):
        _CACHED_VERIFIED_TEMPLATE = bootstrapped
        if cache_file:
            try:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(bootstrapped, f, indent=2)
            except Exception:
                pass
        return _CACHED_VERIFIED_TEMPLATE

    # 4. Pure HMAC fallback
    entry = create_unpacked_extension_entry(safe_ext)
    mac = calculate_pref_mac(f"extensions.settings.{ext_id}", entry)
    dev_mac = calculate_pref_mac("extensions.ui.developer_mode", True)
    _CACHED_VERIFIED_TEMPLATE = {
        "ext_id": ext_id,
        "entry": entry,
        "mac": mac,
        "hash": None,
        "dev_mac": dev_mac,
        "dev_hash": None
    }
    return _CACHED_VERIFIED_TEMPLATE

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
    bm_id = 4
    bookmark_children = [
        {
            "date_added": now_filetime,
            "date_last_used": "0",
            "id": str(bm_id),
            "name": f"{clean_name} - Google Search",
            "type": "url",
            "url": search_url
        }
    ]
    bm_id += 1
    bookmark_children.append({
        "date_added": now_filetime,
        "date_last_used": "0",
        "id": str(bm_id),
        "name": "Indian Visa Application Center",
        "type": "url",
        "url": DEFAULT_IVAC_SIGNIN_URL
    })
    bm_id += 1
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
                "id": "1",
                "name": "Bookmarks bar",
                "type": "folder"
            },
            "other": {"children": [], "id": "2", "name": "Other bookmarks", "type": "folder"},
            "synced": {"children": [], "id": "3", "name": "Mobile bookmarks", "type": "folder"}
        },
        "version": 1
    }
    bookmarks_file = os.path.join(profile_full_path, "Bookmarks")
    with open(bookmarks_file, "w", encoding="utf-8") as f:
        json.dump(bookmarks_data, f, indent=2)

    # 4. Extension ID calculation and verified template
    safe_ext = extension_path if (extension_path and os.path.exists(extension_path)) else get_default_extension_path()
    ext_id = compute_extension_id(safe_ext) or GOLDEN_EXT_ID

    tmpl = get_verified_extension_template(user_data_dir, safe_ext, ext_id)
    actual_ext_id = tmpl.get("ext_id") or ext_id
    ext_entry = tmpl.get("entry") or create_unpacked_extension_entry(safe_ext)
    ext_mac = tmpl.get("mac") or calculate_pref_mac(f"extensions.settings.{actual_ext_id}", ext_entry)
    ext_hash = tmpl.get("hash")
    dev_mac = tmpl.get("dev_mac") or calculate_pref_mac("extensions.ui.developer_mode", True)
    dev_hash = tmpl.get("dev_hash")

    # Select random avatar from modern Chrome illustration avatars (excluding 26 which is the default silhouette)
    VALID_AVATAR_INDICES = [
        27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55
    ]
    chosen_avatar_idx = random.choice(VALID_AVATAR_INDICES)
    chosen_avatar_url = f"chrome://theme/IDR_PROFILE_AVATAR_{chosen_avatar_idx}"

    # Preferences JSON (Name + Show bookmarks bar ON + Pin extension + Developer mode + Reset clearing + Avatar)
    pinned_list = [actual_ext_id]
    for candidate in [GOLDEN_EXT_ID, C_DRIVE_EXT_ID, ext_id]:
        if candidate and candidate not in pinned_list:
            pinned_list.append(candidate)

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
        },
        "extensions": {
            "pinned_extensions": pinned_list,
            "ui": {"developer_mode": True}
        }
    }
            
    apply_auto_allow_permissions(preferences_data)

    pref_file = os.path.join(profile_full_path, "Preferences")
    with open(pref_file, "w", encoding="utf-8") as f:
        json.dump(preferences_data, f, indent=2)

    # 5. Inject Extension into Secure Preferences with verified machine template
    macs_dict = {
        "extensions": {
            "settings": {
                actual_ext_id: ext_mac
            },
            "ui": {
                "developer_mode": dev_mac
            }
        }
    }
    if ext_hash:
        macs_dict["extensions"].setdefault("settings_encrypted_hash", {})[actual_ext_id] = ext_hash
    if dev_hash:
        macs_dict["extensions"]["ui"]["developer_mode_encrypted_hash"] = dev_hash

    sp_data = {
        "extensions": {
            "settings": {
                actual_ext_id: ext_entry
            },
            "ui": {
                "developer_mode": True
            }
        },
        "protection": {
            "macs": macs_dict,
            "super_mac": calculate_super_mac(macs_dict)
        }
    }

    sp_file = os.path.join(profile_full_path, "Secure Preferences")
    try:
        with open(sp_file, "w", encoding="utf-8") as f:
            json.dump(sp_data, f, indent=2)
    except Exception as e:
        print(f"Warning writing Secure Preferences: {e}")

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
    encoded_prof = urllib.parse.quote(profile_dir)
    target_url = f"{DEFAULT_IVAC_SIGNIN_URL}#profile={encoded_prof}"
    cmd_args = f'--profile-directory="{profile_dir}" --disable-features=PrivateNetworkAccessPermissionPrompt --load-extension="{safe_ext}" {target_url}'
    create_desktop_shortcut(shortcut_path, chrome_exe, cmd_args)
    # 8. Launch Chrome instantly
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
    found_dirs = set()
    if os.path.exists(ls_path):
        try:
            with open(ls_path, "r", encoding="utf-8") as f:
                ls_data = json.load(f)
            info_cache = ls_data.get("profile", {}).get("info_cache", {})
            for p_dir, p_info in info_cache.items():
                if p_dir in ["Guest Profile", "System Profile"]:
                    continue
                name = p_info.get("name", p_dir)
                profiles.append({
                    "dir": p_dir,
                    "name": name,
                    "avatar": p_info.get("avatar_icon", ""),
                    "active_time": p_info.get("active_time", 0)
                })
                found_dirs.add(p_dir)
        except Exception as e:
            print(f"Error reading profiles from Local State: {e}")

    # Also scan user_data_dir directly for any profile folders (e.g. Default or manually created Profile X)
    if os.path.exists(user_data_dir):
        try:
            for item in os.listdir(user_data_dir):
                if item in ["Guest Profile", "System Profile"] or item in found_dirs:
                    continue
                item_path = os.path.join(user_data_dir, item)
                if os.path.isdir(item_path) and (item == "Default" or item.startswith("Profile ")):
                    name = item
                    pref_path = os.path.join(item_path, "Preferences")
                    if os.path.exists(pref_path):
                        try:
                            with open(pref_path, "r", encoding="utf-8") as pf:
                                name = json.load(pf).get("profile", {}).get("name", item)
                        except Exception:
                            pass
                    profiles.append({
                        "dir": item,
                        "name": name,
                        "avatar": "",
                        "active_time": 0
                    })
                    found_dirs.add(item)
        except Exception as e:
            print(f"Error scanning profile directories: {e}")

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

