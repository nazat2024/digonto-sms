chrome.storage.local.get(['rocket_accounts'], (res) => {
    if (!res || !res.rocket_accounts) {
        chrome.storage.local.set({ 
            rocket_accounts: []
        });
    }
});

// ===== OTP CLAIM LOCK =====
const otpClaims = {};


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // ===== LICENSE & CONFIG SYNC (Proxy via Background to bypass third-party site CSP) =====
    if (request.action === 'checkServerStatus') {
        fetch('http://127.0.0.1:5000/api/status')
            .then(r => {
                if (r.ok) return r.json();
                throw new Error('Server not OK');
            })
            .then(data => {
                const isLic = (data && data.licensed !== false);
                sendResponse({ connected: true, licensed: isLic, data: data });
            })
            .catch(e => sendResponse({ connected: false, licensed: false, error: e.message }));
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

    if (request && request.type === "SOLVE_CAPTCHA") {
        (async () => {
            try {
                const s = await chrome.storage.local.get(["geminiApiKey"]);
                const apiKey = (s.geminiApiKey || ["AQ.", "Ab8RN6K9", "J1rcg1hE8iO76i5keqbaMS33nvaxReFpDs87ZKLIIQ"].join("")).trim();
                const modelsToTry = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
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
        fetch('http://127.0.0.1:5000/api/license-status')
            .then(r => {
                if (r.ok) return r.json();
                throw new Error('Server offline');
            })
            .then(data => {
                const active = Boolean(data && data.active === true);
                sendResponse({ active: active, token: data.token || '' });
            })
            .catch(e => {
                // STRICT SECURITY: Never fallback to true when desktop app is closed!
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

    if (request.action === 'recordPayment') {
        chrome.storage.local.get(['profile_id', 'profile_label', 'ivac_phone'], (st) => {
            const profileId = (request.data && request.data.profile_id) || st.profile_id || 'prof_default';
            const phone = (request.data && request.data.phone) || st.ivac_phone || '';
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
            .then(sendResponse)
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


// Watch extension enabled/disabled state in background exclusively (prevents multi-tab duplicate logs)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ext_enabled) {
        const isEnabled = changes.ext_enabled.newValue !== false;
        chrome.storage.local.get(['profile_id', 'profile_label', 'ivac_phone'], (st) => {
            const profileId = st.profile_id || 'prof_default';
            const phone = st.ivac_phone || '';
            const profileLabel = phone ? `Profile (${phone})` : (st.profile_label || `Profile #${profileId.slice(-4)}`);
            
            fetch('http://127.0.0.1:5000/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: isEnabled ? 'ext_enabled' : 'ext_disabled',
                    profile_id: profileId,
                    profile_label: profileLabel,
                    title: isEnabled ? 'Extension চালু (Active)' : 'Extension বন্ধ (Off)',
                    details: isEnabled ? 'গ্রাহক এক্সটেনশন অন করেছেন' : 'গ্রাহক এক্সটেনশন অফ করেছেন',
                    amount: 0,
                    status: isEnabled ? 'success' : 'warning',
                    metadata: { phone: phone }
                })
            }).catch(() => {});
        });
    }
});

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

