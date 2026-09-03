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
        const profileId = st.profile_id || 'prof_default';
        const profileLabel = st.profile_label || (st.ivac_phone ? `Profile ${st.ivac_phone}` : `Profile #${profileId.slice(-4)}`);
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

setInterval(sendProfileHeartbeat, 12000);
setTimeout(sendProfileHeartbeat, 2000);


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
