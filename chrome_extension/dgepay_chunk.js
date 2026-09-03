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
                                    
                                    chrome.runtime.sendMessage({
    action: 'recordPayment',
    data: {
        amount: amount,
        status: 'initiated',
        stage: 'pay_clicked',
        rocket_account: activeAccount.number,
        description: ''
    }
}, (d) => {
    if (d && d.payment_id) {
        chrome.storage.local.set({ current_payment_id: d.payment_id });
        console.log('[IVAC] Payment initiated recorded, ID:', d.payment_id);
    }
});
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
