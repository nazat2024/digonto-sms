// SidePanel Script for Digonto QuickFill
try {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
    }
} catch(e) {}

const fields = ['webFile', 'surname', 'givenName', 'passport', 'nid', 'phone', 'email', 'dob', 'password'];
const shortcutMap = {'1':'webFile','2':'surname','3':'givenName','4':'passport','5':'nid','6':'phone','7':'email','8':'dob','9':'password','0':'password'};

function playClickSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
}

function saveData(id) {
    // Save all fields at once to avoid race conditions
    saveAllFields();
}

function saveAllFields() {
    const data = {};
    fields.forEach(f => {
        const el = document.getElementById(f);
        if (el) {
            let val = el.value;
            if (f === 'webFile' || f === 'passport') val = val.toUpperCase();
            data[f] = val;
        }
    });
    chrome.storage.local.set({ ai_autofill_data: data });
}

function copyText(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const cleanText = input.value.trim();
    if (!cleanText) return showToast("কোনো তথ্য নেই!");

    navigator.clipboard.writeText(cleanText).then(() => {
        playClickSound();
        showToast("কপি হয়েছে: " + cleanText);
        if (btnElement) {
            const originalText = btnElement.innerText;
            btnElement.innerText = "✓";
            btnElement.classList.add("copied");
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.classList.remove("copied");
            }, 800);
        }
    }).catch(() => {
        input.select();
        document.execCommand('copy');
        playClickSound();
        showToast("কপি হয়েছে: " + cleanText);
    });
}

let currentZoom = 0.9;

function applyZoom() {
    document.body.style.zoom = currentZoom;
    const zTxt = document.getElementById('zoomLevelTxt');
    if (zTxt) zTxt.innerText = Math.round(currentZoom * 100) + "%";
    chrome.storage.local.set({ ai_sidebar_zoom: currentZoom });
}

function stopLoader(message, color) {
    const loader = document.getElementById('loader');
    const statusText = document.getElementById('statusText');
    const pdfUpload = document.getElementById('pdfUpload');
    if (loader) loader.style.display = 'none';
    if (statusText) {
        statusText.innerText = message;
        statusText.style.color = color;
    }
    if (pdfUpload) pdfUpload.value = '';
}

function extractAndFillData(text) {
    let cleanText = text.replace(/\s+/g, ' ');

    const matchWebfile = cleanText.match(/(BGDR[A-Z0-9]+)/i);
    const matchPassport = cleanText.match(/Passport No.*?([A-Z0-9]+)/i);
    const matchNID = cleanText.match(/National ID No.*?([0-9]{10,17})/i);
    const matchDOB = cleanText.match(/Date of Birth.*?([0-9]{2}-[A-Za-z]{3}-[0-9]{4})/i);
    const matchPhone = cleanText.match(/Phone No.*?([0-9]{11})/i) || cleanText.match(/Mobile.*?([0-9]{11})/i);
    const matchEmail = cleanText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
    const matchSurname = cleanText.match(/Surname \(As in Passport\)\s*(.*?)\s*Given Name/i);
    const matchGivenName = cleanText.match(/Given Name \(As in Passport\)\s*(.*?)\s*Previous\/other/i);

    let dataFound = false;

    if (matchWebfile) { document.getElementById('webFile').value = matchWebfile[1].toUpperCase(); dataFound = true; }
    if (matchPassport) document.getElementById('passport').value = matchPassport[1].toUpperCase();
    if (matchNID) document.getElementById('nid').value = matchNID[1];
    if (matchDOB) document.getElementById('dob').value = matchDOB[1].toUpperCase();
    if (matchEmail) document.getElementById('email').value = matchEmail[1].toLowerCase();

    let finalPhone = "";
    if (matchPhone) {
        finalPhone = matchPhone[1];
        if (finalPhone.startsWith("88")) finalPhone = finalPhone.substring(2);
        if (!finalPhone.startsWith("0")) finalPhone = "0" + finalPhone;
        document.getElementById('phone').value = finalPhone;
    }

    let surnameStr = "";
    let givenNameStr = "";
    if (matchSurname) {
        surnameStr = matchSurname[1].trim();
        document.getElementById('surname').value = surnameStr;
    }
    if (matchGivenName) {
        givenNameStr = matchGivenName[1].trim();
        document.getElementById('givenName').value = givenNameStr;
    }
    if (surnameStr || givenNameStr) {
        const fnEl = document.getElementById('fullName'); if (fnEl) fnEl.value = (givenNameStr + ' ' + surnameStr).trim();
    }

    // Smart Password
    if (givenNameStr && finalPhone) {
        let nameParts = givenNameStr.split(/\s+/);
        let skipPrefixes = ["MD", "MD.", "MST", "MST.", "MR", "MR.", "MRS", "MS", "MISS", "MOSAMMAT", "MUHAMMAD", "MOHAMMAD"];
        let targetName = nameParts[0];

        for (let part of nameParts) {
            if (!skipPrefixes.includes(part.toUpperCase())) {
                targetName = part;
                break;
            }
        }

        targetName = targetName.charAt(0).toUpperCase() + targetName.slice(1).toLowerCase();
        let generatedPassword = targetName + "@" + finalPhone;
        document.getElementById('password').value = generatedPassword;
    }

    saveAllFields();

    if (dataFound) {
        stopLoader("✅ সফলভাবে তথ্য পূরণ হয়েছে!", "var(--btn-copy)");
        playClickSound();
        showToast("PDF থেকে ডেটা নেওয়া হয়েছে!");
    } else {
        stopLoader("⚠️ এটি কি সঠিক ভিসার পিডিএফ?", "#ef4444");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load Saved Data
    chrome.storage.local.get(['ai_autofill_data', 'ai_sidebar_zoom'], (res) => {
        const data = res.ai_autofill_data || {};
        fields.forEach(f => {
            const el = document.getElementById(f);
            if (el && data[f] !== undefined) {
                el.value = data[f];
            }
        });

        if (res.ai_sidebar_zoom) {
            currentZoom = res.ai_sidebar_zoom;
        }
        applyZoom();
    });

    // Bind Input Listeners
    fields.forEach(f => {
        const el = document.getElementById(f);
        if (el) {
            el.addEventListener('input', () => saveData(f));
        }
    });

    // Copy Buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            copyText(target, btn);
        });
    });

    // Zoom Controls
    document.getElementById('zoomInBtn')?.addEventListener('click', () => {
        if (currentZoom < 1.5) {
            currentZoom += 0.1;
            applyZoom();
        }
    });
    document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
        if (currentZoom > 0.5) {
            currentZoom -= 0.1;
            applyZoom();
        }
    });

    // Clear All
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm("সব ডেটা মুছে ফেলতে চান?")) {
                fields.forEach(f => {
                    const el = document.getElementById(f);
                    if (el) el.value = '';
                });
                chrome.storage.local.remove(['ai_autofill_data'], () => {
                    stopLoader("আপলোড করলে ফর্ম অটোমেটিক পূরণ হয়ে যাবে", "var(--text-muted)");
                    showToast("ডেটা ক্লিয়ার করা হয়েছে!");
                });
            }
        });
    }

    // PDF Upload Handler
    const pdfUpload = document.getElementById('pdfUpload');
    if (pdfUpload) {
        pdfUpload.addEventListener('change', async function(e) {
            let file = e.target.files[0];
            if (!file) return;
            if (file.type !== "application/pdf") {
                alert("দয়া করে একটি সঠিক PDF ফাইল আপলোড করুন!");
                e.target.value = '';
                return;
            }

            const loader = document.getElementById('loader');
            const statusText = document.getElementById('statusText');
            if (loader) loader.style.display = 'inline-block';
            if (statusText) {
                statusText.innerText = " তথ্য বের করা হচ্ছে, অপেক্ষা করুন...";
                statusText.style.color = "var(--text-muted)";
            }

            try {
                let reader = new FileReader();
                reader.onload = async function() {
                    try {
                        let typedarray = new Uint8Array(this.result);
                        let fullText = "";
                        if (typeof pdfjsLib !== 'undefined') {
                            let pdf = await pdfjsLib.getDocument(typedarray).promise;
                            let maxPages = Math.min(pdf.numPages, 2);
                            for (let i = 1; i <= maxPages; i++) {
                                let page = await pdf.getPage(i);
                                let content = await page.getTextContent();
                                let strings = content.items.map(item => item.str);
                                fullText += strings.join(" ") + " ";
                            }
                        }
                        extractAndFillData(fullText);
                    } catch (err) {
                        stopLoader("❌ পিডিএফ পড়তে সমস্যা হয়েছে।", "#ef4444");
                    }
                };
                reader.readAsArrayBuffer(file);
            } catch (error) {
                stopLoader("❌ ফাইল খুলতে সমস্যা হয়েছে।", "#ef4444");
            }
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', function(event) {
        if (event.altKey && shortcutMap[event.key]) {
            event.preventDefault();
            const fieldId = shortcutMap[event.key];
            const btn = document.querySelector(`button[data-target="${fieldId}"]`);
            copyText(fieldId, btn);
        }
    });
});
