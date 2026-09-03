(function() {
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
})();
