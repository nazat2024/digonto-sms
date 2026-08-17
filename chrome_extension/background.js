chrome.storage.local.get(['rocket_accounts'], (res) => {
    if (!res || !res.rocket_accounts) {
        chrome.storage.local.set({ 
            rocket_accounts: []
        });
    }
});

// ===== OTP CLAIM LOCK =====
// একটি ফোন নম্বরের OTP একবারে শুধুমাত্র একটি ট্যাবই নিতে পারবে
// otpClaims[phone] = tabId  (কোন ট্যাব claim করেছে)
const otpClaims = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // ===== ATOMIC OTP CLAIM =====
    // প্রথমে claim করো, তারপর OTP নাও — এতে দুটো ট্যাব একই OTP নিতে পারবে না
    if (request.action === 'claimAndFetchOtp') {
        const phone = request.phone;
        const tabId = sender.tab ? sender.tab.id : null;

        // যদি অন্য ট্যাব আগেই claim করে থাকে, তাহলে reject করো
        if (otpClaims[phone] !== undefined && otpClaims[phone] !== tabId) {
            sendResponse({ success: false, reason: 'claimed_by_other_tab' });
            return true;
        }

        // এই ট্যাব claim করুক
        otpClaims[phone] = tabId;

        fetch(`http://127.0.0.1:5000/api/otp/${phone}`)
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.data || data.data.used) {
                    // OTP নেই বা already used — claim ছেড়ে দাও
                    delete otpClaims[phone];
                    sendResponse({ success: false, reason: 'no_otp' });
                } else {
                    // OTP পাওয়া গেছে, claim ধরে রাখো
                    sendResponse({ success: true, data: data.data });
                }
            })
            .catch(e => {
                delete otpClaims[phone];
                sendResponse({ success: false, error: e.message });
            });
        return true;
    }

    if (request.action === 'fetchOtp') {
        fetch(`http://127.0.0.1:5000/api/otp/${request.phone}`)
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }
    if (request.action === 'clearOtp') {
        const phone = request.phone;
        delete otpClaims[phone]; // claim ছেড়ে দাও
        fetch(`http://127.0.0.1:5000/api/clear/${phone}`)
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false }));
        return true;
    }
    if (request.action === 'markUsed') {
        const phone = request.phone;
        delete otpClaims[phone]; // OTP use হয়ে গেছে, claim ছেড়ে দাও
        fetch(`http://127.0.0.1:5000/api/otp/${phone}/used`, { method: 'POST' })
            .then(r => r.json())
            .then(sendResponse)
            .catch(e => sendResponse({ success: false }));
        return true;
    }
});

