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

    let latestServerStatus = null;

    function getPhoneDeviceStatus(phone) {
        if (!phone) return { status: 'none', label: 'নম্বর নেই', dotClass: 'gray' };
        const cleanP = phone.replace(/[^0-9]/g, '').substring(0, 11);
        if (!cleanP || cleanP.length < 11) return { status: 'none', label: 'নম্বর সঠিক নয়', dotClass: 'gray' };
        
        if (!latestServerStatus) {
            return { status: 'offline', label: 'সার্ভার বন্ধ', dotClass: 'red' };
        }
        
        const onlinePhones = latestServerStatus.online_phones || [];
        const offlinePhones = latestServerStatus.offline_phones || [];
        
        if (onlinePhones.includes(cleanP)) {
            return { status: 'online', label: 'মোবাইল অনলাইনে আছে 🟢', dotClass: 'green' };
        }
        if (offlinePhones.includes(cleanP)) {
            return { status: 'offline', label: 'মোবাইল অফলাইনে আছে 🔴', dotClass: 'red' };
        }
        
        const devices = latestServerStatus.devices || [];
        for (const dev of devices) {
            const text = `${dev.sim1_name || ''} ${dev.sim2_name || ''} ${dev.custom_name || ''} ${dev.device_name || ''}`;
            if (text.includes(cleanP)) {
                if (dev.online && dev.is_active !== false) {
                    return { status: 'online', label: `${dev.custom_name || dev.device_name || 'মোবাইল'} অনলাইনে আছে 🟢`, dotClass: 'green' };
                } else {
                    return { status: 'offline', label: `${dev.custom_name || dev.device_name || 'মোবাইল'} অফলাইনে আছে 🔴`, dotClass: 'red' };
                }
            }
        }
        return { status: 'not_connected', label: 'এই নম্বরের কোনো মোবাইল কানেক্টেড নেই ⚪', dotClass: 'gray' };
    }
document.addEventListener('DOMContentLoaded', () => {
    const extToggle = document.getElementById('ext-toggle');
    const phoneInput = document.getElementById('manual-phone-input');
    const passInput = document.getElementById('manual-pass-input');
    const toggleIvacPassBtn = document.getElementById('toggle-ivac-pass-btn');
    const savePhoneBtn = document.getElementById('save-phone-btn');
    const smsDisplay = document.getElementById('latest-sms');
    const serverDot = document.getElementById('server-dot');
    const serverText = document.getElementById('server-text');
    const webfileInput = document.getElementById('webfile-input');
    const addWebfileBtn = document.getElementById('add-webfile-btn');
    const webfileList = document.getElementById('webfile-list');
    const webfileEnabledToggle = document.getElementById('webfile-enabled-toggle');
    const webfileModeBtn = document.getElementById('webfile-mode-btn');

    // Payment elements
    const rocketListEl = document.getElementById('rocket-list');
    const paymentEnabledToggle = document.getElementById('payment-enabled-toggle');
    const paymentModeBtn = document.getElementById('payment-mode-btn');

    // Payment Link Catcher elements
    const paymentLinkCard = document.getElementById('payment-link-card');
    const popupPaymentLink = document.getElementById('popup-payment-link');
    const copyPaymentLinkBtn = document.getElementById('copy-payment-link-btn');
    const deletePaymentLinkBtn = document.getElementById('delete-payment-link-btn');

    // Slot Booking elements
    const slotBookingToggle = document.getElementById('slot-booking-toggle');
    const slotModeBtn = document.getElementById('slot-mode-btn');
    const preferredDateInput = document.getElementById('preferred-date-input');
    const preferredDatePicker = document.getElementById('preferred-date-picker');
    const openCalendarBtn = document.getElementById('open-calendar-btn');
    const smsCardWrap = document.getElementById('sms-card-wrap');
    const addPreferredDateBtn = document.getElementById('add-preferred-date-btn');
    const preferredDatesList = document.getElementById('preferred-dates-list');

    let preferredDates = [];
    let slotBookingEnabled = true;

    let currentPhone = "";
    let webfiles = [];
    let webfileEnabled = true;
    

    // Payment accounts: [{id, number, rocket_extra, rocket_pin, bkash_pin, nagad_pin}]
    let rocketAccounts = [];
    let activeRocketId = null;
    let paymentEnabled = true;
    let paymentMode = "auto";
    let paymentMethods = {}; // { accountId: 'rocket' | 'bkash' | 'nagad' }

    // ===== 1. Load initial state =====
    chrome.storage.local.get([
        'ext_enabled', 'ivac_phone', 'ivac_password',
        'saved_webfiles', 'webfile_enabled', 'webfile_mode',
        'rocket_accounts', 'active_rocket_id', 'payment_enabled', 'payment_mode', 'payment_link', 'payment_methods', 'slot_booking_enabled', 'preferred_dates'
    ], (result) => {
        if (result.ext_enabled !== undefined) {
            extToggle.checked = result.ext_enabled;
        }
        if (result.ivac_phone) {
            currentPhone = result.ivac_phone;
            phoneInput.value = currentPhone;
    phoneInput.addEventListener('blur', () => {
        const ph = phoneInput.value.replace(/[^0-9]/g, '');
        if (ph.length >= 11) {
            chrome.storage.local.set({
                ivac_phone: ph,
                profile_label: `Profile (${ph})`
            });
        }
    });
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
        
        if (result.payment_methods) {
            paymentMethods = result.payment_methods;
        }
        if (result.payment_enabled !== undefined) {
            paymentEnabled = result.payment_enabled;
        }
        if (result.payment_mode) {
            paymentMode = result.payment_mode;
        }

        if (result.slot_booking_enabled !== undefined) {
            slotBookingEnabled = result.slot_booking_enabled;
        }
        if (result.preferred_dates) {
            preferredDates = result.preferred_dates;
        }
        
        const isMainOn = result.ext_enabled !== undefined ? result.ext_enabled : true;
        if (!isMainOn) {
            webfileEnabledToggle.checked = false;
            webfileEnabledToggle.disabled = true;
            paymentEnabledToggle.checked = false;
            paymentEnabledToggle.disabled = true;
            if (slotBookingToggle) {
                slotBookingToggle.checked = false;
                slotBookingToggle.disabled = true;
            }
        } else {
            webfileEnabledToggle.checked = webfileEnabled;
            webfileEnabledToggle.disabled = false;
            paymentEnabledToggle.checked = paymentEnabled;
            paymentEnabledToggle.disabled = false;
            if (slotBookingToggle) {
                slotBookingToggle.checked = slotBookingEnabled;
                slotBookingToggle.disabled = false;
            }
        }

        updateModeBtn();
        updatePaymentModeBtn();
        renderWebfiles();
        renderRocketAccounts();
        renderPreferredDates();

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

    // ===== Payment Auto/Manual Mode Toggle =====
    if (paymentModeBtn) {
        paymentModeBtn.addEventListener('click', () => {
            paymentMode = paymentMode === "auto" ? "manual" : "auto";
            chrome.storage.local.set({ payment_mode: paymentMode });
            updatePaymentModeBtn();
        });
    }

    function updatePaymentModeBtn() {
        if (!paymentModeBtn) return;
        if (paymentMode === "auto") {
            paymentModeBtn.textContent = "Auto";
            paymentModeBtn.classList.remove('manual');
            paymentModeBtn.title = "Auto মোড: dgpay পেজে অটোমেটিক Rocket সিলেক্ট করে Pay বাটনে ক্লিক করবে";
        } else {
            paymentModeBtn.textContent = "Manual";
            paymentModeBtn.classList.add('manual');
            paymentModeBtn.title = "Manual মোড: dgpay পেজে Rocket সিলেক্ট করবে না, আপনি নিজে সিলেক্ট করতে পারবেন";
        }
    }

    // ===== Auto/Manual Mode Toggle =====
    function updateModeBtn() {
        // Mode button removed; switch controls auto/manual directly
    }

    // ===== Add Webfile =====
    addWebfileBtn.addEventListener('click', () => {
        if (webfiles.length >= 4) {
            alert('⚠️ সর্বোচ্চ ৪টি ওয়েবফাইল যোগ করা যাবে!');
            return;
        }
        webfileInput.click();
    });

        webfileInput.addEventListener('change', (e) => {
        if (webfiles.length >= 4) {
            alert('⚠️ সর্বোচ্চ ৪টি ওয়েবফাইল যোগ করা যাবে!');
            webfileInput.value = '';
            return;
        }
        const file = e.target.files[0];
        if (!file) return;

        // Check if a file with the same name already exists
        const isDuplicateName = webfiles.some(f => f.name && f.name.trim().toLowerCase() === file.name.trim().toLowerCase());
        if (isDuplicateName) {
            alert('⚠️ এই ওয়েবফাইলটি আগেই যোগ করা হয়েছে!');
            webfileInput.value = '';
            return;
        }

        if (file.type !== 'application/pdf') {
            alert('শুধুমাত্র PDF ফাইল আপলোড করুন!');
            webfileInput.value = '';
            return;
        }
        if (file.size > 500 * 1024) {
            alert('ফাইলের সাইজ 500KB এর বেশি হতে পারবে না!');
            webfileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            // Check if file content/data is duplicate
            const isDuplicateData = webfiles.some(f => (f.data && f.data === event.target.result) || (f.name && f.name.trim().toLowerCase() === file.name.trim().toLowerCase()));
            if (isDuplicateData) {
                alert('⚠️ এই ওয়েবফাইলটি আগেই যোগ করা হয়েছে!');
                return;
            }

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
        const addRow = addWebfileBtn ? (addWebfileBtn.closest('.webfile-add-row') || addWebfileBtn) : null;
        if (addRow) {
            addRow.style.display = (webfiles.length >= 4) ? 'none' : 'block';
        }
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
            uploadBtn.className = 'wf-upload-btn';
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

    function updatePaymentAccountDots() {
        rocketAccounts.forEach(acc => {
            const cleanNum = (acc.number || '').substring(0, 11);
            const devStat = getPhoneDeviceStatus(cleanNum);
            const dotEl = document.querySelector(`.ri-dot-${acc.id}`);
            if (dotEl) {
                dotEl.className = `dot ${devStat.dotClass} ri-dot-${acc.id}`;
                dotEl.title = devStat.label;
            }
        });
    }

    // ===== ROCKET ACCOUNT MANAGEMENT =====
    
    // ===== Render Payment Accounts List =====
    function renderRocketAccounts() {
        if (rocketAccounts.length === 0) {
            rocketListEl.innerHTML = '<div style="text-align:center; padding:10px; color:#8892b0; font-size:11px;">Desktop App থেকে Payment Account যোগ করুন</div>';
            return;
        }
        rocketListEl.innerHTML = '';
        rocketAccounts.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'rocket-item' + (activeRocketId === acc.id ? ' active' : '');
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'active_rocket';
            radio.checked = (activeRocketId === acc.id);
            radio.className = 'ri-radio';
            
            const currentMethod = paymentMethods[acc.id] || 'rocket';
            
            const numSpan = document.createElement('span');
            numSpan.className = 'ri-number';
            numSpan.style.flex = "1";
            numSpan.style.display = "inline-flex";
            numSpan.style.alignItems = "center";
            numSpan.style.gap = "3px";
            numSpan.style.whiteSpace = "nowrap";
            
            const pinSpan = document.createElement('span');
            pinSpan.className = 'ri-pin';
            pinSpan.style.cursor = 'pointer';
            pinSpan.title = 'PIN দেখতে ক্লিক করুন';
            
            let isRevealed = false;
            
            function updateDisplay() {
                const method = paymentMethods[acc.id] || 'rocket';
                const cleanNum = (acc.number || '').substring(0, 11);
                const devStat = getPhoneDeviceStatus(cleanNum);
                const extraPart = (method === 'rocket' && acc.rocket_extra) ? `-${acc.rocket_extra}` : '';
                numSpan.innerHTML = `<span>${acc.number}${extraPart}</span><span class="dot ${devStat.dotClass} ri-dot-${acc.id}" style="width:6px; height:6px;" title="${devStat.label}"></span>`;
                
                let targetPin = acc.pin || "";
                if (method === 'rocket') targetPin = acc.rocket_pin || targetPin;
                else if (method === 'bkash') targetPin = acc.bkash_pin || targetPin;
                else if (method === 'nagad') targetPin = acc.nagad_pin || targetPin;
                
                pinSpan.textContent = isRevealed ? ('PIN: ' + targetPin) : ('PIN: ' + '••••');
            }
            
            pinSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                isRevealed = !isRevealed;
                updateDisplay();
            });
            
            // Payment Method Dropdown (Clean Light UI, No Icons)
            const methodSelect = document.createElement('select');
            methodSelect.className = 'payment-method-select';
            
            const options = [
                { value: 'rocket', label: 'Rocket' },
                { value: 'bkash', label: 'bKash' },
                { value: 'nagad', label: 'Nagad' }
            ];
            
            options.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt.value;
                optionEl.textContent = opt.label;
                methodSelect.appendChild(optionEl);
            });
            
            methodSelect.value = currentMethod;
            
            methodSelect.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            
            methodSelect.addEventListener('change', (e) => {
                e.stopPropagation();
                paymentMethods[acc.id] = e.target.value;
                chrome.storage.local.set({ payment_methods: paymentMethods });
                updateDisplay(); // Update number and pin when dropdown changes
            });
            
            methodSelect.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent selecting the account when just clicking the dropdown
            });
            
            item.addEventListener('click', () => {
                activeRocketId = acc.id;
                chrome.storage.local.set({ active_rocket_id: activeRocketId });
                renderRocketAccounts();

            });
            radio.addEventListener('change', () => {
                activeRocketId = acc.id;
                chrome.storage.local.set({ active_rocket_id: activeRocketId });
                renderRocketAccounts();

            });
            
            updateDisplay(); // Initial display update
            
            item.appendChild(radio);
            item.appendChild(numSpan);
            item.appendChild(pinSpan);
            item.appendChild(methodSelect);
            rocketListEl.appendChild(item);
        });
    }
    
    function saveRocketAccounts() {
        chrome.storage.local.set({
            rocket_accounts: rocketAccounts,
            active_rocket_id: activeRocketId
        });
    }

    // ===== EYE TOGGLE BUTTONS =====
    // 1. IVAC Password Eye Button (Default: Unhide / text)
    if (toggleIvacPassBtn && passInput) {
        toggleIvacPassBtn.addEventListener('click', () => {
            if (passInput.type === 'text') {
                passInput.type = 'password';
                toggleIvacPassBtn.textContent = '🙈';
            } else {
                passInput.type = 'text';
                toggleIvacPassBtn.textContent = '👁️';
            }
        });
    }

    // Removed Eye buttons for rocket since we don't have the add input anymore

    // ===== Auto Save IVAC phone & password on typing/backspace =====
    function autoSaveCredentials() {
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const pass = passInput ? passInput.value : '';
        
        currentPhone = phone;
        const profileLabel = currentPhone ? `Profile (${currentPhone})` : `Profile`;
        const dataToSave = {
            ivac_phone: currentPhone,
            ivac_password: pass,
            profile_label: profileLabel
        };
        
        chrome.storage.local.set(dataToSave, () => {
            updateStatus();
            // Sync with local desktop app backend
            fetch('http://127.0.0.1:5000/api/profile/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: currentPhone,
                    password: pass
                })
            }).catch(() => {});
        });
    }

    if (passInput) {
        passInput.addEventListener('input', autoSaveCredentials);
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', autoSaveCredentials);
    }
    if (savePhoneBtn) {
        savePhoneBtn.addEventListener('click', autoSaveCredentials);
    }

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

            slotBookingEnabled = false;
            if (slotBookingToggle) {
                slotBookingToggle.checked = false;
                slotBookingToggle.disabled = true;
            }
            chrome.storage.local.set({ slot_booking_enabled: false });
        } else {
            webfileEnabled = true;
            webfileEnabledToggle.checked = true;
            webfileEnabledToggle.disabled = false;
            chrome.storage.local.set({ webfile_enabled: true });

            paymentEnabled = true;
            paymentEnabledToggle.checked = true;
            paymentEnabledToggle.disabled = false;
            chrome.storage.local.set({ payment_enabled: true });

            slotBookingEnabled = true;
            if (slotBookingToggle) {
                slotBookingToggle.checked = true;
                slotBookingToggle.disabled = false;
            }
            chrome.storage.local.set({ slot_booking_enabled: true });
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

        // ===== Slot Booking ON/OFF Toggle =====
    if (slotBookingToggle) {
        slotBookingToggle.addEventListener('change', (e) => {
            slotBookingEnabled = e.target.checked;
            chrome.storage.local.set({ slot_booking_enabled: slotBookingEnabled });
        });
    }

    if (slotModeBtn) {
        slotModeBtn.addEventListener('click', () => {
            chrome.storage.local.get(['slot_fallback_enabled'], (res) => {
                const current = res.slot_fallback_enabled !== undefined ? res.slot_fallback_enabled : true;
                const nextVal = !current;
                chrome.storage.local.set({ slot_fallback_enabled: nextVal }, () => {
                    slotModeBtn.textContent = nextVal ? 'All Date' : 'Only Favorite';
                    slotModeBtn.classList.toggle('manual', !nextVal);
                    slotModeBtn.classList.toggle('manual-mode', !nextVal);
                });
            });
        });
    }

    // ===== Preferred Dates Functions =====
    const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNameMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
    };

    function formatChipDate(val) {
        if (!val) return '';
        val = String(val).trim();
        
        // Match '02-Sep-2026' or '02 Sep 2026' or '2-Sep'
        const nameMatch = val.match(/^(\d{1,2})[-/\s]+([A-Za-z]+)(?:[-/\s]+(\d{4}))?$/);
        if (nameMatch) {
            const day = parseInt(nameMatch[1], 10);
            const mStr = nameMatch[2].toLowerCase();
            const mIdx = monthNameMap[mStr] !== undefined ? monthNameMap[mStr] : -1;
            const mLabel = mIdx !== -1 ? monthsList[mIdx] : nameMatch[2];
            return `${day} ${mLabel}`;
        }

        // Match YYYY-MM-DD (e.g. 2026-09-02)
        const isoMatch = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
            const day = parseInt(isoMatch[3], 10);
            const mIdx = parseInt(isoMatch[2], 10) - 1;
            return `${day} ${monthsList[mIdx] || isoMatch[2]}`;
        }

        // Match DD-MM-YYYY or DD-MM
        const numMatch = val.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?$/);
        if (numMatch) {
            const day = parseInt(numMatch[1], 10);
            const mIdx = parseInt(numMatch[2], 10) - 1;
            return `${day} ${monthsList[mIdx] || numMatch[2]}`;
        }

        // Single day number e.g. '24'
        if (/^\d{1,2}$/.test(val)) {
            return `${parseInt(val, 10)} তারিখ`;
        }

        return val;
    }

    function renderPreferredDates() {
        if (!preferredDatesList) return;
        if (!preferredDates || preferredDates.length === 0) {
            preferredDatesList.innerHTML = '<span class="date-chip-empty">কোনো পছন্দের তারিখ নেই (সব ওপেন ডেটে ঘুরবে)</span>';
            return;
        }

        preferredDatesList.innerHTML = '';
        preferredDates.forEach((dateStr) => {
            const chip = document.createElement('div');
            chip.className = 'date-chip';
            const displayLabel = formatChipDate(dateStr);
            chip.innerHTML = `
                <span>${displayLabel}</span>
                <button type="button" class="chip-del" data-date="${dateStr}" title="মুছে ফেলুন">✕</button>
            `;
            preferredDatesList.appendChild(chip);
        });
    }

    function addDateValue(val) {
        if (!val) return;
        val = String(val).trim();
        if (!val) return;

        if (!Array.isArray(preferredDates)) {
            preferredDates = [];
        }

        if (!preferredDates.includes(val)) {
            preferredDates.push(val);
            chrome.storage.local.set({ preferred_dates: preferredDates }, () => {
                renderPreferredDates();
            });
        }
        if (preferredDateInput) preferredDateInput.value = '';
        if (preferredDatePicker) preferredDatePicker.value = '';
        renderPreferredDates();
    }

    if (addPreferredDateBtn) {
        addPreferredDateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const textVal = preferredDateInput ? preferredDateInput.value.trim() : '';
            const pickVal = preferredDatePicker ? preferredDatePicker.value.trim() : '';
            addDateValue(textVal || pickVal);
        });
    }

    if (preferredDateInput) {
        preferredDateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addDateValue(preferredDateInput.value);
            }
        });
    }

    if (preferredDatePicker) {
        preferredDatePicker.addEventListener('change', () => {
            if (preferredDatePicker.value) {
                addDateValue(preferredDatePicker.value);
            }
        });
    }

    // ===== CUSTOM IN-POPUP CALENDAR LOGIC (FRIDAY & SATURDAY STRICTLY BLOCKED) =====
    const customCalPopup = document.getElementById('custom-calendar-popup');
    const calMonthTitle = document.getElementById('cal-month-title');
    const calDaysGrid = document.getElementById('cal-days-grid');
    const calPrevBtn = document.getElementById('cal-prev-btn');
    const calNextBtn = document.getElementById('cal-next-btn');
    const calCloseBtn = document.getElementById('cal-close-btn');

    let calViewDate = new Date(); // Tracks current viewed month & year

    function renderCustomCalendar() {
        if (!calDaysGrid || !calMonthTitle) return;

        const year = calViewDate.getFullYear();
        const month = calViewDate.getMonth(); // 0-indexed

        const monthName = monthsList[month];
        calMonthTitle.textContent = `${monthName} ${year}`;

        calDaysGrid.innerHTML = '';

        // First day of month (0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat)
        const firstDayIndex = new Date(year, month, 1).getDay();
        // Number of days in month
        const totalDays = new Date(year, month + 1, 0).getDate();

        // Fill leading empty cells
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cal-day-cell empty';
            calDaysGrid.appendChild(emptyCell);
        }

        const today = new Date();

        // Fill day cells
        for (let day = 1; day <= totalDays; day++) {
            const dateObj = new Date(year, month, day);
            const dayOfWeek = dateObj.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
            const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // Friday or Saturday

            const cell = document.createElement('div');
            cell.className = 'cal-day-cell';
            cell.textContent = day;

            if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
                cell.classList.add('today');
            }

            const formattedTag = `${day} ${monthName}`;
            if (preferredDates.includes(formattedTag)) {
                cell.classList.add('selected');
            }

            if (isWeekend) {
                cell.classList.add('weekend-day');
                cell.title = dayOfWeek === 5 ? 'শুক্রবার (IVAC বন্ধ)' : 'শনিবার (IVAC বন্ধ)';
                // Weekend click does nothing
            } else {
                cell.classList.add('working-day');
                cell.title = `${day} ${monthName} (${['রবি','সোম','মঙ্গল','বুধ','বৃহ'][dayOfWeek]}বার)`;
                cell.addEventListener('click', () => {
                    addDateValue(formattedTag);
                    if (customCalPopup) customCalPopup.style.display = 'none';
                });
            }

            calDaysGrid.appendChild(cell);
        }
    }

    if (openCalendarBtn) {
        openCalendarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!customCalPopup) return;
            const isHidden = customCalPopup.style.display === 'none';
            if (isHidden) {
                calViewDate = new Date();
                renderCustomCalendar();
                customCalPopup.style.display = 'block';
            } else {
                customCalPopup.style.display = 'none';
            }
        });
    }

    if (calPrevBtn) {
        calPrevBtn.addEventListener('click', () => {
            calViewDate.setMonth(calViewDate.getMonth() - 1);
            renderCustomCalendar();
        });
    }

    if (calNextBtn) {
        calNextBtn.addEventListener('click', () => {
            calViewDate.setMonth(calViewDate.getMonth() + 1);
            renderCustomCalendar();
        });
    }

    if (calCloseBtn) {
        calCloseBtn.addEventListener('click', () => {
            if (customCalPopup) customCalPopup.style.display = 'none';
        });
    }

    if (preferredDatesList) {
        preferredDatesList.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.chip-del');
            if (delBtn) {
                const targetDate = delBtn.getAttribute('data-date');
                preferredDates = preferredDates.filter(d => d !== targetDate);
                chrome.storage.local.set({ preferred_dates: preferredDates }, () => {
                    renderPreferredDates();
                });
            }
        });
    }

    async function updateStatus() {
        let statusData = null;
        const devBadge = document.getElementById('popup-device-badge');
        const lockOverlay = document.getElementById('license-lock-overlay');
        try {
            const statusRes = await fetch('http://127.0.0.1:5000/api/status');
            if (!statusRes.ok) throw new Error("Server offline");
            statusData = await statusRes.json();
            
            // STRICT ZERO-TRUST: If licensed is false, trigger lockout!
            if (statusData && statusData.licensed === false) {
                throw new Error("License invalid or expired");
            }
            
            // Server is CONNECTED and LICENSED: Hide lock overlay
                        // Server is CONNECTED and LICENSED: Hide lock overlay & update status text
            if (lockOverlay) lockOverlay.style.display = 'none';
            serverDot.className = "dot green";
            serverText.innerText = "সংযুক্ত";
            latestServerStatus = statusData;

                // Update IVAC phone dot
                const ivacDot = document.getElementById('ivac-phone-status-dot');
                if (ivacDot) {
                    const ivacStat = getPhoneDeviceStatus(currentPhone);
                    ivacDot.className = `dot ${ivacStat.dotClass}`;
                    ivacDot.title = `IVAC: ${ivacStat.label}`;
                }
                updatePaymentAccountDots();


                // Update device count badge
                const devices = statusData.devices || [];
                const onlineCount = statusData.online_devices !== undefined ? statusData.online_devices : devices.filter(d => d.online).length;
                const totalCount = statusData.total_devices !== undefined ? statusData.total_devices : devices.length;
                if (devBadge) {
                    devBadge.textContent = `📱 ${onlineCount}/${totalCount}`;
                    devBadge.style.display = 'inline-block';
                    devBadge.title = `অনলাইন: ${onlineCount} টি, মোট: ${totalCount} টি মোবাইল`;
                }
                
                // Real-time 2-way sync credentials with desktop app
                // Server active_profile sync disabled to respect user cleared inputs
                // Sync payment accounts list from Desktop App (NEVER overwrite user-selected active_rocket_id)
                if (statusData && statusData.rocket_accounts) {
                    const serverAccounts = statusData.rocket_accounts;
                    if (JSON.stringify(serverAccounts) !== JSON.stringify(rocketAccounts)) {
                        rocketAccounts = serverAccounts;
                        chrome.storage.local.set({ rocket_accounts: rocketAccounts });
                        if (!document.activeElement || document.activeElement.tagName !== 'SELECT') {
                            renderRocketAccounts();
                        }
                    }
                }

        } catch (e) {
            const lockOverlay = document.getElementById('license-lock-overlay');
            if (lockOverlay) lockOverlay.style.display = 'flex';
            latestServerStatus = null;
            serverDot.className = "dot red";
            serverText.innerText = "সার্ভার বন্ধ";
            smsDisplay.innerText = "সার্ভারের সাথে সংযোগ নেই";
            const ivacDot = document.getElementById('ivac-phone-status-dot');
            if (ivacDot) {
                ivacDot.className = "dot red";
                ivacDot.title = "সার্ভার বন্ধ";
            }
            updatePaymentAccountDots();

            return;
        }

        let otpFound = false;

        // Check all registered phones (IVAC phone + All Payment Account phones)
        const phonesToQuery = [];
        if (currentPhone) phonesToQuery.push({ phone: currentPhone, label: '📱 IVAC', isIvac: true });
        
        rocketAccounts.forEach(acc => {
            if (acc && acc.number) {
                const p = acc.number.substring(0, 11);
                if (!phonesToQuery.find(x => x.phone === p)) {
                    phonesToQuery.push({ phone: p, label: '🚀 Payment', isIvac: false });
                }
            }
        });

        let htmlOtp = '';
        for (const item of phonesToQuery) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/otp/${item.phone}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data && data.data.display) {
                        const isUsed = !!data.data.used;
                        const statusBadge = isUsed ? '<span style="font-size:9px; color:#64748b; font-weight:bold; background:#e2e8f0; padding:1px 4px; border-radius:3px; margin-left:4px;">[Used]</span>' : '<span style="font-size:9px; color:#059669; font-weight:bold; background:#dcfce7; padding:1px 4px; border-radius:3px; margin-left:4px;">[Unused]</span>';
                        const numColor = isUsed ? '#64748b' : (item.isIvac ? '#059669' : '#d97706');
                        const tagColor = item.isIvac ? '#059669' : '#d97706';
                        
                        if (otpFound) {
                            htmlOtp += '<div style="height:1px; background:#e2e8f0; margin:4px 0;"></div>';
                        }
                        htmlOtp += `
                            <div class="otp-tag" style="color:${tagColor}; display:flex; justify-content:space-between; align-items:center;">
                                <span>${item.label} (${item.phone})</span>
                                ${statusBadge}
                            </div>
                            <div class="otp-number" style="color:${numColor};">${data.data.display}</div>
                        `;
                        otpFound = true;
                    }
                }
            } catch(e) {}
        }
        if (otpFound) {
            smsDisplay.innerHTML = htmlOtp;
            if (smsCardWrap) smsCardWrap.style.display = 'flex';
        } else {
            smsDisplay.innerHTML = '';
            if (smsCardWrap) smsCardWrap.style.display = 'none';
        }
    }

    // Open Native Chrome Side Panel
    const openSidebarBtn = document.getElementById('open-sidebar-btn');
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
                        await chrome.sidePanel.open({ tabId: tab.id });
                    }
                    window.close();
                }
            } catch(err) {
                console.error("Error opening side panel:", err);
            }
        });
    }

    updateStatus();
    setInterval(() => {
        if (extToggle.checked) {
            updateStatus();
        }
    }, 1000);
});


    const retryBtn = document.getElementById('retry-server-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            updateStatus();
        });
    }
