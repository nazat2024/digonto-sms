
// ===== PAYMENT METHOD DETECTOR & INTERACTION TRACKER =====
function detectPaymentMethodOnPage() {
    try {
        const lastClicked = sessionStorage.getItem('last_selected_pay_method');
        
        // 1. Radio buttons
        const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
        for (const radio of allRadios) {
            if (radio.checked) {
                let el = radio.parentElement;
                for (let i = 0; i < 5 && el; i++) {
                    const text = el.textContent || '';
                    if (text.includes('Bangla QR')) return 'bangla_qr';
                    if (text.includes('Net Banking')) return 'net_banking';
                    if (text.includes('Card') && !text.includes('Mobile')) return 'card';
                    el = el.parentElement;
                }
            }
        }

        // 2. Bangla QR card / container
        const allDivs = Array.from(document.querySelectorAll('div, label, li, a, button'));
        for (const el of allDivs) {
            const text = (el.textContent || '').trim();
            if (text.startsWith('Bangla QR') || text.includes('scan the Bangla QR') || text.includes('scan the QR')) {
                const isSelected = el.querySelector('input[type="radio"]:checked') ||
                                   el.classList.contains('active') ||
                                   el.classList.contains('selected') ||
                                   el.getAttribute('aria-checked') === 'true';
                if (isSelected) return 'bangla_qr';
            }
        }

        // 3. Sub-options (bKash, Rocket, Nagad, CellFin, TAP)
        for (const el of allDivs) {
            const hasActiveClass = el.classList.contains('active') || el.classList.contains('selected') || el.classList.contains('checked');
            const style = window.getComputedStyle(el);
            const hasActiveBorder = style.borderColor && (style.borderColor.includes('rgb(255') || style.borderColor.includes('rgb(239') || style.borderColor.includes('rgb(16, 185, 129)'));
            if (hasActiveClass || hasActiveBorder) {
                const t = (el.textContent || '').toLowerCase();
                const img = el.querySelector('img');
                const alt = (img && img.alt ? img.alt : '').toLowerCase();
                if (t.includes('bkash') || alt.includes('bkash')) return 'bkash';
                if (t.includes('rocket') || alt.includes('rocket')) return 'rocket';
                if (t.includes('nagad') || alt.includes('nagad')) return 'nagad';
                if (t.includes('cellfin') || alt.includes('cellfin')) return 'cellfin';
                if (t.includes('tap') || alt.includes('tap')) return 'tap';
            }
        }

        if (lastClicked) return lastClicked;
    } catch(e) {}
    return '';
}

if (!window._dgPayMethodClickAttached) {
    window._dgPayMethodClickAttached = true;
    document.addEventListener('click', (e) => {
        try {
            let el = e.target;
            for (let i = 0; i < 4 && el; i++) {
                const text = (el.textContent || '').trim();
                const img = el.querySelector ? el.querySelector('img') : null;
                const alt = (img && img.alt ? img.alt : (el.alt || '')).toLowerCase();
                
                if (text.includes('Bangla QR') || alt.includes('bangla') || alt.includes('qr')) {
                    sessionStorage.setItem('last_selected_pay_method', 'bangla_qr');
                    break;
                } else if (text.includes('bKash') || alt.includes('bkash')) {
                    sessionStorage.setItem('last_selected_pay_method', 'bkash');
                    break;
                } else if (text.includes('Rocket') || alt.includes('rocket')) {
                    sessionStorage.setItem('last_selected_pay_method', 'rocket');
                    break;
                } else if (text.includes('Nagad') || alt.includes('nagad')) {
                    sessionStorage.setItem('last_selected_pay_method', 'nagad');
                    break;
                } else if (text.includes('CellFin') || alt.includes('cellfin')) {
                    sessionStorage.setItem('last_selected_pay_method', 'cellfin');
                    break;
                } else if (text.includes('TAP') || alt.includes('tap')) {
                    sessionStorage.setItem('last_selected_pay_method', 'tap');
                    break;
                } else if (text.includes('Net Banking')) {
                    sessionStorage.setItem('last_selected_pay_method', 'net_banking');
                    break;
                } else if (text.includes('Card') && !text.includes('Mobile')) {
                    sessionStorage.setItem('last_selected_pay_method', 'card');
                    break;
                }
                el = el.parentElement;
            }
        } catch(err) {}
    }, true);
}

// Anti-Tampering & Anti-DevTools Protection
(function _secShield() {
    function _guard() {
        const start = Date.now();
        debugger;
        if (Date.now() - start > 100) {
            window.location.reload();
        }
    }
    setInterval(_guard, 3000);
})();


// ===== PROFILE IDENTITY & REAL-TIME ACTIVITY TRACKER =====
let currentProfileId = 'prof_default';
let currentProfileLabel = 'Profile';

function initProfileIdentity() {
    try {
        chrome.storage.local.get(['profile_id', 'profile_label', 'ivac_phone', 'ext_enabled'], (st) => {
            if (!st.profile_id) {
                const randomPart = Math.random().toString(36).substring(2, 8);
                currentProfileId = 'prof_' + randomPart;
                chrome.storage.local.set({ profile_id: currentProfileId });
            } else {
                currentProfileId = st.profile_id;
            }
            
            if (st.ivac_phone && st.ivac_phone.length >= 10) {
                currentProfileLabel = `Profile (${st.ivac_phone})`;
                chrome.storage.local.set({ profile_label: currentProfileLabel });
            } else if (st.profile_label && st.profile_label.includes('(')) {
                currentProfileLabel = st.profile_label;
            } else {
                currentProfileLabel = `Profile #${currentProfileId.slice(-4)}`;
            }
            
            // Session state emission
            const sessKey = 'ext_session_logged_' + currentProfileId;
            if (!sessionStorage.getItem(sessKey)) {
                sessionStorage.setItem(sessKey, 'true');
                if (st.ext_enabled !== false) {
                    emitActivity('ext_enabled', 'Extension সক্রিয় (Active)', 'ব্রাউজার প্রোফাইল ও এক্সটেনশন চালু আছে', 0, 'success');
                } else {
                    emitActivity('ext_disabled', 'Extension বন্ধ (Off)', 'গ্রাহক এই প্রোফাইলে এক্সটেনশন অফ রেখেছেন', 0, 'warning');
                }
            }
        });
    } catch(e) {}
}
initProfileIdentity();

function sendRecordPayment(paymentData, callback) {
    const amt1 = (paymentData && paymentData.amount_1) || parseFloat(sessionStorage.getItem('sess_amount_1')) || 0;
    const amt2 = (paymentData && paymentData.amount_2) || parseFloat(sessionStorage.getItem('sess_amount_2')) || 0;
    const amt3 = (paymentData && (paymentData.amount_3 || paymentData.amount)) || 0;
    
    const payload = {
        profile_id: currentProfileId,
        profile_label: currentProfileLabel,
        amount_1: amt1,
        amount_2: amt2,
        amount_3: amt3,
        ...(paymentData || {})
    };
    chrome.runtime.sendMessage({
        action: 'recordPayment',
        data: payload
    }, callback);
}


function updateProfileLabel(phone) {
    if (phone && phone.length >= 10) {
        currentProfileLabel = `Profile (${phone})`;
        try {
            chrome.storage.local.set({ profile_label: currentProfileLabel, ivac_phone: phone });
        } catch(e) {}
    }
}

function emitActivity(eventType, title, details = '', amount = 0, status = 'info', metadata = {}) {
    try {
        chrome.storage.local.get(['profile_id', 'profile_label', 'ivac_phone'], (st) => {
            const profileId = currentProfileId || st.profile_id || 'prof_default';
            const phone = st.ivac_phone || '';
            const profileLabel = (phone ? `Profile (${phone})` : (st.profile_label || currentProfileLabel || `Profile #${profileId.slice(-4)}`));
            
            chrome.runtime.sendMessage({
                action: 'trackActivity',
                data: {
                    event_type: eventType,
                    profile_id: profileId,
                    profile_label: profileLabel,
                    title: title,
                    details: details,
                    amount: amount,
                    status: status,
                    metadata: { ...metadata, phone: phone }
                }
            });
        });
    } catch(e) {}
}

// Storage onChanged listener moved to background.js for single-dispatch deduplication

// ===== PAGE DETECTION & ACTIVITY HOOKS LOOP =====
setInterval(() => {
    try {
        const url = window.location.href.toLowerCase();
        const text = (document.body ? document.body.innerText : '').toLowerCase();

        // 1. Phone number detection on Login page
        if (url.includes('signin') || text.includes('sign in') || text.includes('your contact number')) {
            const phoneInput = document.querySelector('input[type="tel"], input[placeholder*="contact"], input[placeholder*="01"]');
            if (phoneInput && phoneInput.value && phoneInput.value.length >= 11) {
                updateProfileLabel(phoneInput.value.trim());
            }
        }

        // 2. Login success detection
        if (!url.includes('signin') && !url.includes('verify') && (url.includes('dashboard') || url.includes('appointment') || text.includes('logout') || text.includes('take your appointment'))) {
            if (!sessionStorage.getItem('login_success_logged')) {
                sessionStorage.setItem('login_success_logged', 'true');
                emitActivity('login_success', 'IVAC লগইন সফল!', 'সফলভাবে লগইন করা হয়েছে', 0, 'success');
            }
        }

        // 3. Confirm All Information is Correct (Image 4)
        const confirmBtn = Array.from(document.querySelectorAll('button, a')).find(el => (el.textContent || '').toLowerCase().includes('confirm all information is correct'));
        if (confirmBtn && !confirmBtn.dataset.trackedConfirm) {
            confirmBtn.dataset.trackedConfirm = 'true';
            confirmBtn.addEventListener('click', () => {
                const totalMatch = document.body.innerText.match(/total number of applicants:\s*(\d+)/i);
                const count = totalMatch ? totalMatch[1] : 'All';
                emitActivity('confirm_clicked', 'Confirm Information ক্লিক করা হয়েছে', `মোট ${count} জন আবেদনকারীর তথ্য নিশ্চিত করা হয়েছে`, 0, 'success');
            });
        }

        // 4. Continue Payment Page (Image 2)
        if (url.includes('continue-payment') || text.includes('pay with dgepay') || text.includes('continue payment')) {
            if (!sessionStorage.getItem('continue_payment_page_logged')) {
                const amtMatch = document.body.innerText.match(/(?:Total Amount|Amount)[:\s]*BDT\s*([\d,]+\.?\d*)/i) || document.body.innerText.match(/BDT\s*([\d,]+\.?\d*)/i);
                const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 0;
                if (amount >= 0) {
                    sessionStorage.setItem('continue_payment_page_logged', 'true');
                    chrome.storage.local.set({ last_tracked_amount: amount });
                    emitActivity('continue_payment_page', 'Continue Payment পেজ (টাকার পরিমাণ)', `Total Amount: ৳ ${amount.toLocaleString()}`, amount, 'info');
                }
            }

            const contPayBtn = Array.from(document.querySelectorAll('button, a')).find(el => (el.textContent || '').toLowerCase().includes('continue payment'));
            if (contPayBtn && !contPayBtn.dataset.trackedContPay) {
                contPayBtn.dataset.trackedContPay = 'true';
                contPayBtn.addEventListener('click', () => {
                    const amtMatch = document.body.innerText.match(/BDT\s*([\d,]+\.?\d*)/i);
                    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 0;
                    emitActivity('continue_payment_click', 'Continue Payment বাটনে ক্লিক', `DGePay গেটওয়েতে পাঠানো হচ্ছে (৳ ${amount.toLocaleString()})`, amount, 'info');
                });
            }
        }

        // 5. DGePay Payment Gateway Selection & Pay Button (Image 3 - Amount 2)
        if (window.location.hostname.includes('dgepay.net')) {
            // Continuously scan for Amount 2 from Pay button or page text
            const payBtns = Array.from(document.querySelectorAll('button, a, div')).filter(b => (b.textContent || '').includes('Pay') && (b.textContent || '').match(/[\d,]+\.?\d*/));
            if (payBtns.length > 0) {
                const match = payBtns[0].textContent.match(/[\d,]+\.?\d*/);
                if (match) {
                    const amt2 = parseFloat(match[0].replace(/,/g, ''));
                    if (amt2 > 0) {
                        sessionStorage.setItem('sess_amount_2', String(amt2));
                    }
                }
            }
            // Track methods (Bangla QR, Card, Mobile Banking, etc.)
            const methodElements = Array.from(document.querySelectorAll('label, div, span')).filter(el => {
                const t = (el.textContent || '').trim().toLowerCase();
                return t === 'bangla qr' || t === 'net banking' || t === 'card' || t.includes('mobile banking');
            });
            methodElements.forEach(el => {
                if (!el.dataset.trackedDgeMethod) {
                    el.dataset.trackedDgeMethod = 'true';
                    el.addEventListener('click', () => {
                        const method = el.textContent.trim();
                        const payBtn = Array.from(document.querySelectorAll('button, a')).find(b => (b.textContent || '').includes('Pay'));
                        const amtMatch = payBtn ? payBtn.textContent.match(/[\d,]+\.?\d*/) : null;
                        const amount = amtMatch ? parseFloat(amtMatch[0].replace(/,/g, '')) : 0;
                        emitActivity('gateway_selected', 'Payment Method নির্বাচন', `Method: ${method} (৳ ${amount.toLocaleString()})`, amount, 'info');
                    });
                }
            });
        }

        // 6. Payment Successful Screen Detection (Image 5)
        if (text.includes('payment successful') || text.includes('payment success')) {
            if (!sessionStorage.getItem('payment_success_activity_logged')) {
                sessionStorage.setItem('payment_success_activity_logged', 'true');
                const trxMatch = document.body.innerText.match(/Transaction ID:?\s*([A-Za-z0-9_-]+)/i);
                const trxId = trxMatch ? trxMatch[1] : 'Completed';
                const timeMatch = (document.body ? document.body.innerText : "").match(/\d{1,2}:\d{2}\s*(?:AM|PM)[^,\r\n]*/i);
                const timeStr = timeMatch ? timeMatch[0] : '';

                chrome.storage.local.get(['current_payment_id', 'last_tracked_amount'], (st) => {
                    const amount = st.last_tracked_amount || 0;
                    emitActivity('payment_success', '🎉 Payment Successful!', `পেমেন্ট সম্পন্ন হয়েছে! TrxID: ${trxId}${timeStr ? ' (' + timeStr + ')' : ''}`, amount, 'success', {
                        trx_id: trxId,
                        time: timeStr
                    });

                    if (st.current_payment_id) {
                        chrome.runtime.sendMessage({
                            action: 'updatePayment',
                            data: {
                                payment_id: st.current_payment_id,
                                stage: 'payment_success',
                                status: 'success'
                            }
                        });
                    }
                });
            }
        }
    } catch(e) {}
}, 1500);

﻿
// ===== UNIVERSAL AUTO COPY, PASTE, CUT & RIGHT-CLICK ENABLER =====
(function enableUniversalCopyPaste() {
    // 1. Force CSS user-select across entire page
    function injectCopyStyles() {
        if (document.getElementById('digonto-copy-enable-style')) return;
        const style = document.createElement('style');
        style.id = 'digonto-copy-enable-style';
        style.textContent = `
            html, body, div, span, applet, object, iframe,
            h1, h2, h3, h4, h5, h6, p, blockquote, pre,
            a, abbr, acronym, address, big, cite, code,
            del, dfn, em, img, ins, kbd, q, s, samp,
            small, strike, strong, sub, sup, tt, var,
            b, u, i, center, dl, dt, dd, ol, ul, li,
            fieldset, form, label, legend, table, caption,
            tbody, tfoot, thead, tr, th, td, article, aside,
            canvas, details, embed, figure, figcaption, footer,
            header, hgroup, menu, nav, output, ruby, section,
            summary, time, mark, audio, video, input, textarea {
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
                user-select: text !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }
    
    injectCopyStyles();
    document.addEventListener('DOMContentLoaded', injectCopyStyles);

    // 2. Capture Phase Event Interceptor (Stops site blockers before they run)
    const bypassEvents = ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'];
    bypassEvents.forEach(evtName => {
        window.addEventListener(evtName, (e) => {
            e.stopImmediatePropagation();
        }, true);
        document.addEventListener(evtName, (e) => {
            e.stopImmediatePropagation();
        }, true);
    });

    // 3. Bypass keyboard copy/paste blocking (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+Insert, Shift+Insert)
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            const k = (e.key || '').toLowerCase();
            if (['c', 'v', 'x', 'a', 'insert'].includes(k)) {
                e.stopImmediatePropagation();
            }
        }
    }, true);

    // 4. Remove inline blocking attributes
    function cleanBlockingAttributes() {
        const elements = document.querySelectorAll('*[oncopy], *[onpaste], *[oncut], *[oncontextmenu], *[onselectstart], *[ondragstart], *[unselectable]');
        elements.forEach(el => {
            el.removeAttribute('oncopy');
            el.removeAttribute('onpaste');
            el.removeAttribute('oncut');
            el.removeAttribute('oncontextmenu');
            el.removeAttribute('onselectstart');
            el.removeAttribute('ondragstart');
            el.removeAttribute('unselectable');
        });
    }

    cleanBlockingAttributes();
    setInterval(cleanBlockingAttributes, 2000);
})();

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
let isLicenseValid = false;
let currentLicenseErrorMsg = null;
let shadowDomRoot = null;

function checkLicenseAndSyncConfig() {
    if (!chrome.runtime || !chrome.runtime.sendMessage) return;
    try {
        chrome.runtime.sendMessage({ action: 'checkLicenseStatus' }, (data) => {
            if (chrome.runtime.lastError || !data || data.active !== true) {
                isLicenseValid = false;
            } else {
                isLicenseValid = true;
            }
        });
        
        if (isLicenseValid) {
            chrome.runtime.sendMessage({ action: 'fetchConfig' }, (cfgData) => {
                if (chrome.runtime.lastError || !cfgData) return;
                if (cfgData.rocket_accounts && cfgData.rocket_accounts.length > 0) {
                    chrome.storage.local.set({ rocket_accounts: cfgData.rocket_accounts });
                }
            });
        }
    } catch(e) {}
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
    ensurePinWidgetAttached();
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

// Auto-Switch Profile (Disabled - preserves per Chrome Profile manual account selection)
function autoSwitchProfile(gateway) {
    // Keep user selected active_rocket_id intact for this Chrome profile
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
    
    // STRICT GUARD: Only run on the actual signin / login page!
    // NEVER run on verify, otp, payment, appointment, or application pages!
    if (url.includes('verify') || url.includes('otp') || url.includes('payment') || url.includes('checkout')) return;
    if (!url.includes('/signin') && !url.includes('/login')) return;

    chrome.storage.local.get(['ivac_phone', 'ivac_password', 'ext_enabled'], (st) => {
        if (st.ext_enabled === false) return;
        
        let phone = (st.ivac_phone || '').trim();
        let pass = (st.ivac_password || '').trim();

        if (!phone && !pass) return;

        // 1. Find and fill Contact Number input ONLY if 11 digits present
        if (phone && phone.length >= 11) {
            const inputs = Array.from(document.querySelectorAll('input'));
            const phoneInputs = inputs.filter(inp => {
                const type = (inp.type || 'text').toLowerCase();
                const name = (inp.name || '').toLowerCase();
                const id = (inp.id || '').toLowerCase();
                const ph = (inp.placeholder || '').toLowerCase();
                if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio' || inp.maxLength === 1) return false;
                return ph.includes('01') || ph.includes('contact') || ph.includes('phone') || ph.includes('mobile') ||
                       name.includes('phone') || name.includes('mobile') || name.includes('contact') ||
                       id.includes('phone') || id.includes('mobile') || id.includes('contact') ||
                       type === 'tel';
            });
            
            const phoneInput = phoneInputs[0] || null;
            if (phoneInput) {
                const cleanVal = (phoneInput.value || '').replace(/[^0-9]/g, '');
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                if (cleanVal !== cleanPhone) {
                    setNativeInputValue(phoneInput, phone);
                }
            }
        }

        // 2. Find and fill Password input ONLY if password present
        if (pass && pass.length > 0) {
            const passInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => i.maxLength !== 1);
            const passInput = passInputs[0] || null;
            if (passInput && passInput.value !== pass) {
                setNativeInputValue(passInput, pass);
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

function ensurePinWidgetAttached() {
    if (window.self !== window.top) return;
    if (window.location.protocol === 'chrome-extension:' || window.location.protocol === 'chrome:') return;
    
    const root = document.documentElement;
    if (!root) return;

    const existing = document.getElementById('ivac-pin-widget-root');
    if (!existing || !document.contains(existing)) {
        if (pinWidgetEl && shadowDomRoot) {
            pinWidgetEl.style.display = 'block';
            root.appendChild(pinWidgetEl);
        } else {
            createPinWidget();
        }
    } else {
        if (existing.style.display === 'none') {
            existing.style.display = 'block';
        }
    }
}

function createPinWidget() {
    if (window.self !== window.top) return; // Never inject widget into iframes (e.g. Captcha)
    if (document.getElementById('ivac-pin-widget-root') && document.contains(document.getElementById('ivac-pin-widget-root'))) return;
    if (window.location.protocol === 'chrome-extension:' || window.location.protocol === 'chrome:') return;

    const root = document.documentElement;
    if (!root) {
        window.addEventListener('DOMContentLoaded', createPinWidget, { once: true });
        return;
    }

    if (!pinWidgetEl) {
        pinWidgetEl = document.createElement('div');
        pinWidgetEl.id = 'ivac-pin-widget-root';
        pinWidgetEl.style.cssText = 'all: initial !important; display: block !important; position: fixed !important; z-index: 2147483647 !important; top: 0; left: 0; width: 0; height: 0;';
        const shadow = pinWidgetEl.attachShadow({ mode: 'open' });
        shadowDomRoot = shadow;
    }

    const shadow = shadowDomRoot;

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
            
            .otp-tag-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2px;
            }
            .status-badge {
                font-size: 8px;
                font-weight: 700;
                padding: 1px 4px;
                border-radius: 3px;
            }
            .badge-unused {
                background: #dcfce7;
                color: #15803d;
                border: 1px solid #86efac;
            }
            .badge-used {
                background: #f1f5f9;
                color: #64748b;
                border: 1px solid #cbd5e1;
            }
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
                    <span id="pin-icon">📋</span>
                    <span id="pin-title">IVAC OTP</span>
                    <span id="pin-device-badge" style="display:none; font-size:9px; background:rgba(255,255,255,0.22); padding:1px 4px; border-radius:3px; margin-left:4px; font-weight:700; letter-spacing:0.3px;" title="সংযুক্ত মোবাইল / মোট মোবাইল">📱 0/0</span>
                </div>
                <button class="hdr-btn" id="min-btn">−</button>
            </div>
            <div id="pin-body">
                <div id="otp-display">
                    <span class="c-gray" style="font-size:10px;">অপেক্ষায় আছে...</span>
                </div>
                <!-- Live 20-Second Slot Rotation & Countdown Panel -->
                <div id="slot-timer-panel" style="display: none; margin-top: 6px; padding: 6px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                        <span id="slot-panel-title" style="font-size: 9px; font-weight: 800; color: #047857; text-transform: uppercase;">📅 স্লট রোটেশন</span>
                        <span id="slot-attempt-badge" style="font-size: 8px; font-weight: 700; background: #059669; color: #fff; padding: 1px 4px; border-radius: 3px;">চেষ্টা #1</span>
                    </div>
                    <div id="slot-status-msg" style="font-size: 10px; font-weight: 700; color: #0f172a; margin-bottom: 3px; line-height: 1.2;">🔄 স্লট চেক করা হচ্ছে...</div>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px;">
                        <span style="font-size: 9px; color: #64748b; font-weight: 600;">কাউন্টডাউন:</span>
                        <span id="slot-live-timer" style="font-size: 13px; font-weight: 800; color: #d97706; font-family: monospace;">20s</span>
                    </div>
                    <div style="width: 100%; height: 3px; background: #e2e8f0; border-radius: 2px; margin-top: 4px; overflow: hidden;">
                        <div id="slot-progress-bar" style="width: 100%; height: 100%; background: #059669; transition: width 0.3s linear;"></div>
                    </div>
                </div>




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
        minBtn.textContent = widgetMinimized ? '+' : '-';
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
    
    // Check elements
    const pinHeader = shadowDomRoot ? shadowDomRoot.getElementById('pin-header') : null;
    const pinBoxEl = shadowDomRoot ? shadowDomRoot.getElementById('pin-box') : null;
    const pinTitle = shadowDomRoot ? shadowDomRoot.getElementById('pin-title') : null;
    const pinIcon = shadowDomRoot ? shadowDomRoot.getElementById('pin-icon') : null;

    if (currentLicenseErrorMsg) {
        if (pinHeader) pinHeader.style.background = '#ef4444';
        if (pinBoxEl) pinBoxEl.style.borderColor = '#ef4444';
        if (pinTitle) pinTitle.textContent = "লাইসেন্স শেষ";
        if (pinIcon) pinIcon.textContent = "⚠️";
        box.innerHTML = `<div style="color:#ef4444; font-size:10px; font-weight:bold; padding:4px; text-align:center; line-height:1.3;">⚠️ ${currentLicenseErrorMsg}</div>`;
        return;
    }

    // Check live server connection status and device count
    let isServerConnected = true;
    let onlineCount = 0;
    let totalCount = 0;
    let serverStatus = null;
    try {
        serverStatus = await new Promise(r => chrome.runtime.sendMessage({ action: 'checkServerStatus' }, (res) => {
            if (chrome.runtime.lastError || !res || !res.connected) {
                r(null);
            } else {
                r(res.data || {});
            }
        }));
        if (!serverStatus) {
            isServerConnected = false;
        } else {
            isServerConnected = true;
            const devices = serverStatus.devices || [];
            onlineCount = serverStatus.online_devices !== undefined ? serverStatus.online_devices : devices.filter(d => d.online).length;
            totalCount = serverStatus.total_devices !== undefined ? serverStatus.total_devices : devices.length;
        }
    } catch(e) {
        isServerConnected = false;
    }

    const pinDeviceBadge = shadowDomRoot ? shadowDomRoot.getElementById('pin-device-badge') : null;

        if (!isServerConnected) {
        if (pinHeader) pinHeader.style.background = '#ef4444';
        if (pinBoxEl) pinBoxEl.style.borderColor = '#ef4444';
        if (pinTitle) pinTitle.textContent = "অফলাইন";
        if (pinIcon) pinIcon.textContent = "⚠️";
        if (pinDeviceBadge) pinDeviceBadge.style.display = 'none';
        box.innerHTML = `<div style="color:#ef4444; font-size:11px; font-weight:700; padding:6px 2px; text-align:center; line-height:1.3;">
                            ⚠️ সার্ভার অফলাইন<br>
                            <span style="font-size:9px; font-weight:normal; color:#64748b;">(সফটওয়্যার চালু করুন)</span>
                         </div>`;
        return;
    } else {
        if (pinHeader) pinHeader.style.background = '#059669';
        if (pinBoxEl) pinBoxEl.style.borderColor = '#059669';
        if (pinTitle) pinTitle.textContent = "IVAC OTP";
        if (pinIcon) pinIcon.textContent = "📋";
        if (pinDeviceBadge) {
            pinDeviceBadge.textContent = `📱 ${onlineCount}/${totalCount}`;
            pinDeviceBadge.style.display = 'inline-block';
            pinDeviceBadge.title = `সংযুক্ত: ${onlineCount} টি, মোট: ${totalCount} টি মোবাইল`;
        }
    }

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

    // Query all relevant registered phones
    const queryList = [];
    if (currentSavedPhone) queryList.push({ phone: currentSavedPhone, label: '📱 IVAC', isIvac: true });
    
    const rocketAccountsList = res.rocket_accounts || [];
    rocketAccountsList.forEach(acc => {
        if (acc && acc.number) {
            const p = acc.number.substring(0, 11);
            if (!queryList.find(x => x.phone === p)) {
                queryList.push({ phone: p, label: '🚀 Payment', isIvac: false });
            }
        }
    });

    const onlinePhonesList = (serverStatus && serverStatus.online_phones) || [];
    const offlinePhonesList = (serverStatus && serverStatus.offline_phones) || [];

    function getDevDot(ph) {
        const c = (ph || '').replace(/[^0-9]/g, '').substring(0, 11);
        if (onlinePhonesList.includes(c)) return '<span title="অনলাইন" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981; margin-left:3px; vertical-align:middle; box-shadow:0 0 4px #10b981;"></span>';
        if (offlinePhonesList.includes(c)) return '<span title="অফলাইন" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#ef4444; margin-left:3px; vertical-align:middle;"></span>';
        return '<span title="কানেক্টেড নেই" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#94a3b8; margin-left:3px; vertical-align:middle;"></span>';
    }

    for (const item of queryList) {
        try {
            const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'fetchOtp', phone: item.phone }, r));
            if (d && d.success && d.data && d.data.display) {
                if (found) html += '<div class="divider"></div>';
                const isUsed = !!d.data.used;
                const statusBadge = isUsed ? '<span class="status-badge badge-used">Used</span>' : '<span class="status-badge badge-unused">Unused</span>';
                const valColor = isUsed ? '#64748b' : (item.isIvac ? '#059669' : '#d97706');
                const tagColorClass = item.isIvac ? 'c-green' : 'c-amber';
                const dotHtml = getDevDot(item.phone);

                html += `<div class="otp-tag-row">
                             <span class="otp-tag ${tagColorClass}">${item.label} (${item.phone})${dotHtml}</span>
                             ${statusBadge}
                         </div>
                         <div class="otp-row">
                             <div class="otp-val" style="color:${valColor};">${d.data.display}</div>
                             <div>
                                 <button class="action-btn" data-action="copy" data-otp="${d.data.otp_string}" title="Copy">📋</button>
                                 <button class="action-btn" data-action="delete" data-phone="${item.phone}" title="Delete">🗑️</button>
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
            const dotHtml = getDevDot(currentSavedPhone);
            text = `<b>${currentSavedPhone}</b>${dotHtml} এর OTP নেই`;
        } else {
            text = `ফোন নম্বর পাওয়া যায়নি!`;
        }
        box.innerHTML = `<span class="c-gray" style="font-size:10px; display:flex; align-items:center; justify-content:center; gap:2px;">${text}</span>`;
    } else {
        box.innerHTML = html;
    }
    } catch(e) {
        // Extension context invalidated â€” silently ignore (happens after extension reload)
    }
}

// ===== AUTO-FILL 6-BOX or 1-BOX OTP =====
function checkForOtpFields() {
    if (!isLicenseValid) return;
    // à¦¶à§à¦§à§à¦®à¦¾à¦¤à§à¦° active (foreground) à¦Ÿà§à¦¯à¦¾à¦¬à§‡ à¦•à¦¾à¦œ à¦•à¦°à¦¬à§‡
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
    if (document.visibilityState !== 'visible') return;

    // Get freshest phone number
    const res = await new Promise(r => chrome.storage.local.get(['ivac_phone'], r));
    const currentSavedPhone = res.ivac_phone || "";
    if (!currentSavedPhone || currentSavedPhone.length < 11) return;

    try {
        // STRICTLY request source: 'IV' and check used === false
        const d = await new Promise(r => chrome.runtime.sendMessage({ 
            action: 'claimAndFetchOtp', 
            phone: currentSavedPhone, 
            source: 'IV' 
        }, r));
        
        if (d && d.success && d.data && d.data.digits && !d.data.used && d.data.source === 'IV') {
            fillOtpNative(otpInputs, d.data.digits, isSingleBox);
            chrome.runtime.sendMessage({ action: 'markUsed', phone: currentSavedPhone, source: 'IV' });
            emitActivity('login_otp_filled', 'Login OTP গ্রহণ ও পূরণ', 'Phone: ' + currentSavedPhone + ', OTP: ' + d.data.digits.join(''), 0, 'info');
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
let currentWebfileIndex = 0;       // à¦•à§‹à¦¨ à¦¨à¦®à§à¦¬à¦° à¦«à¦¾à¦‡à¦² à¦†à¦ªà¦²à§‹à¦¡ à¦•à¦°à¦¤à§‡ à¦¹à¦¬à§‡ (0-based)
let isUploadInProgress = false;    // à¦à¦–à¦¨ à¦†à¦ªà¦²à§‹à¦¡ à¦šà¦²à¦›à§‡ à¦•à¦¿ à¦¨à¦¾
let captchaResolvedAt = 0;         // Captcha à¦•à¦–à¦¨ resolve à¦¹à¦¯à¦¼à§‡à¦›à§‡ (timestamp)
let lastUploadAttemptAt = 0;       // à¦¶à§‡à¦·à¦¬à¦¾à¦° à¦•à¦–à¦¨ à¦†à¦ªà¦²à§‹à¦¡à§‡à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡

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
    const cfFrame = document.querySelector('iframe[src*="cloudflare"], iframe[src*="turnstile"], iframe[src*="challenges.cloudflare.com"]');
    
    if (cfFrame || cf) {
        return !!(cf && cf.value && cf.value.length > 10);
    }
    if (rc) {
        return !!(rc.value && rc.value.length > 10);
    }
    return true;
}

function getVisibleApplicantBoxesCount() {
    const text = document.body.innerText;
    const applicantMatches = text.match(/(?:Primary Applicant|Applicant\s*0?\d+)/gi) || [];
    const uniqueLabels = new Set(applicantMatches.map(m => m.toLowerCase().replace(/\s+/g, '')));
    return uniqueLabels.size;
}

// ===== AUTO-CLICK "Confirm All Information is Correct" (STRICT VALIDATION) =====
function handleConfirmAllInfoButton() {
    if (!window.location.hostname.includes('ivacbd.com')) return;
    
    const pageText = document.body.innerText.toLowerCase();
    if (!pageText.includes('confirm all information is correct')) return;

    const confirmButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]')).filter(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        return t.includes('confirm all information is correct') && isElementVisible(b) && !b.disabled;
    });

    if (confirmButtons.length === 0) return;
    const confirmBtn = confirmButtons[0];

    chrome.storage.local.get(['saved_webfiles', 'webfile_enabled'], (res) => {
        if (chrome.runtime.lastError) return;
        const savedFiles = res.saved_webfiles || [];
        const requiredCount = savedFiles.length;

        // If no webfiles are added in extension, do not auto confirm blindly
        if (requiredCount === 0) return;

        // 1. Check "Total number of applicants: X" matches extension webfiles count
        const totalMatch = document.body.innerText.match(/total\s+number\s+of\s+applicants:\s*(\d+)/i);
        const currentTotal = totalMatch ? parseInt(totalMatch[1], 10) : 0;
        if (currentTotal !== requiredCount) {
            return;
        }

        // 2. Check visual applicant boxes rendered on page equals requiredCount
        const visualBoxesCount = getVisibleApplicantBoxesCount();
        if (visualBoxesCount !== requiredCount) {
            return;
        }

        // 3. Ensure no webfile upload AJAX is actively in progress
        if (pageText.includes('uploading')) return;

        // 4. Ensure captcha on this page is completed (green checkmark)
        if (!isCaptchaResolved()) return;

        // ALL CONDITIONS MET -> Click Confirm All Information button safely
        safeClick(confirmBtn, 'confirmAllInfoCorrect');
        emitActivity('applicants_confirmed', `Applicant তথ্য কনফার্ম (${requiredCount} জন)`, `সকল ${requiredCount} টি ওয়েবফাইল ও তথ্য সফলভাবে কনফার্ম করা হয়েছে`, 0, 'success');
        console.log(`[IVAC] All ${requiredCount} applicants verified & captcha ready. Clicked "Confirm All Information is Correct"!`);
    });
}

// ===== AUTO-CLICK "Save & Continue" IN CONFIRMATION POPUP MODAL (IMAGE 3) =====
function handleSaveAndContinueModal() {
    if (!window.location.hostname.includes('ivacbd.com')) return;
    
    // Check for the specific modal structure with "Please Confirm Your Details"
    const modals = Array.from(document.querySelectorAll('div, section, [role="dialog"], [class*="modal"]')).filter(m => {
        const t = (m.textContent || '').toLowerCase();
        return (t.includes('please confirm your details') || t.includes('make sure all the information is correct before saving')) &&
               (t.includes('save & continue') || t.includes('save and continue')) &&
               m.offsetHeight > 50 && isElementVisible(m);
    });

    if (modals.length > 0) {
        const modal = modals[0];
        const saveBtn = Array.from(modal.querySelectorAll('button, a, div[role="button"]')).find(b => {
            const t = (b.textContent || '').trim().toLowerCase();
            return (t.includes('save & continue') || t.includes('save and continue')) && isElementVisible(b) && !b.disabled;
        });

        if (saveBtn) {
            safeClick(saveBtn, 'saveAndContinueModal');
            emitActivity('details_saved_and_continued', 'Save & Continue ক্লিক', 'আবেদনকারীর সকল তথ্য সফলভাবে সেভ ও কনফার্ম করা হয়েছে', 0, 'success');
            console.log('[IVAC] Clicked Save & Continue in confirmation popup modal!');
        }
    }
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
        // Manual mode à¦ captcha à¦šà§‡à¦•
        if (!isCaptchaResolved()) {
            alert("à¦¦à¦¯à¦¼à¦¾ à¦•à¦°à§‡ à¦†à¦—à§‡ Cloudflare à¦­à§‡à¦°à¦¿à¦«à¦¾à¦‡ (Success!) à¦¹à¦“à¦¯à¦¼à¦¾ à¦ªà¦°à§à¦¯à¦¨à§à¦¤ à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨!");
            sendResponse({ success: false });
            return;
        }
        const success = injectWebfileToPage(msg.fileData, msg.fileName);
        sendResponse({ success });
    }
});


// ===== 6. Intelligent Round-Robin Slot Rotation System (Server-Jam Resilient & Auto 2-Weeks) =====
let isSlotBookingInProgress = false;
let slotLastAttemptTime = 0;
let slotCurrentIndex = 0;
let slotAttemptCount = 0;
let slotNavigatingMonth = false;
let monthWaitTicks = 0; // To prevent frantic arrow clicking during server jams

// State Machine Variables to prevent repeated clicking on dates
let slotState = 'SEARCHING'; // 'SEARCHING', 'WAITING_FOR_BTN'
let slotDateClickTime = 0;
let slotLastClickedTarget = null; // Store which date we clicked

const MONTH_NAMES_EN = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const MONTH_SHORT_EN = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function isCalendarPage() {
    const pathname = (window.location.pathname || '').toLowerCase();
    
    // Explicitly exclude non-calendar pages
    if (pathname.includes('/signin') || 
        pathname.includes('/mission') || 
        pathname.includes('/file_upload') || 
        pathname.includes('/payment') || 
        pathname.includes('/invoice')) {
        return false;
    }

    const isSlotPath = pathname.includes('/time_slot') || 
                       pathname.includes('/time-slot') || 
                       pathname.includes('/timeslot') ||
                       pathname.includes('/appointment/slot');
    
    if (isSlotPath) return true;

    const bodyText = document.body ? document.body.innerText : '';
    const hasCalendarText = bodyText.includes('Select an Appointment Date') || 
                            bodyText.includes('Select an appointment date') ||
                            (bodyText.includes('Continue Booking') && !bodyText.includes('Sign In'));
    
    return hasCalendarText;
}

function getCalendarDisplayedMonthYear() {
    const headerCandidates = document.querySelectorAll('div, span, th, td, h2, h3, h4, p, strong');
    for (const el of headerCandidates) {
        if (!isElementVisible(el)) continue;
        const text = el.textContent.trim();
        const match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i);
        if (match) {
            const monthIdx = MONTH_NAMES_EN.indexOf(match[1].toLowerCase());
            const year = parseInt(match[2], 10);
            if (monthIdx !== -1 && year > 2000) {
                return { month: monthIdx, year: year, element: el };
            }
        }
    }
    return null;
}

function clickCalendarArrow(direction) {
    const allClickables = document.querySelectorAll('button, a, span, div, svg, i, [role="button"]');
    for (const el of allClickables) {
        if (!isElementVisible(el)) continue;
        const text = el.textContent.trim();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        
        if (direction === 'next') {
            if (text === '>' || text === '\u203A' || text === '\u276F' || text === '\u2192' || text === '\u00BB' ||
                ariaLabel.includes('next') || ariaLabel.includes('forward') ||
                el.classList.contains('next') || el.classList.contains('right-arrow') ||
                el.classList.contains('calendar-next') || el.classList.contains('fc-next-button')) {
                el.click();
                console.log('[IVAC Slot] Clicked NEXT month arrow');
                return true;
            }
        } else {
            if (text === '<' || text === '\u2039' || text === '\u276E' || text === '\u2190' || text === '\u00AB' ||
                ariaLabel.includes('prev') || ariaLabel.includes('previous') || ariaLabel.includes('back') ||
                el.classList.contains('prev') || el.classList.contains('left-arrow') ||
                el.classList.contains('calendar-prev') || el.classList.contains('fc-prev-button')) {
                el.click();
                console.log('[IVAC Slot] Clicked PREV month arrow');
                return true;
            }
        }
    }
    return false;
}

function parsePrefDateFull(dateStr) {
    if (!dateStr) return null;
    dateStr = String(dateStr).trim();

    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        return { day: parseInt(isoMatch[3], 10), month: parseInt(isoMatch[2], 10) - 1, year: parseInt(isoMatch[1], 10) };
    }

    const dmyMatch = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmyMatch) {
        return { day: parseInt(dmyMatch[1], 10), month: parseInt(dmyMatch[2], 10) - 1, year: parseInt(dmyMatch[3], 10) };
    }

    const dmMatch = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})$/);
    if (dmMatch) {
        const now = new Date();
        return { day: parseInt(dmMatch[1], 10), month: parseInt(dmMatch[2], 10) - 1, year: now.getFullYear() };
    }

    const dayMonMatch = dateStr.match(/^(\d{1,2})[-\/\s]+([A-Za-z]+)(?:[-\/\s]+(\d{4}))?$/);
    if (dayMonMatch) {
        const day = parseInt(dayMonMatch[1], 10);
        const mStr = dayMonMatch[2].toLowerCase().substring(0, 3);
        const mIdx = MONTH_SHORT_EN.indexOf(mStr);
        if (mIdx !== -1) {
            const year = dayMonMatch[3] ? parseInt(dayMonMatch[3], 10) : new Date().getFullYear();
            return { day, month: mIdx, year };
        }
    }

    if (/^\d{1,2}$/.test(dateStr)) {
        return { day: parseInt(dateStr, 10), month: -1, year: -1 };
    }

    return null;
}

function generateTwoWeeksDates() {
    const dates = [];
    const now = new Date();
    for (let i = 0; i <= 14; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const dayOfWeek = d.getDay(); 
        if (dayOfWeek !== 5 && dayOfWeek !== 6) {
            dates.push({
                day: d.getDate(),
                month: d.getMonth(),
                year: d.getFullYear()
            });
        }
    }
    return dates;
}

function findAvailableCalendarDates() {
    const candidates = [];
    const calendarElements = Array.from(document.querySelectorAll('td, div, span, button, a, [role="gridcell"]'));
    
    calendarElements.forEach(el => {
        if (!el || !isElementVisible(el)) return;
        
        const text = el.textContent.trim();
        const num = parseInt(text, 10);
        if (isNaN(num) || num < 1 || num > 31 || text.length > 2) return;
        
        if (el.hasAttribute('disabled') || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true') {
            return;
        }

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.4) return;
        
        const isCircle = style.borderRadius.includes('50%') || style.borderRadius.includes('9999px') || parseInt(style.borderRadius) >= 8;
        const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
        const isPointer = style.cursor === 'pointer';
        const hasActiveClass = el.classList.contains('active') || el.classList.contains('available') || el.classList.contains('has-slot');
        
        if (isPointer || isCircle || hasBorder || hasActiveClass) {
            if (!candidates.find(c => c.day === num)) {
                candidates.push({ day: num, text: text, element: el });
            }
        }
    });

    candidates.sort((a, b) => a.day - b.day);
    return candidates;
}

function handleSlotRotation() {
    if (!isCalendarPage()) {
        const slotCard = shadowDomRoot ? shadowDomRoot.getElementById('slot-status-card') : null;
        if (slotCard) slotCard.style.display = 'none';
        monthWaitTicks = 0;
        slotState = 'SEARCHING';
        return;
    }

    if (slotNavigatingMonth) return;

    try {
        chrome.storage.local.get(['slot_booking_enabled', 'preferred_dates', 'ext_enabled', 'slot_fallback_enabled'], (res) => {
            if (chrome.runtime.lastError || res.ext_enabled === false || res.slot_booking_enabled === false) return;

            const preferredDates = res.preferred_dates || [];
            const availableDates = findAvailableCalendarDates();
            const calendarInfo = getCalendarDisplayedMonthYear();
            
            const slotCard = shadowDomRoot ? shadowDomRoot.getElementById('slot-status-card') : null;
            const slotStatusText = shadowDomRoot ? shadowDomRoot.getElementById('slot-status-text') : null;
            const slotCountdownText = shadowDomRoot ? shadowDomRoot.getElementById('slot-countdown-text') : null;

            if (slotCard) slotCard.style.display = 'block';

            // STATE MACHINE LOGIC
            const now = Date.now();

            if (slotState === 'WAITING_FOR_BTN') {
                const timeWaiting = now - slotDateClickTime;
                
                // 1. Check if Captcha is resolved and Continue button is visible
                const continueBtn = findButtonByText("continue booking") || findButtonByText("Continue Booking");
                if (isCaptchaResolved() && continueBtn && isElementVisible(continueBtn) && !continueBtn.disabled) {
                    console.log('[IVAC Slot] Clicking Continue Booking!');
                    continueBtn.click();
                    slotLastAttemptTime = now;
                    slotAttemptCount++;
                    slotCurrentIndex++; // Move to next date for next round
                    slotState = 'SEARCHING';
                    
                    if (slotStatusText) slotStatusText.textContent = '\u2705 \u09B8\u09CD\u09B2\u099F\u09C7 \u0995\u09CD\u09B2\u09BF\u0995 \u09B8\u09AB\u09B2!';
                    if (slotCountdownText) slotCountdownText.textContent = '\u0995\u09A8\u09AB\u09BE\u09B0\u09CD\u09AE \u0995\u09B0\u09BE \u09B9\u099A\u09CD\u099B\u09C7...';
                    return;
                }
                
                // 2. Check Timeout (Waited 15 seconds, but button didn't appear)
                if (timeWaiting > 15000) {
                    console.log('[IVAC Slot] Timed out waiting for Continue button. Reverting to SEARCHING.');
                    slotCurrentIndex++; // Skip this problematic date for now
                    slotState = 'SEARCHING';
                    
                    if (slotStatusText) slotStatusText.textContent = '\u26A0\uFE0F \u09B8\u09BE\u09B0\u09CD\u09AD\u09BE\u09B0 \u09B0\u09C7\u09B8\u09AA\u09A8\u09CD\u09B8 \u0995\u09B0\u09C7\u09A8\u09BF';
                    if (slotCountdownText) slotCountdownText.textContent = '\u0985\u09A8\u09CD\u09AF \u09A4\u09BE\u09B0\u09BF\u0996\u09C7 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u099B\u09C7';
                    return;
                }

                // 3. Still Waiting
                const remainingWait = Math.ceil((15000 - timeWaiting) / 1000);
                if (slotStatusText) slotStatusText.textContent = '\u23F3 \u0995\u09CD\u09AF\u09BE\u09AA\u099A\u09BE/লোডিং চেক...';
                if (slotCountdownText) slotCountdownText.textContent = `\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE: ${remainingWait}s`;
                return; // Block here, don't execute SEARCHING logic
            }

            // ==================== SEARCHING LOGIC ====================

            // 1. Calculate Active Targets
            let activeTargets = [];
            if (preferredDates.length > 0) {
                preferredDates.forEach(pref => {
                    const parsed = parsePrefDateFull(pref);
                    if (parsed) activeTargets.push(parsed);
                });
            } else {
                activeTargets = generateTwoWeeksDates();
            }

            if (activeTargets.length === 0) return;

            // 20 Seconds Global Cooldown between SUCCESSFUL clicks
            const elapsedSinceSuccess = now - slotLastAttemptTime;
            if (slotLastAttemptTime > 0 && elapsedSinceSuccess < 20000) {
                const remainingSec = Math.ceil((20000 - elapsedSinceSuccess) / 1000);
                if (slotStatusText) slotStatusText.textContent = '\uD83D\uDD04 \u09B8\u09CD\u09B2\u099F \u09B0\u09CB\u099F\u09C7\u09B6\u09A8 \u0995\u09C1\u09B2\u09A1\u09BE\u0989\u09A8';
                if (slotCountdownText) slotCountdownText.textContent = '\u23F3 \u09B0\u09BF-\u099F\u09CD\u09B0\u09BE\u0987: ' + remainingSec + 's';
                return;
            }

            const requiredMonths = [];
            activeTargets.forEach(t => {
                if (t.month !== -1) {
                    if (!requiredMonths.find(rm => rm.month === t.month && rm.year === t.year)) {
                        requiredMonths.push({ month: t.month, year: t.year });
                    }
                }
            });

            if (!calendarInfo) return; 

            const currentMonth = calendarInfo.month;
            const currentYear = calendarInfo.year;
            
            const isCurrentMonthRequired = requiredMonths.some(rm => rm.month === currentMonth && rm.year === currentYear) || requiredMonths.length === 0;

            let prioritizedQueue = [];
            
            // 1. First priority: Add preferred dates configured in extension
            activeTargets.forEach(t => {
                let matched = null;
                if (t.month === -1) {
                    matched = availableDates.find(d => d.day === t.day);
                } else if (t.month === currentMonth && t.year === currentYear) {
                    matched = availableDates.find(d => d.day === t.day);
                }
                if (matched && !prioritizedQueue.includes(matched)) {
                    prioritizedQueue.push(matched);
                }
            });

            // 2. Second priority: If Fallback is enabled (Auto mode) or if no preferred dates are set, add other available dates
            const isFallbackAllowed = (res.slot_fallback_enabled !== false) || (preferredDates.length === 0);
            if (isFallbackAllowed) {
                availableDates.forEach(avail => {
                    if (!prioritizedQueue.includes(avail)) {
                        prioritizedQueue.push(avail);
                    }
                });
            }

            if (prioritizedQueue.length > 0) {
                // Circles found! Let's click one.
                monthWaitTicks = 0; 
                const targetDateObj = prioritizedQueue[slotCurrentIndex % prioritizedQueue.length];
                if (!targetDateObj) return;

                // CLICK THE DATE CIRCLE
                targetDateObj.element.click();
                const monthLabel = MONTH_NAMES_EN[currentMonth].charAt(0).toUpperCase() + MONTH_NAMES_EN[currentMonth].slice(1);
                console.log('[IVAC Slot] Selected date: ' + targetDateObj.day + ' ' + monthLabel);

                // Transition to WAITING State
                slotState = 'WAITING_FOR_BTN';
                slotDateClickTime = now;
                slotLastClickedTarget = targetDateObj;

                if (slotStatusText) slotStatusText.textContent = '\uD83D\uDCC5 ' + targetDateObj.day + ' ' + monthLabel + ' \u09B8\u09BF\u09B2\u09C7\u0995\u09CD\u099F\u09C7\u09A1!';
                if (slotCountdownText) slotCountdownText.textContent = '\u099A\u09C7\u09B7\u09CD\u099F\u09BE #' + (slotAttemptCount + 1);

            } else {
                // NO circles available yet in the current month
                if (isCurrentMonthRequired) {
                    const otherMonths = requiredMonths.filter(rm => rm.month !== currentMonth || rm.year !== currentYear);
                    
                    if (otherMonths.length > 0) {
                        monthWaitTicks++;
                        if (slotStatusText) slotStatusText.textContent = '\u23F3 \u09B8\u09BE\u09B0\u09CD\u09AD\u09BE\u09B0 \u099C\u09CD\u09AF\u09BE\u09AE (\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE ' + (monthWaitTicks * 2) + 's)...';
                        if (slotCountdownText) slotCountdownText.textContent = '\u09A4\u09BE\u09B0\u09BF\u0996 \u098F\u0996\u09A8\u09CB \u0986\u09B8\u09C7\u09A8\u09BF';

                        if (monthWaitTicks >= 5) {
                            const nextRm = otherMonths[0];
                            const targetTotal = nextRm.year * 12 + nextRm.month;
                            const currentTotal = currentYear * 12 + currentMonth;
                            const direction = targetTotal > currentTotal ? 'next' : 'prev';
                            
                            console.log('[IVAC Slot] Waited 10s, navigating ' + direction + ' to check other month');
                            if (slotCountdownText) slotCountdownText.textContent = '\u0985\u09A8\u09CD\u09AF \u09AE\u09BE\u09B8 \u099A\u09C7\u0995...';
                            
                            slotNavigatingMonth = true;
                            monthWaitTicks = 0;
                            const clicked = clickCalendarArrow(direction);
                            if (clicked) {
                                setTimeout(() => { slotNavigatingMonth = false; }, 800);
                            } else {
                                slotNavigatingMonth = false;
                            }
                        }
                    } else {
                        if (slotStatusText) slotStatusText.textContent = '\u23F3 \u09B8\u09BE\u09B0\u09CD\u09AD\u09BE\u09B0 \u099C\u09CD\u09AF\u09BE\u09AE (\u09A4\u09BE\u09B0\u09BF\u0996 \u0986\u09B8\u09BE\u09B0 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE\u09DF)...';
                        if (slotCountdownText) slotCountdownText.textContent = '\u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0 \u09B8\u09CD\u0995\u09CD\u09AF\u09BE\u09A8 \u099A\u09B2\u099B\u09C7';
                    }
                } else {
                    const nextRm = requiredMonths[0];
                    const targetTotal = nextRm.year * 12 + nextRm.month;
                    const currentTotal = currentYear * 12 + currentMonth;
                    const direction = targetTotal > currentTotal ? 'next' : 'prev';
                    
                    console.log('[IVAC Slot] Current month not needed, navigating ' + direction);
                    if (slotStatusText) slotStatusText.textContent = '\uD83D\uDCC5 \u09B8\u09A0\u09BF\u0995 \u09AE\u09BE\u09B8\u09C7 \u09AF\u09BE\u099A\u09CD\u099B\u09C7...';
                    if (slotCountdownText) slotCountdownText.textContent = '';
                    
                    slotNavigatingMonth = true;
                    monthWaitTicks = 0;
                    const clicked = clickCalendarArrow(direction);
                    if (clicked) {
                        setTimeout(() => { slotNavigatingMonth = false; }, 800);
                    } else {
                        slotNavigatingMonth = false;
                    }
                }
            }
        });
    } catch(e) {}
}


function updateSlotTimerUI(statusText, remainingSec, attemptNumber) {
    if (!shadowDomRoot) return;
    const panel = shadowDomRoot.getElementById('slot-timer-panel');
    const statusEl = shadowDomRoot.getElementById('slot-status-msg');
    const timerEl = shadowDomRoot.getElementById('slot-live-timer');
    const attemptEl = shadowDomRoot.getElementById('slot-attempt-badge');
    const progressEl = shadowDomRoot.getElementById('slot-progress-bar');
    
    if (!panel) return;
    
    const isCalPage = isCalendarPage();
    if (!isCalPage) {
        panel.style.display = 'none';
        return;
    }
    
    panel.style.display = 'block';
    if (statusText && statusEl) statusEl.textContent = statusText;
    if (attemptNumber !== undefined && attemptEl) attemptEl.textContent = 'চেষ্টা #' + attemptNumber;
    
    if (remainingSec !== undefined && remainingSec !== null && timerEl) {
        timerEl.textContent = remainingSec > 0 ? remainingSec + 's' : '0s';
        if (progressEl) {
            const pct = Math.max(0, Math.min(100, (remainingSec / 20) * 100));
            progressEl.style.width = pct + '%';
            if (remainingSec <= 5) {
                progressEl.style.background = '#ef4444';
                timerEl.style.color = '#ef4444';
            } else {
                progressEl.style.background = '#059669';
                timerEl.style.color = '#d97706';
            }
        }
    }
}

// Live High-Frequency (500ms) ticker for permanent floating widget & ultra-smooth slot countdown
setInterval(() => {
    ensurePinWidgetAttached();
    if (!isCalendarPage()) {
        if (shadowDomRoot) {
            const p = shadowDomRoot.getElementById('slot-timer-panel');
            if (p) p.style.display = 'none';
        }
        return;
    }
    
    const now = Date.now();
    const elapsedSinceSuccess = now - slotLastAttemptTime;
    
    if (slotLastAttemptTime > 0 && elapsedSinceSuccess < 20000) {
        const remainingSec = Math.ceil((20000 - elapsedSinceSuccess) / 1000);
        updateSlotTimerUI('⏳ ২০ সে. পর রি-ট্রাই করবে...', remainingSec, slotAttemptCount || 1);
    } else if (slotState === 'WAITING_FOR_BTN') {
        const timeWaiting = now - slotDateClickTime;
        const remainingSec = Math.max(0, Math.ceil((15000 - timeWaiting) / 1000));
        updateSlotTimerUI('📅 তারিখ সিলেক্টেড! বাটন চেক...', remainingSec, slotAttemptCount || 1);
    } else {
        updateSlotTimerUI('🔄 স্লট স্ক্যানিং চলছে...', 0, slotAttemptCount || 1);
    }
}, 500);

// ===== Slot Rotation Timer (runs every 2 seconds on calendar page) =====
setInterval(() => {
    if (!isLicenseValid) return;
    handleSlotRotation();
}, 2000);






// ===== IVAC MISSION & CENTER AUTO-SELECT & CONFIRM (EXACT DOM MATCH) =====
let missionAutoSelectDone = false;
let missionLastAttemptTime = 0;

function handleMissionAndCenterAutoSelect() {
    const isMissionPage = window.location.pathname.includes('/appointment/mission') || 
                          window.location.href.includes('/appointment/mission') ||
                          (document.body.innerText.includes('Select your IVAC center') && document.body.innerText.includes('Confirm Mission'));
    
    if (!isMissionPage) {
        missionAutoSelectDone = false;
        return;
    }

    if (missionAutoSelectDone) return;
    
    const now = Date.now();
    if (now - missionLastAttemptTime < 400) return;
    missionLastAttemptTime = now;

    const form = document.querySelector('form.space-y-6, form') || document.body;

    // 1. Check if the popup options dropdown is open in DOM (div.absolute.z-50)
    const popupMenu = document.querySelector('div.relative div.absolute, div.absolute.z-50, div[class*="absolute"][class*="z-50"], div[class*="overflow-y-auto"]');
    
    if (popupMenu && isElementVisible(popupMenu)) {
        // Collect all option buttons inside the open dropdown popup
        const optionButtons = Array.from(popupMenu.querySelectorAll('button')).filter(b => {
            const t = (b.textContent || '').trim();
            return t !== '' && isElementVisible(b);
        });

        if (optionButtons.length > 0) {
            if (optionButtons.length === 1) {
                const targetOption = optionButtons[0];
                const optionName = targetOption.textContent.trim();
                console.log('[IVAC] Exactly 1 option found in dropdown: ' + optionName);
                
                targetOption.click();
                emitActivity('mission_center_selected', 'Center Auto-Selected', `১টি মাত্র অপশন থাকায় সিলেক্ট করা হয়েছে: ${optionName}`, 0, 'info');

                setTimeout(() => {
                    clickMissionSubmitButton();
                }, 300);
                return;
            } else {
                console.log('[IVAC] Multiple options found in dropdown (' + optionButtons.length + '). Auto-select stopped.');
                missionAutoSelectDone = true;
                return;
            }
        }
    }

    // 2. If popup is not open yet, find the IVAC Center trigger button and click it to open
    const allButtons = Array.from(form.querySelectorAll('button[type="button"], button')).filter(b => isElementVisible(b));
    const centerTriggerBtn = allButtons.find(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        return (t.includes('select your ivac center') || t.includes('select ivac center')) && !t.includes('select a mission');
    });

    if (centerTriggerBtn) {
        console.log('[IVAC] Triggering IVAC Center dropdown open click...');
        centerTriggerBtn.click();
        return;
    }

    // 3. If center is already selected (e.g. shows "IVAC, RAJSHAHI" and no "Select IVAC center" placeholder)
    const pageText = form.innerText || document.body.innerText;
    if (pageText.includes('IVAC,') && !pageText.includes('Select IVAC center')) {
        clickMissionSubmitButton();
    }
}

function clickMissionSubmitButton() {
    const submitBtn = document.querySelector('button[type="submit"]') || 
                      Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').toLowerCase().includes('confirm mission'));
    
    if (submitBtn && !submitBtn.disabled && isElementVisible(submitBtn) && !missionAutoSelectDone) {
        missionAutoSelectDone = true;
        safeClick(submitBtn, 'confirmMissionCenter');
        emitActivity('mission_confirmed', 'Confirm Mission ক্লিক', 'মিশন ও আইভ্যাক সেন্টার কনফার্ম করা হয়েছে', 0, 'success');
        console.log('[IVAC] Clicked Confirm Mission submit button!');
    }
}

// ===== Main Automation Loop =====
        // Ensure floating PIN widget is always active on all pages
        if (!document.getElementById('ivac-pin-widget-root')) {
            ensurePinWidgetAttached();
        }
setInterval(() => {
    if (!isLicenseValid) return;
    try {
    chrome.storage.local.get(['ext_enabled'], (extRes) => {
        if (chrome.runtime.lastError) return;
        if (extRes.ext_enabled === false) return;

        // Auto-select single mission center & click confirm
        handleMissionAndCenterAutoSelect();

        // Strict Auto-click "Confirm All Information is Correct"
        handleConfirmAllInfoButton();

        // Strict Auto-click "Save & Continue" in confirmation modal popup
        handleSaveAndContinueModal();

        // à§§. OTP à¦¬à¦¸à¦¾à¦¨à§‹à¦° à¦ªà¦° "Verify OTP" à¦¤à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾
        const otpInputs = Array.from(document.querySelectorAll('input')).filter(inp =>
            inp.type !== 'hidden' && inp.style.display !== 'none' && (inp.maxLength === 1 || inp.getAttribute('pattern') === '[0-9]')
        );
    if (otpInputs.length === 6 && otpInputs.every(i => i.value !== '')) {
        const verifyBtn = findButtonByText("verify otp");
        if (verifyBtn && isElementVisible(verifyBtn) && !verifyBtn.disabled) {
            safeClick(verifyBtn, 'verifyOtp');
        }
    }

    // à§¨. à¦ªà¦ªà¦†à¦ªà¦—à§à¦²à§‹à¦° 'X' (cross) à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à§‡ à¦•à§‡à¦Ÿà§‡ à¦¦à§‡à¦“à¦¯à¦¼à¦¾
    const closeBtns = document.querySelectorAll('button.close, button.btn-close, .modal button[aria-label="Close"], button[aria-label="Close"]');
    closeBtns.forEach(btn => {
        if (isElementVisible(btn)) safeClick(btn, 'closeBtn');
    });
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => {
        if (btn.textContent.trim() === 'Ã—' && isElementVisible(btn)) {
            safeClick(btn, 'closeBtnText');
        }
    });

    // à§©. à¦•à¦®à¦²à¦¾ à¦°à¦™à§‡à¦° "Take Your Appointment" à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾
    const takeAppBtn = findButtonByText("take your appointment");
    if (takeAppBtn && isElementVisible(takeAppBtn)) {
        safeClick(takeAppBtn, 'takeApp');
    }

    // à§ª. à¦ªà¦ªà¦†à¦ªà§‡à¦° "Next Step" à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾
    const nextStepBtn = findButtonByText("next step");
    if (nextStepBtn && isElementVisible(nextStepBtn)) {
        safeClick(nextStepBtn, 'nextStep');
    }

    // ===== à§«. Smart Webfile Auto-Upload System =====
    const state = getPageUploadState();
    
    // à¦«à¦¾à¦‡à¦² à¦†à¦ªà¦²à§‹à¦¡ à¦ªà§‡à¦œà§‡ à¦¨à¦¾ à¦¥à¦¾à¦•à¦²à§‡ à¦•à¦¿à¦›à§ à¦•à¦°à¦¾à¦° à¦¦à¦°à¦•à¦¾à¦° à¦¨à§‡à¦‡
    if (!state.hasFileInput && !state.isAskingPrimary && !state.isAskingOther) return;
    
    // Uploading... à¦šà¦²à¦›à§‡, à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§‹
    if (state.isUploading) return;

    // Captcha resolve à¦¹à¦“à¦¯à¦¼à¦¾à¦° à¦¸à¦®à¦¯à¦¼ à¦Ÿà§à¦°à§à¦¯à¦¾à¦• à¦•à¦°à¦¾
    if (isCaptchaResolved()) {
        if (captchaResolvedAt === 0) {
            captchaResolvedAt = Date.now();
        }
    } else {
        // Captcha à¦à¦–à¦¨à§‹ resolve à¦¹à¦¯à¦¼à¦¨à¦¿, à¦°à¦¿à¦¸à§‡à¦Ÿ à¦•à¦°à§‹
        captchaResolvedAt = 0;
        return;
    }

    // Captcha resolve à¦¹à¦“à¦¯à¦¼à¦¾à¦° à¦ªà¦° 0.3 à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§‹
    const timeSinceCaptcha = Date.now() - captchaResolvedAt;
    if (timeSinceCaptcha < 300) return;

    // Check if webfile upload is enabled and mode is auto
    try {
    chrome.storage.local.get(['webfile_enabled', 'webfile_mode', 'saved_webfiles'], (res) => {
        const enabled = res.webfile_enabled !== undefined ? res.webfile_enabled : true;
        
        const files = res.saved_webfiles || [];

        // à¦¬à¦¨à§à¦§ à¦¥à¦¾à¦•à¦²à§‡ à¦¬à¦¾ Manual à¦®à§‹à¦¡à§‡ à¦•à¦¿à¦›à§ à¦•à¦°à¦¬à§‡ à¦¨à¦¾
        if (!enabled) return;
        // à¦•à§‹à¦¨à§‹ à¦«à¦¾à¦‡à¦² à¦¨à§‡à¦‡
        if (files.length === 0) return;
        // à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ à¦†à¦ªà¦²à§‹à¦¡ à¦šà¦²à¦›à§‡
        if (isUploadInProgress) return;

        // ===== à¦•à§‹à¦¨ à¦«à¦¾à¦‡à¦²à¦Ÿà¦¿ à¦†à¦ªà¦²à§‹à¦¡ à¦•à¦°à¦¤à§‡ à¦¹à¦¬à§‡ à¦¤à¦¾ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£ =====
        
        // Server error à¦¬à¦¾ Captcha error à¦¦à§‡à¦–à¦²à§‡ â€” captcha à¦°à¦¿à¦¸à§‡à¦Ÿ, à¦¨à¦¤à§à¦¨ captcha-à¦° à¦œà¦¨à§à¦¯ à¦…à¦ªà§‡à¦•à§à¦·à¦¾
        if (state.hasServerError || state.hasCaptchaError) {
            captchaResolvedAt = 0;
            return;
        }

        // "file already exists" à¦¦à§‡à¦–à¦²à§‡ â€” à¦«à¦¾à¦‡à¦² à¦†à¦¸à¦²à§‡ à¦†à¦ªà¦²à§‹à¦¡ à¦¹à¦¯à¦¼à§‡ à¦—à§‡à¦›à§‡, à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§‹
        if (state.hasFileAlreadyExists) return;

        let fileToUpload = null;

        if (state.isAskingPrimary) {
            // Primary Applicant à¦à¦° à¦«à¦¾à¦‡à¦² à¦šà¦¾à¦‡à¦›à§‡ â†’ à§§ à¦¨à¦‚ à¦«à¦¾à¦‡à¦² (index 0)
            currentWebfileIndex = 0;
            fileToUpload = files[0];
        } else if (state.isAskingOther) {
            // Other Applicant à¦à¦° à¦«à¦¾à¦‡à¦² à¦šà¦¾à¦‡à¦›à§‡ â†’ à¦ªà¦°à¦¬à¦°à§à¦¤à§€ à¦«à¦¾à¦‡à¦²
            // Primary (index 0) à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ à¦¹à¦¯à¦¼à§‡ à¦—à§‡à¦›à§‡, à¦¤à¦¾à¦‡ index 1 à¦¥à§‡à¦•à§‡ à¦¶à§à¦°à§
            if (currentWebfileIndex < 1) {
                currentWebfileIndex = 1;
            }
            
            // à¦¯à¦¦à¦¿ à¦†à¦° à¦«à¦¾à¦‡à¦² à¦¨à¦¾ à¦¥à¦¾à¦•à§‡, à¦¥à§‡à¦®à§‡ à¦¯à¦¾à¦“
            if (currentWebfileIndex >= files.length) return;
            
            fileToUpload = files[currentWebfileIndex];
        }

        if (!fileToUpload) return;

        // à¦¶à§‡à¦· à¦†à¦ªà¦²à§‹à¦¡à§‡à¦° à¦ªà¦° à¦•à¦®à¦ªà¦•à§à¦·à§‡ à§© à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦—à§à¦¯à¦¾à¦ª à¦°à¦¾à¦–à§‹
        const timeSinceLastAttempt = Date.now() - lastUploadAttemptAt;
        if (timeSinceLastAttempt < 3000) return;

        // à¦†à¦ªà¦²à§‹à¦¡ à¦•à¦°à§‹!
        isUploadInProgress = true;
        lastUploadAttemptAt = Date.now();
        
        const success = injectWebfileToPage(fileToUpload.data, fileToUpload.name);
        
        if (success) {
            emitActivity('webfile_uploaded', `Webfile আপলোড সম্পন্ন (#${currentWebfileIndex + 1})`, `${fileToUpload.name} সফলভাবে আপলোড হয়েছে`, 0, 'success');
            console.log(`[IVAC] Webfile #${currentWebfileIndex + 1} (${fileToUpload.name}) à¦†à¦ªà¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡`);
            // à¦†à¦ªà¦²à§‹à¦¡ à¦¸à¦«à¦² à¦¹à¦²à§‡ à¦ªà¦°à§‡à¦° à¦«à¦¾à¦‡à¦²à§‡à¦° à¦œà¦¨à§à¦¯ à¦ªà§à¦°à¦¸à§à¦¤à§à¦¤ à¦¹à¦“
            // à¦ªà§‡à¦œ à¦Ÿà§‡à¦•à§à¦¸à¦Ÿ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦¹à¦²à§‡ (Primary â†’ Other) à¦¤à¦–à¦¨ à¦ªà¦°à§‡à¦° à¦«à¦¾à¦‡à¦² à¦†à¦ªà¦²à§‹à¦¡ à¦¹à¦¬à§‡
            currentWebfileIndex++;
            captchaResolvedAt = 0; // à¦¨à¦¤à§à¦¨ captcha-à¦° à¦œà¦¨à§à¦¯ à¦°à¦¿à¦¸à§‡à¦Ÿ
        }
        
        // à§« à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦ªà¦° à¦†à¦ªà¦²à§‹à¦¡ à¦²à¦• à¦–à§à¦²à§‡ à¦¦à¦¾à¦“
        setTimeout(() => {
            isUploadInProgress = false;
        }, 5000);
    }); // close webfile get
    } catch(e) {} // close webfile try

    }); // close ext_enabled get
    } catch (e) {} // close outer try
}, 1000); // close setInterval

// ===== DGEPAY PAYMENT PAGE AUTOMATION =====
// checkout.dgepay.net à¦ à¦•à¦¾à¦œ à¦•à¦°à¦¬à§‡
(function() {
    if (!window.location.hostname.includes('dgepay.net')) return;

    console.log('[IVAC] dgepay à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦ªà§‡à¦œ à¦¡à¦¿à¦Ÿà§‡à¦•à§à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡!');

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
            console.log(`[IVAC] dgepay à¦•à§à¦²à¦¿à¦•: ${key}`);
            return true;
        }
        return false;
    }

    // Main dgepay automation loop
    setInterval(() => {
        if (!isLicenseValid) return;
        try {
            // Check if extension is enabled
            chrome.storage.local.get(['ext_enabled', 'payment_enabled', 'payment_mode', 'rocket_accounts', 'active_rocket_id', 'ivac_phone'], (res) => {
                if (chrome.runtime.lastError) return;
                if (res.ext_enabled === false) return;
                const paymentEnabled = res.payment_enabled !== undefined ? res.payment_enabled : true;
                if (!paymentEnabled) return;
                
                const resolved = getResolvedPaymentAccount(res);
                const isAutoPay = res.payment_mode !== 'manual';

                const pageText = document.body.innerText.toLowerCase();

                // ===== à¦§à¦¾à¦ª à§§: "Or continue without phone number" à¦•à§à¦²à¦¿à¦• =====
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
                                return; // à¦à¦‡ à¦§à¦¾à¦ª à¦¶à§‡à¦·, à¦ªà¦°à§‡à¦° loop à¦ à¦ªà¦°à§‡à¦° à¦§à¦¾à¦ª
                            }
                        }
                    }
                    
                    // If popup is gone (no "continue without phone" text), mark as done
                    if (!pageText.includes('continue without phone') && 
                        !pageText.includes('let\'s get you connected') &&
                        !pageText.includes('enter your phone number')) {
                        paymentStepDone.skipPhone = true;
                    }
                    return; // à¦ªà¦ªà¦†à¦ª à¦¥à¦¾à¦•à¦²à§‡ à¦†à¦° à¦•à¦¿à¦›à§ à¦•à¦°à¦¬à§‡ à¦¨à¦¾
                }

                // ===== à¦§à¦¾à¦ª à§¨: "Mobile Banking" à¦¸à¦¿à¦²à§‡à¦•à§à¦Ÿ à¦•à¦°à¦¾ =====
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
                            console.log('[IVAC] Mobile Banking à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ à¦¸à¦¿à¦²à§‡à¦•à§à¦Ÿ à¦•à¦°à¦¾ à¦†à¦›à§‡');
                        } else {
                            // Click the radio first, then the container
                            if (mobileBankingRadio) {
                                mobileBankingRadio.click();
                                console.log('[IVAC] Mobile Banking à¦°à§‡à¦¡à¦¿à¦“ à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡');
                            }
                            // Also click the container for good measure
                            setTimeout(() => {
                                mobileBankingContainer.click();
                                console.log('[IVAC] Mobile Banking à¦•à¦¨à§à¦Ÿà§‡à¦‡à¦¨à¦¾à¦° à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡');
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
                        console.log('[IVAC] Mobile Banking à¦¸à¦¾à¦¬-à¦…à¦ªà¦¶à¦¨ à¦¦à§‡à¦–à¦¾ à¦¯à¦¾à¦šà§à¦›à§‡, à¦¸à¦¿à¦²à§‡à¦•à§à¦Ÿ à¦¹à¦¯à¦¼à§‡ à¦—à§‡à¦›à§‡');
                    } else if (pageText.includes('rocket') && pageText.includes('nagad') && pageText.includes('cellfin')) {
                        paymentStepDone.mobileBanking = true;
                        console.log('[IVAC] Mobile Banking à¦¸à¦¿à¦²à§‡à¦•à§à¦Ÿ à¦¹à¦¯à¦¼à§‡ à¦—à§‡à¦›à§‡ (à¦Ÿà§‡à¦•à§à¦¸à¦Ÿ à¦«à¦²à¦¬à§à¦¯à¦¾à¦•)');
                    }
                }

                // ===== à¦§à¦¾à¦ª à§©: "Rocket" à¦†à¦‡à¦•à¦¨ à¦¸à¦¿à¦²à§‡à¦•à§à¦Ÿ à¦•à¦°à¦¾ =====
                if (isAutoPay && paymentStepDone.mobileBanking && !paymentStepDone.rocketSelected) {
                    // Find Rocket by text or image alt
                    const allClickable = Array.from(document.querySelectorAll('div, button, label, img, span, li'));
                    const rocketEl = allClickable.find(el => {
                        // Check for text "Rocket"
                        const text = el.textContent.trim();
                        if (text === 'Rocket' || text === 'à¦°à¦•à§‡à¦Ÿ') return true;
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

                // ===== à¦®à§à¦¯à¦¾à¦¨à§à§Ÿà¦¾à¦² à¦“ à¦…à¦Ÿà§‹ à¦‰à¦­à§Ÿ à¦®à§‹à¦¡à§‡à¦‡ Pay à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦Ÿà§à¦°à§à¦¯à¦¾à¦•à¦¿à¦‚ à¦²à¦¿à¦¸à§‡à¦¨à¦¾à¦° à¦¯à§à¦•à§à¦¤ à¦•à¦°à¦¾ =====
                if (!paymentStepDone.payListenerAttached) {
                    const allBtns = Array.from(document.querySelectorAll('button, a'));
                    const payButton = allBtns.find(btn => {
                        const text = btn.textContent.trim();
                        return (text.includes('Pay') && (text.includes('à§³') || text.includes('BDT'))) && !btn.disabled;
                    });

                    if (payButton) {
                        paymentStepDone.payListenerAttached = true;
                        payButton.addEventListener('click', () => {
                            try {
                                const amountMatch = payButton.textContent.match(/[\d,]+\.?\d*/);
                                const amount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
                                if (amount > 0 && !sessionStorage.getItem('dgpay_pay_tracked')) {
                                    sessionStorage.setItem('dgpay_pay_tracked', 'true');
                                    const detectedMethod = detectPaymentMethodOnPage();
                                    const stageToSend = detectedMethod || 'pay_clicked';
                                    sendRecordPayment({
                                        amount: amount,
                                        status: 'initiated',
                                        stage: stageToSend,
                                        rocket_account: stageToSend === 'bangla_qr' ? 'Bangla QR' : (resolved.account ? resolved.account.number : resolved.phone),
                                        description: isAutoPay ? 'Auto Pay' : 'Manual Pay'
                                    }, (d) => {
                                        if (d && d.payment_id) {
                                            chrome.storage.local.set({ current_payment_id: d.payment_id });
                                        }
                                    });
                                }
                            } catch(e) {}
                        });
                    }
                }

                // ===== à¦§à¦¾à¦ª à§ª: Auto à¦®à§‹à¦¡à§‡ "Pay" à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦…à¦Ÿà§‹à¦®à§‡à¦Ÿà¦¿à¦• à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾ =====
                if (isAutoPay && paymentStepDone.rocketSelected && !paymentStepDone.payClicked) {
                    // Wait 1.5 seconds after Rocket selection before clicking Pay
                    const timeSinceRocket = Date.now() - (dgepayClickTimes['rocket'] || 0);
                    if (timeSinceRocket < 1500) return;

                    // Find Pay button - it contains "Pay" and a à§³ amount
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    const payBtn = buttons.find(btn => {
                        const text = btn.textContent.trim();
                        return (text.includes('Pay') && (text.includes('à§³') || text.includes('BDT'))) &&
                               !btn.disabled;
                    });

                    if (payBtn) {
                        // Check button is not greyed out/loading
                        const style = window.getComputedStyle(payBtn);
                        if (style.opacity !== '0.5' && style.pointerEvents !== 'none') {
                            if (dgeSafeClick(payBtn, 'payBtn')) {
                                paymentStepDone.payClicked = true;
                                console.log('[IVAC] Pay à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡!');
                            }
                        }
                    }
                }

            });
        } catch(e) {
            // Extension context invalidated â€” silently ignore
        }
    }, 1200);

})();



// ===== REACT & FRAMEWORK COMPATIBLE INPUT SETTER =====
function setReactInputValue(element, val) {
    if (!element || val === undefined || val === null) return false;
    try {
        const strVal = String(val);
        element.focus();
        
        // 1. Get native setter from prototype
        const valueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        const setter = (valueDescriptor && valueDescriptor.set) || (prototypeValueDescriptor && prototypeValueDescriptor.set);
        
        // 2. React Value Tracker reset (Prevents React controlled component from clearing input)
        const tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue('');
        }
        
        // 3. Set value via native setter
        if (setter) {
            setter.call(element, strVal);
        } else {
            element.value = strVal;
        }
        element.setAttribute('value', strVal);
        
        // 4. Dispatch standard Input and Change events with bubbles: true for React/Angular/Vue
        element.dispatchEvent(new InputEvent('input', { data: strVal, inputType: 'insertText', bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        
        return true;
    } catch (e) {
        console.error('[IVAC] Error setting React input value:', e);
        try {
            element.value = String(val);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch(e2) {
            return false;
        }
    }
}

function fillMultiBoxInputs(inputs, text) {
    if (!inputs || inputs.length === 0 || !text) return false;
    const str = String(text);
    const count = Math.min(inputs.length, str.length);
    for (let i = 0; i < count; i++) {
        const inp = inputs[i];
        const char = str[i];
        if (inp.value !== char) {
            setReactInputValue(inp, char);
        }
    }
    return true;
}

function triggerElementClick(element) {
    if (!element) return false;
    try {
        element.focus();
        element.click();
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
    } catch(e) {
        try {
            element.click();
            return true;
        } catch(e2) {
            return false;
        }
    }
}

// Helper to get active payment account & fallback number
function getResolvedPaymentAccount(res) {
    const rocketAccounts = res.rocket_accounts || [];
    let activeAccount = rocketAccounts.find(a => a.id === res.active_rocket_id);
    if (!activeAccount && rocketAccounts.length > 0) {
        activeAccount = rocketAccounts[0];
    }
    
    let rawNum = activeAccount ? (activeAccount.number || '') : '';
    if (!rawNum && res.ivac_phone) {
        rawNum = res.ivac_phone;
    }
    const phone = rawNum.replace(/[^0-9]/g, '').substring(0, 11);
    
    const paymentMethods = res.payment_methods || {};
    const method = activeAccount ? (paymentMethods[activeAccount.id] || 'rocket') : 'rocket';
    
    return {
        account: activeAccount,
        phone: phone,
        method: method,
        rocket_extra: activeAccount ? (activeAccount.rocket_extra || '') : '',
        rocket_pin: activeAccount ? (activeAccount.rocket_pin || activeAccount.pin || '') : '',
        nagad_pin: activeAccount ? (activeAccount.nagad_pin || activeAccount.pin || '') : '',
        bkash_pin: activeAccount ? (activeAccount.bkash_pin || activeAccount.pin || '') : ''
    };
}

// ===== DBBL NEXUS GATEWAY AUTOMATION (ROCKET) =====
// ecom1.dutchbanglabank.com à¦¬à¦¾ dutchbanglabank.com à¦ à¦•à¦¾à¦œ à¦•à¦°à¦¬à§‡ (à¦¶à§à¦§à§ Rocket)
(function() {
    if (!window.location.hostname.includes('dutchbanglabank.com')) return;

    console.log('[IVAC] DBBL Nexus Gateway à¦¡à¦¿à¦Ÿà§‡à¦•à§à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡!');

    let dbblClickTimes = {};
    let dbblTrackedStage = null;
    let dbblTrackedError = false;

    function dbblSafeClick(element, key) {
        const now = Date.now();
        if (!dbblClickTimes[key] || now - dbblClickTimes[key] > 1500) {
            triggerElementClick(element);
            dbblClickTimes[key] = now;
            console.log(`[IVAC] DBBL à¦•à§à¦²à¦¿à¦•: ${key}`);
            return true;
        }
        return false;
    }

    function findDbblGoBtn() {
        return Array.from(document.querySelectorAll('input, button, a')).find(el => {
            const type = (el.type || '').toLowerCase();
            if (type === 'hidden' || el.style.display === 'none') return false;
            const src = (el.src || '').toLowerCase();
            const alt = (el.alt || '').toLowerCase();
            const val = (el.value || el.textContent || el.name || el.id || '').toLowerCase();
            return src.includes('btn_go') || src.includes('go.gif') || src.includes('go') || alt.includes('otp') || val === 'go' || val.includes('verify') || val.includes('submit');
        });
    }

    function setDbblInputValue(element, val) {
        if (!element || val === undefined || val === null) return;
        const strVal = String(val).trim();
        element.focus();
        element.value = strVal;
        try {
            const proto = Object.getPrototypeOf(element);
            const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (desc && desc.set) {
                if (element._valueTracker) element._valueTracker.setValue('');
                desc.set.call(element, strVal);
            }
        } catch(e) {}
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setInterval(() => {
        try {
            chrome.storage.local.get(['ext_enabled', 'rocket_accounts', 'active_rocket_id', 'payment_enabled', 'ivac_phone'], (res) => {
                if (chrome.runtime.lastError) return;
                if (res.ext_enabled === false) return;
                const paymentEnabled = res.payment_enabled !== undefined ? res.payment_enabled : true;
                if (!paymentEnabled) return;

                const resolved = getResolvedPaymentAccount(res);
                
                // Build all candidate phones dynamically
                const candidatePhones = [];
                if (resolved.phone) candidatePhones.push(resolved.phone);
                (res.rocket_accounts || []).forEach(acc => {
                    if (acc && acc.number) {
                        const p = acc.number.replace(/[^0-9]/g, '').substring(0, 11);
                        if (p && !candidatePhones.includes(p)) candidatePhones.push(p);
                    }
                });
                if (res.ivac_phone) {
                    const p = res.ivac_phone.replace(/[^0-9]/g, '').substring(0, 11);
                    if (p && !candidatePhones.includes(p)) candidatePhones.push(p);
                }

                // Rocket à¦¨à¦®à§à¦¬à¦°: 11 à¦¡à¦¿à¦œà¦¿à¦Ÿ à¦®à§‹à¦¬à¦¾à¦‡à¦² + 1 à¦¡à¦¿à¦œà¦¿à¦Ÿ à¦à¦•à§à¦¸à¦Ÿà§à¦°à¦¾ = à§§à§¨ à¦¡à¦¿à¦œà¦¿à¦Ÿ
                let rocketFullNumber = resolved.phone;
                if (resolved.rocket_extra) {
                    rocketFullNumber = rocketFullNumber + String(resolved.rocket_extra).replace(/[^0-9]/g, '');
                }

                const pageText = (document.body.innerText || '').toLowerCase();

                // ===== ERROR DETECTION =====
                if (!dbblTrackedError) {
                    const errorKeywords = ['invalid pin', 'insufficient balance', 'invalid account', 'transaction failed', 'exceed', 'system error', 'timed out', 'declined', 'cancelled'];
                    const hasError = errorKeywords.some(kw => pageText.includes(kw));
                    if (hasError) {
                        dbblTrackedError = true;
                        let amount = 0;
                        const amountMatch = pageText.match(/amount[\s:]*([\d,]+\.?\d*)/i);
                        if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                        
                        sendRecordPayment({
                            amount: amount,
                            status: 'failed',
                            stage: 'failed_on_dbbl',
                            rocket_account: resolved.phone || candidatePhones[0] || '',
                            description: 'DBBL Gateway Error'
                        });
                        console.log('[IVAC] DBBL Error detected & recorded: ' + amount);
                    }
                }
                
                // ===== AMOUNT PARSING & TRACKING (Page 1) =====
                if (pageText.includes('mobile account information') || pageText.includes('mobile account') || pageText.includes('rocket account')) {
                    sessionStorage.removeItem('dbbl_otp_page_entered_at');
                    sessionStorage.removeItem('dbbl_last_submitted_otp');

                    if (dbblTrackedStage !== 'account_submitted') {
                        let amount = 0;
                        const amountMatch = pageText.match(/amount[\s:]*([\d,]+\.?\d*)/i);
                        if (amountMatch) {
                            amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                        }
                        
                        if (amount >= 0) {
                            dbblTrackedStage = 'rocket';
                            sendRecordPayment({
                                amount: amount,
                                status: 'initiated',
                                stage: 'rocket',
                                rocket_account: resolved.phone || candidatePhones[0] || '',
                                description: ''
                            }, (d) => {
                                if (d && d.payment_id) {
                                    chrome.storage.local.set({ current_payment_id: d.payment_id });
                                }
                            });
                            console.log('[IVAC] DBBL Amount Extracted: ' + amount);
                        }
                    }
                }

                // ===== à¦ªà§‡à¦œ à§§: Mobile Account Information (12-digit Account + PIN + Submit) =====
                if (pageText.includes('mobile account information') || pageText.includes('mobile account') || pageText.includes('rocket account')) {
                    const allVisibleInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])')).filter(inp => {
                        const rect = inp.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && !inp.disabled;
                    });
                    
                    let accountInput = null;
                    let pinInput = null;

                    allVisibleInputs.forEach(inp => {
                        const name = (inp.name || '').toLowerCase();
                        const id = (inp.id || '').toLowerCase();
                        if (name.includes('account') || name.includes('mobile') || name.includes('msisdn') || id.includes('msisdn') || id.includes('account')) {
                            accountInput = inp;
                        }
                        if (name.includes('pin') || id.includes('pin') || inp.type === 'password') {
                            pinInput = inp;
                        }
                    });

                    if (!accountInput || !pinInput) {
                        for (const inp of allVisibleInputs) {
                            const parentText = (inp.parentElement?.innerText || inp.parentElement?.parentElement?.innerText || '').toLowerCase();
                            if (!accountInput && (parentText.includes('account') || parentText.includes('mobile'))) {
                                accountInput = inp;
                            } else if (!pinInput && parentText.includes('pin')) {
                                pinInput = inp;
                            }
                        }
                    }

                    if (!accountInput && allVisibleInputs.length >= 1) {
                        accountInput = allVisibleInputs[0];
                    }
                    if (!pinInput && allVisibleInputs.length >= 2) {
                        const possiblePin = allVisibleInputs.find(i => i !== accountInput && i.type === 'password');
                        pinInput = possiblePin || allVisibleInputs.find(i => i !== accountInput);
                    }

                    if (accountInput && pinInput && accountInput === pinInput) {
                        pinInput = null; 
                    }

                    // Account à¦«à¦¿à¦² à¦•à¦°à§‹ (Rocket = à§§à§¨ à¦¡à¦¿à¦œà¦¿à¦Ÿà§‡à¦° à¦«à§à¦² à¦¨à¦®à§à¦¬à¦°)
                    if (accountInput && accountInput.value !== rocketFullNumber && rocketFullNumber) {
                        setDbblInputValue(accountInput, rocketFullNumber);
                        console.log(`[IVAC] Rocket Account (12 digits) à¦¬à¦¸à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡: ${rocketFullNumber}`);
                    }

                    // PIN à¦«à¦¿à¦² à¦•à¦°à§‹ (Rocket PIN)
                    const rocketPin = resolved.rocket_pin;
                    if (pinInput && pinInput.value !== rocketPin && rocketPin) {
                        setDbblInputValue(pinInput, rocketPin);
                        console.log('[IVAC] Rocket PIN à¦¬à¦¸à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡');
                    }

                    // Account + PIN à¦¦à§à¦Ÿà§‹à¦‡ à¦«à¦¿à¦² à¦¹à¦²à§‡ SUBMIT à¦•à§à¦²à¦¿à¦• à¦•à¦°à§‹
                    if (accountInput && pinInput && accountInput.value.length >= 11 && pinInput.value.length >= 4) {
                        const submitBtn = Array.from(document.querySelectorAll('input[type="submit"], button, input[type="image"], a, #pay')).find(el => {
                            if (el.id === 'pay' || (el.className && typeof el.className === 'string' && el.className.includes('subBtn'))) return true;
                            if (el.type === 'submit') return true;
                            const val = (el.value || el.textContent || el.alt || el.name || el.id || el.src || '').toLowerCase();
                            return val.includes('submit') || val === 'pay';
                        });
                        
                        if (submitBtn) {
                            dbblSafeClick(submitBtn, 'submit');
                        }
                    }
                }

                // ===== à¦ªà§‡à¦œ à§¨: OTP (One Time Password) =====
                if (pageText.includes('otp') || pageText.includes('one time password') || pageText.includes('security code')) {
                    // OTP à¦ªà§‡à¦œà§‡ à¦†à¦¸à¦¾à¦° à¦Ÿà¦¾à¦‡à¦® à¦°à§‡à¦•à¦°à§à¦¡ à¦•à¦°à¦¾ (à§§à§© à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à¦¾à¦° à¦œà¦¨à§à¦¯)
                    let otpEnteredAt = sessionStorage.getItem('dbbl_otp_page_entered_at');
                    if (!otpEnteredAt) {
                        otpEnteredAt = Date.now().toString();
                        sessionStorage.setItem('dbbl_otp_page_entered_at', otpEnteredAt);
                        console.log('[IVAC] DBBL OTP à¦ªà§‡à¦œà§‡ à¦ªà§à¦°à¦¬à§‡à¦¶ à¦•à¦°à§‡à¦›à§‡à¥¤ à§§à§© à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦¶à§à¦°à§...');
                    }

                    const elapsedMs = Date.now() - parseInt(otpEnteredAt, 10);
                    if (elapsedMs < 13000) {
                        // à§§à§© à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦ªà§‚à¦°à¦£ à¦¨à¦¾ à¦¹à¦“à§Ÿà¦¾ à¦ªà¦°à§à¦¯à¦¨à§à¦¤ à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à¦¬à§‡
                        return;
                    }

                    const allInputs = Array.from(document.querySelectorAll('input'));
                    const otpInput = allInputs.find(inp => {
                        if (inp.type === 'hidden' || inp.type === 'submit' || inp.type === 'image' || inp.type === 'button') return false;
                        const name = (inp.name || '').toLowerCase();
                        const id = (inp.id || '').toLowerCase();
                        const type = (inp.type || '').toLowerCase();
                        return name.includes('otp') || id.includes('otp') || type === 'password' || type === 'text' || type === 'tel' || type === 'number';
                    }) || allInputs.find(inp => inp.type !== 'hidden' && inp.type !== 'submit' && inp.type !== 'image');
                    
                    if (otpInput) {
                        // à§ª à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦ªà¦¾à¦° à¦¹à¦“à§Ÿà¦¾à¦° à¦ªà¦°: à¦à¦•à¦¦à¦® à¦²à§‡à¦Ÿà§‡à¦¸à§à¦Ÿ OTP à¦¦à¦¿à§Ÿà§‡ à¦®à¦¾à¦¤à§à¦° à§§ à¦¬à¦¾à¦° à¦Ÿà§à¦°à¦¾à¦‡ à¦•à¦°à¦¬à§‡ (used à¦¹à§‹à¦• à¦†à¦° unused à¦¯à¦¾à¦‡ à¦¹à§‹à¦•)
                        (async () => {
                            try {
                                for (const ph of candidatePhones) {
                                    const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'fetchOtp', phone: ph, source: 'R' }, r));
                                    if (d && d.success && d.data && d.data.otp_string) {
                                        const incomingOtp = d.data.otp_string;
                                        const lastSubmittedOtp = sessionStorage.getItem('dbbl_last_submitted_otp');

                                        // à¦à¦‡ à¦“à¦Ÿà¦¿à¦ªà¦¿ à¦•à§‹à¦¡ à¦¦à¦¿à§Ÿà§‡ à¦…à¦²à¦°à§‡à¦¡à¦¿ à¦à¦•à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à¦¾ à¦¹à§Ÿà§‡ à¦¥à¦¾à¦•à¦²à§‡ à§¨à§Ÿ à¦¬à¦¾à¦° à¦†à¦° à¦Ÿà§à¦°à¦¾à¦‡ à¦•à¦°à¦¬à§‡ à¦¨à¦¾!
                                        if (lastSubmittedOtp === incomingOtp) {
                                            continue;
                                        }

                                        // à¦à¦•à¦¦à¦® à¦²à§‡à¦Ÿà§‡à¦¸à§à¦Ÿ à¦“à¦Ÿà¦¿à¦ªà¦¿ à¦¬à¦¸à¦¾à¦“
                                        if (otpInput.value !== incomingOtp) {
                                            setDbblInputValue(otpInput, incomingOtp);
                                            console.log(`[IVAC] DBBL Rocket Latest OTP à¦‡à¦¨à¦ªà§à¦Ÿà§‡ à¦¬à¦¸à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡ (à§ª à¦¸à§‡à¦•à§‡à¦¨à§à¦¡ à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦¶à§‡à¦·à§‡ à§§ à¦¬à¦¾à¦° à¦Ÿà§à¦°à¦¾à¦‡): ${incomingOtp}`);
                                        }

                                        // à¦à¦‡ à¦•à§‹à¦¡à¦Ÿà¦¿à¦° à¦œà¦¨à§à¦¯ à¦¸à¦¾à¦¬à¦®à¦¿à¦¶à¦¨ à¦²à¦• à¦•à¦°à§‹ à¦¯à§‡à¦¨ à¦à¦•à¦‡ à¦•à§‹à¦¡ à¦¦à¦¿à§Ÿà§‡ à§¨à§Ÿ à¦¬à¦¾à¦° à¦Ÿà§à¦°à¦¾à¦‡ à¦¨à¦¾ à¦•à¦°à§‡
                                        sessionStorage.setItem('dbbl_last_submitted_otp', incomingOtp);

                                        const goBtn = findDbblGoBtn();
                                        if (goBtn) {
                                            const delay = Math.floor(Math.random() * 300) + 150;
                                            setTimeout(() => {
                                                triggerElementClick(goBtn);
                                                console.log(`[IVAC] DBBL Go à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡ (${delay}ms) OTP: ${incomingOtp}`);
                                            }, delay);
                                        }
                                        break; // à¦²à§‡à¦Ÿà§‡à¦¸à§à¦Ÿ à¦“à¦Ÿà¦¿à¦ªà¦¿ à¦¦à¦¿à§Ÿà§‡ à§§ à¦¬à¦¾à¦° à¦Ÿà§à¦°à¦¾à¦‡ à¦¸à¦®à§à¦ªà¦¨à§à¦¨
                                    }
                                }
                            } catch(e) {}
                        })();

                        // Fallback manual fill check
                        if (otpInput.value && otpInput.value.length >= 4) {
                            const lastSubmittedOtp = sessionStorage.getItem('dbbl_last_submitted_otp');
                            if (lastSubmittedOtp !== otpInput.value) {
                                sessionStorage.setItem('dbbl_last_submitted_otp', otpInput.value);
                                const goBtn = findDbblGoBtn();
                                if (goBtn) {
                                    triggerElementClick(goBtn);
                                }
                            }
                        }
                    }
                }
            });
        } catch(e) {}
    }, 300);

})();

// ===== NAGAD PAYMENT GATEWAY AUTOMATION =====
(function() {
    if (!window.location.hostname.includes('mynagad.com') && !window.location.hostname.includes('nagad.com')) return;
    
    console.log('[IVAC] Nagad Payment Gateway à¦¡à¦¿à¦Ÿà§‡à¦•à§à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡!');
    // autoSwitchProfile disabled to respect profile selection
    
    let nagadClickTimes = {};
    let nagadOtpPolling = null;
    let nagadTrackedInitiated = false;
    
    function nagadSafeClick(element, key) {
        const now = Date.now();
        if (!nagadClickTimes[key] || now - nagadClickTimes[key] > 2000) {
            triggerElementClick(element);
            nagadClickTimes[key] = now;
            console.log(`[IVAC] Nagad à¦•à§à¦²à¦¿à¦•: ${key}`);
            return true;
        }
        return false;
    }
    
    setInterval(() => {
        try {
            chrome.storage.local.get(['ext_enabled', 'rocket_accounts', 'active_rocket_id', 'payment_enabled', 'ivac_phone'], (res) => {
                if (chrome.runtime.lastError) return;
                if (res.ext_enabled === false) return;
                const paymentEnabled = res.payment_enabled !== undefined ? res.payment_enabled : true;
                if (!paymentEnabled) return;
                
                const resolved = getResolvedPaymentAccount(res);
                const nagadNumber = resolved.phone;
                const nagadPin = resolved.nagad_pin;
                if (!nagadNumber || nagadNumber.length < 11) return;

                const pageText = (document.body.innerText || '').toLowerCase();
                
                if (!nagadTrackedInitiated && !sessionStorage.getItem('nagad_tracked_init')) {
                    try {
                        const amountText = Array.from(document.querySelectorAll('*')).map(el => el.textContent).join(' ');
                        const amountMatch = amountText.match(/(?:Total Amount: BDT|amount:?|\u09F3|Tk\.?|BDT)\s*([\d,]+\.?\d*)/i);
                        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
                        if (amount >= 0) {
                            nagadTrackedInitiated = true;
                            sessionStorage.setItem('nagad_tracked_init', 'true');
                            sendRecordPayment({
                                amount: amount,
                                status: 'initiated',
                                stage: 'nagad',
                                rocket_account: nagadNumber,
                                description: ''
                            }, (d) => {
                                if (d && d.payment_id) {
                                    chrome.storage.local.set({ current_payment_id: d.payment_id });
                                }
                            });
                        }
                    } catch(e) {}
                }

                // Identify Page Context
                const isPinPage = pageText.includes('enter pin') || pageText.includes('nagad pin') || (pageText.includes('pin') && !pageText.includes('account number') && !pageText.includes('verification'));
                const isOtpPage = !isPinPage && (pageText.includes('verification code') || pageText.includes('otp') || pageText.includes('security code'));
                const isAccountPage = !isPinPage && !isOtpPage && (pageText.includes('nagad account number') || pageText.includes('account number') || pageText.includes('mobile number') || pageText.includes('your nagad') || pageText.includes('proceed') || pageText.includes('terms and conditions'));
                
                // ===== à¦¸à§à¦Ÿà§‡à¦ª à§§: Nagad Account Number (à§§à§§ à¦¡à¦¿à¦œà¦¿à¦Ÿ) à¦«à¦¿à¦² à¦•à¦°à§‹ =====
                if (isAccountPage && nagadNumber) {
                    const visibleInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])')).filter(inp => {
                        const rect = inp.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && !inp.disabled;
                    });
                    
                    let allFilled = false;
                    if (visibleInputs.length >= 11) {
                        fillMultiBoxInputs(visibleInputs, nagadNumber);
                        const filledCount = visibleInputs.slice(0, 11).filter(inp => inp.value && inp.value.length === 1).length;
                        if (filledCount === 11) allFilled = true;
                    } else if (visibleInputs.length > 0) {
                        const inp = visibleInputs.find(i => (i.placeholder||'').toLowerCase().includes('account') || (i.name||'').toLowerCase().includes('account') || (i.id||'').toLowerCase().includes('account')) || visibleInputs[0];
                        if (inp) {
                            if (inp.value !== nagadNumber) {
                                setReactInputValue(inp, nagadNumber);
                            }
                            if (inp.value === nagadNumber) allFilled = true;
                        }
                    }
                    
                    // Click Proceed when all 11 digits are filled
                    if (allFilled) {
                        const proceedBtn = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"]')).find(el => {
                            const text = (el.textContent || el.value || '').toLowerCase().trim();
                            return (text === 'proceed' || text.includes('proceed') || text === 'pay') && !el.disabled;
                        });
                        if (proceedBtn) {
                            nagadSafeClick(proceedBtn, 'proceed');
                        }
                    }
                }
                
                // ===== à¦¸à§à¦Ÿà§‡à¦ª à§©: OTP à¦«à¦¿à¦² (OTP à¦ªà§‡à¦œà§‡) =====
                if (isOtpPage) {
                    const otpInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])')).filter(inp => {
                        const rect = inp.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && !inp.disabled;
                    });
                    
                    if (otpInputs.length > 0 && !nagadOtpPolling) {
                        nagadOtpPolling = setInterval(async () => {
                            try {
                                const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'fetchOtp', phone: nagadNumber, source: 'N' }, r));
                                if (d && d.success && d.data && !d.data.used) {
                                    const otp = d.data.otp_string;
                                    const currentOtpInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])')).filter(inp => {
                                        const rect = inp.getBoundingClientRect();
                                        return rect.width > 0 && rect.height > 0 && !inp.disabled;
                                    });
                                    
                                    if (currentOtpInputs.length >= 4) {
                                        fillMultiBoxInputs(currentOtpInputs, otp);
                                    } else if (currentOtpInputs.length === 1) {
                                        setReactInputValue(currentOtpInputs[0], otp);
                                    }
                                    
                                    clearInterval(nagadOtpPolling);
                                    nagadOtpPolling = null;
                                    console.log(`[IVAC] Nagad OTP à¦¬à¦¸à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡: ${otp}`);
                                    chrome.runtime.sendMessage({ action: 'markUsed', phone: nagadNumber, source: 'N' });
                                    
                                    setTimeout(() => {
                                        const proceedBtn = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"]')).find(el => {
                                            const text = (el.textContent || el.value || '').toLowerCase().trim();
                                            return (text === 'proceed' || text.includes('proceed') || text === 'confirm' || text === 'submit') && !el.disabled;
                                        });
                                        if (proceedBtn) nagadSafeClick(proceedBtn, 'otpProceed');
                                    }, 500);
                                }
                            } catch(e) {}
                        }, 1000);
                    }
                }
                
                // ===== à¦¸à§à¦Ÿà§‡à¦ª à§ª: PIN à¦«à¦¿à¦² (PIN à¦ªà§‡à¦œà§‡) =====
                if (isPinPage && nagadPin) {
                    const pinInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])')).filter(inp => {
                        const rect = inp.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && !inp.disabled;
                    });
                    
                    if (pinInputs.length >= 4) {
                        fillMultiBoxInputs(pinInputs, nagadPin);
                    } else if (pinInputs.length >= 1 && pinInputs[0].value !== nagadPin) {
                        setReactInputValue(pinInputs[0], nagadPin);
                    }
                    
                    // Click proceed after pin
                    const confirmBtn = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"]')).find(el => {
                        const text = (el.textContent || el.value || '').toLowerCase().trim();
                        return (text === 'proceed' || text.includes('proceed') || text.includes('submit') || text.includes('pay') || text === 'confirm') && !el.disabled;
                    });
                    if (confirmBtn) {
                        nagadSafeClick(confirmBtn, 'pinConfirm');
                    }
                }
            });
        } catch(e) {}
    }, 300);
})();

// ===== BKASH PAYMENT GATEWAY AUTOMATION (NATIVE MAIN WORLD + SCRIPTING + DOM CLICK) =====
(function() {
    if (!window.location.hostname.includes('bkash.com') && 
        !window.location.hostname.includes('bkash') && 
        !window.location.hostname.includes('bka.sh')) return;
    
    let bkashTrackedInitiated = false;
    
    console.log('[IVAC] bKash Payment Gateway à¦¡à¦¿à¦Ÿà§‡à¦•à§à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡! (v4.0.1 Ultimate)');
    
    let lastConfirmClickTime = 0;

    function getVisibleInputs() {
        return Array.from(document.querySelectorAll('input')).filter(inp => {
            if (inp.type === 'hidden' || inp.type === 'submit' || inp.type === 'button' || inp.type === 'image' || inp.type === 'checkbox' || inp.type === 'radio') return false;
            const rect = inp.getBoundingClientRect();
            const style = window.getComputedStyle(inp);
            return rect.width > 30 && rect.height > 15 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && !inp.disabled;
        });
    }

    function setBkashValue(inputEl, val) {
        if (!inputEl || !val) return false;
        const strVal = String(val).trim();
        
        try {
            inputEl.focus();
            
            // 1. Prototype setter + value tracker reset (Vue / React compatibility)
            const proto = Object.getPrototypeOf(inputEl);
            const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            if (desc && desc.set) {
                if (inputEl._valueTracker) inputEl._valueTracker.setValue('');
                desc.set.call(inputEl, strVal);
            } else {
                inputEl.value = strVal;
            }
            inputEl.setAttribute('value', strVal);
            
            // 2. Try execCommand insertText
            try {
                inputEl.select();
                document.execCommand('insertText', false, strVal);
            } catch(e) {}
            
            // 3. Dispatch standard Input and Change events for Vue v-model
            inputEl.dispatchEvent(new Event('focus', { bubbles: true, composed: true }));
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: strVal, composed: true }));
            inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: strVal.slice(-1), composed: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            
            return inputEl.value === strVal;
        } catch (e) {
            inputEl.value = strVal;
            return true;
        }
    }

    function triggerBkashConfirm(mainInput) {
        // 1. Signal Main World actor in inject.js (Native MV3 MAIN world script)
        try {
            window.postMessage({ type: 'IVAC_CLICK_BKASH_CONFIRM' }, '*');
            window.dispatchEvent(new CustomEvent('IVAC_CLICK_BKASH_CONFIRM_EVENT'));
        } catch(e) {}

        // 2. Ask background.js to execute MAIN world script injection
        try {
            chrome.runtime.sendMessage({ action: 'executeMainWorldClick' });
        } catch(e) {}

        // 3. Keyboard Enter on input with composed: true
        if (mainInput) {
            try {
                mainInput.focus();
                ['keydown', 'keypress', 'keyup'].forEach(t => {
                    mainInput.dispatchEvent(new KeyboardEvent(t, {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    }));
                });
            } catch(e) {}
        }

        // 4. Direct DOM Click with composed: true
        const btn = document.querySelector('button.btn-group__btn-confirm') || 
                    document.querySelector('button.btn-active') || 
                    document.querySelector('.btn-group button:last-child') || 
                    document.querySelector('button[class*="btn-confirm"]') || 
                    document.getElementById('submit_action') || document.getElementById('confirmBtn');
        
        if (btn) {
            btn.focus();
            ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evtType => {
                btn.dispatchEvent(new MouseEvent(evtType, {
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
            });
            btn.click();
        }
        
        console.log('[IVAC] bKash Confirm à¦Ÿà§à¦°à¦¿à¦—à¦¾à¦° à¦¸à¦®à§à¦ªà¦¨à§à¦¨!');
        return true;
    }

    // Main loop (runs every 180ms)
    setInterval(() => {
        try {
            chrome.storage.local.get(['ext_enabled', 'rocket_accounts', 'active_rocket_id', 'payment_enabled', 'ivac_phone'], (res) => {
                if (chrome.runtime.lastError || res.ext_enabled === false) return;
                const paymentEnabled = res.payment_enabled !== undefined ? res.payment_enabled : true;
                if (!paymentEnabled) return;

                const resolved = getResolvedPaymentAccount(res);
                const bkashNumber = resolved.phone;
                const bkashPin = resolved.bkash_pin;
                if (!bkashNumber || bkashNumber.length < 11) return;

                const visibleInputs = getVisibleInputs();
                if (visibleInputs.length === 0) return; // Loading state

                const mainInput = visibleInputs[0];
                const pageText = (document.body.innerText || '').toLowerCase();
                const now = Date.now();

                if (!bkashTrackedInitiated && !sessionStorage.getItem('bkash_tracked_init')) {
                    try {
                        const amountText = Array.from(document.querySelectorAll('*')).map(el => el.textContent).join(' ');
                        const amountMatch = (document.body.innerText || '').match(/(?:\u09F3|Tk\.?|BDT|Amount:?)\s*([\d,]+\.?\d*)/i) || amountText.match(/(?:\u09F3|Tk\.?|BDT|Amount:?)\s*([\d,]+\.?\d*)/i);
                        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
                        if (amount >= 0) {
                            bkashTrackedInitiated = true;
                            sessionStorage.setItem('bkash_tracked_init', 'true');
                            sendRecordPayment({
                                amount: amount,
                                status: 'initiated',
                                stage: 'bkash',
                                rocket_account: bkashNumber,
                                description: ''
                            }, (d) => {
                                if (d && d.payment_id) {
                                    chrome.storage.local.set({ current_payment_id: d.payment_id });
                                }
                            });
                        }
                    } catch(e) {}
                }

                // 1. PIN Step Detection
                const isPinStep = mainInput.type === 'password' || pageText.includes('enter pin') || pageText.includes('bkash pin') || (pageText.includes('pin') && !pageText.includes('verification'));

                // 2. OTP Step Detection
                const isOtpStep = !isPinStep && (pageText.includes('verification') || pageText.includes('digit code') || pageText.includes('resend code') || (mainInput.placeholder || '').toLowerCase().includes('digit') || (mainInput.placeholder || '').toLowerCase().includes('code'));

                // 3. Account Step Detection
                const isAccountStep = !isPinStep && !isOtpStep;

                // ===== STEP 1: Account Number =====
                if (isAccountStep && bkashNumber) {
                    if (mainInput.value !== bkashNumber) {
                        setBkashValue(mainInput, bkashNumber);
                        console.log('[IVAC] bKash à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¨à¦®à§à¦¬à¦° à¦¬à¦¸à¦¾à¦¨à§‹ à¦¹à§Ÿà§‡à¦›à§‡:', bkashNumber);
                    }
                    if (mainInput.value === bkashNumber && now - lastConfirmClickTime > 400) {
                        triggerBkashConfirm(mainInput);
                        lastConfirmClickTime = now;
                    }
                }

                // ===== STEP 2: OTP Verification =====
                if (isOtpStep) {
                    // Fetch latest OTP for bkash number
                    chrome.runtime.sendMessage({ action: 'fetchOtp', phone: bkashNumber, source: 'B' }, (d) => {
                        if (d && d.success && d.data && d.data.otp_string) {
                            const otp = d.data.otp_string;
                            if (mainInput.value !== otp) {
                                setBkashValue(mainInput, otp);
                                console.log('[IVAC] bKash OTP à¦¬à¦¸à¦¾à¦¨à§‹ à¦¹à§Ÿà§‡à¦›à§‡:', otp);
                                chrome.runtime.sendMessage({ action: 'markUsed', phone: bkashNumber, source: 'B' });
                            }
                        }
                    });

                    // If OTP is entered in the box, trigger Confirm
                    if (mainInput.value && mainInput.value.length >= 4 && now - lastConfirmClickTime > 400) {
                        triggerBkashConfirm(mainInput);
                        lastConfirmClickTime = now;
                    }
                }

                // ===== STEP 3: PIN Step =====
                if (isPinStep && bkashPin) {
                    if (mainInput.value !== bkashPin) {
                        setBkashValue(mainInput, bkashPin);
                        console.log('[IVAC] bKash PIN à¦¬à¦¸à¦¾à¦¨à§‹ à¦¹à§Ÿà§‡à¦›à§‡!');
                    }
                    if (mainInput.value === bkashPin && now - lastConfirmClickTime > 400) {
                        triggerBkashConfirm(mainInput);
                        lastConfirmClickTime = now;
                    }
                }
            });
        } catch(e) {}
    }, 180);
})();



