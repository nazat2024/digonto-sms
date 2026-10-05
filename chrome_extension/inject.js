(function() {
    // ===== CAPTURE SHADOW ROOTS FOR CLOUDFLARE TURNSTILE DETECTION =====
    const capturedShadowRoots = [];
    try {
        const origAttachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function(init) {
            const shadow = origAttachShadow.apply(this, arguments);
            try {
                if (shadow) capturedShadowRoots.push(shadow);
            } catch(e) {}
            return shadow;
        };
    } catch(e) {}

    // ===== UNIVERSAL COPY, PASTE, CUT & RIGHT-CLICK ENABLER (MAIN WORLD) =====
    const blockedEvents = ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'];

    const origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (typeof type === 'string' && blockedEvents.includes(type.toLowerCase())) {
            const wrappedListener = function(event) {
                if (event) {
                    event.stopImmediatePropagation = function() {};
                    event.stopPropagation = function() {};
                    event.preventDefault = function() {};
                }
                if (typeof listener === 'function') {
                    try {
                        return listener.apply(this, arguments);
                    } catch(e) {}
                }
            };
            return origAddEventListener.call(this, type, wrappedListener, options);
        }
        return origAddEventListener.apply(this, arguments);
    };

    blockedEvents.forEach(evt => {
        const prop = 'on' + evt;
        try {
            Object.defineProperty(document, prop, {
                get: () => null,
                set: () => true,
                configurable: true
            });
            Object.defineProperty(window, prop, {
                get: () => null,
                set: () => true,
                configurable: true
            });
        } catch(e) {}
    });

    // ===== IVAC PAYMENT LINK INTERCEPTOR =====
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('load', function() {
            if (this.responseText && this.responseText.includes('website_url')) {
                try {
                    const data = JSON.parse(this.responseText);
                    if (data && data.data && data.data.website_url && (data.data.website_url.includes('payment') || data.data.website_url.includes('checkout'))) {
                        window.postMessage({ type: 'IVAC_PAYMENT_LINK', url: data.data.website_url }, '*');
                    }
                } catch(e) {}
            }
        });
        origOpen.apply(this, arguments);
    };
    
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await origFetch.apply(this, args);
        try {
            const clone = response.clone();
            clone.json().then(data => {
                if (data && data.data && data.data.website_url && (data.data.website_url.includes('payment') || data.data.website_url.includes('checkout'))) {
                    window.postMessage({ type: 'IVAC_PAYMENT_LINK', url: data.data.website_url }, '*');
                }
            }).catch(e => {});
        } catch(e) {}
        return response;
    };

    // ===== MAIN WORLD BKASH CONFIRM TRIGGER =====
    function performMainWorldBkashClick() {
        try {
            const btn = document.querySelector('button.btn-group__btn-confirm') || 
                        document.querySelector('button.btn-active') || 
                        document.querySelector('.btn-group button:last-child') || 
                        document.querySelector('button[class*="btn-confirm"]') || 
                        document.getElementById('submit_action');
            
            if (btn) {
                btn.focus();
                ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evtType => {
                    btn.dispatchEvent(new MouseEvent(evtType, {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        view: window
                    }));
                });
                btn.click();
            }

            const activeInputs = Array.from(document.querySelectorAll('input:not([type="hidden"])')).filter(i => {
                const r = i.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            const mainInp = activeInputs[0];
            if (mainInp) {
                ['keydown', 'keypress', 'keyup'].forEach(evtType => {
                    mainInp.dispatchEvent(new KeyboardEvent(evtType, {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    }));
                });
            }
        } catch(e) {}
    }

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'IVAC_CLICK_BKASH_CONFIRM') {
            performMainWorldBkashClick();
        }
    });

    window.addEventListener('IVAC_CLICK_BKASH_CONFIRM_EVENT', () => {
        performMainWorldBkashClick();
    });

    // ===== CLOUDFLARE TURNSTILE REAL-TIME STATE REPORTER (ALL FRAMES) =====
    (function initTurnstileStateReporter() {
        let lastReportedState = null;

        function checkTurnstileState() {
            try {
                const isCfHost = window.location.hostname.includes('cloudflare.com');
                const hasCfWidget = isCfHost || !!document.querySelector('iframe[src*="cloudflare"], iframe[src*="turnstile"], .cf-turnstile');
                if (!hasCfWidget && !isCfHost) return;

                let state = 'IDLE';
                const roots = [document, ...capturedShadowRoots];

                let foundSuccess = false;
                let foundSpinner = false;
                let foundCheckbox = false;

                for (const root of roots) {
                    try {
                        const text = ((root.textContent || '') + ' ' + (root.body ? root.body.innerText : '')).toLowerCase();

                        // 1. Success check
                        if ((root.querySelector && root.querySelector('[class*="success"], svg[class*="check"], .ctp-checkbox-checked, #success')) || text.includes('success')) {
                            foundSuccess = true;
                            break;
                        }
                        const cb = root.querySelector ? root.querySelector('input[type="checkbox"]') : null;
                        if (cb && cb.checked) {
                            foundSuccess = true;
                            break;
                        }

                        // 2. Spinner check (actively verifying)
                        if (root.querySelector && root.querySelector('.ctp-spinner, [class*="spinner"], svg[class*="spin"], #spinner')) {
                            foundSpinner = true;
                        }
                        if (text.includes('verifying') || text.includes('checking') || text.includes('যাচাই করা হচ্ছে')) {
                            foundSpinner = true;
                        }

                        // 3. Checkbox waiting for human click
                        if (cb && !cb.checked) {
                            foundCheckbox = true;
                        }
                        if (text.includes('verify you are human') || text.includes('human')) {
                            if (!foundSpinner) {
                                foundCheckbox = true;
                            }
                        }
                    } catch(e) {}
                }

                if (foundSuccess) {
                    state = 'SUCCESS';
                } else if (foundSpinner) {
                    state = 'SPINNING';
                } else if (foundCheckbox) {
                    state = 'WAITING_CLICK';
                }

                if (state !== 'IDLE' && state !== lastReportedState) {
                    lastReportedState = state;
                    try {
                        window.top.postMessage({
                            type: 'IVAC_CF_STATE',
                            state: state,
                            timestamp: Date.now()
                        }, '*');
                    } catch(e) {}
                }
            } catch(e) {}
        }

        setInterval(checkTurnstileState, 200);
    })();
})();
