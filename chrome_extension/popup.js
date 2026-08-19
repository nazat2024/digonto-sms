document.addEventListener('DOMContentLoaded', () => {
    const extToggle = document.getElementById('ext-toggle');
    const phoneInput = document.getElementById('manual-phone-input');
    const passInput = document.getElementById('manual-pass-input');
    const savePhoneBtn = document.getElementById('save-phone-btn');
    const smsDisplay = document.getElementById('latest-sms');
    const serverDot = document.getElementById('server-dot');
    const serverText = document.getElementById('server-text');
    const webfileInput = document.getElementById('webfile-input');
    const addWebfileBtn = document.getElementById('add-webfile-btn');
    const webfileList = document.getElementById('webfile-list');
    const webfileEnabledToggle = document.getElementById('webfile-enabled-toggle');
    const webfileModeBtn = document.getElementById('webfile-mode-btn');

    // Rocket elements
    const rocketPinInput = document.getElementById('rocket-pin-input');
    const addRocketBtn = document.getElementById('add-rocket-btn');
    const rocketListEl = document.getElementById('rocket-list');
    const paymentEnabledToggle = document.getElementById('payment-enabled-toggle');

    // Payment Link Catcher elements
    const paymentLinkCard = document.getElementById('payment-link-card');
    const popupPaymentLink = document.getElementById('popup-payment-link');
    const copyPaymentLinkBtn = document.getElementById('copy-payment-link-btn');
    const deletePaymentLinkBtn = document.getElementById('delete-payment-link-btn');

    let currentPhone = "";
    let webfiles = [];
    let webfileEnabled = true;
    let webfileMode = "auto";

    // Rocket accounts: [{id, number, pin}]
    let rocketAccounts = [];
    let activeRocketId = null;
    let paymentEnabled = true;

    // ===== 1. Load initial state =====
    chrome.storage.local.get([
        'ext_enabled', 'ivac_phone', 'ivac_password',
        'saved_webfiles', 'webfile_enabled', 'webfile_mode',
        'rocket_accounts', 'active_rocket_id', 'payment_enabled', 'payment_link'
    ], (result) => {
        if (result.ext_enabled !== undefined) {
            extToggle.checked = result.ext_enabled;
        }
        if (result.ivac_phone) {
            currentPhone = result.ivac_phone;
            phoneInput.value = currentPhone;
        }
        if (result.ivac_password && passInput) {
            passInput.value = result.ivac_password;
        }

        if (result.saved_webfiles) {
            webfiles = result.saved_webfiles;
        }
        if (result.webfile_enabled !== undefined) {
            webfileEnabled = result.webfile_enabled;
        }
        if (result.webfile_mode) {
            webfileMode = result.webfile_mode;
        }

        // Rocket accounts load
        if (result.rocket_accounts) {
            rocketAccounts = result.rocket_accounts;
        }
        if (result.active_rocket_id) {
            activeRocketId = result.active_rocket_id;
        }
        if (!activeRocketId && rocketAccounts.length > 0) {
            activeRocketId = rocketAccounts[0].id;
            chrome.storage.local.set({ active_rocket_id: activeRocketId });
        }
        
        if (result.payment_enabled !== undefined) {
            paymentEnabled = result.payment_enabled;
        }

        webfileEnabledToggle.checked = webfileEnabled;
        paymentEnabledToggle.checked = paymentEnabled;
        updateModeBtn();
        renderWebfiles();
        renderRocketAccounts();
        updateStatus();

        // Payment link initial load
        if (result.payment_link) {
            popupPaymentLink.value = result.payment_link;
            paymentLinkCard.style.display = 'block';
        }
    });

    // ===== Listen for Storage Changes (for Payment Link) =====
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.payment_link) {
            if (changes.payment_link.newValue) {
                popupPaymentLink.value = changes.payment_link.newValue;
                paymentLinkCard.style.display = 'block';
            } else {
                paymentLinkCard.style.display = 'none';
                popupPaymentLink.value = '';
            }
        }
    });

    // ===== Payment Link Buttons =====
    copyPaymentLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(popupPaymentLink.value);
        const orig = copyPaymentLinkBtn.textContent;
        copyPaymentLinkBtn.textContent = '✅ Copied!';
        setTimeout(() => { copyPaymentLinkBtn.textContent = orig; }, 1000);
    });

    deletePaymentLinkBtn.addEventListener('click', () => {
        chrome.storage.local.remove('payment_link');
    });

    // ===== Webfile ON/OFF Toggle =====
    webfileEnabledToggle.addEventListener('change', (e) => {
        webfileEnabled = e.target.checked;
        chrome.storage.local.set({ webfile_enabled: webfileEnabled });
    });

    // ===== Payment ON/OFF Toggle =====
    paymentEnabledToggle.addEventListener('change', (e) => {
        paymentEnabled = e.target.checked;
        chrome.storage.local.set({ payment_enabled: paymentEnabled });
    });

    // ===== Auto/Manual Mode Toggle =====
    webfileModeBtn.addEventListener('click', () => {
        webfileMode = webfileMode === "auto" ? "manual" : "auto";
        chrome.storage.local.set({ webfile_mode: webfileMode });
        updateModeBtn();
        renderWebfiles();
    });

    function updateModeBtn() {
        if (webfileMode === "auto") {
            webfileModeBtn.textContent = "Auto";
            webfileModeBtn.classList.remove('manual');
        } else {
            webfileModeBtn.textContent = "Manual";
            webfileModeBtn.classList.add('manual');
        }
    }

    // ===== Add Webfile =====
    addWebfileBtn.addEventListener('click', () => {
        webfileInput.click();
    });

    webfileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            alert('শুধুমাত্র PDF ফাইল সাপোর্ট করবে!');
            return;
        }
        if (file.size > 500 * 1024) {
            alert('ফাইলের সাইজ 500KB এর নিচে হতে হবে!');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            const newFile = {
                id: Date.now().toString(),
                name: file.name,
                data: event.target.result
            };
            webfiles.push(newFile);
            saveWebfiles();
            renderWebfiles();
        };
        reader.readAsDataURL(file);
        webfileInput.value = '';
    });

    // ===== Render Webfile List =====
    function renderWebfiles() {
        if (webfiles.length === 0) {
            webfileList.innerHTML = '<div class="webfile-empty">কোনো ফাইল যোগ হয়নি</div>';
            return;
        }
        webfileList.innerHTML = '';
        webfiles.forEach((wf, index) => {
            const item = document.createElement('div');
            item.className = 'wf-item';
            
            const num = document.createElement('span');
            num.className = 'wf-num';
            num.textContent = (index + 1);
            
            const name = document.createElement('span');
            name.className = 'wf-name';
            name.textContent = wf.name;
            name.title = wf.name;

            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'wf-upload-btn' + (webfileMode === 'manual' ? ' show' : '');
            uploadBtn.textContent = '⬆ Upload';
            uploadBtn.title = 'এই ফাইলটি আপলোড করুন';
            uploadBtn.addEventListener('click', () => {
                manualUpload(wf);
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'wf-btn';
            delBtn.textContent = '🗑️';
            delBtn.title = 'ফাইল মুছুন';
            delBtn.addEventListener('click', () => {
                webfiles = webfiles.filter(f => f.id !== wf.id);
                saveWebfiles();
                renderWebfiles();
            });

            item.appendChild(num);
            item.appendChild(name);
            item.appendChild(uploadBtn);
            item.appendChild(delBtn);
            webfileList.appendChild(item);
        });
    }

    function saveWebfiles() {
        chrome.storage.local.set({ saved_webfiles: webfiles });
    }

    function manualUpload(wf) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'manual_upload_webfile',
                    fileData: wf.data,
                    fileName: wf.name
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        alert('পেজে সংযোগ করা যায়নি! পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।');
                    }
                });
            }
        });
    }

    // ===== ROCKET ACCOUNT MANAGEMENT =====
    
    addRocketBtn.addEventListener('click', () => {
        const number = rocketNumberInput.value.replace(/[^0-9]/g, '');
        const pin = rocketPinInput.value.trim();
        
        if (number.length !== 12) {
            alert('Rocket নম্বর ১২ ডিজিটের হতে হবে!');
            return;
        }
        if (!pin || pin.length < 4) {
            alert('PIN কমপক্ষে ৪ ডিজিটের হতে হবে!');
            return;
        }
        
        if (rocketAccounts.find(a => a.number === number)) {
            alert('এই Rocket নম্বর আগেই যোগ করা হয়েছে!');
            return;
        }
        
        const newAccount = {
            id: Date.now().toString(),
            number: number,
            pin: pin
        };
        
        rocketAccounts.push(newAccount);
        
        if (rocketAccounts.length === 1) {
            activeRocketId = newAccount.id;
        }
        
        saveRocketAccounts();
        renderRocketAccounts();
        
        rocketNumberInput.value = '';
        rocketPinInput.value = '';
    });
    
    function renderRocketAccounts() {
        if (rocketAccounts.length === 0) {
            rocketListEl.innerHTML = '<div class="rocket-empty">কোনো Rocket অ্যাকাউন্ট নেই</div>';
            return;
        }
        
        rocketListEl.innerHTML = '';
        rocketAccounts.forEach((acc) => {
            const item = document.createElement('div');
            item.className = 'rocket-item' + (acc.id === activeRocketId ? ' active' : '');
            
            const radio = document.createElement('div');
            radio.className = 'ri-radio';
            
            const numSpan = document.createElement('span');
            numSpan.className = 'ri-number';
            numSpan.textContent = acc.number;
            
            const pinSpan = document.createElement('span');
            pinSpan.className = 'ri-pin';
            pinSpan.textContent = '🔑 ' + acc.pin;
            
            const delBtn = document.createElement('button');
            delBtn.className = 'ri-del';
            delBtn.textContent = '🗑️';
            delBtn.title = 'মুছুন';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                rocketAccounts = rocketAccounts.filter(a => a.id !== acc.id);
                if (activeRocketId === acc.id) {
                    activeRocketId = rocketAccounts.length > 0 ? rocketAccounts[0].id : null;
                }
                saveRocketAccounts();
                renderRocketAccounts();
            });
            
            item.addEventListener('click', () => {
                activeRocketId = acc.id;
                saveRocketAccounts();
                renderRocketAccounts();
            });
            
            item.appendChild(radio);
            item.appendChild(numSpan);
            item.appendChild(pinSpan);
            item.appendChild(delBtn);
            rocketListEl.appendChild(item);
        });
    }
    
    function saveRocketAccounts() {
        chrome.storage.local.set({
            rocket_accounts: rocketAccounts,
            active_rocket_id: activeRocketId
        });
    }

    // ===== Save IVAC phone & password =====
    savePhoneBtn.addEventListener('click', () => {
        const phone = phoneInput.value.replace(/[^0-9]/g, '');
        const pass = passInput ? passInput.value.trim() : '';
        const dataToSave = {};
        
        if (phone.length >= 11) {
            currentPhone = phone;
            dataToSave.ivac_phone = currentPhone;
        }
        if (pass) {
            dataToSave.ivac_password = pass;
        }
        
        if (Object.keys(dataToSave).length > 0) {
            chrome.storage.local.set(dataToSave, () => {
                savePhoneBtn.innerText = "✓";
                setTimeout(() => { savePhoneBtn.innerText = "সেভ"; }, 1000);
                updateStatus();
            });
        }
    });

    // ===== Handle toggle changes =====
    extToggle.addEventListener('change', (e) => {
        const isOn = e.target.checked;
        chrome.storage.local.set({ ext_enabled: isOn });
        
        if (!isOn) {
            webfileEnabled = false;
            webfileEnabledToggle.checked = false;
            webfileEnabledToggle.disabled = true;
            chrome.storage.local.set({ webfile_enabled: false });

            paymentEnabled = false;
            paymentEnabledToggle.checked = false;
            paymentEnabledToggle.disabled = true;
            chrome.storage.local.set({ payment_enabled: false });
        } else {
            webfileEnabled = true;
            webfileEnabledToggle.checked = true;
            webfileEnabledToggle.disabled = false;
            chrome.storage.local.set({ webfile_enabled: true });

            paymentEnabled = true;
            paymentEnabledToggle.checked = true;
            paymentEnabledToggle.disabled = false;
            chrome.storage.local.set({ payment_enabled: true });
        }
    });

    // ===== Listen for storage changes =====
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.ivac_phone) {
                currentPhone = changes.ivac_phone.newValue;
                phoneInput.value = currentPhone;
                updateStatus();
            }
            if (changes.ivac_password && passInput) {
                passInput.value = changes.ivac_password.newValue || '';
            }
        }
    });

    // ===== Fetch SMS and Server Status =====
    async function updateStatus() {
        try {
            const statusRes = await fetch('http://127.0.0.1:5000/api/status');
            if (statusRes.ok) {
                serverDot.className = "dot green";
                serverText.innerText = "সংযুক্ত";
            } else {
                throw new Error("Bad status");
            }
        } catch (e) {
            serverDot.className = "dot red";
            serverText.innerText = "সার্ভার বন্ধ";
            smsDisplay.innerText = "সার্ভারের সাথে সংযোগ নেই";
            return;
        }

        let otpFound = false;

        // Check IVAC Login Phone
        if (currentPhone) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/otp/${currentPhone}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data && !data.data.used) {
                        smsDisplay.innerHTML = `
                            <div class="otp-tag" style="color:#059669;">📱 IVAC OTP (${currentPhone})</div>
                            <div class="otp-number otp-ivac">${data.data.display}</div>
                        `;
                        otpFound = true;
                    }
                }
            } catch (e) {}
        }

        // Check Active Rocket Phone (১২ ডিজিটের প্রথম ১১ ডিজিট)
        const activeRocket = rocketAccounts.find(a => a.id === activeRocketId);
        if (activeRocket) {
            const rocketPhone = activeRocket.number.substring(0, 11);
            if (rocketPhone !== currentPhone) {
                try {
                    const response = await fetch(`http://127.0.0.1:5000/api/otp/${rocketPhone}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data && !data.data.used) {
                            if (otpFound) {
                                smsDisplay.innerHTML += `
                                    <div style="height:1px; background:#e2e8f0; margin:4px 0;"></div>
                                    <div class="otp-tag" style="color:#d97706;">🚀 Rocket OTP (${rocketPhone})</div>
                                    <div class="otp-number otp-pay">${data.data.display}</div>
                                `;
                            } else {
                                smsDisplay.innerHTML = `
                                    <div class="otp-tag" style="color:#d97706;">🚀 Rocket OTP (${rocketPhone})</div>
                                    <div class="otp-number otp-pay">${data.data.display}</div>
                                `;
                                otpFound = true;
                            }
                        }
                    }
                } catch (e) {}
            }
        }

        if (!otpFound) {
            smsDisplay.innerText = "কোনো নতুন SMS আসেনি";
        }
    }

    updateStatus();
    setInterval(() => {
        if (extToggle.checked) {
            updateStatus();
        }
    }, 2000);
});
