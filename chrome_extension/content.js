/**
 * IVAC Auto-Fill Assistant Content Script
 * 
 * 1. Auto-captures IVAC phone number from login forms
 * 2. Auto-fills OTP fields (6 boxes)
 * 3. Shows a persistent, draggable floating pin widget ON the page
 * 4. Auto-clicks through the appointment flow
 * 5. Webfile Auto/Manual Upload (with captcha detection)
 */

let otpPollingInterval = null;
const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

// ===== LICENSE & SYNC SERVER CHECK =====
let isLicenseValid = true;

async function checkLicenseAndSyncConfig() {
    try {
        const res = await fetch('http://localhost:5000/api/license-status');
        const data = await res.json();
        if (!data.active) {
            showLicenseError("আপনার Digonto QuickFill লাইসেন্সের মেয়াদ শেষ হয়ে গেছে! দয়া করে সফটওয়্যার থেকে রিনিউ করুন।");
            isLicenseValid = false;
        } else {
            isLicenseValid = true;
            removeLicenseError();
        }
        
        // Sync Rocket Accounts
        const cfgRes = await fetch('http://localhost:5000/api/config');
        const cfgData = await cfgRes.json();
        if (cfgData.rocket_accounts && cfgData.rocket_accounts.length > 0) {
            chrome.storage.local.get(['active_rocket_id'], (st) => {
                const accounts = cfgData.rocket_accounts;
                let activeId = st.active_rocket_id;
                if (!accounts.find(a => a.id === activeId)) {
                    activeId = accounts[0].id;
                }
                chrome.storage.local.set({
                    rocket_accounts: accounts,
                    active_rocket_id: activeId
                });
            });
        }
        
        // Sync Active Profile Credentials in real-time
        if (cfgData.active_profile) {
            const servPhone = cfgData.active_profile.phone || '';
            const servPass = cfgData.active_profile.password || '';
            
            chrome.storage.local.get(['ivac_phone', 'ivac_password'], (local) => {
                const updates = {};
                if (servPhone && local.ivac_phone !== servPhone) {
                    updates.ivac_phone = servPhone;
                }
                if (servPass !== undefined && local.ivac_password !== servPass) {
                    updates.ivac_password = servPass;
                }
                if (Object.keys(updates).length > 0) {
                    chrome.storage.local.set(updates);
                }
            });
        }
    } catch (e) {
        showLicenseError("Digonto QuickFill কাজ করছে না! দয়া করে IVAC Desktop সফটওয়্যারটি ব্যাকগ্রাউন্ডে চালু রাখুন।");
        isLicenseValid = false;
    }
}

function showLicenseError(msg) {
    let errBanner = document.getElementById('ivac-license-err-banner');
    if (!errBanner) {
        errBanner = document.createElement('div');
        errBanner.id = 'ivac-license-err-banner';
        errBanner.style = "position:fixed; top:0; left:0; width:100%; background:#ef4444; color:white; text-align:center; padding:15px; font-size:18px; font-weight:bold; z-index:99999999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);";
        document.documentElement.appendChild(errBanner);
    }
    errBanner.innerText = msg;
}

function removeLicenseError() {
    const errBanner = document.getElementById('ivac-license-err-banner');
    if (errBanner) errBanner.remove();
}

// Check every 1 second for live real-time sync
checkLicenseAndSyncConfig();
setInterval(checkLicenseAndSyncConfig, 1000);

// ===== INJECT NETWORK INTERCEPTOR (Auto Link Catcher) =====
const interceptorScript = document.createElement('script');
interceptorScript.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(interceptorScript);
interceptorScript.onload = function() {
    this.remove();
};

// Listen for intercepted links
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'IVAC_PAYMENT_LINK') {
        chrome.storage.local.set({ payment_link: event.data.url });
    }
});
// ==========================================================

// Load saved state (just for widget init)
chrome.storage.local.get(['ivac_phone', 'rocket_accounts', 'active_rocket_id'], function(result) {
    if (chrome.runtime.lastError) {} // Ignore and continue
    createPinWidget();
});

// Helper to get active rocket phone dynamically
function getActiveRocketPhone(accounts, activeId) {
    if (accounts && activeId) {
        const active = accounts.find(a => a.id === activeId);
        if (active) {
            return active.number.substring(0, 11);
        }
    }
    return "";
}

// Auto-capture phone from input fields on IVAC site
document.addEventListener('input', handlePhoneCapture);
document.addEventListener('change', handlePhoneCapture);
document.addEventListener('focusout', handlePhoneCapture);

function handlePhoneCapture(e) {
    if (!e || !e.target || !e.target.tagName) return;
    if (e.target.tagName.toLowerCase() !== 'input') return;
    checkInputForPhone(e.target);
}

function checkInputForPhone(inputEl) {
    const type = (inputEl.type || 'text').toLowerCase();
    if (type === 'text' || type === 'tel' || type === 'number') {
        const val = (inputEl.value || '').replace(/[^0-9]/g, '');
        const m = val.match(phoneRegex);
        if (m) {
            chrome.storage.local.get(['ivac_phone'], (res) => {
                if (res.ivac_phone !== m[1]) {
                    chrome.storage.local.set({ ivac_phone: m[1] });
                }
            });
        }
    }
}

// Bulletproof fallback: Scan all inputs periodically (for Chrome Autofill or JS injected values)
setInterval(() => {
    try {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(inp => checkInputForPhone(inp));
    } catch (e) {}
}, 2000);

// ===== AUTO-FILL SIGN-IN CREDENTIALS (Mobile Number & Password) =====
function setNativeInputValue(element, value) {
    if (!element || value === undefined || value === null) return;
    try {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value') ? Object.getOwnPropertyDescriptor(element, 'value').set : null;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value') ? Object.getOwnPropertyDescriptor(prototype, 'value').set : null;
        
        if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else if (valueSetter) {
            valueSetter.call(element, value);
        } else {
            element.value = value;
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    } catch (e) {
        element.value = value;
    }
}

function autoFillLoginCredentials() {
    const url = window.location.href.toLowerCase();
    if (!url.includes('/signin') && !url.includes('signin') && !url.includes('login')) return;

    chrome.storage.local.get(['ivac_phone', 'ivac_password', 'ext_enabled'], (st) => {
        if (st.ext_enabled === false) return;
        
        let phone = st.ivac_phone;
        let pass = st.ivac_password;

        if (!phone && !pass) return;

        // 1. Find and fill Contact Number input
        if (phone) {
            const inputs = Array.from(document.querySelectorAll('input'));
            const phoneInputs = inputs.filter(inp => {
                const type = (inp.type || 'text').toLowerCase();
                const name = (inp.name || '').toLowerCase();
                const id = (inp.id || '').toLowerCase();
                const ph = (inp.placeholder || '').toLowerCase();
                if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio') return false;
                return ph.includes('01') || ph.includes('contact') || ph.includes('phone') || ph.includes('mobile') ||
                       name.includes('phone') || name.includes('mobile') || name.includes('contact') ||
                       id.includes('phone') || id.includes('mobile') || id.includes('contact') ||
                       type === 'tel';
            });
            
            const phoneInput = phoneInputs.length > 0 ? phoneInputs[0] : document.querySelector('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])');
            if (phoneInput) {
                const cleanVal = (phoneInput.value || '').replace(/[^0-9]/g, '');
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                if (cleanVal !== cleanPhone) {
                    setNativeInputValue(phoneInput, phone);
                }
            }
        }

        // 2. Find and fill Password input
        if (pass) {
            const passInput = document.querySelector('input[type="password"], input[placeholder*="password" i], input[name*="password" i], input[id*="password" i]');
            if (passInput) {
                if (!passInput.value || passInput.value !== pass) {
                    setNativeInputValue(passInput, pass);
                }
            }
        }
    });
}

// Continuously auto-fill login credentials while on signin page
setInterval(autoFillLoginCredentials, 600);
document.addEventListener('DOMContentLoaded', autoFillLoginCredentials);
window.addEventListener('load', autoFillLoginCredentials);

// ===== FLOATING PIN WIDGET (injected into the webpage DOM) =====
let pinWidgetEl = null;
let widgetMinimized = false;

function createPinWidget() {
    // Don't duplicate
    if (document.getElementById('ivac-pin-widget-root')) return;
    // Skip on extension pages
    if (window.location.protocol === 'chrome-extension:' || window.location.protocol === 'chrome:') return;

    pinWidgetEl = document.createElement('div');
    pinWidgetEl.id = 'ivac-pin-widget-root';

    // Use shadow DOM so page CSS doesn't affect our widget
    const shadow = pinWidgetEl.attachShadow({ mode: 'closed' });

    const wrapper = document.createElement('div');
    wrapper.id = 'pin-wrapper';
    wrapper.innerHTML = `
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            #pin-box {
                position: fixed;
                top: 12px;
                right: 12px;
                z-index: 2147483647;
                width: 195px;
                background: #fff;
                border: 2px solid #059669;
                border-radius: 8px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 11px;
                color: #0f172a;
                overflow: hidden;
                user-select: none;
            }
            #pin-header {
                background: #059669;
                color: #fff;
                padding: 4px 8px;
                font-weight: 700;
                font-size: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
            }
            #pin-header-left {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .hdr-btn {
                background: none;
                border: none;
                color: #fff;
                font-size: 14px;
                cursor: pointer;
                padding: 0 2px;
                font-weight: bold;
                line-height: 1;
            }
            #pin-body {
                padding: 5px 7px;
                background: #f8fafc;
            }
            #otp-display {
                background: #fff;
                border: 1px dashed #cbd5e1;
                border-radius: 4px;
                padding: 5px;
                text-align: center;
                min-height: 24px;
            }
            .otp-val {
                font-size: 16px;
                font-weight: 800;
                letter-spacing: 1px;
            }
            .otp-tag {
                font-size: 8px;
                font-weight: 700;
                text-transform: uppercase;
                margin-bottom: 1px;
            }
            .c-green { color: #059669; }
            .c-amber { color: #d97706; }
            .c-gray { color: #94a3b8; }
            .divider { height:1px; background:#e2e8f0; margin:3px 0; }
            
            .otp-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 2px;
            }
            .action-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 2px 4px;
                font-size: 14px;
                border-radius: 4px;
                transition: background 0.2s;
            }
            .action-btn:hover {
                background: #e2e8f0;
            }
        </style>
        <div id="pin-box">
            <div id="pin-header">
                <div id="pin-header-left">
                    <span>📌</span>
                    <span>IVAC OTP</span>
                </div>
                <button class="hdr-btn" id="min-btn">−</button>
            </div>
            <div id="pin-body">
                <div id="otp-display">
                    <span class="c-gray" style="font-size:10px;">অপেক্ষা করছি...</span>
                </div>
            </div>
        </div>
    `;

    shadow.appendChild(wrapper);
    document.documentElement.appendChild(pinWidgetEl);

    // Minimize/Expand toggle
    const minBtn = shadow.getElementById('min-btn');
    const pinBody = shadow.getElementById('pin-body');
    minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widgetMinimized = !widgetMinimized;
        pinBody.style.display = widgetMinimized ? 'none' : 'block';
        minBtn.textContent = widgetMinimized ? '+' : '−';
    });

    // Make draggable
    const pinBox = shadow.getElementById('pin-box');
    const pinHeader = shadow.getElementById('pin-header');
    let dragging = false, dx = 0, dy = 0;

    pinHeader.addEventListener('mousedown', (e) => {
        dragging = true;
        dx = e.clientX - pinBox.getBoundingClientRect().left;
        dy = e.clientY - pinBox.getBoundingClientRect().top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        pinBox.style.left = (e.clientX - dx) + 'px';
        pinBox.style.top = (e.clientY - dy) + 'px';
        pinBox.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => { dragging = false; });

    // Start live OTP polling for this widget
    const otpBox = shadow.getElementById('otp-display');
    setInterval(() => updateWidgetOtp(otpBox), 1500);

    // Event delegation for copy and delete buttons
    otpBox.addEventListener('click', async (e) => {
        const btn = e.target.closest('.action-btn');
        if (!btn) return;
        
        const action = btn.getAttribute('data-action');
        if (action === 'copy') {
            const otp = btn.getAttribute('data-otp');
            navigator.clipboard.writeText(otp);
            const originalText = btn.textContent;
            btn.textContent = '✅';
            setTimeout(() => { btn.textContent = originalText; }, 1000);
        } else if (action === 'delete') {
            const phone = btn.getAttribute('data-phone');
            try {
                await new Promise(r => chrome.runtime.sendMessage({ action: 'clearOtp', phone: phone }, r));
                updateWidgetOtp(otpBox); // Update UI immediately
            } catch (err) {}
        } else if (action === 'copy-link') {
            const link = btn.getAttribute('data-link');
            navigator.clipboard.writeText(link);
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = originalText; }, 1000);
        } else if (action === 'delete-link') {
            chrome.storage.local.remove('payment_link', () => {
                updateWidgetOtp(otpBox);
            });
        }
    });
}

// Live Update Widget OTP
async function updateWidgetOtp(box) {
    if (!box) return;
    
    try {
    // Always get the freshest data directly from storage! No out-of-sync tabs.
    const res = await new Promise(r => chrome.storage.local.get(['ext_enabled', 'ivac_phone', 'rocket_accounts', 'active_rocket_id', 'payment_link'], (result) => {
        if (chrome.runtime.lastError) {
            r({});
        } else {
            r(result || {});
        }
    }));
    
    if (res.ext_enabled === false) {
        if (pinWidgetEl) pinWidgetEl.style.display = 'none';
        return;
    } else {
        if (pinWidgetEl) pinWidgetEl.style.display = 'block';
    }

    const currentSavedPhone = res.ivac_phone || "";
    const currentRocketPhone = getActiveRocketPhone(res.rocket_accounts, res.active_rocket_id);

    let html = '';
    let found = false;

    // Check IVAC phone
    if (currentSavedPhone) {
        try {
            const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'fetchOtp', phone: currentSavedPhone }, r));
            if (d && d.success && d.data && !d.data.used) {
                html += `<div class="otp-tag c-green">📱 IVAC (${currentSavedPhone})</div>
                             <div class="otp-row">
                                 <div class="otp-val c-green">${d.data.display}</div>
                                 <div>
                                     <button class="action-btn" data-action="copy" data-otp="${d.data.otp_string}" title="Copy">📋</button>
                                     <button class="action-btn" data-action="delete" data-phone="${currentSavedPhone}" title="Delete">🗑️</button>
                                 </div>
                             </div>`;
                found = true;
            }
        } catch(e) {}
    }

    // Check Rocket phone
    if (currentRocketPhone && currentRocketPhone !== currentSavedPhone) {
        try {
            const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'fetchOtp', phone: currentRocketPhone }, r));
            if (d && d.success && d.data && !d.data.used) {
                if (found) html += `<div class="divider"></div>`;
                    html += `<div class="otp-tag c-amber">🚀 Rocket (${currentRocketPhone})</div>
                             <div class="otp-row">
                                 <div class="otp-val c-amber">${d.data.display}</div>
                                 <div>
                                     <button class="action-btn" data-action="copy" data-otp="${d.data.otp_string}" title="Copy">📋</button>
                                     <button class="action-btn" data-action="delete" data-phone="${currentRocketPhone}" title="Delete">🗑️</button>
                                 </div>
                             </div>`;
                found = true;
            }
        } catch(e) {}
    }

    // Check Payment Link
    if (res.payment_link) {
        if (found) html += `<div class="divider"></div>`;
        html += `<div class="otp-tag" style="color:#2563eb;">🔗 Payment Link Found!</div>
                 <div style="margin-top:4px; display:flex; flex-direction:column; gap:4px;">
                     <input type="text" value="${res.payment_link}" readonly style="width:100%; padding:4px; font-size:10px; border:1px solid #cbd5e1; border-radius:4px; background:#f8fafc; color:#475569;" title="Payment Link">
                     <div style="display:flex; justify-content:space-between; gap:4px;">
                         <button class="action-btn" style="flex:1; background:#e0f2fe; color:#2563eb; font-weight:bold;" data-action="copy-link" data-link="${res.payment_link}">📋 Copy Link</button>
                         <button class="action-btn" style="flex:1; background:#fee2e2; color:#ef4444;" data-action="delete-link">🗑️ Clear</button>
                     </div>
                 </div>`;
        found = true;
    }

    if (!found) {
        let text = "কোনো নতুন OTP নেই";
        if (currentSavedPhone) {
            text = `<b>${currentSavedPhone}</b> এর OTP নেই`;
        } else {
            text = `ফোন নম্বর পাওয়া যায়নি!`;
        }
        box.innerHTML = `<span class="c-gray" style="font-size:10px;">${text}</span>`;
    } else {
        box.innerHTML = html;
    }
    } catch(e) {
        // Extension context invalidated — silently ignore (happens after extension reload)
    }
}

// ===== AUTO-FILL 6-BOX or 1-BOX OTP =====
function checkForOtpFields() {
    if (!isLicenseValid) return;
    // শুধুমাত্র active (foreground) ট্যাবে কাজ করবে
    if (document.visibilityState !== 'visible') return;

    const inputs = Array.from(document.querySelectorAll('input'));
    
    // Check for 6 separate boxes (Webfile final submit)
    const otpInputs = inputs.filter(inp =>
        inp.type !== 'hidden' &&
        inp.style.display !== 'none' &&
        (inp.maxLength === 1 || inp.getAttribute('pattern') === '[0-9]')
    );

    // Check for 1 single box (Login/Sign In page)
    const singleOtpInput = inputs.find(inp => 
        inp.type !== 'hidden' &&
        inp.style.display !== 'none' &&
        (inp.id.toLowerCase().includes('otp') || 
         inp.name.toLowerCase().includes('otp') || 
         (inp.placeholder || '').toLowerCase().includes('otp'))
    );

    if (otpInputs.length === 6) {
        if (!otpPollingInterval) {
            otpPollingInterval = setInterval(() => fetchAndFillOtp(otpInputs, false), 1500);
        }
    } else if (singleOtpInput) {
        if (!otpPollingInterval) {
            otpPollingInterval = setInterval(() => fetchAndFillOtp([singleOtpInput], true), 1500);
        }
    } else if (otpPollingInterval) {
        clearInterval(otpPollingInterval);
        otpPollingInterval = null;
    }
}

async function fetchAndFillOtp(otpInputs, isSingleBox) {
    if (!isLicenseValid) return;
    // শুধুমাত্র active (foreground) ট্যাবে কাজ করবে
    if (document.visibilityState !== 'visible') return;

    // Get freshest phone numbers
    const res = await new Promise(r => chrome.storage.local.get(['ivac_phone', 'rocket_accounts', 'active_rocket_id'], r));
    const currentSavedPhone = res.ivac_phone || "";
    const currentRocketPhone = getActiveRocketPhone(res.rocket_accounts, res.active_rocket_id);

    try {
        let filled = false;
        if (currentSavedPhone) {
            // claimAndFetchOtp — atomic: শুধু একটি ট্যাবই এই OTP পাবে
            const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'claimAndFetchOtp', phone: currentSavedPhone }, r));
            if (d && d.success && d.data && d.data.digits && !d.data.used) {
                fillOtpNative(otpInputs, d.data.digits, isSingleBox);
                chrome.runtime.sendMessage({ action: 'markUsed', phone: currentSavedPhone });
                filled = true;
            }
        }
        if (!filled && currentRocketPhone && currentRocketPhone !== currentSavedPhone) {
            const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'claimAndFetchOtp', phone: currentRocketPhone }, r));
            if (d && d.success && d.data && d.data.digits && !d.data.used) {
                fillOtpNative(otpInputs, d.data.digits, isSingleBox);
                chrome.runtime.sendMessage({ action: 'markUsed', phone: currentRocketPhone });
            }
        }
    } catch(e) {}
}

// React-safe fill function
function fillOtpNative(inputs, digits, isSingleBox) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (isSingleBox && inputs.length === 1) {
        nativeInputValueSetter.call(inputs[0], digits.join(''));
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    } else if (!isSingleBox && inputs.length === 6 && digits.length === 6) {
        for (let i = 0; i < 6; i++) {
            nativeInputValueSetter.call(inputs[i], digits[i]);
            inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

setInterval(checkForOtpFields, 1000);

// ===== IVAC AUTOMATION (Auto-Clicking & Webfile Upload) =====
let lastClickTimes = {};

// Webfile upload state tracking
let currentWebfileIndex = 0;       // কোন নম্বর ফাইল আপলোড করতে হবে (0-based)
let isUploadInProgress = false;    // এখন আপলোড চলছে কি না
let captchaResolvedAt = 0;         // Captcha কখন resolve হয়েছে (timestamp)
let lastUploadAttemptAt = 0;       // শেষবার কখন আপলোডের চেষ্টা হয়েছে

function safeClick(element, key) {
    const now = Date.now();
    if (!lastClickTimes[key] || now - lastClickTimes[key] > 2000) {
        element.click();
        lastClickTimes[key] = now;
    }
}

function findButtonByText(text) {
    const elements = Array.from(document.querySelectorAll('button, a.btn, .btn'));
    return elements.find(el => el.textContent.toLowerCase().includes(text.toLowerCase()));
}

function isElementVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
}

// ===== Captcha Check =====
function isCaptchaResolved() {
    const cf = document.querySelector('[name="cf-turnstile-response"]');
    const rc = document.querySelector('[name="g-recaptcha-response"]');
    if (cf) return cf.value && cf.value.length > 10;
    if (rc) return rc.value && rc.value.length > 10;
    return true;
}

// ===== Page State Detection =====
function getPageUploadState() {
    const pageText = document.body.innerText.toLowerCase().replace(/\s+/g, ' ');
    
    const hasFileInput = document.querySelector('input[type="file"]') !== null;
    const isAskingPrimary = pageText.includes("upload primary applicant's webfile");
    const isAskingOther = pageText.includes("upload other applicant's webfile");
    const hasServerError = pageText.includes("internal server error") || pageText.includes("incident id");
    const hasCaptchaError = pageText.includes("captcha verification service is temporarily unavailable");
    const hasFileAlreadyExists = pageText.includes("file already");
    const isUploading = pageText.includes("uploading");
    
    return {
        hasFileInput,
        isAskingPrimary,
        isAskingOther,
        hasServerError,
        hasCaptchaError,
        hasFileAlreadyExists,
        isUploading
    };
}

// ===== Webfile Injection Helper =====
function injectWebfileToPage(base64Data, fileName) {
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) return false;

    try {
        const rawData = base64Data.split(',')[1];
        const byteCharacters = atob(rawData);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
            const slice = byteCharacters.slice(offset, offset + 1024);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, { type: 'application/pdf' });
        const file = new File([blob], fileName || "webfile.pdf", { type: 'application/pdf' });

        const dt = new DataTransfer();
        dt.items.add(file);

        // 1. Bypass React Native Setter
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files').set;
        if (setter) setter.call(fileInput, dt.files);
        
        // 2. Dispatch events
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        // 3. Dispatch drop event
        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
        });
        if (fileInput.parentElement) {
            fileInput.parentElement.dispatchEvent(dropEvent);
        }
        
        return true;
    } catch(e) {
        console.error("Webfile injection failed", e);
        return false;
    }
}

// ===== Listen for Manual Upload messages from popup =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'manual_upload_webfile') {
        // Manual mode এ captcha চেক
        if (!isCaptchaResolved()) {
            alert("দয়া করে আগে Cloudflare ভেরিফাই (Success!) হওয়া পর্যন্ত অপেক্ষা করুন!");
            sendResponse({ success: false });
            return;
        }
        const success = injectWebfileToPage(msg.fileData, msg.fileName);
        sendResponse({ success });
    }
});

// ===== Main Automation Loop =====
setInterval(() => {
    if (!isLicenseValid) return;
    try {
    chrome.storage.local.get(['ext_enabled'], (extRes) => {
        if (chrome.runtime.lastError) return;
        if (extRes.ext_enabled === false) return;

        // ১. OTP বসানোর পর "Verify OTP" তে ক্লিক করা
        const otpInputs = Array.from(document.querySelectorAll('input')).filter(inp =>
            inp.type !== 'hidden' && inp.style.display !== 'none' && (inp.maxLength === 1 || inp.getAttribute('pattern') === '[0-9]')
        );
    if (otpInputs.length === 6 && otpInputs.every(i => i.value !== '')) {
        const verifyBtn = findButtonByText("verify otp");
        if (verifyBtn && isElementVisible(verifyBtn) && !verifyBtn.disabled) {
            safeClick(verifyBtn, 'verifyOtp');
        }
    }

    // ২. পপআপগুলোর 'X' (cross) বাটনে ক্লিক করে কেটে দেওয়া
    const closeBtns = document.querySelectorAll('button.close, button.btn-close, .modal button[aria-label="Close"], button[aria-label="Close"]');
    closeBtns.forEach(btn => {
        if (isElementVisible(btn)) safeClick(btn, 'closeBtn');
    });
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => {
        if (btn.textContent.trim() === '×' && isElementVisible(btn)) {
            safeClick(btn, 'closeBtnText');
        }
    });

    // ৩. কমলা রঙের "Take Your Appointment" বাটনে ক্লিক করা
    const takeAppBtn = findButtonByText("take your appointment");
    if (takeAppBtn && isElementVisible(takeAppBtn)) {
        safeClick(takeAppBtn, 'takeApp');
    }

    // ৪. পপআপের "Next Step" বাটনে ক্লিক করা
    const nextStepBtn = findButtonByText("next step");
    if (nextStepBtn && isElementVisible(nextStepBtn)) {
        safeClick(nextStepBtn, 'nextStep');
    }

    // ===== ৫. Smart Webfile Auto-Upload System =====
    const state = getPageUploadState();
    
    // ফাইল আপলোড পেজে না থাকলে কিছু করার দরকার নেই
    if (!state.hasFileInput && !state.isAskingPrimary && !state.isAskingOther) return;
    
    // Uploading... চলছে, অপেক্ষা করো
    if (state.isUploading) return;

    // Captcha resolve হওয়ার সময় ট্র্যাক করা
    if (isCaptchaResolved()) {
        if (captchaResolvedAt === 0) {
            captchaResolvedAt = Date.now();
        }
    } else {
        // Captcha এখনো resolve হয়নি, রিসেট করো
        captchaResolvedAt = 0;
        return;
    }

    // Captcha resolve হওয়ার পর 0.3 সেকেন্ড অপেক্ষা করো
    const timeSinceCaptcha = Date.now() - captchaResolvedAt;
    if (timeSinceCaptcha < 300) return;

    // Check if webfile upload is enabled and mode is auto
    try {
    chrome.storage.local.get(['webfile_enabled', 'webfile_mode', 'saved_webfiles'], (res) => {
        const enabled = res.webfile_enabled !== undefined ? res.webfile_enabled : true;
        const mode = res.webfile_mode || 'auto';
        const files = res.saved_webfiles || [];

        // বন্ধ থাকলে বা Manual মোডে কিছু করবে না
        if (!enabled || mode !== 'auto') return;
        // কোনো ফাইল নেই
        if (files.length === 0) return;
        // ইতিমধ্যে আপলোড চলছে
        if (isUploadInProgress) return;

        // ===== কোন ফাইলটি আপলোড করতে হবে তা নির্ধারণ =====
        
        // Server error বা Captcha error দেখলে — captcha রিসেট, নতুন captcha-র জন্য অপেক্ষা
        if (state.hasServerError || state.hasCaptchaError) {
            captchaResolvedAt = 0;
            return;
        }

        // "file already exists" দেখলে — ফাইল আসলে আপলোড হয়ে গেছে, অপেক্ষা করো
        if (state.hasFileAlreadyExists) return;

        let fileToUpload = null;

        if (state.isAskingPrimary) {
            // Primary Applicant এর ফাইল চাইছে → ১ নং ফাইল (index 0)
            currentWebfileIndex = 0;
            fileToUpload = files[0];
        } else if (state.isAskingOther) {
            // Other Applicant এর ফাইল চাইছে → পরবর্তী ফাইল
            // Primary (index 0) ইতিমধ্যে হয়ে গেছে, তাই index 1 থেকে শুরু
            if (currentWebfileIndex < 1) {
                currentWebfileIndex = 1;
            }
            
            // যদি আর ফাইল না থাকে, থেমে যাও
            if (currentWebfileIndex >= files.length) return;
            
            fileToUpload = files[currentWebfileIndex];
        }

        if (!fileToUpload) return;

        // শেষ আপলোডের পর কমপক্ষে ৩ সেকেন্ড গ্যাপ রাখো
        const timeSinceLastAttempt = Date.now() - lastUploadAttemptAt;
        if (timeSinceLastAttempt < 3000) return;

        // আপলোড করো!
        isUploadInProgress = true;
        lastUploadAttemptAt = Date.now();
        
        const success = injectWebfileToPage(fileToUpload.data, fileToUpload.name);
        
        if (success) {
            console.log(`[IVAC] Webfile #${currentWebfileIndex + 1} (${fileToUpload.name}) আপলোড করা হয়েছে`);
            // আপলোড সফল হলে পরের ফাইলের জন্য প্রস্তুত হও
            // পেজ টেক্সট পরিবর্তন হলে (Primary → Other) তখন পরের ফাইল আপলোড হবে
            currentWebfileIndex++;
            captchaResolvedAt = 0; // নতুন captcha-র জন্য রিসেট
        }
        
        // ৫ সেকেন্ড পর আপলোড লক খুলে দাও
        setTimeout(() => {
            isUploadInProgress = false;
        }, 5000);
    }); // close webfile get
    } catch(e) {} // close webfile try

    }); // close ext_enabled get
    } catch (e) {} // close outer try
}, 1000); // close setInterval

// ===== DGEPAY PAYMENT PAGE AUTOMATION =====
// checkout.dgepay.net এ কাজ করবে
(function() {
    if (!window.location.hostname.includes('dgepay.net')) return;

    console.log('[IVAC] dgepay পেমেন্ট পেজ ডিটেক্ট হয়েছে!');

    let dgepayClickTimes = {};
    let paymentStepDone = {
        skipPhone: false,
        mobileBanking: false,
        rocketSelected: false,
        payClicked: false
    };

    function dgeSafeClick(element, key) {
        const now = Date.now();
        if (!dgepayClickTimes[key] || now - dgepayClickTimes[key] > 2500) {
            element.click();
            dgepayClickTimes[key] = now;
            console.log(`[IVAC] dgepay ক্লিক: ${key}`);
            return true;
        }
        return false;
    }

    // Main dgepay automation loop
    setInterval(() => {
        if (!isLicenseValid) return;
        try {
            // Check if extension is enabled
            chrome.storage.local.get(['ext_enabled', 'payment_enabled'], (res) => {
                if (chrome.runtime.lastError) return;
                if (res.ext_enabled === false) return;
                const paymentEnabled = res.payment_enabled !== undefined ? res.payment_enabled : true;
                if (!paymentEnabled) return;

                const pageText = document.body.innerText.toLowerCase();

                // ===== ধাপ ১: "Or continue without phone number" ক্লিক =====
                if (!paymentStepDone.skipPhone) {
                    // Find the link/button by text
                    const allLinks = Array.from(document.querySelectorAll('a, button, span, p, div'));
                    const skipLink = allLinks.find(el => {
                        const text = el.textContent.trim().toLowerCase();
                        return text.includes('continue without phone number') || 
                               text.includes('without phone');
                    });
                    
                    if (skipLink) {
                        // Only click if the popup is visible
                        const rect = skipLink.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            if (dgeSafeClick(skipLink, 'skipPhone')) {
                                paymentStepDone.skipPhone = true;
                                return; // এই ধাপ শেষ, পরের loop এ পরের ধাপ
                            }
                        }
                    }
                    
                    // If popup is gone (no "continue without phone" text), mark as done
                    if (!pageText.includes('continue without phone') && 
                        !pageText.includes('let\'s get you connected') &&
                        !pageText.includes('enter your phone number')) {
                        paymentStepDone.skipPhone = true;
                    }
                    return; // পপআপ থাকলে আর কিছু করবে না
                }

                // ===== ধাপ ২: "Mobile Banking" সিলেক্ট করা =====
                if (!paymentStepDone.mobileBanking) {
                    // Strategy 1: Find the radio input specifically for Mobile Banking
                    // Walk up multiple parent levels from each radio to find "Mobile Banking" text
                    const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
                    let mobileBankingRadio = null;
                    let mobileBankingContainer = null;

                    for (const radio of allRadios) {
                        let el = radio.parentElement;
                        // Walk up to 6 parent levels from the radio input
                        for (let level = 0; level < 6 && el; level++) {
                            const text = el.textContent.trim();
                            if (text.includes('Mobile Banking')) {
                                // CRITICAL: Reject if this container also has other payment methods
                                // That means we've accidentally matched a large parent container
                                if (text.includes('Bangla QR') || text.includes('Net Banking')) {
                                    // Don't match this level, keep walking up
                                    // (el = el.parentElement happens at end of loop)
                                } else {
                                    // Size check: must be a single payment row, not the whole form
                                    const rect = el.getBoundingClientRect();
                                    if (rect.height > 0 && rect.height < 200) {
                                        mobileBankingRadio = radio;
                                        mobileBankingContainer = el;
                                        break;
                                    }
                                }
                            }
                            el = el.parentElement;
                        }
                        if (mobileBankingRadio) break;
                    }

                    // Strategy 2: Find by text with strict size filtering
                    if (!mobileBankingRadio) {
                        const candidates = Array.from(document.querySelectorAll('div, label, li, span'));
                        for (const el of candidates) {
                            const ownText = el.textContent.trim();
                            if (!ownText.includes('Mobile Banking')) continue;
                            // Reject elements that also contain other payment method names
                            // which means we've matched a large parent container
                            if (ownText.includes('Bangla QR') || ownText.includes('Net Banking')) continue;
                            const rect = el.getBoundingClientRect();
                            // Must be a reasonably small clickable element, not the whole page
                            if (rect.height > 0 && rect.height < 150 && rect.width > 50) {
                                mobileBankingContainer = el;
                                mobileBankingRadio = el.querySelector('input[type="radio"]');
                                break;
                            }
                        }
                    }

                    if (mobileBankingContainer) {
                        // Check if already selected
                        const isSelected = (mobileBankingRadio && mobileBankingRadio.checked) ||
                                          mobileBankingContainer.classList.contains('active') ||
                                          mobileBankingContainer.classList.contains('selected') ||
                                          mobileBankingContainer.getAttribute('aria-checked') === 'true' ||
                                          window.getComputedStyle(mobileBankingContainer).borderColor.includes('rgb(255');
                        
                        if (isSelected) {
                            paymentStepDone.mobileBanking = true;
                            console.log('[IVAC] Mobile Banking ইতিমধ্যে সিলেক্ট করা আছে');
                        } else {
                            // Click the radio first, then the container
                            if (mobileBankingRadio) {
                                mobileBankingRadio.click();
                                console.log('[IVAC] Mobile Banking রেডিও ক্লিক করা হয়েছে');
                            }
                            // Also click the container for good measure
                            setTimeout(() => {
                                mobileBankingContainer.click();
                                console.log('[IVAC] Mobile Banking কন্টেইনার ক্লিক করা হয়েছে');
                            }, 200);
                            dgepayClickTimes['mobileBanking'] = Date.now();
                            // Don't mark done yet, wait for next loop to verify
                            return;
                        }
                    }

                    // Fallback: Check if Rocket/Nagad icons are already visible 
                    // (means Mobile Banking is already expanded/selected)
                    const subOptions = document.querySelectorAll('img[alt*="ocket"], img[alt*="agad"]');
                    if (subOptions.length > 0) {
                        paymentStepDone.mobileBanking = true;
                        console.log('[IVAC] Mobile Banking সাব-অপশন দেখা যাচ্ছে, সিলেক্ট হয়ে গেছে');
                    } else if (pageText.includes('rocket') && pageText.includes('nagad') && pageText.includes('cellfin')) {
                        paymentStepDone.mobileBanking = true;
                        console.log('[IVAC] Mobile Banking সিলেক্ট হয়ে গেছে (টেক্সট ফলব্যাক)');
                    }
                }

                // ===== ধাপ ৩: "Rocket" আইকন সিলেক্ট করা =====
                if (paymentStepDone.mobileBanking && !paymentStepDone.rocketSelected) {
                    // Find Rocket by text or image alt
                    const allClickable = Array.from(document.querySelectorAll('div, button, label, img, span, li'));
                    const rocketEl = allClickable.find(el => {
                        // Check for text "Rocket"
                        const text = el.textContent.trim();
                        if (text === 'Rocket' || text === 'রকেট') return true;
                        // Check for alt text on images
                        if (el.tagName === 'IMG' && (el.alt || '').toLowerCase().includes('rocket')) return true;
                        return false;
                    });

                    if (rocketEl) {
                        // Click on the Rocket element or its parent container
                        const clickTarget = rocketEl.closest('div[class]') || rocketEl.parentElement || rocketEl;
                        if (dgeSafeClick(clickTarget, 'rocket')) {
                            // Also try clicking the element itself
                            setTimeout(() => {
                                rocketEl.click();
                            }, 300);
                            paymentStepDone.rocketSelected = true;
                            return;
                        }
                    }
                }

                // ===== ধাপ ৪: "Pay" বাটনে ক্লিক =====
                if (paymentStepDone.rocketSelected && !paymentStepDone.payClicked) {
                    // Wait 1.5 seconds after Rocket selection before clicking Pay
                    const timeSinceRocket = Date.now() - (dgepayClickTimes['rocket'] || 0);
                    if (timeSinceRocket < 1500) return;

                    // Find Pay button - it contains "Pay" and a ৳ amount
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    const payBtn = buttons.find(btn => {
                        const text = btn.textContent.trim();
                        return (text.includes('Pay') && (text.includes('৳') || text.includes('BDT'))) &&
                               !btn.disabled;
                    });

                    if (payBtn) {
                        // Check button is not greyed out/loading
                        const style = window.getComputedStyle(payBtn);
                        if (style.opacity !== '0.5' && style.pointerEvents !== 'none') {
                            if (dgeSafeClick(payBtn, 'payBtn')) {
                                paymentStepDone.payClicked = true;
                                console.log('[IVAC] Pay বাটনে ক্লিক করা হয়েছে!');
                                
                                // NEW: Track Payment Initiated
                                try {
                                    const amountMatch = payBtn.textContent.match(/[\d,]+\.?\d*/);
                                    const amount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
                                    
                                    fetch('http://localhost:5000/api/payment', {
                                        method: 'POST',
                                        headers: {'Content-Type': 'application/json'},
                                        body: JSON.stringify({
                                            amount: amount,
                                            status: 'initiated',
                                            stage: 'pay_clicked',
                                            rocket_account: activeAccount.number,
                                            description: ''
                                        })
                                    }).then(r => r.json()).then(d => {
                                        if (d.payment_id) {
                                            chrome.storage.local.set({ current_payment_id: d.payment_id });
                                            console.log('[IVAC] Payment initiated recorded, ID:', d.payment_id);
                                        }
                                    }).catch(e => console.log('Payment init error:', e));
                                } catch(e) {}
                            }
                        }
                    }
                }

            });
        } catch(e) {
            // Extension context invalidated — silently ignore
        }
    }, 1200);

})();

// ===== DBBL NEXUS GATEWAY AUTOMATION =====
// ecom1.dutchbanglabank.com বা dutchbanglabank.com এ কাজ করবে
(function() {
    if (!window.location.hostname.includes('dutchbanglabank.com')) return;

    console.log('[IVAC] DBBL Nexus Gateway ডিটেক্ট হয়েছে!');

    let dbblStepDone = {
        accountFilled: false,
        pinFilled: false,
        submitted: false,
        otpFilled: false,
        goClicked: false
    };
    let dbblClickTimes = {};
    let rocketOtpPolling = null;

    function dbblSafeClick(element, key) {
        const now = Date.now();
        if (!dbblClickTimes[key] || now - dbblClickTimes[key] > 2500) {
            element.click();
            dbblClickTimes[key] = now;
            console.log(`[IVAC] DBBL ক্লিক: ${key}`);
            return true;
        }
        return false;
    }

    // DBBL automation loop
    setInterval(() => {
        if (!isLicenseValid) return;
        try {
            chrome.storage.local.get(['ext_enabled', 'rocket_accounts', 'active_rocket_id', 'payment_enabled'], (res) => {
                if (chrome.runtime.lastError) return;
                if (res.ext_enabled === false) return;
                const paymentEnabled = res.payment_enabled !== undefined ? res.payment_enabled : true;
                if (!paymentEnabled) return;

                const rocketAccounts = res.rocket_accounts || [];
                const activeId = res.active_rocket_id;
                const activeAccount = rocketAccounts.find(a => a.id === activeId);

                if (!activeAccount) return; // কোনো Rocket অ্যাকাউন্ট নেই

                const pageText = document.body.innerText.toLowerCase();

                // ===== পেজ ১: Mobile Account Information (Account + PIN + Submit) =====
                if (pageText.includes('mobile account information') || pageText.includes('mobile account')) {
                    
                    const allVisibleInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])'));
                    let accountInput = null;
                    let pinInput = null;

                    // ১. Name/ID দিয়ে খোঁজার চেষ্টা
                    allVisibleInputs.forEach(inp => {
                        const name = (inp.name || '').toLowerCase();
                        const id = (inp.id || '').toLowerCase();
                        if (name.includes('account') || name.includes('mobile') || name.includes('msisdn') || id.includes('msisdn')) {
                            accountInput = inp;
                        }
                        if (name.includes('pin') || id.includes('pin') || inp.type === 'password') {
                            pinInput = inp;
                        }
                    });

                    // ২. যদি না পায়, তাহলে আশেপাশের টেক্সট (Label) দিয়ে খোঁজার চেষ্টা
                    if (!accountInput || !pinInput) {
                        for (const inp of allVisibleInputs) {
                            const parentText = (inp.parentElement.innerText || inp.parentElement.parentElement.innerText || '').toLowerCase();
                            if (!accountInput && (parentText.includes('account') || parentText.includes('mobile'))) {
                                accountInput = inp;
                            } else if (!pinInput && parentText.includes('pin')) {
                                pinInput = inp;
                            }
                        }
                    }

                    // ৩. যদি এখনও না পায়, প্রথম ২টা ইনপুট ধরে নাও
                    if (!accountInput && allVisibleInputs.length >= 1) {
                        accountInput = allVisibleInputs[0];
                    }
                    if (!pinInput && allVisibleInputs.length >= 2) {
                        const possiblePin = allVisibleInputs.find(i => i !== accountInput && i.type === 'password');
                        pinInput = possiblePin || allVisibleInputs.find(i => i !== accountInput);
                    }

                    // নিশ্চিত করো যে দুটো একই ফিল্ড নয়
                    if (accountInput && pinInput && accountInput === pinInput) {
                        pinInput = null; 
                    }

                    // Account ফিল করো
                    if (accountInput && !dbblStepDone.accountFilled) {
                        accountInput.value = activeAccount.number;
                        accountInput.dispatchEvent(new Event('input', { bubbles: true }));
                        accountInput.dispatchEvent(new Event('change', { bubbles: true }));
                        dbblStepDone.accountFilled = true;
                        console.log(`[IVAC] Rocket Account বসানো হয়েছে: ${activeAccount.number}`);
                    }

                    // PIN ফিল করো
                    if (pinInput && !dbblStepDone.pinFilled) {
                        pinInput.value = activeAccount.pin;
                        pinInput.dispatchEvent(new Event('input', { bubbles: true }));
                        pinInput.dispatchEvent(new Event('change', { bubbles: true }));
                        dbblStepDone.pinFilled = true;
                        console.log('[IVAC] Rocket PIN বসানো হয়েছে');
                    }

                    // Account + PIN দুটোই ফিল হলে SUBMIT ক্লিক করো
                    if (dbblStepDone.accountFilled && dbblStepDone.pinFilled && !dbblStepDone.submitted) {
                        // ১ সেকেন্ড অপেক্ষা করো
                        const timeSincePin = Date.now() - (dbblClickTimes['pinFilled'] || 0);
                        if (!dbblClickTimes['pinFilled']) {
                            dbblClickTimes['pinFilled'] = Date.now();
                            return;
                        }
                        if (timeSincePin < 1000) return;

                        // SUBMIT বাটন খুঁজো
                        const submitBtn = Array.from(document.querySelectorAll('input[type="submit"], button, input[type="image"], a, #pay')).find(el => {
                            if (el.id === 'pay' || (el.className && typeof el.className === 'string' && el.className.includes('subBtn'))) return true;
                            if (el.type === 'submit') return true;
                            
                            const val = (el.value || el.textContent || el.alt || el.name || el.id || el.src || '').toLowerCase();
                            return val.includes('submit') || val === 'pay';
                        });
                        
                        if (submitBtn) {
                            if (dbblSafeClick(submitBtn, 'submit')) {
                                dbblStepDone.submitted = true;
                                console.log('[IVAC] SUBMIT ক্লিক করা হয়েছে!');
                                
                                // NEW: Track Stage Update
                                chrome.storage.local.get(['current_payment_id'], (res) => {
                                    if (res.current_payment_id) {
                                        fetch('http://localhost:5000/api/payment/update', {
                                            method: 'POST',
                                            headers: {'Content-Type': 'application/json'},
                                            body: JSON.stringify({
                                                payment_id: res.current_payment_id,
                                                stage: 'account_filled'
                                            })
                                        }).catch(e => console.log('Payment update error:', e));
                                    }
                                });
                            }
                        }
                    }
                }

                // ===== পেজ ২: OTP (One Time Password) =====
                if (pageText.includes('otp') && pageText.includes('one time password')) {
                    const otpInput = document.querySelector('input[type="text"], input[type="tel"], input[type="number"], input:not([type="submit"]):not([type="image"]):not([type="hidden"])');
                    
                    if (otpInput && !dbblStepDone.otpFilled) {
                        // Rocket নম্বর থেকে ১১ ডিজিট ফোন নম্বর বের করো (শেষের ডিজিট বাদ)
                        const rocketPhone = activeAccount.number.substring(0, 11);
                        
                        // OTP ফেচ করো (শুধুমাত্র যদি নিজে থেকে বসানো না হয়ে থাকে)
                        if (!rocketOtpPolling && otpInput.value.length < 4) {
                            rocketOtpPolling = setInterval(async () => {
                                if (!isLicenseValid) return;
                                // শুধুমাত্র active (foreground) ট্যাবে কাজ করবে
                                if (document.visibilityState !== 'visible') return;
                                
                                const res = await new Promise(r => chrome.storage.local.get(['rocket_accounts', 'active_rocket_id'], r));
                                const currentRocketPhone = getActiveRocketPhone(res.rocket_accounts, res.active_rocket_id);
                                if (!currentRocketPhone) return;

                                try {
                                    // claimAndFetchOtp — atomic: শুধু একটি ট্যাবই এই OTP পাবে
                                    const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'claimAndFetchOtp', phone: currentRocketPhone }, r));
                                    if (d && d.success && d.data && !d.data.used) {
                                        // React-safe OTP fill
                                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                        nativeInputValueSetter.call(otpInput, d.data.otp_string);
                                        otpInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        otpInput.dispatchEvent(new Event('change', { bubbles: true }));
                                        
                                        dbblStepDone.otpFilled = true;
                                        console.log(`[IVAC] Rocket OTP বসানো হয়েছে: ${d.data.otp_string}`);
                                        
                                        // OTP used মার্ক করো
                                        chrome.runtime.sendMessage({ action: 'markUsed', phone: currentRocketPhone });
                                    }
                                } catch(e) {}
                            }, 1000);
                        }
                    }

                    // Go বাটনে অটো ক্লিক (যদি OTP বক্সে ৪ বা তার বেশি ডিজিট থাকে - ম্যানুয়াল বা অটো যাই হোক)
                    if (otpInput && otpInput.value.length >= 4 && !dbblStepDone.goClicked) {
                        dbblStepDone.goClicked = true; // একবারই ক্লিক করবে
                        
                        if (rocketOtpPolling) {
                            clearInterval(rocketOtpPolling);
                            rocketOtpPolling = null;
                        }
                        
                        setTimeout(() => {
                            const goBtn = Array.from(document.querySelectorAll('input, button, a')).find(el => {
                                const type = (el.type || '').toLowerCase();
                                if (type === 'hidden' || el.style.display === 'none') return false;
                                
                                const src = (el.src || '').toLowerCase();
                                const alt = (el.alt || '').toLowerCase();
                                const val = (el.value || el.textContent || '').toLowerCase();
                                
                                return src.includes('btn_go') || src.includes('go.gif') || alt.includes('otp') || val === 'go' || val.includes('verify');
                            });
                            if (goBtn) {
                                if (dbblSafeClick(goBtn, 'goBtn')) {
                                    console.log('[IVAC] Go (OTP) বাটনে ক্লিক করা হয়েছে!');
                                    
                                    // Track final success
                                    chrome.storage.local.get(['current_payment_id'], (res) => {
                                        if (res.current_payment_id) {
                                            fetch('http://localhost:5000/api/payment/update', {
                                                method: 'POST',
                                                headers: {'Content-Type': 'application/json'},
                                                body: JSON.stringify({
                                                    payment_id: res.current_payment_id,
                                                    stage: 'otp_submitted',
                                                    status: 'success'
                                                })
                                            }).then(() => {
                                                // Clear current_payment_id after success
                                                chrome.storage.local.remove(['current_payment_id']);
                                            }).catch(e => console.log('Payment update error:', e));
                                        } else {
                                            // Fallback for old sessions that didn't initiate properly
                                            try {
                                                let extractedAmount = 0;
                                                const pageTextMatch = document.body.innerText.match(/Amount\s+([\d,]+\.?\d*)/i);
                                                if (pageTextMatch) {
                                                    extractedAmount = parseFloat(pageTextMatch[1].replace(/,/g, ''));
                                                }
                                                
                                                fetch('http://localhost:5000/api/payment-success', { 
                                                    method: 'POST',
                                                    headers: {'Content-Type': 'application/json'},
                                                    body: JSON.stringify({
                                                        amount: extractedAmount,
                                                        rocket_account: activeAccount ? activeAccount.number : "Unknown"
                                                    })
                                                }).catch(()=>console.log('Payment track error')); 
                                            } catch(e){}
                                        }
                                    });
                                }
                            } else {
                                console.log('[IVAC] Go বাটন খুঁজে পাওয়া যায়নি।');
                            }
                        }, 500); // আধা সেকেন্ড পর ক্লিক
                    }
                }
            });
        } catch(e) {
            // Extension context invalidated — silently ignore
        }
    }, 1200);

})();
