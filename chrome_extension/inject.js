(function() {
    // Intercept XHR
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
    
    // Intercept Fetch
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
})();
