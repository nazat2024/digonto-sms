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
                    emitActivity('tab_presence', 'Extension সক্রিয় (Active)', 'ব্রাউজার প্রোফাইল ও এক্সটেনশন চালু আছে', 0, 'success', { off_source: 'tab_presence' });
                }
            }
            // Profile activity heartbeat is managed centrally by background.js (sendProfileHeartbeat)
        });
    } catch(e) {}
}
initProfileIdentity();

// ===== ZERO-SLEEP SERVICE WORKER KEEP-ALIVE PORT =====
let keepAlivePort = null;
function maintainHotAwakePort() {
    try {
        if (chrome.runtime && typeof chrome.runtime.connect === 'function') {
            keepAlivePort = chrome.runtime.connect({ name: 'keepAlive_hotAwake' });
            keepAlivePort.onDisconnect.addListener(() => {
                keepAlivePort = null;
                setTimeout(maintainHotAwakePort, 2000);
            });
        }
    } catch (e) {
        setTimeout(maintainHotAwakePort, 4000);
    }
}
maintainHotAwakePort();
setInterval(() => {
    try {
        if (keepAlivePort) {
            keepAlivePort.disconnect();
            keepAlivePort = null;
        }
        maintainHotAwakePort();
    } catch(e) {}
}, 240000);

function sendRecordPayment(paymentData, callback) {
    chrome.storage.local.get([
        'current_payment_session_id',
        'session_start_time',
        'last_amount_1',
        'last_amount_2',
        'last_amount_1_time',
        'last_amount_2_time',
        'profile_id',
        'profile_label',
        'ivac_phone'
    ], (st) => {
        const now = Date.now();
        const profId = (currentProfileId || st.profile_id || 'prof_default').replace(/[^a-zA-Z0-9_]/g, '');
        const phone = st.ivac_phone || '';
        let profLabel = currentProfileLabel || st.profile_label;
        if (!profLabel || profLabel === 'Profile' || profLabel.startsWith('Profile #')) {
            if (phone) profLabel = `Profile (${phone})`;
            else profLabel = `Profile #${profId.slice(-4)}`;
        }

        // 10-minute active payment session window across all steps
        let sessionId = (paymentData && paymentData.payment_session_id) || st.current_payment_session_id;
        const isSessionValid = sessionId && st.session_start_time && (now - st.session_start_time < 10 * 60 * 1000);
        if (!isSessionValid || !sessionId) {
            sessionId = `pay_${profId}_${now}`;
            chrome.storage.local.set({
                current_payment_session_id: sessionId,
                session_start_time: now
            });
        }

        // Amount 1: explicit > storage (within 10 mins) > 0
        let amt1 = 0;
        if (paymentData && paymentData.amount_1) {
            amt1 = parseFloat(paymentData.amount_1);
        } else if (st.last_amount_1 && (!st.last_amount_1_time || now - st.last_amount_1_time < 10 * 60 * 1000)) {
            amt1 = parseFloat(st.last_amount_1);
        }

        // Amount 2: explicit > storage (within 10 mins) > 0
        let amt2 = 0;
        if (paymentData && paymentData.amount_2) {
            amt2 = parseFloat(paymentData.amount_2);
        } else if (st.last_amount_2 && (!st.last_amount_2_time || now - st.last_amount_2_time < 10 * 60 * 1000)) {
            amt2 = parseFloat(st.last_amount_2);
        }

        // Amount 3: explicit in paymentData (amount_3 or amount) > 0
        let amt3 = (paymentData && (paymentData.amount_3 || paymentData.amount)) ? parseFloat(paymentData.amount_3 || paymentData.amount) : 0;

        // Persist newly provided amounts to storage so subsequent stages inherit them
        const toStore = {};
        if (amt1 > 0 && amt1 !== st.last_amount_1) {
            toStore.last_amount_1 = amt1;
            toStore.last_amount_1_time = now;
        }
        if (amt2 > 0 && amt2 !== st.last_amount_2) {
            toStore.last_amount_2 = amt2;
            toStore.last_amount_2_time = now;
        }
        if (Object.keys(toStore).length > 0) {
            chrome.storage.local.set(toStore);
        }

        const effectiveAmount = amt3 || amt2 || amt1 || 0;

        const payload = {
            profile_id: profId,
            profile_label: profLabel,
            amount_1: amt1,
            amount_2: amt2,
            amount_3: amt3,
            amount: effectiveAmount,
            payment_session_id: sessionId,
            ...(paymentData || {})
        };
        payload.amount_1 = amt1;
        payload.amount_2 = amt2;
        if (amt3) payload.amount_3 = amt3;
        payload.amount = effectiveAmount;
        payload.payment_session_id = sessionId;

        chrome.runtime.sendMessage({
            action: 'recordPayment',
            data: payload
        }, (res) => {
            if (res && res.payment_id) {
                chrome.storage.local.set({ current_payment_id: res.payment_id });
            }
            if (typeof callback === 'function') callback(res);
        });
    });
}


function updateProfileLabel(phone) {
    if (phone && phone.length >= 10) {
        currentProfileLabel = `Profile (${phone})`;
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
        const host = window.location.hostname.toLowerCase();
        const isIvacHost = host.includes('ivacbd.com') || host.includes('indianvisa-bangladesh.nic.in');
        const isGatewayHost = host.includes('dgepay.net') || host.includes('mynagad.com') || host.includes('nagad.com') || host.includes('bkash.com') || host.includes('122.152.54.218') || host.includes('shurjopay');
        if (!isIvacHost && !isGatewayHost) return;

        const url = window.location.href.toLowerCase();
        const text = (document.body ? document.body.innerText : '').toLowerCase();

        // 1. Phone number detection on Login page
        if (url.includes('signin') || text.includes('sign in') || text.includes('your contact number') || url.includes('appointment.ivacbd.com')) {
            const phoneInput = findIvacLoginPhoneInput();
            if (phoneInput && phoneInput.value && !isProgrammaticFilling) {
                const digits = phoneInput.value.replace(/[^0-9]/g, '');
                if (digits.length === 11 && digits.startsWith('01')) {
                    chrome.storage.local.get(['ivac_phone'], (res) => {
                        if (res.ivac_phone !== digits) {
                            chrome.storage.local.set({
                                ivac_phone: digits,
                                profile_label: `Profile (${digits})`
                            });
                            updateProfileLabel(digits);
                        }
                    });
                }
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

        // 4. Continue Payment Page (Image 2 - Amount 1)
        const isExcludedPaymentUrl = url.includes('payment-status') || 
                                     url.includes('receipt') || 
                                     url.includes('status') ||
                                     window.location.hostname.includes('dgepay.net') ||
                                     window.location.hostname.includes('mynagad.com') ||
                                     window.location.hostname.includes('nagad.com') ||
                                     window.location.hostname.includes('bkash.com') ||
                                     window.location.hostname.includes('122.152.54.218');

        const contPayBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
            const t = (el.textContent || '').toLowerCase().trim();
            return t === 'continue payment' || t.includes('pay with dgepay') || t.includes('continue payment');
        });

        const isContinuePaymentPage = !isExcludedPaymentUrl && 
                                     (url.includes('continue-payment') || !!contPayBtn) &&
                                     (text.includes('total amount') || text.includes('pay with dgepay') || text.includes('bdt'));

        if (isContinuePaymentPage && (text.includes('total amount') || text.includes('pay with dgepay') || text.includes('bdt'))) {
            let amount1 = 0;
            const amtMatch = document.body.innerText.match(/(?:Total\s*Amount|Amount)[:\s]*BDT\s*([\d,]+\.?\d*)/i) || 
                             document.body.innerText.match(/BDT\s*([\d,]+\.?\d*)/i) ||
                             document.body.innerText.match(/(?:Total\s*Amount|Amount)[:\s]*(\d[\d,]*\.?\d*)/i);
            if (amtMatch) {
                amount1 = parseFloat(amtMatch[1].replace(/,/g, ''));
            }

            if (amount1 > 0) {
                chrome.storage.local.set({ 
                    last_amount_1: amount1, 
                    last_amount_1_time: Date.now(), 
                    last_tracked_amount: amount1 
                });

                if (!sessionStorage.getItem('continue_payment_page_logged')) {
                    sessionStorage.setItem('continue_payment_page_logged', 'true');
                    emitActivity('continue_payment_page', 'Continue Payment পেজ (টাকার পরিমাণ)', `Total Amount: ৳ ${amount1.toLocaleString()}`, amount1, 'info');
                    sendRecordPayment({
                        amount_1: amount1,
                        amount: amount1,
                        status: 'initiated',
                        stage: 'continue_payment',
                        description: `IVAC Total Amount: ৳ ${amount1.toLocaleString()}`
                    });
                }
            }

            if (contPayBtn && !contPayBtn.dataset.trackedContPay) {
                contPayBtn.dataset.trackedContPay = 'true';
                contPayBtn.addEventListener('click', () => {
                    const amtMatch = document.body.innerText.match(/BDT\s*([\d,]+\.?\d*)/i);
                    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : (amount1 || 0);
                    emitActivity('continue_payment_click', 'Continue Payment বাটনে ক্লিক', `DGePay গেটওয়েতে পাঠানো হচ্ছে (৳ ${amount.toLocaleString()})`, amount, 'info');
                    if (amount > 0) {
                        sendRecordPayment({
                            amount_1: amount,
                            amount: amount,
                            status: 'initiated',
                            stage: 'continue_payment_click',
                            description: `Pay With DGePay Click: ৳ ${amount.toLocaleString()}`
                        });
                    }
                });
            }
        }

        // 5. DGePay Payment Gateway Selection & Pay Button (Image 1 - Amount 2)
        if (window.location.hostname.includes('dgepay.net')) {
            // Find Pay button text or page text containing amount
            const allElements = Array.from(document.querySelectorAll('button, a, div, span, p'));
            const payElements = allElements.filter(b => {
                const t = (b.textContent || '').trim();
                return t.includes('Pay') && (t.includes('৳') || t.includes('\u09F3') || t.includes('BDT') || t.includes('Tk') || /Pay\s*\(?[\d,]/.test(t));
            });

            let amount2 = 0;
            if (payElements.length > 0) {
                const match = payElements[0].textContent.match(/[\d,]+\.?\d*/);
                if (match) amount2 = parseFloat(match[0].replace(/,/g, ''));
            }
            if (!amount2) {
                const pageAmtMatch = (document.body.innerText || '').match(/(?:Pay|Total|Amount)[\s(:]*(?:৳|\u09F3|BDT|Tk\.?)?\s*([\d,]+\.?\d*)/i);
                if (pageAmtMatch) amount2 = parseFloat(pageAmtMatch[1].replace(/,/g, ''));
            }

            if (amount2 > 0) {
                chrome.storage.local.set({ 
                    last_amount_2: amount2, 
                    last_amount_2_time: Date.now() 
                });

                if (!sessionStorage.getItem('dgepay_amount_2_logged')) {
                    sessionStorage.setItem('dgepay_amount_2_logged', 'true');
                    chrome.storage.local.get(['last_amount_1'], (st) => {
                        const amt1 = st.last_amount_1 || 0;
                        sendRecordPayment({
                            amount_1: amt1,
                            amount_2: amount2,
                            amount: amount2,
                            status: 'initiated',
                            stage: 'dgepay_methods',
                            description: `DGePay Payment Gateway: ৳ ${amount2.toLocaleString()}`
                        });
                    });
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
                        emitActivity('gateway_selected', 'Payment Method নির্বাচন', `Method: ${method}${amount2 ? ` (৳ ${amount2.toLocaleString()})` : ''}`, amount2, 'info');
                    });
                }
            });
        }

        // 6. Payment Successful Screen Detection (Image 1 & Image 5)
        checkAndLogPaymentSuccess();
    } catch(e) {}
}, 750);

// Immediate execution on page load (so fast 2-3s redirects are NEVER missed)
checkAndLogPaymentSuccess();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndLogPaymentSuccess);
}
window.addEventListener('load', checkAndLogPaymentSuccess);
// ===== HIGH-VISIBILITY PAYMENT RESULT OVERLAY BANNER (DISABLED) =====
function renderPaymentOverlayBanner(type, details = {}) {
    // Disabled as requested by user ("এটা যেন না আসে")
    try {
        const existing = document.getElementById('ivac-payment-result-banner');
        if (existing) existing.remove();
    } catch(e) {}
}

// ===== UNIVERSAL PAYMENT SUCCESS & FAILURE DETECTOR (100,000% ZERO-GUESSWORK) =====
function checkAndLogPaymentSuccess() {
    try {
        const host = window.location.hostname.toLowerCase();
        const isIvacHost = host.includes('ivacbd.com') || host.includes('indianvisa-bangladesh.nic.in');
        const isGatewayHost = host.includes('dgepay.net') || host.includes('mynagad.com') || host.includes('nagad.com') || host.includes('bkash.com') || host.includes('122.152.54.218') || host.includes('shurjopay');
        
        // STRICT SAFETY GUARD: Never execute payment checks on external websites (e.g. GitHub, Google, Facebook)
        if (!isIvacHost && !isGatewayHost) {
            return;
        }

        const fullUrl = window.location.href;
        const url = fullUrl.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        const search = window.location.search || '';
        const searchParams = new URLSearchParams(search);
        const text = (document.body ? document.body.innerText : '').toLowerCase();

        const isDgepayHost = window.location.hostname.includes('dgepay.net');
        const isStatusPath = pathname.includes('payment-status') || url.includes('payment-status') || url.includes('txn_status') || url.includes('code=');

        const txnStatus = searchParams.get('txn_status');
        const hasErrorCode = searchParams.has('code');
        const errorCode = searchParams.get('code') || '';

        // Extract any visible transaction ID from DOM text or URL parameters
        let trxId = searchParams.get('txnId') || searchParams.get('trxId') || searchParams.get('transaction_id') || searchParams.get('trx_id') || '';
        if (!trxId) {
            const trxMatch = (document.body ? document.body.innerText : '').match(/(?:Transaction\s*ID|TrxID|TxnID)[:\s]*([A-Za-z0-9_-]+)/i);
            if (trxMatch) trxId = trxMatch[1].trim();
        }
        if (!trxId && txnStatus === '3') {
            const urlTrxMatch = fullUrl.match(/txnId=([a-zA-Z0-9_-]+)/i);
            if (urlTrxMatch) trxId = urlTrxMatch[1].trim();
        }

        // =========================================================================
        // 1. STRICT FAILURE CHECK (CHECK FIRST TO PREVENT FALSE POSITIVES!)
        // =========================================================================
        const hasPaymentFailedText = text.includes('payment failed') || 
                                     text.includes('transaction failed') || 
                                     text.includes('payment declined') || 
                                     text.includes('payment cancelled') || 
                                     text.includes('payment canceled');

        const isDgepayFailed = isDgepayHost && (isStatusPath || hasPaymentFailedText) && (
            hasErrorCode || 
            (txnStatus && txnStatus !== '3') || 
            hasPaymentFailedText
        );

        if (isDgepayFailed) {
            const finalErrorCode = errorCode || '2002/2013';

            if (!sessionStorage.getItem('payment_failed_logged_session')) {
                sessionStorage.setItem('payment_failed_logged_session', 'true');
                sessionStorage.setItem('payment_handled_session', 'failed');

                chrome.storage.local.get(['current_payment_id', 'current_payment_session_id'], (st) => {
                    const pid = st.current_payment_id || st.current_payment_session_id;
                    emitActivity('payment_failed', '❌ Payment Failed / Cancelled', `পেমেন্ট সম্পন্ন হয়নি (DGePay Status: ${txnStatus || finalErrorCode || 'failed'})`, 0, 'error');
                    
                    const failPayload = {
                        payment_id: pid,
                        payment_session_id: st.current_payment_session_id,
                        stage: 'failed_on_dgepay',
                        status: 'failed',
                        error_code: finalErrorCode,
                        trx_id: `Failed (${finalErrorCode})`
                    };

                    chrome.runtime.sendMessage({
                        action: 'updatePayment',
                        data: failPayload
                    });

                    try {
                        if (navigator.sendBeacon) {
                            navigator.sendBeacon('http://127.0.0.1:5000/api/payment/update', new Blob([JSON.stringify(failPayload)], { type: 'application/json' }));
                        }
                    } catch(e) {}
                });
            }
            return; // STOP IMMEDIATELY! Do not evaluate success branch!
        }

        // =========================================================================
        // 2. STRICT SUCCESS CHECK (CHECK SECOND)
        // =========================================================================
        const hasPaymentSuccessText = text.includes('payment successful') || 
                                     text.includes('payment success') || 
                                     text.includes('transaction successful') || 
                                     text.includes('payment completed') ||
                                     text.includes('পেমেন্ট সফল') ||
                                     text.includes('আবেদন সফল');

        const isDgepaySuccess = isDgepayHost && !hasPaymentFailedText && !hasErrorCode && (
            txnStatus === '3' || 
            hasPaymentSuccessText
        );

        const isIvacReturn = url.includes('payment.ivacbd.com') || url.includes('appointment.ivacbd.com') || url.includes('payment_success') || url.includes('payment-success');
        const isReceiptPage = isIvacReturn && !hasPaymentFailedText && (
            text.includes('appointment confirmed') || 
            text.includes('appointment slip') || 
            text.includes('download receipt') ||
            (text.includes('transaction id') && (text.includes('bdt') || text.includes('amount') || text.includes('ivac')))
        );

        if (isDgepaySuccess || (isIvacReturn && hasPaymentSuccessText) || isReceiptPage) {
            const finalTrxId = trxId || (isDgepaySuccess ? 'DGePay_Success' : 'Completed');

            // Extract page amount if visible on screen
            let pageAmt = 0;
            const pageAmtMatch = (document.body ? document.body.innerText : '').match(/(?:BDT|\u09F3|Tk\.?|Amount[:\s]*)[\s]*([\d,]+\.?\d*)/i);
            if (pageAmtMatch) pageAmt = parseFloat(pageAmtMatch[1].replace(/,/g, ''));

            chrome.storage.local.get([
                'current_payment_id', 
                'current_payment_session_id', 
                'last_amount_1', 
                'last_amount_2', 
                'last_amount_3', 
                'last_tracked_amount'
            ], (st) => {
                const finalAmount = pageAmt || st.last_amount_3 || st.last_amount_2 || st.last_amount_1 || st.last_tracked_amount || 0;
                const pid = st.current_payment_id || st.current_payment_session_id;

                if (!sessionStorage.getItem('payment_success_logged_session')) {
                    sessionStorage.setItem('payment_success_logged_session', 'true');
                    sessionStorage.setItem('payment_handled_session', 'success');

                    const timeMatch = (document.body ? document.body.innerText : '').match(/\d{1,2}:\d{2}\s*(?:AM|PM)[^,\r\n]*/i);
                    const timeStr = timeMatch ? timeMatch[0] : '';

                    console.log(`[IVAC] 🎉 PAYMENT SUCCESS CONFIRMED! TrxID: ${finalTrxId}, Amount: ${finalAmount}, ID: ${pid}`);

                    emitActivity('payment_success', '🎉 Payment Successful!', `পেমেন্ট সম্পন্ন হয়েছে! TrxID: ${finalTrxId}${timeStr ? ' (' + timeStr + ')' : ''}${finalAmount > 0 ? ` (৳ ${finalAmount.toLocaleString()})` : ''}`, finalAmount, 'success', {
                        trx_id: finalTrxId,
                        time: timeStr,
                        status: 'success'
                    });

                    // 1. Send recordPayment (upsert/update with status: success and persistent session ID)
                    sendRecordPayment({
                        status: 'success',
                        stage: 'payment_success',
                        amount: finalAmount,
                        amount_3: finalAmount,
                        rocket_account: finalTrxId,
                        description: `Payment Success (TrxID: ${finalTrxId})`
                    });

                    // 2. Direct updatePayment call to guarantee Turso + Firebase update
                    const updatePayload = {
                        payment_id: pid,
                        payment_session_id: st.current_payment_session_id,
                        stage: 'payment_success',
                        status: 'success',
                        amount: finalAmount,
                        amount_1: st.last_amount_1 || 0,
                        amount_2: st.last_amount_2 || 0,
                        amount_3: finalAmount,
                        trx_id: finalTrxId
                    };

                    chrome.runtime.sendMessage({
                        action: 'updatePayment',
                        data: updatePayload
                    });

                    // 3. Guaranteed survive-redirect beacon to local server
                    try {
                        if (navigator.sendBeacon) {
                            navigator.sendBeacon('http://127.0.0.1:5000/api/payment/update', new Blob([JSON.stringify(updatePayload)], { type: 'application/json' }));
                        }
                    } catch(bErr) {}
                }
            });
        }
    } catch(e) {
        console.error('[IVAC] checkAndLogPaymentSuccess error:', e);
    }
}

// Immediate execution & Lifecycle event bindings
checkAndLogPaymentSuccess();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndLogPaymentSuccess);
}
window.addEventListener('load', checkAndLogPaymentSuccess);
window.addEventListener('pageshow', checkAndLogPaymentSuccess);

// Active Real-Time Poller & DOM Mutation Observer on Payment / Gateway pages
// (Guarantees zero-delay detection even if DGePay renders text asynchronously after SVG animation)
if (window.location.hostname.includes('dgepay.net') || window.location.href.includes('payment') || window.location.href.includes('appointment')) {
    let _paymentCheckTicks = 0;
    const _paymentCheckInterval = setInterval(() => {
        _paymentCheckTicks++;
        checkAndLogPaymentSuccess();
        if (_paymentCheckTicks > 50 || sessionStorage.getItem('payment_handled_session')) {
            clearInterval(_paymentCheckInterval);
        }
    }, 350);

    try {
        const _targetNode = document.body || document.documentElement;
        if (_targetNode) {
            const _payObserver = new MutationObserver(() => {
                checkAndLogPaymentSuccess();
            });
            _payObserver.observe(_targetNode, { childList: true, subtree: true, characterData: true });
        }
    } catch(obsErr) {}
}

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
let isLicenseValid = true; // Default to true so active registered sessions are not blocked by transient worker sleep
let currentLicenseErrorMsg = null;
let shadowDomRoot = null;

function checkLicenseAndSyncConfig() {
    if (!chrome.runtime || !chrome.runtime.sendMessage) return;
    try {
        chrome.runtime.sendMessage({ action: 'checkLicenseStatus' }, (data) => {
            if (chrome.runtime.lastError) return;
            if (data && data.active === true) {
                isLicenseValid = true;
            } else if (data && data.active === false && !data.error) {
                isLicenseValid = false;
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

// Check every 2 seconds for live real-time sync
checkLicenseAndSyncConfig();
setInterval(checkLicenseAndSyncConfig, 2000);

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
function extractBdMobile(str) {
    if (!str) return null;
    const clean = String(str).replace(/[^0-9]/g, '');
    const m = clean.match(/(01[3-9]\d{8})/);
    return m ? m[1] : null;
}

function findIvacLoginPhoneInput() {
    const inputs = Array.from(document.querySelectorAll('input'));
    // 1. Direct attribute match
    for (const inp of inputs) {
        const type = (inp.type || 'text').toLowerCase();
        if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio' || inp.maxLength === 1) continue;
        const name = (inp.name || '').toLowerCase();
        const id = (inp.id || '').toLowerCase();
        const ph = (inp.placeholder || '').toLowerCase();

        if (type === 'tel') return inp;
        if (ph.includes('01') || ph.includes('contact') || ph.includes('phone') || ph.includes('mobile')) return inp;
        if (name.includes('phone') || name.includes('mobile') || name.includes('contact')) return inp;
        if (id.includes('phone') || id.includes('mobile') || id.includes('contact')) return inp;
    }

    // 2. Surrounding label / container match (e.g., "Your Contact Number")
    for (const inp of inputs) {
        const type = (inp.type || 'text').toLowerCase();
        if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio' || inp.maxLength === 1) continue;
        const parent = inp.closest('div, form, label, p, tr, td');
        if (parent && /(contact number|mobile number|phone number|contact)/i.test(parent.textContent)) {
            return inp;
        }
    }

    // 3. Any input that currently contains an 11-digit BD mobile number
    for (const inp of inputs) {
        const type = (inp.type || 'text').toLowerCase();
        if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio' || inp.maxLength === 1) continue;
        const val = (inp.value || '').replace(/[^0-9]/g, '');
        if (val.length === 11 && val.startsWith('01')) return inp;
    }

    return null;
}

document.addEventListener('input', handlePhoneCapture);
document.addEventListener('change', handlePhoneCapture);
document.addEventListener('focusout', handlePhoneCapture);

function handlePhoneCapture(e) {
    if (!e || !e.target || !e.target.tagName) return;
    if (e.target.tagName.toLowerCase() !== 'input') return;
    checkInputForPhone(e.target);
}

function checkInputForPhone(inputEl) {
    if (!inputEl) return;
    const type = (inputEl.type || 'text').toLowerCase();
    if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio' || inputEl.maxLength === 1) return;
    
    const val = (inputEl.value || '').replace(/[^0-9]/g, '');
    const bdMobile = extractBdMobile(val);
    if (bdMobile) {
        chrome.storage.local.get(['ivac_phone'], (res) => {
            if (res.ivac_phone !== bdMobile) {
                chrome.storage.local.set({
                    ivac_phone: bdMobile,
                    profile_label: `Profile (${bdMobile})`
                });
                updateProfileLabel(bdMobile);
            }
        });
    }
}

// Document event listeners handle phone capture safely on user input/change

// Answer queries from popup regarding current page phone number & widget toggle, and AutoFill requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'AUTOFILL_IVAC_SIGNUP') {
        if (typeof autoFillIvacSignupInfo === 'function') {
            autoFillIvacSignupInfo((result) => {
                sendResponse(result || { success: true });
            });
            return true;
        } else {
            sendResponse({ success: false, message: 'AutoFill engine not ready' });
            return false;
        }
    }
    if (request && request.action === 'TOGGLE_FLOATING_WINDOW') {
        const shouldHide = request.hide === true;
        isFloatingWidgetHidden = shouldHide;
        if (typeof setFloatingWidgetVisible === 'function') {
            setFloatingWidgetVisible(!shouldHide);
        }
        sendResponse({ success: true, hidden: shouldHide });
        return false;
    }
    if (request && request.action === 'getLoginPagePhone') {
        const pInput = findIvacLoginPhoneInput();
        const pDigits = pInput ? (pInput.value || '').replace(/[^0-9]/g, '') : '';
        const passInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => i.maxLength !== 1);
        const passVal = passInputs[0] ? passInputs[0].value : '';
        sendResponse({
            phone: (pDigits.length === 11 && pDigits.startsWith('01')) ? pDigits : '',
            password: passVal || ''
        });
        return true;
    }
});

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

let isProgrammaticFilling = false;

function autoFillLoginCredentials() {
    const url = window.location.href.toLowerCase();
    
    // STRICT GUARD: Only run on the actual signin / login page!
    if (url.includes('verify') || url.includes('otp') || url.includes('payment') || url.includes('checkout')) return;
    if (!url.includes('/signin') && !url.includes('/login') && !url.includes('appointment.ivacbd.com')) return;

    chrome.storage.local.get(['ivac_phone', 'ivac_password', 'ext_enabled'], (st) => {
        if (st.ext_enabled === false) return;
        
        let phone = (st.ivac_phone || '').trim();
        let pass = (st.ivac_password || '').trim();

        const phoneInput = findIvacLoginPhoneInput();
        if (phoneInput) {
            const cleanVal = (phoneInput.value || '').replace(/[^0-9]/g, '');
            const cleanPhone = phone.replace(/[^0-9]/g, '');

            // CRITICAL: If the page already has a valid 11-digit BD number, adopt it if different
            if (cleanVal.length === 11 && cleanVal.startsWith('01')) {
                if (cleanVal !== cleanPhone) {
                    chrome.storage.local.set({
                        ivac_phone: cleanVal,
                        profile_label: `Profile (${cleanVal})`
                    });
                    updateProfileLabel(cleanVal);
                }
            } else if (cleanVal.length === 0 && cleanPhone.length === 11) {
                // Only autofill if the field is completely empty!
                isProgrammaticFilling = true;
                setNativeInputValue(phoneInput, phone);
                isProgrammaticFilling = false;
            }

            // Real-time listener for user typing / change
            if (!phoneInput.dataset.ivacAutoSaveAttached) {
                phoneInput.dataset.ivacAutoSaveAttached = 'true';
                const syncLive = () => {
                    if (isProgrammaticFilling) return;
                    const typed = (phoneInput.value || '').replace(/[^0-9]/g, '');
                    if (typed.length === 11 && typed.startsWith('01')) {
                        chrome.storage.local.get(['ivac_phone'], (r) => {
                            if (r.ivac_phone !== typed) {
                                chrome.storage.local.set({
                                    ivac_phone: typed,
                                    profile_label: `Profile (${typed})`
                                });
                                updateProfileLabel(typed);
                            }
                        });
                    }
                };
                phoneInput.addEventListener('input', syncLive);
                phoneInput.addEventListener('change', syncLive);
                phoneInput.addEventListener('blur', syncLive);
            }
        }

        // Find and fill Password input
        const passInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => i.maxLength !== 1);
        const passInput = passInputs[0] || null;
        if (passInput) {
            const currentPassVal = passInput.value || '';
            const isBullets = /^[•●*]+$/.test(currentPassVal);
            if (currentPassVal.length >= 4 && !isBullets) {
                if (!pass || pass !== currentPassVal) {
                    chrome.storage.local.set({ ivac_password: currentPassVal });
                }
            } else if (currentPassVal.length === 0 && pass && pass.length > 0) {
                isProgrammaticFilling = true;
                setNativeInputValue(passInput, pass);
                isProgrammaticFilling = false;
            }
            if (!passInput.dataset.ivacAutoSaveAttached) {
                passInput.dataset.ivacAutoSaveAttached = 'true';
                const syncPass = () => {
                    if (isProgrammaticFilling) return;
                    const val = passInput.value || '';
                    if (val.length >= 4 && !/^[•●*]+$/.test(val)) {
                        chrome.storage.local.set({ ivac_password: val });
                    }
                };
                passInput.addEventListener('input', syncPass);
                passInput.addEventListener('change', syncPass);
                passInput.addEventListener('blur', syncPass);
            }
        }
    });
}

// Targeted autofill triggers without thrashing intervals
document.addEventListener('DOMContentLoaded', autoFillLoginCredentials);
window.addEventListener('load', autoFillLoginCredentials);
setTimeout(autoFillLoginCredentials, 400);
setTimeout(autoFillLoginCredentials, 1200);
setTimeout(autoFillLoginCredentials, 2500);

// Extract #profile= and #proxy= from URL if launched from desktop app or shortcut
(function initProfileFromUrl() {
    try {
        if (window.location.hash && (window.location.hash.includes('profile=') || window.location.hash.includes('proxy='))) {
            const match = window.location.hash.match(/profile=([^&]+)/);
            if (match && match[1]) {
                const profDir = decodeURIComponent(match[1]);
                chrome.storage.local.set({ my_chrome_profile: profDir });
            }
            const proxyMatch = window.location.hash.match(/proxy=([^&]*)/);
            if (proxyMatch) {
                const proxyVal = decodeURIComponent(proxyMatch[1] || '').trim();
                chrome.storage.local.get(['ivac_proxy_enabled'], (res) => {
                    const isEn = (res && res.ivac_proxy_enabled !== undefined) ? res.ivac_proxy_enabled : Boolean(proxyVal);
                    chrome.runtime.sendMessage({
                        action: 'setProfileProxy',
                        proxy: proxyVal,
                        enabled: isEn
                    });
                });
            }
            try {
                history.replaceState(null, null, window.location.pathname + window.location.search);
            } catch(e) {}
        }
    } catch(e) {}
})();

// Global in-memory visibility flag for instant zero-latency hide/show
let isFloatingWidgetHidden = false;
try {
    chrome.storage.local.get(['hide_floating_window'], (res) => {
        if (res && res.hide_floating_window === true) {
            isFloatingWidgetHidden = true;
            if (typeof setFloatingWidgetVisible === 'function') {
                setFloatingWidgetVisible(false);
            }
        }
    });
} catch(e) {}

// Real-time listener for credentials changes and floating window visibility
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.ivac_phone || changes.ivac_password) {
            if (!isProgrammaticFilling && typeof autoFillLoginCredentials === 'function') {
                autoFillLoginCredentials();
            }
        }
        if (changes.hide_floating_window !== undefined) {
            const isHidden = changes.hide_floating_window.newValue === true;
            isFloatingWidgetHidden = isHidden;
            if (typeof setFloatingWidgetVisible === 'function') {
                setFloatingWidgetVisible(!isHidden);
            }
        }
        if (changes.ext_enabled !== undefined) {
            const isOff = changes.ext_enabled.newValue === false;
            if (isOff && typeof setFloatingWidgetVisible === 'function') {
                setFloatingWidgetVisible(false);
            }
        }
    }
});

// ===== FLOATING PIN WIDGET (injected into the webpage DOM) =====
let pinWidgetEl = null;
let widgetMinimized = false;

function setFloatingWidgetVisible(visible) {
    isFloatingWidgetHidden = !visible;
    const rootEl = document.getElementById('ivac-pin-widget-root') || pinWidgetEl;
    if (rootEl) {
        rootEl.style.setProperty('display', visible ? 'block' : 'none', 'important');
        const shadow = rootEl.shadowRoot || shadowDomRoot;
        if (shadow) {
            const box = shadow.getElementById('pin-box');
            if (box) {
                box.style.setProperty('display', visible ? 'block' : 'none', 'important');
            }
        }
        if (!visible) {
            // Physically detach from DOM so browser cannot render it under any circumstances
            if (rootEl.parentNode) {
                rootEl.parentNode.removeChild(rootEl);
            } else if (typeof rootEl.remove === 'function') {
                rootEl.remove();
            }
        } else {
            // Re-attach to document if not present
            if (!document.getElementById('ivac-pin-widget-root') || !document.contains(rootEl)) {
                const docRoot = document.documentElement || document.body;
                if (docRoot) docRoot.appendChild(rootEl);
            }
        }
    }
}

function ensurePinWidgetAttached() {
    if (window.self !== window.top) return;
    if (window.location.protocol === 'chrome-extension:' || window.location.protocol === 'chrome:') return;
    if (isFloatingWidgetHidden) {
        const existing = document.getElementById('ivac-pin-widget-root');
        if (existing) {
            if (existing.parentNode) existing.parentNode.removeChild(existing);
            else existing.remove();
        }
        return;
    }
    
    chrome.storage.local.get(['ext_enabled', 'hide_floating_window'], (s) => {
        if (s && (s.ext_enabled === false || s.hide_floating_window === true)) {
            isFloatingWidgetHidden = true;
            setFloatingWidgetVisible(false);
            return;
        }
        if (isFloatingWidgetHidden) return;
        
        const root = document.documentElement || document.body;
        if (!root) return;

        const existing = document.getElementById('ivac-pin-widget-root');
        if (!existing || !document.contains(existing)) {
            if (pinWidgetEl && (pinWidgetEl.shadowRoot || shadowDomRoot)) {
                setFloatingWidgetVisible(true);
                root.appendChild(pinWidgetEl);
            } else {
                createPinWidget();
            }
        } else {
            setFloatingWidgetVisible(true);
        }
    });
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
        pinWidgetEl.style.cssText = 'all: initial !important; position: fixed !important; z-index: 2147483647 !important; top: 0; left: 0; width: 0; height: 0;';
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
                top: 10px;
                left: max(15px, calc(50% - 220px));
                right: auto;
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
            @keyframes ivacCaptchaBlink {
                0% { background: #fee2e2; border-color: #ef4444; box-shadow: 0 0 0 rgba(239, 68, 68, 0.2); }
                50% { background: #fecaca; border-color: #dc2626; box-shadow: 0 0 10px rgba(220, 38, 38, 0.7); }
                100% { background: #fee2e2; border-color: #ef4444; box-shadow: 0 0 0 rgba(239, 68, 68, 0.2); }
            }
            @keyframes ivacPulseBadge {
                0% { opacity: 0.6; transform: scale(0.95); }
                100% { opacity: 1; transform: scale(1.05); }
            }
        </style>
                <div id="pin-box">
            <div id="pin-header">
                <div id="pin-header-left">
                    <span id="pin-icon">📋</span>
                    <span id="pin-title">IVAC OTP</span>
                    <span id="pin-device-badge" style="display:none; font-size:9px; background:rgba(255,255,255,0.22); padding:1px 4px; border-radius:3px; margin-left:4px; font-weight:700; letter-spacing:0.3px;" title="সংযুক্ত মোবাইল / মোট মোবাইল">📱 0/0</span>
                    <span id="pin-captcha-badge" style="display:none; font-size:8px; background:#ef4444; color:#fff; padding:1px 4px; border-radius:3px; margin-left:3px; font-weight:800; animation:ivacPulseBadge 0.8s infinite alternate;" title="ক্যাপচা এখনো টিক করা হয়নি!">⚠️ CAPTCHA</span>
                </div>
                <div style="display:flex; align-items:center; gap:2px;">
                    <button class="hdr-btn" id="min-btn" title="মিনিমাইজ">−</button>
                    <button class="hdr-btn" id="close-widget-btn" title="উইন্ডো লুকান" style="font-size:10px; padding:0 3px;">✕</button>
                </div>
            </div>
            <div id="pin-body">
                <div id="otp-display">
                    <span class="c-gray" style="font-size:10px;">অপেক্ষায় আছে...</span>
                </div>
                <!-- Live Captcha Attention Banner -->
                <div id="captcha-alert-banner" style="display: none; margin-top: 5px; padding: 6px 8px; background: #fee2e2; border: 1.5px solid #ef4444; border-radius: 6px; text-align: center; cursor: pointer; animation: ivacCaptchaBlink 0.9s infinite alternate;" title="ক্লিক করলে ক্যাপচায় স্ক্রোল করবে">
                    <div style="font-size: 11px; font-weight: 800; color: #b91c1c; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <span>⚠️</span> <span>ক্যাপচায় টিক করুন!</span>
                    </div>
                    <div style="font-size: 9px; color: #991b1b; margin-top: 2px;">এখানে চাপলে সরাসরি বক্সে নিয়ে যাবে ⬇️</div>
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
    if (!isFloatingWidgetHidden) {
        const docRoot = document.documentElement || document.body;
        if (docRoot) docRoot.appendChild(pinWidgetEl);
    }

    // Initial check to respect hide_floating_window
    chrome.storage.local.get(['hide_floating_window', 'ext_enabled'], (s) => {
        if (s && (s.ext_enabled === false || s.hide_floating_window === true)) {
            isFloatingWidgetHidden = true;
            setFloatingWidgetVisible(false);
        } else {
            if (!isFloatingWidgetHidden) {
                setFloatingWidgetVisible(true);
            }
        }
    });

    // Minimize/Expand toggle
    const minBtn = shadow.getElementById('min-btn');
    const pinBody = shadow.getElementById('pin-body');
    minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widgetMinimized = !widgetMinimized;
        pinBody.style.display = widgetMinimized ? 'none' : 'block';
        minBtn.textContent = widgetMinimized ? '+' : '-';
    });

    // Close/Hide Widget button
    const closeBtn = shadow.getElementById('close-widget-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.storage.local.set({ hide_floating_window: true });
            setFloatingWidgetVisible(false);
        });
    }



    // Make draggable & save custom position with strict viewport boundary clamping (cannot be dragged off-screen)
    const pinBox = shadow.getElementById('pin-box');
    const pinHeader = shadow.getElementById('pin-header');
    let dragging = false, dx = 0, dy = 0;

    function clampPinBoxPosition(leftVal, topVal) {
        const boxWidth = (pinBox && (pinBox.offsetWidth || pinBox.getBoundingClientRect().width)) || 195;
        const boxHeight = (pinBox && (pinBox.offsetHeight || pinBox.getBoundingClientRect().height)) || 60;
        const pad = 4; // 4px safe margin from viewport edge

        const winW = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1024;
        const winH = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 768;

        const maxLeft = Math.max(pad, winW - boxWidth - pad);
        const maxTop = Math.max(pad, winH - boxHeight - pad);

        let finalLeft = typeof leftVal === 'number' ? leftVal : parseFloat(leftVal);
        let finalTop = typeof topVal === 'number' ? topVal : parseFloat(topVal);

        if (isNaN(finalLeft)) finalLeft = pad;
        if (isNaN(finalTop)) finalTop = pad;

        finalLeft = Math.min(Math.max(pad, finalLeft), maxLeft);
        finalTop = Math.min(Math.max(pad, finalTop), maxTop);

        return { left: finalLeft + 'px', top: finalTop + 'px' };
    }

    // Restore user-dragged position if saved, otherwise default is used (with boundary clamping)
    chrome.storage.local.get(['pin_custom_left', 'pin_custom_top'], (pos) => {
        if (pos && pos.pin_custom_left && pos.pin_custom_top) {
            const clamped = clampPinBoxPosition(pos.pin_custom_left, pos.pin_custom_top);
            pinBox.style.left = clamped.left;
            pinBox.style.top = clamped.top;
            pinBox.style.right = 'auto';
            pinBox.style.bottom = 'auto';
        }
    });

    pinHeader.addEventListener('mousedown', (e) => {
        dragging = true;
        const rect = pinBox.getBoundingClientRect();
        dx = e.clientX - rect.left;
        dy = e.clientY - rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const clamped = clampPinBoxPosition(e.clientX - dx, e.clientY - dy);
        pinBox.style.left = clamped.left;
        pinBox.style.top = clamped.top;
        pinBox.style.right = 'auto';
        pinBox.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            const clamped = clampPinBoxPosition(pinBox.style.left, pinBox.style.top);
            pinBox.style.left = clamped.left;
            pinBox.style.top = clamped.top;
            chrome.storage.local.set({
                pin_custom_left: clamped.left,
                pin_custom_top: clamped.top
            });
        }
    });

    // Window resize safeguard: ensure box never overflows screen if window resized
    window.addEventListener('resize', () => {
        if (!pinBox || !document.contains(pinWidgetEl)) return;
        const rect = pinBox.getBoundingClientRect();
        if (rect.left + rect.width > window.innerWidth || rect.top + rect.height > window.innerHeight) {
            const clamped = clampPinBoxPosition(rect.left, rect.top);
            pinBox.style.left = clamped.left;
            pinBox.style.top = clamped.top;
            pinBox.style.right = 'auto';
            pinBox.style.bottom = 'auto';
        }
    });

    // Double-click header to reset back to default position (Image 2)
    pinHeader.addEventListener('dblclick', () => {
        pinBox.style.top = '10px';
        pinBox.style.left = 'max(15px, calc(50% - 220px))';
        pinBox.style.right = 'auto';
        pinBox.style.bottom = 'auto';
        chrome.storage.local.remove(['pin_custom_left', 'pin_custom_top']);
    });

    // Start live OTP polling for this widget with visibility-aware adaptive scheduling
    const otpBox = shadow.getElementById('otp-display');
    let widgetPollTimer = null;
    function scheduleWidgetPoll() {
        if (widgetPollTimer) clearTimeout(widgetPollTimer);
        const delay = document.visibilityState === 'hidden' ? 4500 : 1500;
        widgetPollTimer = setTimeout(async () => {
            await updateWidgetOtp(otpBox);
            scheduleWidgetPoll();
        }, delay);
    }
    scheduleWidgetPoll();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateWidgetOtp(otpBox);
            scheduleWidgetPoll();
        }
    });

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
        } else if (action === 'delete-email-otp') {
            chrome.runtime.sendMessage({ action: 'clearEmailOtp' }, () => {
                updateWidgetOtp(otpBox);
            });
        }
    });
}

// Live Update Widget OTP
async function updateWidgetOtp(box) {
    if (!box) return;
    
    // Fast check if widget is hidden by user
    if (isFloatingWidgetHidden) {
        setFloatingWidgetVisible(false);
        return;
    }
    try {
        const pref = await new Promise(r => chrome.storage.local.get(['hide_floating_window', 'ext_enabled'], s => r(s || {})));
        if (pref.ext_enabled === false || pref.hide_floating_window === true || isFloatingWidgetHidden) {
            isFloatingWidgetHidden = true;
            setFloatingWidgetVisible(false);
            return;
        } else {
            if (!isFloatingWidgetHidden) {
                setFloatingWidgetVisible(true);
            }
        }
    } catch(e) {}
    
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
        if (!isCaptchaAlertActive) {
            if (pinHeader) pinHeader.style.background = '#059669';
            if (pinBoxEl) pinBoxEl.style.borderColor = '#059669';
        }
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
    const res = await new Promise(r => chrome.storage.local.get(['ext_enabled', 'hide_floating_window', 'ivac_phone', 'ivac_email', 'rocket_accounts', 'active_rocket_id', 'payment_link', 'latest_email_otp'], (result) => {
        if (chrome.runtime.lastError) {
            r({});
        } else {
            r(result || {});
        }
    }));
    
    if (res.ext_enabled === false || res.hide_floating_window === true || isFloatingWidgetHidden) {
        isFloatingWidgetHidden = true;
        setFloatingWidgetVisible(false);
        return;
    } else {
        if (!isFloatingWidgetHidden) {
            setFloatingWidgetVisible(true);
        }
    }

    const currentSavedPhone = res.ivac_phone || "";
    const currentSavedEmail = (res.ivac_email || "").trim().toLowerCase();
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

    // Check Email OTP with strict multi-profile isolation
    const emailOtpData = res.latest_email_otp || null;
    if (emailOtpData && emailOtpData.otp && (Date.now() - emailOtpData.timestamp < 300000)) {
        const otpEmail = (emailOtpData.email || '').trim().toLowerCase();
        if (!currentSavedEmail || !otpEmail || currentSavedEmail === otpEmail) {
            if (found) html += '<div class="divider"></div>';
            const isUsed = !!emailOtpData.used;
            const statusBadge = isUsed ? '<span class="status-badge badge-used">Used</span>' : '<span class="status-badge badge-unused">Unused</span>';
            const valColor = isUsed ? '#64748b' : '#0284c7';
            const emailTagLabel = otpEmail ? `✉️ ${otpEmail}` : '✉️ IVAC Email';
            html += `<div class="otp-tag-row">
                         <span class="otp-tag" style="color:#0284c7;" title="${otpEmail}">${emailTagLabel}</span>
                         ${statusBadge}
                     </div>
                     <div class="otp-row">
                         <div class="otp-val" style="color:${valColor};">${emailOtpData.otp}</div>
                         <div>
                             <button class="action-btn" data-action="copy" data-otp="${emailOtpData.otp}" title="Copy">📋</button>
                             <button class="action-btn" data-action="delete-email-otp" title="Delete">🗑️</button>
                         </div>
                     </div>`;
            found = true;
        }
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
        if (currentSavedPhone || currentSavedEmail) {
            const phonePart = currentSavedPhone ? `<b>${currentSavedPhone}</b>${getDevDot(currentSavedPhone)}` : '';
            const emailPart = currentSavedEmail ? `<span style="color:#0284c7; font-size:9.5px; font-weight:700;">${currentSavedEmail}</span>` : '';
            const targets = [phonePart, emailPart].filter(Boolean).join(' / ');
            text = `${targets} এর OTP নেই`;
        } else {
            text = `ফোন নম্বর পাওয়া যায়নি!`;
        }
        box.innerHTML = `<span class="c-gray" style="font-size:10px; display:flex; align-items:center; justify-content:center; gap:3px; flex-wrap:wrap;">${text}</span>`;
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

    // Get freshest phone & email number
    const res = await new Promise(r => chrome.storage.local.get(['ivac_phone', 'ivac_email'], r));
    const currentSavedPhone = res.ivac_phone || "";
    const currentSavedEmail = (res.ivac_email || "").trim().toLowerCase();
    if ((!currentSavedPhone || currentSavedPhone.length < 11) && !currentSavedEmail) return;

    try {
        // 1. Try SMS OTP first if phone is configured
        if (currentSavedPhone && currentSavedPhone.length >= 11) {
            const d = await new Promise(r => chrome.runtime.sendMessage({ 
                action: 'claimAndFetchOtp', 
                phone: currentSavedPhone, 
                source: 'IV' 
            }, r));
            
            if (d && d.success && d.data && d.data.digits && !d.data.used && d.data.source === 'IV') {
                fillOtpNative(otpInputs, d.data.digits, isSingleBox);
                chrome.runtime.sendMessage({ action: 'markUsed', phone: currentSavedPhone, source: 'IV' });
                emitActivity('login_otp_filled', 'Login OTP গ্রহণ ও পূরণ', 'Phone: ' + currentSavedPhone + ', OTP: ' + d.data.digits.join(''), 0, 'info');
                return;
            }
        }

        // 2. Try Email OTP if SMS OTP was not found or not yet available
        if (currentSavedEmail) {
            const emailResp = await new Promise(r => chrome.runtime.sendMessage({ 
                action: 'fetchEmailOtp', 
                email: currentSavedEmail 
            }, r));
            if (emailResp && emailResp.success && emailResp.data && emailResp.data.otp && !emailResp.data.used) {
                const otpEmail = (emailResp.data.email || '').trim().toLowerCase();
                // STRICT MULTI-PROFILE ISOLATION CHECK:
                // Only fill if OTP's email strictly matches this profile's configured email!
                if (otpEmail && currentSavedEmail && otpEmail !== currentSavedEmail) {
                    console.warn(`[IVAC Master Pro] Rejected Email OTP for ${otpEmail} (Current Profile is: ${currentSavedEmail})`);
                    return;
                }

                const digits = String(emailResp.data.otp).split('').map(Number);
                if (digits.length === 6 || (isSingleBox && digits.length >= 4)) {
                    fillOtpNative(otpInputs, digits, isSingleBox);
                    chrome.runtime.sendMessage({ action: 'markEmailOtpUsed' });
                    emitActivity('login_otp_filled', 'Login Email OTP গ্রহণ ও পূরণ', 'Email (' + currentSavedEmail + ') OTP: ' + emailResp.data.otp, 0, 'info');
                }
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

// ===== Captcha Check & Helper =====
function getTurnstileElement() {
    return document.querySelector('iframe[src*="cloudflare"], iframe[src*="turnstile"], iframe[src*="challenges.cloudflare.com"], iframe[id*="cf-chl-widget"]') 
        || document.querySelector('.cf-turnstile')
        || document.querySelector('[name="cf-turnstile-response"]')?.parentElement;
}

function isCaptchaResolved() {
    const cf = document.querySelector('[name="cf-turnstile-response"]');
    const rc = document.querySelector('[name="g-recaptcha-response"]');
    const cfFrame = getTurnstileElement();
    
    if (cfFrame || cf) {
        return !!(cf && cf.value && cf.value.length > 10);
    }
    if (rc) {
        return !!(rc.value && rc.value.length > 10);
    }
    return true;
}

// ===== Smart Cloudflare Turnstile Alert & Auto-Scroll Watcher =====
let _turnstileWatcherStarted = false;
let isCaptchaAlertActive = false;
let turnstileIframeState = 'IDLE'; // 'IDLE' | 'SPINNING' | 'WAITING_CLICK' | 'SUCCESS'
let turnstileCheckboxAppearTime = null;
let turnstileLastResetTime = Date.now();
let wasTurnstileResolved = false;

function resetTurnstileWatch(reason) {
    turnstileLastResetTime = Date.now();
    turnstileCheckboxAppearTime = null;
    if (turnstileIframeState !== 'SPINNING' && turnstileIframeState !== 'WAITING_CLICK') {
        turnstileIframeState = 'IDLE';
    }
    
    // Immediately dismiss any active red alert
    if (isCaptchaAlertActive) {
        isCaptchaAlertActive = false;
        dismissCaptchaAlertUI();
    }
}

function dismissCaptchaAlertUI() {
    const shadow = shadowDomRoot;
    if (!shadow) return;
    const captchaBanner = shadow.getElementById('captcha-alert-banner');
    const pinCaptchaBadge = shadow.getElementById('pin-captcha-badge');
    const pinHeader = shadow.getElementById('pin-header');
    const pinBoxEl = shadow.getElementById('pin-box');

    if (captchaBanner) captchaBanner.style.display = 'none';
    if (pinCaptchaBadge) pinCaptchaBadge.style.display = 'none';
    if (pinHeader) pinHeader.style.background = '#059669';
    if (pinBoxEl) pinBoxEl.style.borderColor = '#059669';

    const cfElement = getTurnstileElement();
    if (cfElement) {
        cfElement.style.outline = '';
        cfElement.style.boxShadow = '';
    }
}

function showCaptchaSuccessUI() {
    const shadow = shadowDomRoot;
    if (!shadow) return;
    const captchaBanner = shadow.getElementById('captcha-alert-banner');
    const pinCaptchaBadge = shadow.getElementById('pin-captcha-badge');
    const pinHeader = shadow.getElementById('pin-header');
    const pinBoxEl = shadow.getElementById('pin-box');

    if (pinCaptchaBadge) pinCaptchaBadge.style.display = 'none';
    if (pinHeader) pinHeader.style.background = '#059669';
    if (pinBoxEl) pinBoxEl.style.borderColor = '#059669';

    if (captchaBanner) {
        captchaBanner.style.display = 'block';
        captchaBanner.style.animation = 'none';
        captchaBanner.style.background = '#ecfdf5';
        captchaBanner.style.borderColor = '#10b981';
        captchaBanner.innerHTML = `
            <div style="font-size: 11px; font-weight: 800; color: #047857; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <span>✅</span> <span>ক্যাপচা সম্পন্ন হয়েছে!</span>
            </div>
        `;
        setTimeout(() => {
            if (!isCaptchaAlertActive && captchaBanner) {
                captchaBanner.style.display = 'none';
            }
        }, 2200);
    }

    const cfElement = getTurnstileElement();
    if (cfElement) {
        cfElement.style.outline = '2px solid #10b981';
        cfElement.style.boxShadow = '0 0 16px 3px rgba(16, 185, 129, 0.7)';
        setTimeout(() => {
            if (cfElement) {
                cfElement.style.outline = '';
                cfElement.style.boxShadow = '';
            }
        }, 2000);
    }
}

function triggerCaptchaAlertUI() {
    if (isCaptchaAlertActive) return;
    isCaptchaAlertActive = true;

    const shadow = shadowDomRoot;
    if (!shadow) return;
    const captchaBanner = shadow.getElementById('captcha-alert-banner');
    const pinCaptchaBadge = shadow.getElementById('pin-captcha-badge');
    const pinHeader = shadow.getElementById('pin-header');
    const pinBoxEl = shadow.getElementById('pin-box');

    if (captchaBanner) {
        captchaBanner.style.display = 'block';
        captchaBanner.style.animation = 'ivacCaptchaBlink 0.9s infinite alternate';
        captchaBanner.style.background = '#fee2e2';
        captchaBanner.style.borderColor = '#ef4444';
        captchaBanner.innerHTML = `
            <div style="font-size: 11px; font-weight: 800; color: #b91c1c; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <span>⚠️</span> <span>ক্যাপচায় টিক করুন!</span>
            </div>
            <div style="font-size: 9px; color: #991b1b; margin-top: 2px;">এখানে চাপলে সরাসরি বক্সে নিয়ে যাবে ⬇️</div>
        `;
    }
    if (pinCaptchaBadge) pinCaptchaBadge.style.display = 'inline-block';
    if (pinHeader) pinHeader.style.background = '#dc2626';
    if (pinBoxEl) pinBoxEl.style.borderColor = '#dc2626';

    scrollToTurnstileElement();
}

function scrollToTurnstileElement() {
    const el = getTurnstileElement();
    if (el) {
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
            el.scrollIntoView(true);
        }
        el.style.transition = 'box-shadow 0.3s ease, outline 0.3s ease';
        el.style.outline = '3px solid #ef4444';
        el.style.outlineOffset = '4px';
        el.style.boxShadow = '0 0 20px 5px rgba(239, 68, 68, 0.85)';
        el.style.borderRadius = '8px';
    }
}

function initCloudflareTurnstileWatcher() {
    if (window.self !== window.top) return;
    if (_turnstileWatcherStarted) return;
    _turnstileWatcherStarted = true;

    let lastUrl = window.location.href;
    let lastIframeSrc = '';

    // Listen to real-time reports from Turnstile iframe (via inject.js)
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'IVAC_CF_STATE') {
            const reportedState = event.data.state;
            if (reportedState === 'SPINNING') {
                turnstileIframeState = 'SPINNING';
                checkboxFirstAppearedTime = null;
                // Spinner is actively turning -> suppress any alert!
                if (isCaptchaAlertActive) {
                    isCaptchaAlertActive = false;
                    dismissCaptchaAlertUI();
                }
            } else if (reportedState === 'WAITING_CLICK') {
                if (turnstileIframeState !== 'WAITING_CLICK') {
                    turnstileIframeState = 'WAITING_CLICK';
                    checkboxFirstAppearedTime = Date.now(); // Start 5-second countdown from now!
                }
            } else if (reportedState === 'SUCCESS') {
                turnstileIframeState = 'SUCCESS';
                checkboxFirstAppearedTime = null;
                if (isCaptchaAlertActive) {
                    isCaptchaAlertActive = false;
                    showCaptchaSuccessUI();
                }
            }
        }
    });

    // Global click listener: when user clicks calendar date, month arrow, or button, reset timer immediately!
    document.addEventListener('click', (e) => {
        try {
            const t = e.target;
            if (!t) return;
            const isCalendarOrAction = t.closest && t.closest('.calendar, [role="gridcell"], table, td, .fc-day, .ant-picker, .react-calendar, [class*="calendar"], [class*="day"], [class*="date"], button, [role="button"], a');
            if (isCalendarOrAction) {
                resetTurnstileWatch('user_click');
            }
        } catch(err) {}
    }, true);

    function ensureBannerClickAttached() {
        if (!shadowDomRoot) return;
        const banner = shadowDomRoot.getElementById('captcha-alert-banner');
        if (banner && !banner.dataset.clickAttached) {
            banner.dataset.clickAttached = 'true';
            banner.addEventListener('click', () => {
                scrollToTurnstileElement();
            });
        }
    }

    setInterval(() => {
        ensureBannerClickAttached();

        // 1. Reset on URL navigation
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            resetTurnstileWatch('url_navigation');
        }

        const cfElement = getTurnstileElement();
        const cfInput = document.querySelector('[name="cf-turnstile-response"]');
        const rcInput = document.querySelector('[name="g-recaptcha-response"]');

        const currentTokenVal = (cfInput && cfInput.value) || (rcInput && rcInput.value) || '';
        const isResolved = !!(
            (currentTokenVal && currentTokenVal.length > 10) ||
            turnstileIframeState === 'SUCCESS'
        );

        // 2. Token cleared / reset detection (e.g. date click cleared the token)
        if (wasTurnstileResolved && !isResolved) {
            wasTurnstileResolved = false;
            resetTurnstileWatch('token_cleared');
        }

        // 3. Iframe change / reload detection
        if (cfElement) {
            const currentSrc = cfElement.src || '';
            if (currentSrc && currentSrc !== lastIframeSrc) {
                lastIframeSrc = currentSrc;
                resetTurnstileWatch('iframe_reloaded');
            }
        }

        // If no captcha widget exists on page
        if (!cfElement && !cfInput && !rcInput) {
            if (isCaptchaAlertActive) {
                isCaptchaAlertActive = false;
                dismissCaptchaAlertUI();
            }
            return;
        }

        // 4. Captcha is Resolved -> Success
        if (isResolved) {
            if (!wasTurnstileResolved) {
                wasTurnstileResolved = true;
            }
            if (isCaptchaAlertActive) {
                isCaptchaAlertActive = false;
                showCaptchaSuccessUI();
            }
            return;
        }

        // ==================== CAPTCHA NOT RESOLVED ====================

        // RULE 1: If Cloudflare Turnstile is actively SPINNING / VERIFYING ("ঘুরতে দেখলে"):
        // Absolutely NEVER show red alert while the spinner is spinning!
        if (turnstileIframeState === 'SPINNING') {
            if (isCaptchaAlertActive) {
                isCaptchaAlertActive = false;
                dismissCaptchaAlertUI();
            }
            checkboxFirstAppearedTime = null;
            return;
        }

        // RULE 2: If Turnstile reported 'WAITING_CLICK' (empty checkbox is rendered and ready for human click):
        // Wait FULL 5 SECONDS from the moment the empty checkbox actually appeared!
        if (turnstileIframeState === 'WAITING_CLICK') {
            if (!checkboxFirstAppearedTime) {
                checkboxFirstAppearedTime = Date.now();
            }
            const timeSinceCheckbox = Date.now() - checkboxFirstAppearedTime;
            if (timeSinceCheckbox >= 5000) {
                triggerCaptchaAlertUI();
            }
            return;
        }

        // RULE 3: Fallback (if no postMessage from iframe received):
        // Allow at least 7.5 seconds from last reset/date click (2.5s spinner check + 5s human click grace period)
        const timeSinceReset = Date.now() - turnstileLastResetTime;
        if (timeSinceReset >= 7500) {
            triggerCaptchaAlertUI();
        }
    }, 400);
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


// ===== 6. Intelligent Multi-Month Round-Robin Slot Rotation System =====
let isSlotBookingInProgress = false;
let slotLastAttemptTime = 0;
let slotCurrentIndex = 0;
const slotMonthIndices = {}; // Per-month rotation index map: "YYYY_MM" -> current index in prioritizedQueue
let slotLastAttemptMonthKey = null; // Key of the month ("YYYY_MM") where the last attempt was made
let slotAttemptCount = 0;
let slotNavigatingMonth = false;
let slotLastEmptyMonthSwitchTime = 0;

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
                       pathname.includes('/time slot') ||
                       pathname.includes('/time%20slot') ||
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

function isSlotHeldOrUnavailable() {
    // 1. Toast / Sonner notifications that are currently VISIBLE on screen
    const toasts = document.querySelectorAll('section[aria-label*="Notification"], ol[class*="fixed"] li, div[role="alert"], div.Info, div[class*="toast"], div[class*="notification"]');
    for (const t of toasts) {
        if (isElementVisible(t)) {
            const txt = (t.textContent || '').toLowerCase();
            if (txt.includes('temporarily held') || txt.includes('held by users') || 
                txt.includes('not available') || txt.includes('no slot') || 
                txt.includes('please wait a little longer') || txt.includes('wait a little longer') ||
                txt.includes('try after some time') || txt.includes('try again after') ||
                txt.includes('কিছুক্ষণ পরে') || txt.includes('কিছুক্ষন পরে')) {
                return true;
            }
        }
    }
    return false;
}

function dismissSlotToast() {
    const closeBtns = document.querySelectorAll('section[aria-label*="Notification"] button, ol[class*="fixed"] button, div.Info button, div[role="alert"] button');
    closeBtns.forEach(b => {
        try { b.click(); } catch(e) {}
    });
}

function clickCalendarArrow(direction) {
    const allClickables = document.querySelectorAll('button, a, span, div, svg, i, [role="button"]');
    for (const el of allClickables) {
        if (!isElementVisible(el)) continue;
        const text = el.textContent.trim();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        
        if (direction === 'next') {
            if (text === '>' || text === '›' || text === '❯' || text === '→' || text === '»' ||
                ariaLabel.includes('next') || ariaLabel.includes('forward') ||
                el.classList.contains('next') || el.classList.contains('right-arrow') ||
                el.classList.contains('calendar-next') || el.classList.contains('fc-next-button')) {
                const btn = el.closest('button') || el;
                btn.click();
                try { if (typeof resetTurnstileWatch === 'function') resetTurnstileWatch('month_arrow_click'); } catch(e) {}
                console.log('[IVAC Slot] Clicked NEXT month arrow');
                return true;
            }
        } else {
            if (text === '<' || text === '‹' || text === '❮' || text === '←' || text === '«' ||
                ariaLabel.includes('prev') || ariaLabel.includes('previous') || ariaLabel.includes('back') ||
                el.classList.contains('prev') || el.classList.contains('left-arrow') ||
                el.classList.contains('calendar-prev') || el.classList.contains('fc-prev-button')) {
                const btn = el.closest('button') || el;
                btn.click();
                try { if (typeof resetTurnstileWatch === 'function') resetTurnstileWatch('month_arrow_click'); } catch(e) {}
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

// Proven calendar date detection (matches exactly the green circles/active dates)
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

/**
 * Calculates the last workable booking date of a month.
 * In Bangladesh, IVAC is closed on Friday (5) and Saturday (6).
 * If the month ends on Friday or Saturday, Thursday is the effective last date.
 * @param {number} year - Full year (e.g. 2026)
 * @param {number} month - 0-indexed month (0 = Jan, 9 = Oct, 11 = Dec)
 * @returns {number} The last workable day number of the month (e.g. 29 for Oct 2026)
 */
function getLastWorkableDayOfMonth(year, month) {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const lastDayDate = new Date(year, month, totalDays);
    const dayOfWeek = lastDayDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    
    if (dayOfWeek === 6) { // Saturday
        return totalDays - 2; // Thursday
    } else if (dayOfWeek === 5) { // Friday
        return totalDays - 1; // Thursday
    }
    return totalDays;
}

function getTargetMonthsToScan(res, calendarInfo) {
    const targetMonths = [];
    const now = new Date();
    const curM = now.getMonth();
    const curY = now.getFullYear();
    const nextM = (curM + 1) % 12;
    const nextY = curM === 11 ? curY + 1 : curY;

    const preferredDates = res.preferred_dates || [];
    const isFallbackAllowed = (res.slot_fallback_enabled !== false) || (preferredDates.length === 0);

    // 1. Add months from preferred dates
    if (preferredDates.length > 0) {
        preferredDates.forEach(pref => {
            const parsed = parsePrefDateFull(pref);
            if (parsed) {
                if (parsed.month !== -1 && parsed.year !== -1) {
                    if (!targetMonths.some(m => m.month === parsed.month && m.year === parsed.year)) {
                        targetMonths.push({ month: parsed.month, year: parsed.year });
                    }
                } else {
                    // Plain day number: belongs to current month or next month
                    if (!targetMonths.some(m => m.month === curM && m.year === curY)) {
                        targetMonths.push({ month: curM, year: curY });
                    }
                    if (!targetMonths.some(m => m.month === nextM && m.year === nextY)) {
                        targetMonths.push({ month: nextM, year: nextY });
                    }
                }
            }
        });
    }

    // 2. If fallback is allowed or preferred dates empty, always include current month & next month ONLY (e.g. September & October)
    // NEVER NOVEMBER!
    if (isFallbackAllowed || targetMonths.length === 0) {
        if (!targetMonths.some(m => m.month === curM && m.year === curY)) {
            targetMonths.push({ month: curM, year: curY });
        }
        if (!targetMonths.some(m => m.month === nextM && m.year === nextY)) {
            targetMonths.push({ month: nextM, year: nextY });
        }
    }

    // Sort chronologically
    targetMonths.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
    return targetMonths;
}

function handleSlotRotation() {
    if (!isCalendarPage()) {
        const slotCard = shadowDomRoot ? shadowDomRoot.getElementById('slot-status-card') : null;
        if (slotCard) slotCard.style.display = 'none';
        slotState = 'SEARCHING';
        return;
    }

    if (slotNavigatingMonth) return;

    try {
        chrome.storage.local.get(['slot_booking_enabled', 'preferred_dates', 'ext_enabled', 'slot_fallback_enabled'], (res) => {
            if (chrome.runtime.lastError) return;
            if (res.ext_enabled === false || res.slot_booking_enabled === false) return;

            const preferredDates = res.preferred_dates || [];
            const availableDates = findAvailableCalendarDates();
            const calendarInfo = getCalendarDisplayedMonthYear();
            
            const slotCard = shadowDomRoot ? shadowDomRoot.getElementById('slot-status-card') : null;
            const slotStatusText = shadowDomRoot ? shadowDomRoot.getElementById('slot-status-text') : null;
            const slotCountdownText = shadowDomRoot ? shadowDomRoot.getElementById('slot-countdown-text') : null;

            if (slotCard) slotCard.style.display = 'block';

            const now = Date.now();

            // ==================== STATE: WAITING_FOR_BTN ====================
            if (slotState === 'WAITING_FOR_BTN') {
                const timeWaiting = now - slotDateClickTime;
                
                // 1. Check if slots are temporarily held or unavailable toast appears
                if (isSlotHeldOrUnavailable()) {
                    console.log('[IVAC Slot] Toast detected: Slots on selected date are temporarily held or server cooldown triggered.');
                    dismissSlotToast();
                    slotLastAttemptTime = now; // START STRICT 20-SECOND COOLDOWN
                    slotAttemptCount++;
                    if (slotLastAttemptMonthKey) {
                        slotMonthIndices[slotLastAttemptMonthKey] = (slotMonthIndices[slotLastAttemptMonthKey] || 0) + 1;
                    }
                    slotState = 'SEARCHING';
                    if (slotStatusText) slotStatusText.textContent = '⏳ ২০ সে. পর রি-ট্রাই করবে...';
                    if (slotCountdownText) slotCountdownText.textContent = 'কাউন্টডাউন: 20s';
                    return;
                }

                // 2. Check if Captcha is resolved and Continue button is visible
                const continueBtn = findButtonByText("continue booking") || findButtonByText("Continue Booking");
                if (isCaptchaResolved() && continueBtn && isElementVisible(continueBtn) && !continueBtn.disabled) {
                    console.log('[IVAC Slot] Clicking Continue Booking!');
                    continueBtn.click();
                    slotLastAttemptTime = now; // START STRICT 20-SECOND COOLDOWN
                    slotAttemptCount++;
                    if (slotLastAttemptMonthKey) {
                        slotMonthIndices[slotLastAttemptMonthKey] = (slotMonthIndices[slotLastAttemptMonthKey] || 0) + 1;
                    }
                    slotState = 'SEARCHING';
                    
                    if (slotStatusText) slotStatusText.textContent = '✅ Continue Booking ক্লিক করা হয়েছে!';
                    if (slotCountdownText) slotCountdownText.textContent = 'পেমেন্ট পেজে রিডাইরেক্ট অপেক্ষা...';
                    return;
                }
                
                // 3. Check Timeout (Waited 4 seconds, but button didn't appear -> server jam or no slots for this date)
                if (timeWaiting > 4000) {
                    console.log('[IVAC Slot] Timed out waiting for Continue button (4s). Reverting to SEARCHING.');
                    slotLastAttemptTime = now; // Set 20-second cooldown
                    slotAttemptCount++;
                    if (slotLastAttemptMonthKey) {
                        slotMonthIndices[slotLastAttemptMonthKey] = (slotMonthIndices[slotLastAttemptMonthKey] || 0) + 1;
                    }
                    slotState = 'SEARCHING';
                    
                    if (slotStatusText) slotStatusText.textContent = '⏳ ২০ সে. পর রি-ট্রাই করবে...';
                    if (slotCountdownText) slotCountdownText.textContent = 'কাউন্টডাউন: 20s';
                    return;
                }

                // 4. Still Waiting for Button
                const remainingWait = Math.max(0, Math.ceil((4000 - timeWaiting) / 1000));
                if (slotStatusText) slotStatusText.textContent = '⏳ ক্যাপচা/বাটন লোডিং চেক...';
                if (slotCountdownText) slotCountdownText.textContent = `অপেক্ষা: ${remainingWait}s`;
                return;
            }

            // ==================== STATE: SEARCHING ====================

            // 20 Seconds Global Cooldown between attempts to strictly prevent "কিছুক্ষন পরে চেষ্টা করুন" notice
            // DO NOT TOUCH THE DOM OR CLICK ARROWS DURING THIS 20 SECONDS!
            const elapsedSinceAttempt = now - slotLastAttemptTime;
            if (slotLastAttemptTime > 0 && elapsedSinceAttempt < 20000) {
                const remainingSec = Math.ceil((20000 - elapsedSinceAttempt) / 1000);
                if (slotStatusText) slotStatusText.textContent = '⏳ ২০ সে. পর রি-ট্রাই করবে...';
                if (slotCountdownText) slotCountdownText.textContent = 'কাউন্টডাউন: ' + remainingSec + 's';
                return; // STRICTLY WAIT! Zero DOM manipulation during 20 seconds.
            }

            if (!calendarInfo) return; 

            const currentMonth = calendarInfo.month;
            const currentYear = calendarInfo.year;
            const currentTotal = currentYear * 12 + currentMonth;
            const currentMonthKey = `${currentYear}_${currentMonth}`;

            // Determine all target months to scan (e.g. September & October ONLY)
            const targetMonths = getTargetMonthsToScan(res, calendarInfo);
            const isCurrentMonthInTargets = targetMonths.some(m => m.month === currentMonth && m.year === currentYear);

            // If currently displayed month is NOT in targets (e.g. somehow in November or beyond), navigate back immediately!
            if (!isCurrentMonthInTargets && targetMonths.length > 0) {
                let targetM = targetMonths[0];
                const maxTargetTotal = targetMonths[targetMonths.length - 1].year * 12 + targetMonths[targetMonths.length - 1].month;
                if (currentTotal > maxTargetTotal) {
                    targetM = targetMonths[targetMonths.length - 1]; // e.g. October if we're in November
                }
                const targetTotal = targetM.year * 12 + targetM.month;
                const direction = targetTotal > currentTotal ? 'next' : 'prev';
                console.log(`[IVAC Slot] Current month (${MONTH_NAMES_EN[currentMonth]}) not needed, navigating ${direction} to ${MONTH_NAMES_EN[targetM.month]}`);
                if (slotStatusText) slotStatusText.textContent = '📅 সঠিক মাসে যাচ্ছে (' + MONTH_NAMES_EN[targetM.month].toUpperCase() + ')...';
                if (slotCountdownText) slotCountdownText.textContent = '';
                
                slotNavigatingMonth = true;
                clickCalendarArrow(direction);
                setTimeout(() => { slotNavigatingMonth = false; }, 800);
                return;
            }

            // Calculate prioritized queue for currently displayed month
            let prioritizedQueue = [];
            const isFallbackAllowed = (res.slot_fallback_enabled !== false) || (preferredDates.length === 0);

            // 1. First priority: Add preferred dates matching current month
            if (preferredDates.length > 0) {
                preferredDates.forEach(pref => {
                    const parsed = parsePrefDateFull(pref);
                    if (parsed) {
                        let matched = null;
                        if (parsed.month === -1) {
                            matched = availableDates.find(d => d.day === parsed.day);
                        } else if (parsed.month === currentMonth && parsed.year === currentYear) {
                            matched = availableDates.find(d => d.day === parsed.day);
                        }
                        if (matched && !prioritizedQueue.includes(matched)) {
                            prioritizedQueue.push(matched);
                        }
                    }
                });
            }

            // 2. Second priority: If Fallback is enabled or preferred dates empty, add all other available date circles
            if (isFallbackAllowed) {
                availableDates.forEach(avail => {
                    if (!prioritizedQueue.includes(avail)) {
                        prioritizedQueue.push(avail);
                    }
                });
            }

            // Other target months in the round-robin cycle
            const otherTargetMonths = targetMonths.filter(m => (m.year * 12 + m.month) !== currentTotal);
            const currentIdx = targetMonths.findIndex(m => (m.year * 12 + m.month) === currentTotal);
            const isLastTargetMonth = (currentIdx !== -1) && (currentIdx === targetMonths.length - 1);

            // ==================== CASE 1: NO AVAILABLE DATES IN CURRENT MONTH ====================
            if (prioritizedQueue.length === 0) {
                if (otherTargetMonths.length > 0) {
                    const timeSinceEmptySwitch = now - slotLastEmptyMonthSwitchTime;
                    if (timeSinceEmptySwitch < 5000) {
                        const remain = Math.ceil((5000 - timeSinceEmptySwitch) / 1000);
                        if (slotStatusText) slotStatusText.textContent = `⏳ এই মাসে কোনো স্লট নেই (${remain}s)...`;
                        if (slotCountdownText) slotCountdownText.textContent = 'অন্য মাস স্ক্যান অপেক্ষা';
                        return;
                    }

                    const nextTarget = targetMonths[(currentIdx + 1) % targetMonths.length];
                    const nextTotal = nextTarget.year * 12 + nextTarget.month;
                    const direction = nextTotal > currentTotal ? 'next' : 'prev';

                    const curMonthName = MONTH_NAMES_EN[currentMonth].toUpperCase();
                    const nextMonthName = MONTH_NAMES_EN[nextTarget.month].toUpperCase();
                    console.log(`[IVAC Slot] No slots in [${curMonthName}]. Switching to [${nextMonthName}] via ${direction}`);

                    if (slotStatusText) slotStatusText.textContent = `📅 স্লট নেই, অন্য মাস চেক: ${nextMonthName}...`;
                    if (slotCountdownText) slotCountdownText.textContent = 'মাস পরিবর্তন হচ্ছে';

                    slotNavigatingMonth = true;
                    slotLastEmptyMonthSwitchTime = now;
                    slotLastAttemptMonthKey = null;
                    clickCalendarArrow(direction);
                    setTimeout(() => { slotNavigatingMonth = false; }, 1000);
                    return;
                } else {
                    if (slotStatusText) slotStatusText.textContent = '⏳ কোনো স্লট নেই...';
                    if (slotCountdownText) slotCountdownText.textContent = 'তারিখ আসার অপেক্ষায় স্ক্যানিং';
                    return;
                }
            }

            // ==================== CASE 2: CURRENT MONTH HAS AVAILABLE DATES ====================
            let monthDateIdx = slotMonthIndices[currentMonthKey] || 0;

            // Check if all dates in current month's queue have been checked
            if (monthDateIdx >= prioritizedQueue.length) {
                const lastCheckedDateObj = prioritizedQueue[prioritizedQueue.length - 1];
                const lastCheckedDay = lastCheckedDateObj ? lastCheckedDateObj.day : 0;
                const lastWorkableDay = getLastWorkableDayOfMonth(currentYear, currentMonth);

                console.log(`[IVAC Slot] Current month queue complete. Last checked: ${lastCheckedDay}, Last workable day: ${lastWorkableDay}`);

                // User Rule: If this is an earlier target month (e.g. October),
                // ONLY switch to next month if lastCheckedDay was the month's last workable date (Thursday if ends on Fri/Sat)!
                if (!isLastTargetMonth && otherTargetMonths.length > 0 && lastCheckedDay >= lastWorkableDay) {
                    const nextTarget = targetMonths[(currentIdx + 1) % targetMonths.length];
                    const nextTotal = nextTarget.year * 12 + nextTarget.month;
                    const direction = nextTotal > currentTotal ? 'next' : 'prev';
                    const nextMonthName = MONTH_NAMES_EN[nextTarget.month].toUpperCase();

                    console.log(`[IVAC Slot] Reached end of month (${lastCheckedDay} >= ${lastWorkableDay}). Moving to next month: ${nextMonthName}`);

                    if (slotStatusText) slotStatusText.textContent = `📅 শেষ তারিখ সম্পন্ন, পরবর্তী মাস: ${nextMonthName}...`;
                    if (slotCountdownText) slotCountdownText.textContent = 'অন্য মাসে স্লট খোঁজা হচ্ছে';

                    slotMonthIndices[currentMonthKey] = 0; // Reset queue for this month
                    slotNavigatingMonth = true;
                    slotLastAttemptMonthKey = null;
                    clickCalendarArrow(direction);
                    setTimeout(() => { slotNavigatingMonth = false; }, 1000);
                    return;
                } else if (isLastTargetMonth && otherTargetMonths.length > 0) {
                    // Finished all dates in the last target month (e.g. November). Return to the first month (e.g. October)!
                    const nextTarget = targetMonths[0];
                    const nextMonthName = MONTH_NAMES_EN[nextTarget.month].toUpperCase();

                    console.log(`[IVAC Slot] Finished checking last target month. Returning to: ${nextMonthName}`);

                    if (slotStatusText) slotStatusText.textContent = `📅 পুনরায় প্রথম মাসে ফিরছে: ${nextMonthName}...`;
                    if (slotCountdownText) slotCountdownText.textContent = 'মাস পরিবর্তন হচ্ছে';

                    slotMonthIndices[currentMonthKey] = 0;
                    slotNavigatingMonth = true;
                    slotLastAttemptMonthKey = null;
                    clickCalendarArrow('prev');
                    setTimeout(() => { slotNavigatingMonth = false; }, 1000);
                    return;
                } else {
                    // Month end NOT reached (e.g. 8 < 29)!
                    // Stay in current month and loop back to the first available date!
                    console.log(`[IVAC Slot] Not at month end (${lastCheckedDay} < ${lastWorkableDay}). Looping back to first date in current month.`);
                    slotMonthIndices[currentMonthKey] = 0;
                    monthDateIdx = 0;
                }
            }

            const targetDateObj = prioritizedQueue[monthDateIdx];
            if (!targetDateObj) return;

            // CLICK THE DATE CIRCLE (HEAD's exact working method)
            targetDateObj.element.click();
            try {
                if (typeof resetTurnstileWatch === 'function') {
                    resetTurnstileWatch('slot_rotation_date_click');
                }
            } catch(e) {}

            const monthLabel = MONTH_NAMES_EN[currentMonth].charAt(0).toUpperCase() + MONTH_NAMES_EN[currentMonth].slice(1);
            console.log(`[IVAC Slot] Selected date: ${targetDateObj.day} ${monthLabel} (Index #${monthDateIdx + 1}/${prioritizedQueue.length})`);

            // Transition to WAITING State
            slotState = 'WAITING_FOR_BTN';
            slotDateClickTime = now;
            slotLastClickedTarget = targetDateObj;
            slotLastAttemptMonthKey = currentMonthKey;

            if (slotStatusText) slotStatusText.textContent = `📅 ${targetDateObj.day} ${monthLabel} সিলেক্টেড!`;
            if (slotCountdownText) slotCountdownText.textContent = `মোট চেষ্টা #${slotAttemptCount + 1}`;
        });
    } catch(e) {
        console.error('[IVAC Slot] Error in handleSlotRotation:', e);
    }
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
    if (!isFloatingWidgetHidden) {
        ensurePinWidgetAttached();
    }
    if (!isCalendarPage()) {
        if (shadowDomRoot) {
            const p = shadowDomRoot.getElementById('slot-timer-panel');
            if (p) p.style.display = 'none';
        }
        return;
    }
    
    const now = Date.now();
    const elapsedSinceAttempt = now - slotLastAttemptTime;
    
    if (slotNavigatingMonth) {
        updateSlotTimerUI('📅 মাস পরিবর্তন হচ্ছে...', 0, slotAttemptCount || 1);
    } else if (slotLastAttemptTime > 0 && elapsedSinceAttempt < 20000) {
        const remainingSec = Math.ceil((20000 - elapsedSinceAttempt) / 1000);
        updateSlotTimerUI('⏳ ২০ সে. পর রি-ট্রাই করবে...', remainingSec, slotAttemptCount || 1);
    } else if (slotState === 'WAITING_FOR_BTN') {
        const timeWaiting = now - slotDateClickTime;
        const remainingSec = Math.max(0, Math.ceil((4000 - timeWaiting) / 1000));
        updateSlotTimerUI('📅 বাটন/ক্যাপচা লোডিং চেক...', remainingSec, slotAttemptCount || 1);
    } else {
        updateSlotTimerUI('🔄 স্লট স্ক্যানিং চলছে...', 0, slotAttemptCount || 1);
    }
}, 500);

// ===== Slot Rotation Timer (runs every 1 second on calendar page) =====
setInterval(() => {
    handleSlotRotation();
}, 1000);



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
        if (!isFloatingWidgetHidden && !document.getElementById('ivac-pin-widget-root')) {
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
                        return (text.includes('Pay') && (text.includes('৳') || text.includes('\u09F3') || text.includes('BDT') || text.includes('Tk') || /Pay\s*\(?[\d,]/.test(text))) && !btn.disabled;
                    });

                    if (payButton) {
                        paymentStepDone.payListenerAttached = true;
                        payButton.addEventListener('click', () => {
                            try {
                                const amountMatch = payButton.textContent.match(/[\d,]+\.?\d*/);
                                const amount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
                                if (amount > 0 && !sessionStorage.getItem('dgpay_pay_tracked')) {
                                    sessionStorage.setItem('dgpay_pay_tracked', 'true');
                                    chrome.storage.local.set({ last_amount_2: amount, last_amount_2_time: Date.now() });
                                    const detectedMethod = detectPaymentMethodOnPage();
                                    const stageToSend = detectedMethod || 'pay_clicked';
                                    chrome.storage.local.get(['last_amount_1'], (st) => {
                                        sendRecordPayment({
                                            amount_1: st.last_amount_1 || 0,
                                            amount_2: amount,
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

                    // Find Pay button - it contains "Pay" and a ৳ amount
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    const payBtn = buttons.find(btn => {
                        const text = btn.textContent.trim();
                        return (text.includes('Pay') && (text.includes('৳') || text.includes('\u09F3') || text.includes('BDT') || text.includes('Tk') || /Pay\s*\(?[\d,]/.test(text))) &&
                               !btn.disabled;
                    });

                    if (payBtn) {
                        // Check button is not greyed out/loading
                        const style = window.getComputedStyle(payBtn);
                        if (style.opacity !== '0.5' && style.pointerEvents !== 'none') {
                            if (dgeSafeClick(payBtn, 'payBtn')) {
                                paymentStepDone.payClicked = true;
                                console.log('[IVAC] Pay বাটনে ক্লিক করা হয়েছে!');
                                try {
                                    const amountMatch = payBtn.textContent.match(/[\d,]+\.?\d*/);
                                    const amount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
                                    if (amount > 0) {
                                        chrome.storage.local.set({ last_amount_2: amount, last_amount_2_time: Date.now() });
                                        chrome.storage.local.get(['last_amount_1'], (st) => {
                                            sendRecordPayment({
                                                amount_1: st.last_amount_1 || 0,
                                                amount_2: amount,
                                                amount: amount,
                                                status: 'initiated',
                                                stage: 'pay_clicked',
                                                rocket_account: (resolved.account ? resolved.account.number : resolved.phone) || '',
                                                description: isAutoPay ? 'Auto Pay Clicked' : 'Manual Pay Clicked'
                                            });
                                        });
                                    }
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
// ecom1.dutchbanglabank.com বা dutchbanglabank.com এ কাজ করবে (শুধু Rocket)
(function() {
    if (!window.location.hostname.includes('dutchbanglabank.com')) return;

    console.log('[IVAC] DBBL Nexus Gateway ডিটেক্ট হয়েছে!');

    let dbblClickTimes = {};
    let dbblTrackedStage = null;
    let dbblTrackedError = false;
    let dbblOtpAttempted = false;
    let dbblIsFetchingOtp = false;

    function dbblSafeClick(element, key) {
        const now = Date.now();
        if (!dbblClickTimes[key] || now - dbblClickTimes[key] > 1500) {
            triggerElementClick(element);
            dbblClickTimes[key] = now;
            console.log(`[IVAC] DBBL ক্লিক: ${key}`);
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

                // Rocket নম্বর: 11 ডিজিট মোবাইল + 1 ডিজিট এক্সট্রা = ১২ ডিজিট
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
                    sessionStorage.removeItem('dbbl_otp_attempted');
                    dbblOtpAttempted = false;
                    dbblIsFetchingOtp = false;

                    const isAlreadyTracked = sessionStorage.getItem('dbbl_tracked_init') === 'true' || dbblTrackedStage === 'rocket' || dbblTrackedStage === 'account_submitted' || window.__dbbl_init_tracked;
                    if (!isAlreadyTracked) {
                        let amount = 0;
                        const amountMatch = pageText.match(/amount[\s:]*([\d,]+\.?\d*)/i);
                        if (amountMatch) {
                            amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                        }
                        
                        if (amount >= 0) {
                            dbblTrackedStage = 'rocket';
                            window.__dbbl_init_tracked = true;
                            sessionStorage.setItem('dbbl_tracked_init', 'true');

                            const targetAccount = resolved.phone || candidatePhones[0] || '';
                            const cleanAccount = targetAccount.replace(/[^0-9]/g, '');
                            const timeBucket = Math.floor(Date.now() / 60000);
                            const profId = (currentProfileId || 'prof_default').replace(/[^a-zA-Z0-9_]/g, '');
                            const paymentSessionId = `pay_${profId}_${cleanAccount || 'acc'}_${timeBucket}`;

                            sendRecordPayment({
                                payment_session_id: paymentSessionId,
                                amount: amount,
                                status: 'initiated',
                                stage: 'rocket',
                                rocket_account: targetAccount,
                                description: ''
                            }, (d) => {
                                if (d && d.payment_id) {
                                    chrome.storage.local.set({ current_payment_id: d.payment_id });
                                }
                            });
                            console.log('[IVAC] DBBL Amount Extracted & Tracked: ' + amount + ' (Session ID: ' + paymentSessionId + ')');
                        }
                    }
                }

                // ===== পেজ ১: Mobile Account Information (12-digit Account + PIN + Submit) =====
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

                    // Account ফিল করো (Rocket = ১২ ডিজিটের ফুল নম্বর)
                    if (accountInput && accountInput.value !== rocketFullNumber && rocketFullNumber) {
                        setDbblInputValue(accountInput, rocketFullNumber);
                        console.log(`[IVAC] Rocket Account (12 digits) বসানো হয়েছে: ${rocketFullNumber}`);
                    }

                    // PIN ফিল করো (Rocket PIN)
                    const rocketPin = resolved.rocket_pin;
                    if (pinInput && pinInput.value !== rocketPin && rocketPin) {
                        setDbblInputValue(pinInput, rocketPin);
                        console.log('[IVAC] Rocket PIN বসানো হয়েছে');
                    }

                    // Account + PIN দুটোই ফিল হলে SUBMIT ক্লিক করো
                    if (accountInput && pinInput && accountInput.value.length >= 11 && pinInput.value.length >= 4) {
                        const submitBtn = Array.from(document.querySelectorAll('input[type="submit"], button, input[type="image"], a, #pay')).find(el => {
                            if (el.id === 'pay' || (el.className && typeof el.className === 'string' && el.className.includes('subBtn'))) return true;
                            if (el.type === 'submit') return true;
                            const val = (el.value || el.textContent || el.alt || el.name || el.id || el.src || '').toLowerCase();
                            return val.includes('submit') || val === 'pay';
                        });
                        
                        if (submitBtn) {
                            dbblTrackedStage = 'account_submitted';
                            dbblSafeClick(submitBtn, 'submit');
                        }
                    }
                }

                // ===== পেজ ২: OTP (One Time Password) =====
                if (pageText.includes('otp') || pageText.includes('one time password') || pageText.includes('security code')) {
                    // ১ বার মানে ১ বারই:
                    // একবার যদি এই সেশনে ওটিপি বসানো বা সাবমিট চেষ্টা হয়ে থাকে, তবে আর কখনোই দ্বিতীয়বার বসাবে না।
                    // ওটিপি ভুল হলেও, বক্স ফাঁকা হয়ে গেলেও, বা নতুন ওটিপি এলেও হাত দিবে না। ব্যবহারকারী নিজে ম্যানুয়ালি বসাবেন।
                    if (dbblOtpAttempted || sessionStorage.getItem('dbbl_otp_attempted') === 'true') {
                        return;
                    }

                    // প্যারালাল একাধিক কল রোধ করতে
                    if (dbblIsFetchingOtp) {
                        return;
                    }

                    // OTP পেজে আসার টাইম রেকর্ড করা (১৩ সেকেন্ড অপেক্ষা করার জন্য)
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
                        // যদি ইউজার ইতিমধ্যে নিজে কিছু টাইপ করে থাকেন, তবে ওভাররাইট করবে না
                        if (otpInput.value && otpInput.value.trim().length > 0) {
                            return;
                        }

                        dbblIsFetchingOtp = true;

                        (async () => {
                            try {
                                for (const ph of candidatePhones) {
                                    if (dbblOtpAttempted || sessionStorage.getItem('dbbl_otp_attempted') === 'true') {
                                        break;
                                    }
                                    const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'fetchOtp', phone: ph, source: 'R' }, r));
                                    if (d && d.success && d.data && d.data.otp_string) {
                                        const incomingOtp = d.data.otp_string;

                                        // STRICT 1-TIME LOCK:
                                        // ওটিপি বসানোর সাথে সাথে ফ্ল্যাগ সেট হবে যেন আর কখনোই নতুন বা পুরনো ওটিপি না বসায়
                                        dbblOtpAttempted = true;
                                        sessionStorage.setItem('dbbl_otp_attempted', 'true');
                                        sessionStorage.setItem('dbbl_last_submitted_otp', incomingOtp);

                                        setDbblInputValue(otpInput, incomingOtp);
                                        console.log(`[IVAC] DBBL Rocket OTP ইনপুটে বসানো হয়েছে (একমাত্র ১ বার ট্রাই): ${incomingOtp}`);

                                        // সার্ভারে used মার্ক করো
                                        chrome.runtime.sendMessage({ action: 'markUsed', phone: ph, source: 'R' });

                                        const goBtn = findDbblGoBtn();
                                        if (goBtn) {
                                            const delay = Math.floor(Math.random() * 300) + 150;
                                            setTimeout(() => {
                                                triggerElementClick(goBtn);
                                                console.log(`[IVAC] DBBL Go বাটনে ক্লিক করা হয়েছে (${delay}ms) OTP: ${incomingOtp}`);
                                            }, delay);
                                        }
                                        break; // একমাত্র ১ বার ট্রাই সম্পন্ন, লুপ শেষ
                                    }
                                }
                            } catch(e) {
                                console.error('[IVAC] DBBL OTP fetch error:', e);
                            } finally {
                                dbblIsFetchingOtp = false;
                            }
                        })();
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
    let nagadOtpAttempted = false;
    
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
                    sessionStorage.removeItem('nagad_otp_attempted');
                    nagadOtpAttempted = false;
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
                    if (nagadOtpAttempted || sessionStorage.getItem('nagad_otp_attempted') === 'true') {
                        if (nagadOtpPolling) {
                            clearInterval(nagadOtpPolling);
                            nagadOtpPolling = null;
                        }
                        return;
                    }

                    const otpInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])')).filter(inp => {
                        const rect = inp.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && !inp.disabled;
                    });
                    
                    if (otpInputs.length > 0 && !nagadOtpPolling) {
                        nagadOtpPolling = setInterval(async () => {
                            try {
                                if (nagadOtpAttempted || sessionStorage.getItem('nagad_otp_attempted') === 'true') {
                                    clearInterval(nagadOtpPolling);
                                    nagadOtpPolling = null;
                                    return;
                                }
                                const d = await new Promise(r => chrome.runtime.sendMessage({ action: 'fetchOtp', phone: nagadNumber, source: 'N' }, r));
                                if (d && d.success && d.data && !d.data.used && d.data.otp_string) {
                                    const otp = d.data.otp_string;
                                    nagadOtpAttempted = true;
                                    sessionStorage.setItem('nagad_otp_attempted', 'true');
                                    clearInterval(nagadOtpPolling);
                                    nagadOtpPolling = null;

                                    const currentOtpInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])')).filter(inp => {
                                        const rect = inp.getBoundingClientRect();
                                        return rect.width > 0 && rect.height > 0 && !inp.disabled;
                                    });
                                    
                                    if (currentOtpInputs.length >= 4) {
                                        fillMultiBoxInputs(currentOtpInputs, otp);
                                    } else if (currentOtpInputs.length === 1) {
                                        setReactInputValue(currentOtpInputs[0], otp);
                                    }
                                    
                                    console.log(`[IVAC] Nagad OTP বসানো হয়েছে (একমাত্র ১ বার): ${otp}`);
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
    let bkashOtpAttempted = false;
    let bkashIsFetchingOtp = false;

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
                    sessionStorage.removeItem('bkash_otp_attempted');
                    bkashOtpAttempted = false;
                    bkashIsFetchingOtp = false;
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
                    if (bkashOtpAttempted || sessionStorage.getItem('bkash_otp_attempted') === 'true') {
                        return; // Strictly 1 attempt!
                    }

                    if (bkashIsFetchingOtp) {
                        return;
                    }

                    if (mainInput.value && mainInput.value.trim().length > 0) {
                        return;
                    }

                    bkashIsFetchingOtp = true;

                    // Fetch latest OTP for bkash number
                    chrome.runtime.sendMessage({ action: 'fetchOtp', phone: bkashNumber, source: 'B' }, (d) => {
                        bkashIsFetchingOtp = false;
                        if (bkashOtpAttempted || sessionStorage.getItem('bkash_otp_attempted') === 'true') {
                            return;
                        }
                        if (d && d.success && d.data && d.data.otp_string) {
                            const otp = d.data.otp_string;
                            bkashOtpAttempted = true;
                            sessionStorage.setItem('bkash_otp_attempted', 'true');

                            setBkashValue(mainInput, otp);
                            console.log('[IVAC] bKash OTP বসানো হয়েছে (একমাত্র ১ বার):', otp);
                            chrome.runtime.sendMessage({ action: 'markUsed', phone: bkashNumber, source: 'B' });

                            setTimeout(() => {
                                triggerBkashConfirm(mainInput);
                                lastConfirmClickTime = Date.now();
                            }, 300);
                        }
                    });
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


// ========================================================================================
// ===== IVAC DYNAMIC SMART AUTO-FILL ENGINE (CLEAN ONE-TIME FILL & RESILIENT) =====
// ========================================================================================

/**
 * Robust Date Parser:
 * Parses various date formats from sidebar (15-OCT-1984, 15-NOV-1997, 15.10.1984, 1984-10-15)
 */
function parseDateComponents(dobStr) {
    if (!dobStr || typeof dobStr !== 'string') return null;
    dobStr = dobStr.trim();
    if (!dobStr) return null;

    const monthMap = {
        'jan': 1, 'january': 1,
        'feb': 2, 'february': 2,
        'mar': 3, 'march': 3,
        'apr': 4, 'april': 4,
        'may': 5,
        'jun': 6, 'june': 6,
        'jul': 7, 'july': 7,
        'aug': 8, 'august': 8,
        'sep': 9, 'september': 9,
        'oct': 10, 'october': 10,
        'nov': 11, 'november': 11,
        'dec': 12, 'december': 12
    };

    let day = null, month = null, year = null;

    // Format 1: 15-OCT-1984 or 15-NOV-1997 or 15 Nov 1997
    const alphaMatch = dobStr.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{4})$/);
    if (alphaMatch) {
        day = parseInt(alphaMatch[1], 10);
        const mStr = alphaMatch[2].toLowerCase();
        month = monthMap[mStr] || null;
        year = parseInt(alphaMatch[3], 10);
    } else {
        // Format 2: DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = dobStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (dmyMatch) {
            day = parseInt(dmyMatch[1], 10);
            month = parseInt(dmyMatch[2], 10);
            year = parseInt(dmyMatch[3], 10);
        } else {
            // Format 3: YYYY-MM-DD or YYYY.MM.DD
            const ymdMatch = dobStr.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
            if (ymdMatch) {
                year = parseInt(ymdMatch[1], 10);
                month = parseInt(ymdMatch[2], 10);
                day = parseInt(ymdMatch[3], 10);
            }
        }
    }

    if (day && month && year && month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1900 && year < 2100) {
        const dd = String(day).padStart(2, '0');
        const mm = String(month).padStart(2, '0');
        const yyyy = String(year);
        return {
            day,
            month,
            year,
            formattedDot: `${dd}.${mm}.${yyyy}`,   // 15.11.1997
            formattedSlash: `${dd}/${mm}/${yyyy}`, // 15/11/1997
            formattedDash: `${dd}-${mm}-${yyyy}`,  // 15-11-1997
            formattedIso: `${yyyy}-${mm}-${dd}`,   // 1997-11-15
            dateObj: new Date(year, month - 1, day)
        };
    }
    return null;
}

/**
 * Classifies an <input> element strictly by its associated <label>.
 * Immune to box reordering. Never classifies an <input> as DOB.
 */
function classifyIvacInputField(input) {
    if (!input || input.tagName !== 'INPUT') return null;

    const type = (input.type || 'text').toLowerCase();
    if (['radio', 'checkbox', 'submit', 'button', 'file', 'hidden'].includes(type)) return null;
    if (input.maxLength === 1 || input.id === 'otp' || input.name === 'otp' || input.classList.contains('otp-input')) return null;

    // Collect label specifically associated with this input
    let labelText = '';
    const flexBox = input.closest('div.flex-1') || input.parentElement;
    if (flexBox) {
        const lbl = flexBox.querySelector('label');
        if (lbl) labelText = (lbl.textContent || '').trim();
    }
    if (!labelText) {
        const card = input.closest('div[class*="rounded-xl"], div[class*="border"]');
        if (card) {
            const lbl = card.querySelector('label');
            if (lbl) labelText = (lbl.textContent || '').trim();
        }
    }
    if (!labelText && input.id) {
        const forLabel = document.querySelector(`label[for="${input.id}"]`);
        if (forLabel) labelText = (forLabel.textContent || '').trim();
    }

    const placeholder = (input.placeholder || '').toLowerCase().trim();
    const name = (input.name || '').toLowerCase().trim();
    const id = (input.id || '').toLowerCase().trim();
    const l = labelText.toLowerCase();

    // 1. CITIZENSHIP / NATIONAL ID (NID)
    // Label on IVAC: "Citizenship / National ID No *"
    if (l.includes('citizenship') || l.includes('national id') || l.includes('nid') || 
        placeholder.includes('3333') || name.includes('nid') || id.includes('nid')) {
        return 'nid';
    }

    // 2. GIVEN NAME (As in Passport)
    if ((l.includes('given name') || l.includes('given') || placeholder.includes('rojon') || name.includes('given') || id.includes('given')) &&
        !l.includes('surname') && !l.includes('last name')) {
        return 'givenName';
    }

    // 3. SURNAME (As in Passport)
    if ((l.includes('surname') || l.includes('last name') || placeholder.includes('ali') || name.includes('surname') || id.includes('surname')) &&
        !l.includes('given')) {
        return 'surname';
    }

    // 4. PASSPORT NUMBER
    // Label on IVAC: "Passport Number *"
    if (l.includes('passport number') || l.includes('passport no') || l.includes('passport #') || 
        (l.includes('passport') && !l.includes('given') && !l.includes('surname')) ||
        placeholder.includes('1234567890') || name.includes('passport') || id.includes('passport')) {
        return 'passport';
    }

    // 5. WEB FILE NO
    if (l.includes('web file') || l.includes('webfile') || placeholder.includes('bgdr')) {
        return 'webFile';
    }

    // 6. PHONE / MOBILE
    if (l.includes('phone') || l.includes('mobile') || l.includes('contact') || placeholder.includes('017') || type === 'tel') {
        return 'phone';
    }

    // 7. EMAIL
    if (l.includes('email') || l.includes('mail') || type === 'email' || placeholder.includes('@')) {
        return 'email';
    }

    // 8. PASSWORD
    if (type === 'password') {
        return 'password';
    }

    return null;
}

/**
 * Locate the Date of Birth popover trigger element on IVAC page
 */
function findDobPopoverTrigger() {
    const candidateTriggers = Array.from(document.querySelectorAll('div[data-slot="popover-trigger"], [aria-haspopup="dialog"], div.cursor-pointer'));
    for (const el of candidateTriggers) {
        const card = el.closest('div[class*="rounded-xl"]') || el;
        const lbl = card.querySelector('label');
        const txt = ((lbl ? lbl.textContent : '') + ' ' + el.textContent).toLowerCase();
        if (txt.includes('date of birth') || txt.includes('dob') || card.querySelector('.lucide-calendar')) {
            return el;
        }
    }
    return null;
}

/**
 * Safe, Native Calendar Popover Selection:
 * Completely avoids mutating React's textContent or Fiber internals.
 * Uses real native user-like clicks so React updates state naturally and NEVER crashes!
 */
async function autoSelectCalendarDate(triggerEl, parsedDate) {
    if (!triggerEl || !parsedDate) return;

    try {
        const isClosed = triggerEl.getAttribute('data-state') === 'closed' || 
                         triggerEl.getAttribute('aria-expanded') === 'false';

        // Open popover
        if (isClosed) {
            triggerEl.click();
        }

        // Wait a moment for popover to mount
        await new Promise(r => setTimeout(r, 140));

        const popovers = Array.from(document.querySelectorAll('div[data-radix-popper-content-wrapper], div[role="dialog"], div[data-slot="popover-content"], div.rdp'));
        const activePopover = popovers.find(p => p.offsetParent !== null || window.getComputedStyle(p).display !== 'none');

        if (activePopover) {
            // Select Year & Month if native dropdown selects exist
            const selects = Array.from(activePopover.querySelectorAll('select'));
            for (const sel of selects) {
                const opts = Array.from(sel.options);
                // Year select:
                if (opts.some(o => /^\d{4}$/.test((o.value || o.text || '').trim()))) {
                    const targetYearStr = String(parsedDate.year);
                    const opt = opts.find(o => o.value === targetYearStr || o.text.trim() === targetYearStr);
                    if (opt) {
                        sel.value = opt.value;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    continue;
                }
                // Month select:
                const shortM = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][parsedDate.month - 1];
                const opt = opts.find(o => {
                    const val = (o.value || '').toLowerCase();
                    const txt = (o.text || '').toLowerCase();
                    return val === String(parsedDate.month - 1) || val === String(parsedDate.month) || txt.includes(shortM) || val.includes(shortM);
                });
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            await new Promise(r => setTimeout(r, 100));

            // Find and click the target day button
            const allButtons = Array.from(activePopover.querySelectorAll('button'));
            const dayStr = String(parsedDate.day);

            const dayBtn = allButtons.find(b => {
                if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
                const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
                if (ariaLabel.includes('previous') || ariaLabel.includes('next') || ariaLabel.includes('month') || ariaLabel.includes('year')) return false;
                const t = (b.textContent || '').trim();
                return t === dayStr;
            });

            if (dayBtn) {
                dayBtn.click();
            }

            await new Promise(r => setTimeout(r, 80));

            // Close popover if still open
            const stillOpen = triggerEl.getAttribute('data-state') === 'open' || 
                              triggerEl.getAttribute('aria-expanded') === 'true';
            if (stillOpen) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
            }
        }
    } catch(err) {
        console.warn('[IVAC Calendar AutoSelect] Handled smoothly:', err);
    }
}

/**
 * Visual highlight indicator on filled element
 */
function highlightFilledElement(el) {
    if (!el) return;
    try {
        const target = el.closest('div[class*="rounded-xl"]') || el;
        const originalBoxShadow = target.style.boxShadow;
        target.style.transition = 'box-shadow 0.3s ease';
        target.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.45)';
        setTimeout(() => {
            target.style.boxShadow = originalBoxShadow;
        }, 1200);
    } catch(e) {}
}

/**
 * Floating notification on the web page
 */
function showPageAutofillToast(msg, isSuccess = true) {
    try {
        let toast = document.getElementById('ivac_autofill_page_toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ivac_autofill_page_toast';
            toast.style.cssText = `
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 2147483647;
                background: ${isSuccess ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : '#ef4444'};
                color: #ffffff;
                padding: 10px 18px;
                border-radius: 10px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                font-weight: 700;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: center;
                gap: 8px;
                pointer-events: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
                transform: translateY(-10px);
                opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<span style="font-size:16px;">${isSuccess ? '⚡' : '⚠️'}</span> <span>${msg}</span>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        clearTimeout(window._ivacToastTimer);
        window._ivacToastTimer = setTimeout(() => {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
            }
        }, 2200);
    } catch(e) {}
}

/**
 * Main AutoFill Function:
 * - Runs ONCE on page load.
 * - NEVER interferes with user manual edits.
 * - NEVER clicks the Sign Up button.
 */
let _ivacHasAutoFilledOnThisPage = false;
let _isAutoFillingSignup = false;

function autoFillIvacSignupInfo(force = false, callback = null) {
    if (typeof force === 'function') {
        callback = force;
        force = true;
    }
    // If not forced and already filled once on this page, do not touch anything!
    if (!force && _ivacHasAutoFilledOnThisPage) {
        if (callback) callback({ success: true, message: 'Already filled' });
        return;
    }

    if (_isAutoFillingSignup) return;
    _isAutoFillingSignup = true;

    chrome.storage.local.get(['ai_autofill_data', 'ext_enabled'], async (res) => {
        try {
            if (res.ext_enabled === false) {
                _isAutoFillingSignup = false;
                if (callback) callback({ success: false, message: 'Extension disabled' });
                return;
            }

            const data = res.ai_autofill_data || {};
            const hasAnyData = Object.values(data).some(v => v && String(v).trim().length > 0);
            if (!hasAnyData) {
                _isAutoFillingSignup = false;
                if (callback) callback({ success: false, message: 'সাইডবারে কোনো তথ্য নেই!' });
                return;
            }

            let filledCount = 0;

            // 1. Fill all regular inputs (Given Name, Surname, NID, Passport, etc.)
            const allInputs = Array.from(document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="file"])'));

            for (const input of allInputs) {
                const fieldType = classifyIvacInputField(input);
                if (!fieldType) continue;

                let valToSet = null;
                if (fieldType === 'givenName' && data.givenName) valToSet = data.givenName.trim();
                else if (fieldType === 'surname' && data.surname) valToSet = data.surname.trim();
                else if (fieldType === 'nid' && data.nid) valToSet = data.nid.trim().replace(/[^0-9]/g, ''); // Numbers only!
                else if (fieldType === 'passport' && data.passport) valToSet = data.passport.trim().toUpperCase();
                else if (fieldType === 'webFile' && data.webFile) valToSet = data.webFile.trim().toUpperCase();
                else if (fieldType === 'phone' && data.phone) valToSet = data.phone.trim();
                else if (fieldType === 'email' && data.email) valToSet = data.email.trim().toLowerCase();
                else if (fieldType === 'password' && data.password) valToSet = data.password.trim();

                if (valToSet !== null && valToSet !== undefined && valToSet.length > 0) {
                    // Only fill if forced, or if field is currently empty
                    if (force || !input.value || input.value.trim() === '') {
                        setNativeInputValue(input, valToSet);
                        highlightFilledElement(input);
                        filledCount++;
                    }
                }
            }

            // 2. Select Date of Birth in Calendar popover safely
            const parsedDob = parseDateComponents(data.dob);
            if (parsedDob) {
                const dobTrigger = findDobPopoverTrigger();
                if (dobTrigger) {
                    await autoSelectCalendarDate(dobTrigger, parsedDob);
                    highlightFilledElement(dobTrigger);
                    filledCount++;
                }
            }

            _ivacHasAutoFilledOnThisPage = true;
            _isAutoFillingSignup = false;

            if (filledCount > 0) {
                showPageAutofillToast(`⚡ AutoFill: ${filledCount}টি ফিল্ড পূরণ হয়েছে!`, true);
            }
            if (callback) callback({ success: true, filledCount });

        } catch (err) {
            _isAutoFillingSignup = false;
            console.error('[IVAC Smart AutoFill] Error:', err);
            if (callback) callback({ success: false, error: err.message });
        }
    });
}

// Global Keyboard Shortcut: Alt+A or Alt+F triggers forced autofill
window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'a' || e.key === 'A' || e.key === 'f' || e.key === 'F')) {
        const url = window.location.href.toLowerCase();
        if (url.includes('ivac') || url.includes('appointment')) {
            e.preventDefault();
            autoFillIvacSignupInfo(true, (res) => {
                if (res && !res.success && res.message) {
                    showPageAutofillToast(res.message, false);
                }
            });
        }
    }
});

// Run ONCE on page load (700ms after load to allow React to mount)
(function _initOneTimeAutoFill() {
    const url = window.location.href.toLowerCase();
    if (url.includes('appointment.ivacbd.com') || url.includes('ivacbd.com')) {
        setTimeout(() => {
            autoFillIvacSignupInfo(false);
        }, 700);
        // Start Cloudflare Turnstile Watcher immediately
        try {
            initCloudflareTurnstileWatcher();
        } catch (e) {}
    }
})();


