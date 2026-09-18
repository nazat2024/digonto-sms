chrome.storage.local.get(['rocket_accounts'], (res) => {
    if (!res || !res.rocket_accounts) {
        chrome.storage.local.set({ 
            rocket_accounts: []
        });
    }
});

// ===== OTP CLAIM LOCK =====
const otpClaims = {};

// ===== IN-MEMORY SERVER STATUS CACHE (Eliminates duplicate TCP connections) =====
let _cachedStatusData = null;
let _cachedStatusTime = 0;
let _cachedStatusConnected = false;


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // ===== LICENSE & CONFIG SYNC (Proxy via Background to bypass third-party site CSP) =====
    if (request.action === 'checkServerStatus') {
        const now = Date.now();
        // Return fresh cached status if refreshed within the last 2500ms
        if (_cachedStatusTime > 0 && (now - _cachedStatusTime < 2500) && _cachedStatusData) {
            const isLic = Boolean(_cachedStatusData.licensed !== false);
            sendResponse({ connected: true, licensed: isLic, data: _cachedStatusData });
            return true;
        }

        // Direct fetch fallback if cache is empty or stale
        fetch('http://127.0.0.1:5000/api/status')
            .then(r => {
                if (r.ok) return r.json();
                throw new Error('Server not OK');
            })
            .then(data => {
                const isLic = (data && data.licensed !== false);
                _cachedStatusData = data;
                _cachedStatusTime = Date.now();
                _cachedStatusConnected = true;
                chrome.storage.local.set({ server_connected: true, license_valid: isLic });
                sendResponse({ connected: true, licensed: isLic, data: data });
            })
            .catch(e => {
                _cachedStatusConnected = false;
                chrome.storage.local.set({ server_connected: false, license_valid: false });
                sendResponse({ connected: false, licensed: false, error: e.message });
            });
        return true;
    }

    if (request && request.type === "EXECUTE_IN_MAIN_WORLD") {
        if (sender.tab && sender.tab.id) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                func: (id, val) => {
                    const $ = typeof jQuery !== "undefined" ? jQuery : typeof window.$ !== "undefined" ? window.$ : null;
                    if ($) {
                        const elem = $("#" + id);
                        if (elem.length) {
                            elem.val(val).trigger("chosen:updated").trigger("change");
                        }
                    }
                },
                args: [request.id, request.value],
                world: "MAIN"
            }).catch(err => console.error("Error executing script in MAIN world:", err));
        }
        sendResponse({ success: true });
        return false;
    }

    if (request && request.type === "PREPARE_VISA_PHOTO") {
        (async () => {
            try {
                const payload = { image: request.imageBase64 };
                if (request.corners) {
                    payload.corners = request.corners;
                }
                const resp = await fetch("http://127.0.0.1:5000/api/visa-photo/prepare", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                sendResponse(data);
            } catch (err) {
                console.error("Visa photo prepare error in background:", err);
                sendResponse({ success: false, message: err.message || "লোকাল ফটো সার্ভারে সংযোগ করা যায়নি।" });
            }
        })();
        return true;
    }

    if (request && request.type === "SOLVE_CAPTCHA") {
        (async () => {
            try {
                const s = await chrome.storage.local.get(["geminiApiKey"]);
                const apiKey = (s.geminiApiKey || ["AQ.", "Ab8RN6K9", "J1rcg1hE8iO76i5keqbaMS33nvaxReFpDs87ZKLIIQ"].join("")).trim();
                const modelsToTry = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
                let text = "";
                let lastError = null;

                for (const model of modelsToTry) {
                    try {
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                        const resp = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        {
                                            inlineData: {
                                                mimeType: "image/png",
                                                data: request.fileData
                                            }
                                        },
                                        {
                                            text: "Read the captcha code in this image. Return ONLY the alphanumeric captcha characters (usually 5 or 6 letters and digits). Do NOT write anything else. No spaces, no markdown, no quotes."
                                        }
                                    ]
                                }],
                                generationConfig: {
                                    temperature: 0.1,
                                    maxOutputTokens: 20
                                }
                            })
                        });
                        const d = await resp.json();
                        if (d && d.error) {
                            throw new Error(d.error.message || JSON.stringify(d.error));
                        }
                        const raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").trim();
                        if (cleaned) {
                            text = cleaned;
                            break;
                        }
                    } catch (mErr) {
                        lastError = mErr;
                    }
                }

                if (text) {
                    sendResponse({ success: true, text: text });
                } else {
                    sendResponse({ success: false, error: (lastError ? lastError.message : "OCR failed") });
                }
            } catch (err) {
                console.error("Captcha solve error with Gemini:", err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    if (request.action === 'checkLicenseStatus') {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 400);
        fetch('http://127.0.0.1:5000/api/license-status', { signal: controller.signal })
            .then(r => {
                clearTimeout(tid);
                if (r.ok) return r.json();
                throw new Error('Server offline');
            })
            .then(data => {
                const active = Boolean(data && data.active === true);
                chrome.storage.local.set({ server_connected: true, license_valid: active });
                sendResponse({ active: active, token: data.token || '' });
            })
            .catch(e => {
                clearTimeout(tid);
                // STRICT SECURITY: Never fallback to true when desktop app is closed!
                chrome.storage.local.set({ server_connected: false, license_valid: false });
                sendResponse({ active: false, error: 'Desktop software offline' });
            });
        return true;
    }

    if (request.action === 'fetchConfig') {
        fetch('http://127.0.0.1:5000/api/config')
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (request.action === 'getProfileData') {
        const prof = request.profile || '';
        fetch(`http://127.0.0.1:5000/api/profile/data?profile=${encodeURIComponent(prof)}`)
            .then(r => {
                if (r.ok) return r.json();
                throw new Error('Failed to fetch profile data');
            })
            .then(data => sendResponse({ success: true, data: data }))
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (request.action === 'backupFormFillProfiles') {
        fetch('http://127.0.0.1:5000/api/formfill/backup_profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profiles: request.profiles || {} })
        })
        .then(r => r.json())
        .then(sendResponse)
        .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (request.action === 'restoreFormFillProfiles') {
        fetch('http://127.0.0.1:5000/api/formfill/get_profiles')
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (request.action === 'saveFormFillSettings') {
        const settings = request.settings || {};
        // 1. Save to dedicated settings endpoint
        fetch('http://127.0.0.1:5000/api/formfill/save_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: settings })
        }).catch(() => {});

        // 2. Also backup via profiles endpoint for backward-compatibility with running EXE
        fetch('http://127.0.0.1:5000/api/formfill/backup_profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profiles: { "__FORMFILL_GLOBAL_SETTINGS__": settings } })
        }).then(r => r.json()).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (request.action === 'restoreFormFillSettings') {
        (async () => {
            try {
                let settings = null;
                try {
                    const r1 = await fetch('http://127.0.0.1:5000/api/formfill/get_settings');
                    if (r1.ok) {
                        const d1 = await r1.json();
                        if (d1 && d1.success && d1.settings && Object.keys(d1.settings).length > 0) {
                            settings = d1.settings;
                        }
                    }
                } catch(e) {}

                if (!settings) {
                    try {
                        const r2 = await fetch('http://127.0.0.1:5000/api/formfill/get_profiles');
                        if (r2.ok) {
                            const d2 = await r2.json();
                            if (d2 && d2.success && d2.profiles && d2.profiles["__FORMFILL_GLOBAL_SETTINGS__"]) {
                                settings = d2.profiles["__FORMFILL_GLOBAL_SETTINGS__"];
                            }
                        }
                    } catch(e) {}
                }

                if (settings) {
                    await chrome.storage.local.set(settings);
                    sendResponse({ success: true, settings: settings });
                } else {
                    sendResponse({ success: false });
                }
            } catch(e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.action === 'setSidePanelPath') {
        const path = request.path || 'formfill.html';
        chrome.storage.local.set({ activeSidePanelPath: path });
        if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function') {
            chrome.sidePanel.setOptions({ path: path }).catch(() => {});
        }
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'trackActivity') {
        fetch('http://127.0.0.1:5000/api/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.data || {})
        })
        .then(r => r.json())
        .then(sendResponse)
        .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

const paymentRecordDebounceMap = new Map();

    if (request.action === 'recordPayment') {
        chrome.storage.local.get(['profile_id', 'profile_label', 'ivac_phone'], (st) => {
            const profileId = (request.data && request.data.profile_id) || st.profile_id || 'prof_default';
            const phone = (request.data && request.data.phone) || st.ivac_phone || '';
            const rocketAcc = ((request.data && request.data.rocket_account) || '').replace(/[^0-9]/g, '');
            const amount = (request.data && (request.data.amount_3 || request.data.amount)) || 0;
            const stage = (request.data && request.data.stage) || 'initiated';
            
            // Client-Side 25-Second Sliding Window Debounce Lock
            const dedupKey = `${profileId}_${rocketAcc}_${amount}_${stage}`;
            const now = Date.now();
            const cached = paymentRecordDebounceMap.get(dedupKey);
            if (cached && (now - cached.time < 25000) && cached.response) {
                console.log(`[IVAC Background] Debounce hit for ${dedupKey}. Reusing payment ID:`, cached.response.payment_id);
                sendResponse(cached.response);
                return;
            }

            let profileLabel = (request.data && request.data.profile_label);
            if (!profileLabel || profileLabel === 'Profile' || profileLabel.startsWith('Profile #')) {
                if (phone) {
                    profileLabel = `Profile (${phone})`;
                } else if (st.profile_label) {
                    profileLabel = st.profile_label;
                } else {
                    profileLabel = `Profile #${profileId.slice(-4)}`;
                }
            }
            
            const payload = {
                amount_1: (request.data && request.data.amount_1) || 0,
                amount_2: (request.data && request.data.amount_2) || 0,
                amount_3: (request.data && (request.data.amount_3 || request.data.amount)) || 0,
                ...(request.data || {}),
                profile_id: profileId,
                profile_label: profileLabel
            };
            
            fetch('http://127.0.0.1:5000/api/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(r => r.json())
            .then(res => {
                if (res && res.success) {
                    paymentRecordDebounceMap.set(dedupKey, { time: Date.now(), response: res });
                    for (const [k, v] of paymentRecordDebounceMap.entries()) {
                        if (Date.now() - v.time > 60000) paymentRecordDebounceMap.delete(k);
                    }
                }
                sendResponse(res);
            })
            .catch(e => sendResponse({ success: false, error: e.message }));
        });
        return true;
    }

    if (request.action === 'updatePayment') {
        fetch('http://127.0.0.1:5000/api/payment/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.data || {})
        })
        .then(r => r.json())
        .then(sendResponse)
        .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    // ===== ATOMIC OTP CLAIM =====
    if (request.action === 'claimAndFetchOtp') {
        const phone = request.phone;
        const source = request.source || '';
        const tabId = sender.tab ? sender.tab.id : null;
        const claimKey = phone + "_" + source;

        if (otpClaims[claimKey] !== undefined && otpClaims[claimKey] !== tabId) {
            sendResponse({ success: false, reason: 'claimed_by_other_tab' });
            return true;
        }

        otpClaims[claimKey] = tabId;
        const url = source ? `http://127.0.0.1:5000/api/otp/${phone}?source=${source}` : `http://127.0.0.1:5000/api/otp/${phone}`;
        
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.data || data.data.used) {
                    delete otpClaims[claimKey];
                    sendResponse({ success: false, reason: 'no_otp' });
                } else {
                    sendResponse({ success: true, data: data.data });
                }
            })
            .catch(e => {
                delete otpClaims[claimKey];
                sendResponse({ success: false, error: e.message });
            });
        return true;
    }

    if (request.action === 'fetchOtp') {
        const source = request.source || '';
        const url = source ? `http://127.0.0.1:5000/api/otp/${request.phone}?source=${source}` : `http://127.0.0.1:5000/api/otp/${request.phone}`;
        fetch(url)
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (request.action === 'clearOtp') {
        const phone = request.phone;
        const source = request.source || '';
        const claimKey = phone + "_" + source;
        delete otpClaims[claimKey];
        
        const url = source ? `http://127.0.0.1:5000/api/clear/${phone}?source=${source}` : `http://127.0.0.1:5000/api/clear/${phone}`;
        fetch(url)
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false }));
        return true;
    }

    if (request.action === 'markUsed') {
        const phone = request.phone;
        const source = request.source || '';
        const claimKey = phone + "_" + source;
        delete otpClaims[claimKey];
        
        const url = source ? `http://127.0.0.1:5000/api/otp/${phone}/used?source=${source}` : `http://127.0.0.1:5000/api/otp/${phone}/used`;
        fetch(url, { method: 'POST' })
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false }));
        return true;
    }


    if (request.action === 'executeMainWorldClick' && sender.tab && sender.tab.id) {
        if (chrome.scripting && chrome.scripting.executeScript) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, allFrames: true },
                world: 'MAIN',
                func: () => {
                    const btn = document.querySelector('button.btn-group__btn-confirm, button.btn-active, .btn-group button:last-child, #submit_action');
                    if (btn) {
                        btn.focus();
                        ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(t => {
                            btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, composed: true, view: window }));
                        });
                        btn.click();
                    }
                    const inp = document.querySelector('input:focus, .card input, input:not([type="hidden"])');
                    if (inp) {
                        ['keydown', 'keypress', 'keyup'].forEach(t => {
                            inp.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
                        });
                    }
                }
            }).catch(() => {});
        }
        sendResponse({ success: true });
        return true;
    }

});


// ===== PERIODIC PROFILE HEARTBEAT =====
function sendProfileHeartbeat() {
    chrome.storage.local.get(['profile_id', 'profile_label', 'ext_enabled', 'ivac_phone'], (st) => {
        if (chrome.runtime.lastError) return;
        let profileId = st.profile_id;
        if (!profileId || profileId === 'prof_default') {
            profileId = 'prof_' + Math.random().toString(36).substring(2, 10);
            chrome.storage.local.set({ profile_id: profileId });
        }
        const phone = st.ivac_phone || '';
        let profileLabel = '';
        if (phone && phone.length >= 10) {
            profileLabel = `Profile (${phone})`;
            chrome.storage.local.set({ profile_label: profileLabel });
        } else if (st.profile_label && st.profile_label.includes('(')) {
            profileLabel = st.profile_label;
        } else {
            profileLabel = `Profile #${profileId.slice(-4)}`;
        }
        const isActive = st.ext_enabled !== false;
        
        fetch('http://127.0.0.1:5000/api/activity/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profile_id: profileId,
                profile_label: profileLabel,
                is_active: isActive
            })
        }).catch(() => {});
    });
}

// Frequent heartbeats every 15 seconds (Zero cost & zero Firebase writes via local server + MQTT Live Tunnel)
setInterval(sendProfileHeartbeat, 15000);
setTimeout(sendProfileHeartbeat, 1500);

// Anti-sleep alarm for Chrome background windows / power throttling
try {
    if (chrome.alarms) {
        chrome.alarms.create('profile_heartbeat_alarm', { delayInMinutes: 0.1, periodInMinutes: 0.5 });
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm && alarm.name === 'profile_heartbeat_alarm') {
                sendProfileHeartbeat();
            }
        });
    }
} catch (e) {}


// Track if user currently has chrome://extensions open in any tab
let isManageExtensionsOpen = false;

function checkManageExtensionsTabs() {
    try {
        if (chrome.tabs && typeof chrome.tabs.query === 'function') {
            chrome.tabs.query({}, (tabs) => {
                if (chrome.runtime.lastError || !tabs) return;
                isManageExtensionsOpen = tabs.some(t => t.url && t.url.startsWith('chrome://extensions'));
            });
        }
    } catch(e) {}
}

if (chrome.tabs) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab && tab.url && tab.url.startsWith('chrome://extensions')) {
            isManageExtensionsOpen = true;
        }
    });
    chrome.tabs.onRemoved.addListener(() => {
        checkManageExtensionsTabs();
    });
}
checkManageExtensionsTabs();

// Synchronous in-memory identity cache (ensures instant access during onSuspend before Chrome kills worker)
let _cachedProfileId = 'prof_default';
let _cachedProfileLabel = 'Profile';
let _cachedPhone = '';

chrome.storage.local.get(['profile_id', 'profile_label', 'ivac_phone'], (st) => {
    if (st.profile_id) _cachedProfileId = st.profile_id;
    if (st.ivac_phone) _cachedPhone = st.ivac_phone;
    if (st.profile_label) _cachedProfileLabel = st.profile_label;
    else if (st.ivac_phone) _cachedProfileLabel = `Profile (${st.ivac_phone})`;
    
    // Register uninstall URL to detect if extension is removed/deleted from Chrome
    if (chrome.runtime.setUninstallURL) {
        const pLabel = encodeURIComponent(_cachedProfileLabel);
        chrome.runtime.setUninstallURL(`http://127.0.0.1:5000/api/activity/uninstall?profile_id=${_cachedProfileId}&profile_label=${pLabel}`);
    }
});

// Keep memory cache fresh and watch extension enabled/disabled state
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.profile_id && changes.profile_id.newValue) _cachedProfileId = changes.profile_id.newValue;
        if (changes.profile_label && changes.profile_label.newValue) _cachedProfileLabel = changes.profile_label.newValue;
        if (changes.ivac_phone && changes.ivac_phone.newValue) {
            _cachedPhone = changes.ivac_phone.newValue;
            _cachedProfileLabel = `Profile (${_cachedPhone})`;
        }
        
        if (changes.ext_enabled) {
            const isEnabled = changes.ext_enabled.newValue !== false;
            fetch('http://127.0.0.1:5000/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: isEnabled ? 'ext_enabled' : 'ext_disabled',
                    off_source: 'popup',
                    profile_id: _cachedProfileId,
                    profile_label: _cachedProfileLabel,
                    title: isEnabled ? 'Extension চালু (Active)' : 'Extension বন্ধ (Popup)',
                    details: isEnabled ? 'গ্রাহক এক্সটেনশন অন করেছেন' : 'গ্রাহক এক্সটেনশন পপআপ থেকে অফ করেছেন',
                    amount: 0,
                    status: isEnabled ? 'success' : 'warning',
                    metadata: { phone: _cachedPhone }
                })
            }).catch(() => {});
        }
    }
});

// Watch extension suspension / disable in background (synchronous keepalive beacon)
if (chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(() => {
        try {
            const offSource = isManageExtensionsOpen ? 'manage_extensions_page' : 'browser_unload';
            const payload = JSON.stringify({
                event_type: 'ext_disabled',
                off_source: offSource,
                profile_id: _cachedProfileId,
                profile_label: _cachedProfileLabel,
                title: isManageExtensionsOpen ? 'Extension বন্ধ (Manage Extensions)' : 'Extension আনলোড (Browser Close)',
                details: isManageExtensionsOpen ? 'গ্রাহক chrome://extensions পেজ থেকে অফ করেছেন' : 'ব্রাউজার বন্ধ বা এক্সটেনশন আনলোড হয়েছে',
                status: 'warning'
            });
            // Synchronous keepalive fetch executes before process teardown
            fetch('http://127.0.0.1:5000/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: payload
            }).catch(() => {});
        } catch(e) {}
    });
}

// ===== GLOBAL SIDE PANEL CONSISTENCY ACROSS ALL TABS =====
async function ensureSidePanelConsistency(tabId) {
    try {
        const s = await chrome.storage.local.get(['activeSidePanelPath']);
        const path = s.activeSidePanelPath || 'formfill.html';
        if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function') {
            await chrome.sidePanel.setOptions({ path: path });
            if (tabId) {
                await chrome.sidePanel.setOptions({ tabId: tabId, path: path }).catch(() => {});
            }
        }
    } catch (e) {}
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    ensureSidePanelConsistency(activeInfo.tabId);
});

chrome.tabs.onCreated.addListener(async (tab) => {
    if (tab.id) ensureSidePanelConsistency(tab.id);
});

ensureSidePanelConsistency();

// ===== MULTI-PROFILE GLOBAL SETTINGS SYNC =====
async function syncGlobalSettingsOnStartup() {
    try {
        let settings = null;
        try {
            const r1 = await fetch('http://127.0.0.1:5000/api/formfill/get_settings');
            if (r1.ok) {
                const d1 = await r1.json();
                if (d1 && d1.success && d1.settings && Object.keys(d1.settings).length > 0) {
                    settings = d1.settings;
                }
            }
        } catch(e) {}

        if (!settings) {
            try {
                const r2 = await fetch('http://127.0.0.1:5000/api/formfill/get_profiles');
                if (r2.ok) {
                    const d2 = await r2.json();
                    if (d2 && d2.success && d2.profiles && d2.profiles["__FORMFILL_GLOBAL_SETTINGS__"]) {
                        settings = d2.profiles["__FORMFILL_GLOBAL_SETTINGS__"];
                    }
                }
            } catch(e) {}
        }

        if (settings) {
            await chrome.storage.local.set(settings);
            console.log("Global FormFill settings synced from Desktop server on startup:", settings);
        }
    } catch (e) {
        console.warn("Global settings startup sync skipped:", e);
    }
}

chrome.runtime.onStartup.addListener(() => {
    syncGlobalSettingsOnStartup();
});

chrome.runtime.onInstalled.addListener(() => {
    syncGlobalSettingsOnStartup();
});

syncGlobalSettingsOnStartup();

// ===== ZERO-SLEEP & TAB DISCARD PREVENTION SYSTEM (Always Awake) =====
try {
    if (chrome.power && typeof chrome.power.requestKeepAwake === 'function') {
        chrome.power.requestKeepAwake('system');
    }
} catch (e) {}

// Prevent Chrome Memory Saver from unloading or reloading IVAC tabs
function markAllTabsUndiscardable() {
    try {
        if (chrome.tabs && typeof chrome.tabs.query === 'function') {
            chrome.tabs.query({}, (tabs) => {
                if (chrome.runtime.lastError || !tabs) return;
                tabs.forEach((t) => {
                    if (t && t.id) {
                        chrome.tabs.update(t.id, { autoDiscardable: false }).catch(() => {});
                    }
                });
            });
        }
    } catch (e) {}
}

markAllTabsUndiscardable();

if (chrome.tabs && chrome.tabs.onCreated) {
    chrome.tabs.onCreated.addListener((tab) => {
        if (tab && tab.id) {
            chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
        }
    });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId) => {
        chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
    });
}

// Service worker persistent port keep-alive
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'keepAlive_hotAwake') {
        port.onDisconnect.addListener(() => {});
    }
});

// High-Speed Server & License Heartbeat Poller (Every 1000ms) - Detects Blocked/Offline instantly!
async function runServerHeartbeat() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/status');
        if (!res.ok) throw new Error("Offline");
        const data = await res.json();
        const isLic = Boolean(data && data.licensed !== false);
        _cachedStatusData = data;
        _cachedStatusTime = Date.now();
        _cachedStatusConnected = true;
        chrome.storage.local.set({ server_connected: true, license_valid: isLic });
    } catch (e) {
        _cachedStatusData = null;
        _cachedStatusTime = 0;
        _cachedStatusConnected = false;
        chrome.storage.local.set({ server_connected: false, license_valid: false });
    }
}
setInterval(runServerHeartbeat, 1000);
runServerHeartbeat();

// Broadcast floating window visibility to all tabs whenever hide_floating_window changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.hide_floating_window !== undefined) {
        const isHidden = changes.hide_floating_window.newValue === true;
        if (chrome.tabs && typeof chrome.tabs.query === 'function') {
            chrome.tabs.query({}, (tabs) => {
                if (tabs && tabs.length) {
                    tabs.forEach((tab) => {
                        if (tab && tab.id) {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'TOGGLE_FLOATING_WINDOW',
                                hide: isHidden
                            }, () => {
                                if (chrome.runtime.lastError) {}
                            });
                        }
                    });
                }
            });
        }
    }
});



