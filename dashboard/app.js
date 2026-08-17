/**
 * IVAC OTP Auto-Fill Dashboard (Extension Edition)
 */

const socket = io();

// State
let state = {
    otps: [],
    isConnected: false
};

// DOM Elements
const els = {
    statusDot: document.querySelector('.status-dot'),
    statusText: document.querySelector('.status-text'),
    serverIp: document.querySelector('.server-ip'),
    
    statWaiting: document.querySelector('#stat-waiting .stat-value'),
    statReceived: document.querySelector('#stat-received .stat-value'),
    statSuccess: document.querySelector('#stat-success .stat-value'),
    
    logContainer: document.getElementById('log-container'),
    btnClearLog: document.getElementById('btn-clear-log'),
    btnClearAll: document.getElementById('btn-clear-all'),
    
    manualForm: document.getElementById('manual-otp-form'),
    manualPhone: document.getElementById('manual-phone'),
    otpBoxes: Array.from(document.querySelectorAll('.otp-box')),
    manualSmsText: document.getElementById('manual-sms-text'),
    toastContainer: document.getElementById('toast-container')
};

// Initialization
function init() {
    setupSocketListeners();
    setupEventListeners();
    setupOtpInputHandling();
    determineServerIP();
}

function determineServerIP() {
    fetch('/api/ip')
        .then(response => response.json())
        .then(data => {
            if (data.ip) {
                const port = window.location.port || '5000'; // Default if standard 80
                const ipStr = `${data.ip}:${port}`;
                els.serverIp.innerHTML = `📡 ${ipStr}`;
                els.serverIp.dataset.rawIp = ipStr;
                
                const urlElement = document.getElementById('macrodroid-url');
                if (urlElement) {
                    urlElement.textContent = `http://${data.ip}:5000/api/sms`;
                }
            }
        })
        .catch(err => {
            console.error("Error fetching IP:", err);
            const fallbackIp = `${window.location.hostname}:${window.location.port}`;
            els.serverIp.innerHTML = `📡 ${fallbackIp}`;
            els.serverIp.dataset.rawIp = fallbackIp;
        });
}

// Socket Listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        state.isConnected = true;
        updateConnectionStatus();
        addLog('success', 'সার্ভারের সাথে সংযুক্ত হয়েছে');
    });

    socket.on('disconnect', () => {
        state.isConnected = false;
        updateConnectionStatus();
        addLog('error', 'সার্ভার থেকে বিচ্ছিন্ন হয়েছে');
    });

    socket.on('status_update', (data) => {
        if (data.otps) {
            state.otps = data.otps;
            updateStats();
        }
    });

    socket.on('otp_received', (data) => {
        state.otps.push(data);
        updateStats();
        addLog('info', `📱 ${data.phone} নম্বরে OTP এসেছে: <b>${data.display}</b>`);
        showToast('success', 'নতুন OTP', `${data.phone} নম্বরে OTP এসেছে: ${data.display}`);
    });

    socket.on('otp_used', (data) => {
        const otp = state.otps.find(o => o.phone === data.phone);
        if (otp) {
            otp.used = true;
            updateStats();
            addLog('success', `✅ ${data.phone} নম্বরের OTP ব্যবহার হয়েছে`);
        }
    });

    socket.on('cleared', () => {
        state.otps = [];
        updateStats();
        addLog('warning', 'সব ডেটা মুছে ফেলা হয়েছে');
        showToast('info', 'রিসেট সম্পন্ন', 'সব ডেটা মুছে ফেলা হয়েছে');
    });
}

function updateConnectionStatus() {
    if (state.isConnected) {
        els.statusDot.className = 'status-dot connected';
        els.statusText.textContent = 'সংযুক্ত (Online)';
    } else {
        els.statusDot.className = 'status-dot disconnected';
        els.statusText.textContent = 'বিচ্ছিন্ন (Offline)';
    }
}

function updateStats() {
    const total = state.otps.length;
    const used = state.otps.filter(o => o.used).length;
    const waiting = total - used;

    els.statReceived.textContent = total;
    els.statWaiting.textContent = waiting;
    els.statSuccess.textContent = used;
}

// Event Listeners
function setupEventListeners() {
    els.btnClearLog.addEventListener('click', () => {
        els.logContainer.innerHTML = '';
        addLog('info', 'লগ পরিষ্কার করা হয়েছে');
    });

    els.btnClearAll.addEventListener('click', async () => {
        if (confirm('আপনি কি নিশ্চিত যে সব OTP মুছে ফেলতে চান?')) {
            await fetch('/api/clear', { method: 'POST' });
        }
    });

    // Fetch local IP for MacroDroid setup is now handled in determineServerIP()

    // New IP Management Buttons
    const btnCopyIp = document.getElementById('btn-copy-ip');
    if (btnCopyIp) {
        btnCopyIp.addEventListener('click', () => {
            const ip = els.serverIp.dataset.rawIp;
            if (ip) {
                navigator.clipboard.writeText(ip);
                showToast('success', 'কপি হয়েছে', 'IP Address কপি করা হয়েছে: ' + ip);
            }
        });
    }

    const btnRefreshIp = document.getElementById('btn-refresh-ip');
    if (btnRefreshIp) {
        btnRefreshIp.addEventListener('click', () => {
            determineServerIP();
            showToast('info', 'রিফ্রেশ', 'IP Address রিফ্রেশ করা হয়েছে');
        });
    }

    // Chrome profile url copy
    const btnCopyChrome = document.getElementById('btn-copy-chrome-url');
    if (btnCopyChrome) {
        btnCopyChrome.addEventListener('click', () => {
            navigator.clipboard.writeText('chrome://version/');
            showToast('success', 'কপি হয়েছে', 'chrome://version/ কপি করা হয়েছে। নতুন ট্যাবে পেস্ট করুন।');
        });
    }

    // JSON Payload copy
    const btnCopyJson = document.getElementById('btn-copy-json');
    if (btnCopyJson) {
        btnCopyJson.addEventListener('click', () => {
            const jsonText = document.getElementById('macrodroid-json').innerText;
            navigator.clipboard.writeText(jsonText);
            showToast('success', 'কপি হয়েছে', 'JSON Payload কপি করা হয়েছে!');
        });
    }

    // Handle manual OTP form submit
    els.manualForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phone = els.manualPhone.value.trim();
        if (!phone) {
            showToast('error', 'ভুল তথ্য', 'ফোন নম্বর দিন');
            return;
        }

        const smsText = els.manualSmsText.value.trim();
        let otpDigits = els.otpBoxes.map(b => b.value).join('');

        let payload = {};

        if (smsText) {
            payload = {
                phone: phone,
                sms_body: smsText,
                sms_from: 'MANUAL'
            };
            
            try {
                const resp = await fetch('/api/sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await resp.json();
                if (data.success) {
                    els.manualSmsText.value = '';
                    showToast('success', 'সফল', 'SMS প্রসেস করা হয়েছে');
                } else {
                    showToast('error', 'ব্যর্থ', data.error || 'OTP পাওয়া যায়নি');
                }
            } catch (err) {
                showToast('error', 'ত্রুটি', 'সার্ভারে পৌঁছানো যায়নি');
            }
        } else if (otpDigits.length === 6) {
            payload = {
                phone: phone,
                otp: otpDigits
            };
            
            try {
                const resp = await fetch('/api/manual-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await resp.json();
                if (data.success) {
                    els.otpBoxes.forEach(b => b.value = '');
                    els.otpBoxes[0].focus();
                    showToast('success', 'সফল', 'ম্যানুয়াল OTP পাঠানো হয়েছে');
                } else {
                    showToast('error', 'ব্যর্থ', data.error || 'OTP পাঠানো যায়নি');
                }
            } catch (err) {
                showToast('error', 'ত্রুটি', 'সার্ভারে পৌঁছানো যায়নি');
            }
        } else {
            showToast('warning', 'অসম্পূর্ণ', 'হয় ৬ ডিজিটের OTP দিন, না হয় SMS টেক্সট দিন');
        }
    });
}

function setupOtpInputHandling() {
    els.otpBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            // Numbers only
            box.value = box.value.replace(/[^0-9]/g, '');
            
            if (box.value && index < els.otpBoxes.length - 1) {
                els.otpBoxes[index + 1].focus();
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && index > 0) {
                els.otpBoxes[index - 1].focus();
            }
        });
        
        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
            if (pastedData) {
                let startIdx = index;
                for (let i = 0; i < pastedData.length && startIdx < els.otpBoxes.length; i++) {
                    els.otpBoxes[startIdx].value = pastedData[i];
                    startIdx++;
                }
                if (startIdx < els.otpBoxes.length) {
                    els.otpBoxes[startIdx].focus();
                } else {
                    els.otpBoxes[els.otpBoxes.length - 1].focus();
                }
            }
        });
    });
}

// Logging Utils
function addLog(type, message) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-icon">${icon}</span>
        <span class="log-msg">${message}</span>
    `;
    
    els.logContainer.prepend(entry);
    
    // Keep max 100 logs
    if (els.logContainer.children.length > 100) {
        els.logContainer.lastChild.remove();
    }
}

// Toast Utils
function showToast(type, title, message, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close">×</button>
    `;

    els.toastContainer.appendChild(toast);

    // Animation
    setTimeout(() => toast.classList.add('show'), 10);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    };

    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// Start
document.addEventListener('DOMContentLoaded', init);
