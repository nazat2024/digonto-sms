console.log("IV Autofill: content.js script has been loaded."); const e = { DELHI: { name: "VISHAL HOTEL", add1: "1576 MAIN BAZAR ROAD, PAHARGANJ", add2_pincode: "110021", state: "DELHI", district: "NEW DELHI", phone: "919560640328" }, KOLKATA: { name: "The Park Hotel", add1: "17, Park St, Taltala", add2_pincode: "700016", state: "WEST BENGAL", district: "KOLKATA", phone: "913322499000" }, CHENNAI: { name: "The Park Chennai", add1: "601, Anna Salai, Tirumurthy Nagar, Nungambakkam", add2_pincode: "600006", state: "TAMIL NADU", district: "CHENNAI", phone: "914442676000" }, BANGALORE: { name: "GREENS RESIDENCY", add1: "118, KALASIPALYA MAIN RD, OPPOSITE AYYAPPASWAMY TEMPLE, KALASIPALYA", add2_pincode: "560002", state: "KARNATAKA", district: "BANGALORE", phone: "918026703912" }, MUMBAI: { name: "Hotel Golden Crown", add1: "Road No. 3, Tank View, Sahar Village, Andheri East", add2_pincode: "400099", state: "MAHARASHTRA", district: "MUMBAI", phone: "91 91524 32787" }, "EMBASSY-BULGARIA": { name: "Embassy of Bulgaria", add1: "E P16/17, Chandra Gupta Marg, Chanakyapuri", add2_pincode: "110021", state: "DELHI", district: "NEW DELHI", phone: "91 11 2611 5550" } }; function t(e, t) { if (t && "NILL" !== t) { const n = document.getElementById(e); n && (console.log(`- Filling Text Field #${e} with value: ${t}`), n.value = t, n.dispatchEvent(new Event("input", { bubbles: !0 })), n.dispatchEvent(new Event("change", { bubbles: !0 })), n.dispatchEvent(new Event("blur", { bubbles: !0 }))) } } function n(e, t) {
    if (null == t || "NILL" === t) return;
    const el = document.getElementById(e);
    if (!el) return;
    let found = false;
    const target = String(t).trim().toUpperCase();
    for (let idx = 0; idx < el.options.length; idx++) {
        const opt = el.options[idx];
        const optVal = (opt.value || "").trim().toUpperCase();
        const optTxt = (opt.text || opt.innerText || "").trim().toUpperCase();
        if (
            optVal === target ||
            optTxt === target ||
            (target === "BANGLADESH" && (optVal === "BGD" || optTxt === "BGD" || optTxt.startsWith("BANGLADESH"))) ||
            (target === "BGDR" && optTxt.includes("RAJSHAHI")) ||
            (target === "BGDD" && optTxt.includes("DHAKA")) ||
            (target === "BGDC" && optTxt.includes("CHITTAGONG")) ||
            (target === "BGDK" && optTxt.includes("KHULNA")) ||
            (target === "BGDS" && optTxt.includes("SYLHET"))
        ) {
            el.selectedIndex = idx;
            el.value = opt.value;
            opt.selected = true;
            found = true;
            break;
        }
    }
    if (found) {
        console.log(`- Setting Dropdown #${e} to: ${t}`);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
        console.warn(`   -> Could not find option "${t}" in dropdown #${e}`);
    }
} function i(e, t) { document.querySelectorAll(`input[name="${e}"]`).forEach(e => { e.value.toUpperCase() === t.toUpperCase() && (e.checked = !0, e.dispatchEvent(new Event("change", { bubbles: !0 })), e.dispatchEvent(new Event("click", { bubbles: !0 }))) }) } function o(e) { const t = e.toLowerCase(), n = Array.from(document.querySelectorAll("div, td, span, b, th")); for (let e of n) if (e.textContent.toLowerCase().includes(t)) { if (Array.from(e.children).some(e => e.textContent.toLowerCase().includes(t))) continue; let n = e.nextElementSibling, i = 0; for (; n && i < 3;) { const e = n.textContent.trim(); if (e && ":" !== e && e.length >= 2 && !e.includes("*") && !e.includes("?")) return e; n = n.nextElementSibling, i++ } } return "" } function a(e, t, n = 1e4) {
    return new Promise((resolve) => {
        if (!document.getElementById(e)) return resolve();
        const startTime = Date.now();
        const s = String(t).trim().toUpperCase();
        const timer = setInterval(() => {
            const el = document.getElementById(e);
            if (!el) { clearInterval(timer); return resolve(); }
            for (const opt of el.options) {
                const optVal = (opt.value || "").trim().toUpperCase();
                const optTxt = (opt.text || opt.innerText || "").trim().toUpperCase();
                if (
                    optTxt === s ||
                    optVal === s ||
                    (s === "BANGLADESH" && (optVal === "BGD" || optTxt === "BGD" || optTxt.startsWith("BANGLADESH"))) ||
                    (s === "BGDR" && optTxt.includes("RAJSHAHI")) ||
                    (s === "BGDD" && optTxt.includes("DHAKA")) ||
                    (s === "BGDC" && optTxt.includes("CHITTAGONG")) ||
                    (s === "BGDK" && optTxt.includes("KHULNA")) ||
                    (s === "BGDS" && optTxt.includes("SYLHET"))
                ) {
                    clearInterval(timer);
                    return resolve();
                }
            }
            if (Date.now() - startTime > n) {
                clearInterval(timer);
                console.warn(`Timeout waiting for ${t} in ${e}`);
                resolve();
            }
        }, 150);
    });
} function l(e, t = 3e3) { return new Promise(n => { if (!document.getElementById(e)) return n(); const i = Date.now(), o = setInterval(() => { const a = document.getElementById(e); if (!a) return clearInterval(o), void n(); (a.options.length <= 1 || Date.now() - i > t) && (clearInterval(o), n()) }, 100) }) } chrome.runtime.onMessage.addListener((e, t, n) => { "FILL_FORM" === e.type ? (console.log("IV Autofill: Received data from popup. Starting process.", e.data), sessionStorage.setItem("autofillInProgress", "true"), sessionStorage.setItem("autofillData", JSON.stringify(e.data)), m(e.data)) : "TRIGGER_WIZARD" === e.type && (console.log("IV Autofill: Received trigger wizard request:", e.wizard), "cover_letter" === e.wizard ? B() : "noc" === e.wizard ? P() : "undertaking" === e.wizard && D(), n({ success: !0 })) }); 
// ==================== AUTO CAPTCHA SOLVER HELPERS ====================
function findCaptchaImage() {
    let img = document.getElementById("capt") || document.getElementById("captcha") || document.getElementById("captchaImg") || document.getElementById("cpatchaTextBox");
    if (img && img.tagName === "IMG") return img;

    img = document.querySelector('img[src*="captcha" i], img[src*="capt" i], img[id*="capt" i], img[name*="capt" i], img[alt*="captcha" i]');
    if (img) return img;

    const labels = Array.from(document.querySelectorAll("td, th, label, div, span, p")).filter(el => 
        /enter above text/i.test(el.textContent) || /captcha/i.test(el.textContent)
    );
    for (const l of labels) {
        const container = l.closest("tr, form, table, div.row, div");
        if (container) {
            const candidate = container.querySelector("img");
            if (candidate && !/(reload|refresh|logo|header|banner|flag|emblem|icon|home)/i.test(candidate.src || "")) {
                return candidate;
            }
        }
    }

    const allImgs = Array.from(document.querySelectorAll("img")).filter(im => {
        const w = im.offsetWidth || im.naturalWidth || 0;
        const h = im.offsetHeight || im.naturalHeight || 0;
        const src = (im.src || "").toLowerCase();
        if (src.includes("logo") || src.includes("banner") || src.includes("flag") || src.includes("emblem") || src.includes("header") || src.includes("icon") || src.includes("reload") || src.includes("refresh") || src.includes("home")) return false;
        return (w >= 70 && w <= 400 && h >= 20 && h <= 120);
    });
    if (allImgs.length > 0) return allImgs[0];

    return null;
}

function findCaptchaInput() {
    let inp = document.getElementById("captcha") || document.getElementById("capt") || document.getElementById("captcha_code") || document.getElementById("captchacode") || document.getElementById("cpatchaTextBox") || document.querySelector('input[name="captcha" i], input[name="capt" i], input[name="captcha_code" i]');
    if (inp && inp.tagName === "INPUT") return inp;

    const labels = Array.from(document.querySelectorAll("td, th, label, div, span, p")).filter(el => 
        /enter above text/i.test(el.textContent)
    );
    for (const l of labels) {
        if (l.htmlFor) {
            const target = document.getElementById(l.htmlFor);
            if (target && target.tagName === "INPUT") return target;
        }
        const container = l.closest("tr, form, table, div.row, div");
        if (container) {
            const target = container.querySelector('input[type="text"], input:not([type])');
            if (target) return target;
        }
        let next = l.nextElementSibling;
        while (next) {
            const target = next.tagName === "INPUT" ? next : next.querySelector('input[type="text"], input:not([type])');
            if (target) return target;
            next = next.nextElementSibling;
        }
        const pCell = l.closest("td, th");
        if (pCell && pCell.nextElementSibling) {
            const target = pCell.nextElementSibling.querySelector('input[type="text"], input:not([type])');
            if (target) return target;
        }
    }

    if (window.location.href.toLowerCase().includes("completepartially") || (document.body && document.body.innerText.includes("Complete Partially Filled"))) {
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).filter(el => {
            return el.offsetWidth > 0 && el.offsetHeight > 0 && !el.readOnly && !el.disabled;
        });
        if (textInputs.length >= 2) {
            return textInputs[1];
        }
    }

    return null;
}

function findTempAppIdInput() {
    let inp = document.getElementById("token") || document.getElementById("appl_id") || document.getElementById("temp_id") || document.getElementById("temp_app_id") || document.getElementById("application_id") || document.querySelector('input[name="token" i], input[name*="temp" i], input[name*="appl" i]');
    if (inp && inp.tagName === "INPUT") return inp;

    const labels = Array.from(document.querySelectorAll("td, th, label, div, span, p")).filter(el => 
        /temporary application id/i.test(el.textContent)
    );
    for (const l of labels) {
        if (l.htmlFor) {
            const target = document.getElementById(l.htmlFor);
            if (target && target.tagName === "INPUT") return target;
        }
        const container = l.closest("tr, form, table, div.row, div");
        if (container) {
            const target = container.querySelector('input[type="text"], input:not([type])');
            if (target) return target;
        }
        const pCell = l.closest("td, th");
        if (pCell && pCell.nextElementSibling) {
            const target = pCell.nextElementSibling.querySelector('input[type="text"], input:not([type])');
            if (target) return target;
        }
    }

    if (window.location.href.toLowerCase().includes("completepartially") || (document.body && document.body.innerText.includes("Complete Partially Filled"))) {
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).filter(el => {
            return el.offsetWidth > 0 && el.offsetHeight > 0 && !el.readOnly && !el.disabled;
        });
        if (textInputs.length >= 1) {
            return textInputs[0];
        }
    }
    return null;
}

async function getCaptchaBase64(imgEl) {
    if (!imgEl) return null;
    if (!imgEl.complete || imgEl.naturalWidth === 0) {
        await new Promise(resolve => {
            imgEl.addEventListener("load", resolve, { once: true });
            imgEl.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 800);
        });
    }

    try {
        const canvas = document.createElement("canvas");
        canvas.width = imgEl.naturalWidth || imgEl.width || 200;
        canvas.height = imgEl.naturalHeight || imgEl.height || 50;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl && dataUrl.includes(",")) {
            const b64 = dataUrl.split(",")[1];
            if (b64 && b64.length > 50) return b64;
        }
    } catch (err) {
        console.warn("Canvas capture failed, attempting fetch fallback:", err);
    }

    try {
        const resp = await fetch(imgEl.src, { credentials: "include" });
        const blob = await resp.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result;
                if (typeof res === "string" && res.includes(",")) {
                    resolve(res.split(",")[1]);
                } else {
                    resolve(null);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error("Direct fetch of captcha image failed:", err);
        return null;
    }
}

let isSolvingCaptcha = false;
let lastSolvedCaptchaKey = "";

async function autoSolveAndFillCaptcha(force = false) {
    if (isSolvingCaptcha) return;

    const s = await chrome.storage.local.get(["autoCaptchaEnabled"]);
    if (s.autoCaptchaEnabled === false && !force) {
        console.log("Auto Captcha is disabled in settings.");
        return;
    }

    const img = findCaptchaImage();
    const input = findCaptchaInput();

    if (!img || !input) {
        return;
    }

    const currentKey = (img.src || "") + "_" + (img.naturalWidth || 0);
    if (!force && input.value && input.value.trim().length >= 4 && lastSolvedCaptchaKey === currentKey) {
        return;
    }

    isSolvingCaptcha = true;
    lastSolvedCaptchaKey = currentKey;

    const originalBorder = input.style.border;
    const originalPlaceholder = input.placeholder || "";
    input.placeholder = "Solving Captcha with AI...";
    input.style.border = "2px solid #3b82f6";

    try {
        console.log("Auto Captcha: Capturing image...", img.src || img);
        const b64 = await getCaptchaBase64(img);
        if (!b64) throw new Error("Could not extract captcha image base64.");

        const res = await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: "SOLVE_CAPTCHA", fileData: b64 }, r => {
                if (chrome.runtime.lastError || !r) return resolve(null);
                resolve(r);
            });
        });

        if (res && res.success && res.text) {
            const cleanText = res.text.trim();
            console.log("Auto Captcha solved:", cleanText);
            input.value = cleanText;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("blur", { bubbles: true }));

            input.style.border = "2px solid #22c55e";
            input.style.backgroundColor = "#f0fdf4";
            setTimeout(() => {
                input.style.border = originalBorder;
                input.style.backgroundColor = "";
                input.placeholder = originalPlaceholder;
            }, 2000);
        } else {
            console.warn("Auto Captcha solver returned error or empty:", res);
            lastSolvedCaptchaKey = "";
            input.style.border = originalBorder;
            input.style.backgroundColor = "";
            input.placeholder = originalPlaceholder;
        }
    } catch (err) {
        console.error("Auto Captcha execution error:", err);
        lastSolvedCaptchaKey = "";
        input.style.border = originalBorder;
        input.style.backgroundColor = "";
        input.placeholder = originalPlaceholder;
    } finally {
        isSolvingCaptcha = false;
    }
}

function initAutoCaptcha() {
    const run = () => {
        autoSolveAndFillCaptcha();
        setTimeout(() => autoSolveAndFillCaptcha(), 600);
        setTimeout(() => autoSolveAndFillCaptcha(), 1500);
        setTimeout(() => autoSolveAndFillCaptcha(), 3000);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
        run();
    }
    window.addEventListener("load", run, { once: true });

    const setupListeners = () => {
        const img = findCaptchaImage();
        if (img && !img._captchaListenerAttached) {
            img._captchaListenerAttached = true;
            img.addEventListener("load", () => {
                console.log("Captcha image reloaded. Re-solving with AI...");
                setTimeout(() => autoSolveAndFillCaptcha(true), 200);
            });
        }
        const reloadBtns = document.querySelectorAll('img[src*="reload" i], img[src*="refresh" i], a[href*="reload" i], a[href*="refresh" i], .refresh, [onclick*="reload" i], [onclick*="refresh" i]');
        reloadBtns.forEach(btn => {
            if (!btn._captchaListenerAttached) {
                btn._captchaListenerAttached = true;
                btn.addEventListener("click", () => {
                    console.log("Captcha reload button clicked. Re-solving with AI...");
                    setTimeout(() => autoSolveAndFillCaptcha(true), 800);
                });
            }
        });
    };

    setupListeners();
    setTimeout(setupListeners, 1000);
    setTimeout(setupListeners, 2500);
}
// ==================== END AUTO CAPTCHA SOLVER HELPERS ====================

let s, r, d = null;
async function p(e) {
    const mS = await chrome.storage.local.get(["defaultMissionCode"]);
    const defMsn = mS.defaultMissionCode || "BGDD";
    if (!e.missioncode_id || e._type === "PASSPORT" || !e.bgd_no || (defMsn && defMsn !== "BGDD")) {
        e.missioncode_id = defMsn;
    }
    const targetMission = e.missioncode_id || defMsn;
    console.log("IV Autofill: Detected Page 0. Setting basic fields...");

    // Function to cleanly set mission & nationality once
    d = (async function () {
        try {
            n("countryname_id", "BANGLADESH");
            await a("missioncode_id", targetMission, 6000);
            const mEl = document.getElementById("missioncode_id");
            const curVal = mEl ? mEl.value : "";
            if (curVal !== targetMission) {
                n("missioncode_id", targetMission);
                // Changing mission causes the site to AJAX-load nationalities. Wait a moment for AJAX to start.
                await new Promise(res => setTimeout(res, 500));
            }
            // Wait for nationality dropdown options to be available and select BANGLADESH
            await a("nationality_id", "BANGLADESH", 8000);
            n("nationality_id", "BANGLADESH");

            // Verify after 500ms that site AJAX didn't overwrite it
            setTimeout(() => {
                const nat = document.getElementById("nationality_id");
                if (nat && (!nat.value || nat.selectedIndex <= 0)) {
                    n("nationality_id", "BANGLADESH");
                }
            }, 500);
            console.log("IV Autofill: Country, Mission, and Nationality configured.");
        } catch (err) {
            console.error("IV Autofill: Error setting basic fields:", err);
        }
    })();

    autoSolveAndFillCaptcha(true);

    (function (e) {
        if (document.getElementById("iv-visa-modal")) return;
        const i = document.createElement("link");
        i.rel = "stylesheet";
        i.href = chrome.runtime.getURL("modal.css");
        document.head.appendChild(i);
        const o = e.email_id && "NILL" !== e.email_id ? e.email_id : "";
        const s = targetMission;
        r = document.createElement("div");
        r.id = "iv-visa-modal";
        r.innerHTML = `
        <div class="iv-visa-content">
            <h3>Start Application</h3>
            <div class="iv-email-section">
                <label>Indian Mission/Office:</label>
                <select id="iv-mission-select" class="iv-email-input" style="margin-bottom: 15px;">
                    <option value="BGDC" ${"BGDC" === s ? "selected" : ""}>BANGLADESH-CHITTAGONG</option>
                    <option value="BGDD" ${"BGDD" === s ? "selected" : ""}>BANGLADESH-DHAKA</option>
                    <option value="BGDK" ${"BGDK" === s ? "selected" : ""}>BANGLADESH-KHULNA</option>
                    <option value="BGDR" ${"BGDR" === s ? "selected" : ""}>BANGLADESH-RAJSHAHI</option>
                    <option value="BGDS" ${"BGDS" === s ? "selected" : ""}>BANGLADESH-SYLHET</option>
                </select>
                
                <label>Applicant Email ID:</label>
                <input type="email" id="iv-user-email" class="iv-email-input" value="${o}" placeholder="Enter valid email...">
                <span class="iv-warning">⚠ Please check your email very carefully!</span>
            </div>
            <div class="iv-visa-grid">
                <button class="iv-visa-btn btn-tourist" id="btn-tourist">Tourist Visa</button>
                <button class="iv-visa-btn btn-double" id="btn-double">Double Entry</button>
                <button class="iv-visa-btn btn-med-pat" id="btn-med-pat">Medical Patient</button>
                <button class="iv-visa-btn btn-med-att" id="btn-med-att">Medical Attendant</button>
                <button class="iv-visa-btn btn-other" id="btn-other">Others (Manual)</button>
            </div>
        </div>
        `;
        document.body.appendChild(r);

        const mSelect = document.getElementById("iv-mission-select");
        if (mSelect) {
            mSelect.onchange = async () => {
                if (mSelect.value) {
                    e.missioncode_id = mSelect.value;
                    n("missioncode_id", mSelect.value);
                    await new Promise(res => setTimeout(res, 500));
                    await a("nationality_id", "BANGLADESH", 5000);
                    n("nationality_id", "BANGLADESH");
                }
            };
        }

        const p = async (purposeCode) => {
            const emailVal = document.getElementById("iv-user-email") ? document.getElementById("iv-user-email").value : "";
            const missionVal = document.getElementById("iv-mission-select") ? document.getElementById("iv-mission-select").value : targetMission;
            r.remove();

            // 1. INSTANTLY fill email, dob, journey date without any blocking
            if (emailVal) {
                t("email_id", emailVal);
                t("email_re_id", emailVal);
                e.email_id = emailVal;
            }
            t("dob_id", e.dob);
            if (!e.jouryney_id) {
                const _jS = await chrome.storage.local.get(["defaultJourneyDateMode", "defaultJourneyDate"]);
                const _m = String(_jS?.defaultJourneyDateMode || "");
                const _d = parseInt(_m, 10);
                if (["15", "30", "45"].includes(_m) && !isNaN(_d) && _d > 0) {
                    const _dt = new Date();
                    _dt.setDate(_dt.getDate() + _d);
                    e.jouryney_id = `${String(_dt.getDate()).padStart(2, "0")}/${String(_dt.getMonth() + 1).padStart(2, "0")}/${_dt.getFullYear()}`;
                } else if (_jS?.defaultJourneyDate && _jS.defaultJourneyDate.trim()) {
                    e.jouryney_id = _jS.defaultJourneyDate.trim();
                } else if (!isNaN(_d) && _d > 0) {
                    const _dt = new Date();
                    _dt.setDate(_dt.getDate() + _d);
                    e.jouryney_id = `${String(_dt.getDate()).padStart(2, "0")}/${String(_dt.getMonth() + 1).padStart(2, "0")}/${_dt.getFullYear()}`;
                }
            }
            t("jouryney_id", e.jouryney_id);
            sessionStorage.setItem("autofillData", JSON.stringify(e));

            // 2. Ensure mission and nationality match
            if (d) {
                await d;
                d = null;
            }
            const curM = document.getElementById("missioncode_id") ? document.getElementById("missioncode_id").value : "";
            if (missionVal && curM !== missionVal) {
                n("missioncode_id", missionVal);
                e.missioncode_id = missionVal;
                await new Promise(res => setTimeout(res, 500));
                await a("nationality_id", "BANGLADESH", 5000);
                n("nationality_id", "BANGLADESH");
            } else {
                const nat = document.getElementById("nationality_id");
                if (!nat || !nat.value || nat.selectedIndex <= 0) {
                    n("nationality_id", "BANGLADESH");
                }
            }

            // 3. Fill visa purpose quickly
            if (purposeCode) {
                await (async function (code) {
                    let t = document.getElementById("visaPurposeDropdown");
                    if (!t) {
                        t = await new Promise(res => {
                            const startTime = Date.now();
                            const interval = setInterval(() => {
                                const el = document.getElementById("visaPurposeDropdown");
                                if (el) {
                                    clearInterval(interval);
                                    return res(el);
                                }
                                if (Date.now() - startTime > 4000) {
                                    clearInterval(interval);
                                    return res(null);
                                }
                            }, 100);
                        });
                    }
                    if (t) {
                        await a("visaPurposeDropdown", code, 6000);
                        n("visaPurposeDropdown", code);
                        y("visaPurposeDropdown", code);
                    } else {
                        let svc = null, pur = null;
                        if ("544" === code) { svc = "3"; pur = "234"; }
                        else if ("532" === code) { svc = "87"; pur = "186"; }
                        else if ("545" === code) { svc = "16"; pur = "235"; }
                        else if ("546" === code) { svc = "16"; pur = "236"; }
                        if (svc && pur) {
                            await a("visaService", svc, 6000);
                            n("visaService", svc);
                            await a("purpose", pur, 6000);
                            n("purpose", pur);
                        }
                    }
                })(purposeCode);
            }

            // Final safety check for nationality
            const finalNat = document.getElementById("nationality_id");
            if (finalNat && (!finalNat.value || finalNat.selectedIndex <= 0)) {
                n("nationality_id", "BANGLADESH");
            }
        };

        document.getElementById("btn-tourist").onclick = () => p("544");
        document.getElementById("btn-double").onclick = () => p("532");
        document.getElementById("btn-med-pat").onclick = () => p("545");
        document.getElementById("btn-med-att").onclick = () => p("546");
        document.getElementById("btn-other").onclick = () => p(null);
    })(e);
}

function findPrintMissionSelect() {
    let sel = document.getElementById("indian_mission") || 
              document.getElementById("mission") || 
              document.getElementById("mission_code") || 
              document.getElementById("missioncode_id") || 
              document.querySelector('select[name*="mission" i], select[id*="mission" i]');
    if (sel && sel.tagName === "SELECT") return sel;

    const labels = Array.from(document.querySelectorAll("td, th, label, div, span, p")).filter(el => 
        /indian\s*mission/i.test(el.textContent) || /mission/i.test(el.textContent)
    );
    for (const l of labels) {
        const container = l.closest("tr, form, table, div.row, div");
        if (container) {
            const s = container.querySelector("select");
            if (s) return s;
        }
        const pCell = l.closest("td, th");
        if (pCell && pCell.nextElementSibling) {
            const s = pCell.nextElementSibling.querySelector("select");
            if (s) return s;
        }
    }

    const selects = Array.from(document.querySelectorAll("select")).filter(s => {
        return s.offsetWidth > 0 && s.offsetHeight > 0;
    });
    for (const s of selects) {
        const txt = (s.innerText || s.textContent || "").toUpperCase();
        if (txt.includes("DHAKA") || txt.includes("RAJSHAHI") || txt.includes("CHITTAGONG") || txt.includes("KHULNA") || txt.includes("SYLHET")) {
            return s;
        }
    }
    return selects[0] || null;
}

function findPrintDobInput() {
    let inp = document.getElementById("dob") || 
              document.getElementById("date_of_birth") || 
              document.getElementById("dob_id") || 
              document.getElementById("dateOfBirth") || 
              document.querySelector('input[name*="dob" i], input[id*="dob" i], input[placeholder*="DD/MM/YYYY" i], input[placeholder*="birth" i]');
    if (inp && inp.tagName === "INPUT") return inp;

    const labels = Array.from(document.querySelectorAll("td, th, label, div, span, p")).filter(el => 
        /date\s*of\s*birth/i.test(el.textContent)
    );
    for (const l of labels) {
        if (l.htmlFor) {
            const target = document.getElementById(l.htmlFor);
            if (target && target.tagName === "INPUT") return target;
        }
        const container = l.closest("tr, form, table, div.row, div");
        if (container) {
            const target = container.querySelector('input[type="text"], input:not([type])');
            if (target && target.id !== "captcha" && target.id !== "capt") return target;
        }
        const pCell = l.closest("td, th");
        if (pCell && pCell.nextElementSibling) {
            const target = pCell.nextElementSibling.querySelector('input[type="text"], input:not([type])');
            if (target && target.id !== "captcha" && target.id !== "capt") return target;
        }
    }

    if (window.location.href.toLowerCase().includes("printapplication") || (document.body && /reprint\s*form/i.test(document.body.innerText))) {
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).filter(el => {
            const isCap = /capt/i.test(el.id || "") || /capt/i.test(el.name || "") || /capt/i.test(el.placeholder || "");
            return el.offsetWidth > 0 && el.offsetHeight > 0 && !el.readOnly && !el.disabled && !isCap;
        });
        if (textInputs.length >= 2) {
            return textInputs[1];
        }
    }
    return null;
}

function findPrintPassportInput() {
    let inp = document.getElementById("passport_no") || 
              document.getElementById("passportno") || 
              document.getElementById("pass_no") || 
              document.getElementById("ppt_no") || 
              document.getElementById("passport") || 
              document.querySelector('input[name*="pass" i], input[id*="pass" i], input[placeholder*="passport" i]');
    if (inp && inp.tagName === "INPUT") return inp;

    const labels = Array.from(document.querySelectorAll("td, th, label, div, span, p")).filter(el => 
        /passport\s*no/i.test(el.textContent)
    );
    for (const l of labels) {
        if (l.htmlFor) {
            const target = document.getElementById(l.htmlFor);
            if (target && target.tagName === "INPUT") return target;
        }
        const container = l.closest("tr, form, table, div.row, div");
        if (container) {
            const target = container.querySelector('input[type="text"], input:not([type])');
            if (target && target.id !== "captcha" && target.id !== "capt") return target;
        }
        const pCell = l.closest("td, th");
        if (pCell && pCell.nextElementSibling) {
            const target = pCell.nextElementSibling.querySelector('input[type="text"], input:not([type])');
            if (target && target.id !== "captcha" && target.id !== "capt") return target;
        }
    }

    if (window.location.href.toLowerCase().includes("printapplication") || (document.body && /reprint\s*form/i.test(document.body.innerText))) {
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).filter(el => {
            const isCap = /capt/i.test(el.id || "") || /capt/i.test(el.name || "") || /capt/i.test(el.placeholder || "");
            return el.offsetWidth > 0 && el.offsetHeight > 0 && !el.readOnly && !el.disabled && !isCap;
        });
        if (textInputs.length >= 3) {
            return textInputs[2];
        }
    }
    return null;
}

function findPrintAppIdInput() {
    let inp = document.getElementById("application_id") || 
              document.getElementById("appl_id") || 
              document.getElementById("app_id") || 
              document.getElementById("web_file_no") || 
              document.querySelector('input[name*="appl" i], input[id*="appl" i], input[placeholder*="application id" i]');
    if (inp && inp.tagName === "INPUT") return inp;

    const labels = Array.from(document.querySelectorAll("td, th, label, div, span, p")).filter(el => 
        /application\s*id/i.test(el.textContent)
    );
    for (const l of labels) {
        if (l.htmlFor) {
            const target = document.getElementById(l.htmlFor);
            if (target && target.tagName === "INPUT") return target;
        }
        const container = l.closest("tr, form, table, div.row, div");
        if (container) {
            const target = container.querySelector('input[type="text"], input:not([type])');
            if (target && target.id !== "captcha" && target.id !== "capt") return target;
        }
        const pCell = l.closest("td, th");
        if (pCell && pCell.nextElementSibling) {
            const target = pCell.nextElementSibling.querySelector('input[type="text"], input:not([type])');
            if (target && target.id !== "captcha" && target.id !== "capt") return target;
        }
    }

    if (window.location.href.toLowerCase().includes("printapplication") || (document.body && /reprint\s*form/i.test(document.body.innerText))) {
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).filter(el => {
            const isCap = /capt/i.test(el.id || "") || /capt/i.test(el.name || "") || /capt/i.test(el.placeholder || "");
            return el.offsetWidth > 0 && el.offsetHeight > 0 && !el.readOnly && !el.disabled && !isCap;
        });
        if (textInputs.length >= 1) {
            return textInputs[0];
        }
    }
    return null;
}

async function fillPrintApplicationPage(e) {
    if (!e) return;
    try {
        console.log("IV Autofill: Starting fillPrintApplicationPage with data:", e);
        for (let attempt = 0; attempt < 10; attempt++) {
            if (findPrintMissionSelect() || findPrintDobInput() || findPrintPassportInput()) break;
            await new Promise(r => setTimeout(r, 200));
        }

        const mS = await chrome.storage.local.get(["defaultMissionCode"]);
        const defMsn = mS.defaultMissionCode || "BGDD";
        if (!e.missioncode_id || e._type === "PASSPORT" || !e.bgd_no || (defMsn && defMsn !== "BGDD")) {
            e.missioncode_id = defMsn;
        }

        // 1. Select Regular Visa radio if present
        const radioBtns = Array.from(document.querySelectorAll('input[type="radio"]'));
        for (const r of radioBtns) {
            const container = r.closest("label, tr, td, div") || r.parentElement;
            const txt = ((container ? container.innerText : "") + " " + (r.value || "")).toLowerCase();
            if (txt.includes("regular")) {
                if (!r.checked) {
                    r.checked = true;
                    r.click();
                    r.dispatchEvent(new Event("change", { bubbles: true }));
                }
                break;
            }
        }

        // 2. Select Indian Mission
        const sel = findPrintMissionSelect();
        if (sel) {
            const target = String(e.missioncode_id || e.mission || defMsn).trim().toUpperCase();
            let matchedIndex = -1;
            for (let i = 0; i < sel.options.length; i++) {
                const opt = sel.options[i];
                const optVal = (opt.value || "").trim().toUpperCase();
                const optTxt = (opt.text || opt.innerText || "").trim().toUpperCase();
                if (optVal === target || optTxt === target) {
                    matchedIndex = i;
                    break;
                }
                if ((target.includes("RAJSHAHI") || target === "BGDR") && optTxt.includes("RAJSHAHI")) {
                    matchedIndex = i;
                    break;
                }
                if ((target.includes("DHAKA") || target === "BGDD") && optTxt.includes("DHAKA")) {
                    matchedIndex = i;
                    break;
                }
                if ((target.includes("CHITTAGONG") || target === "BGDC") && optTxt.includes("CHITTAGONG")) {
                    matchedIndex = i;
                    break;
                }
                if ((target.includes("KHULNA") || target === "BGDK") && optTxt.includes("KHULNA")) {
                    matchedIndex = i;
                    break;
                }
                if ((target.includes("SYLHET") || target === "BGDS") && optTxt.includes("SYLHET")) {
                    matchedIndex = i;
                    break;
                }
            }
            if (matchedIndex >= 0) {
                sel.selectedIndex = matchedIndex;
                sel.value = sel.options[matchedIndex].value;
                sel.options[matchedIndex].selected = true;
                sel.dispatchEvent(new Event("input", { bubbles: true }));
                sel.dispatchEvent(new Event("change", { bubbles: true }));
                sel.dispatchEvent(new Event("blur", { bubbles: true }));
                try { if (window.jQuery) window.jQuery(sel).trigger("change"); } catch(e) {}
                console.log("IV Autofill: Selected Indian Mission on PrintApplication:", sel.options[matchedIndex].text);
            }
        }

        // 3. Fill Date of Birth
        let dobVal = (e.dob || e.birth_date || e.date_of_birth || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dobVal)) {
            const parts = dobVal.split("-");
            dobVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        if (dobVal) {
            const dobInp = findPrintDobInput();
            if (dobInp) {
                dobInp.focus();
                dobInp.value = dobVal;
                dobInp.dispatchEvent(new Event("input", { bubbles: true }));
                dobInp.dispatchEvent(new Event("change", { bubbles: true }));
                dobInp.dispatchEvent(new Event("blur", { bubbles: true }));
                try { if (window.jQuery) window.jQuery(dobInp).trigger("change"); } catch(e) {}
                console.log("IV Autofill: Filled Date of Birth on PrintApplication:", dobVal);
            }
        }

        // 4. Fill Passport No
        const pptVal = (e.passNo || e.passport_no || e.passportNo || "").trim();
        if (pptVal) {
            const pptInp = findPrintPassportInput();
            if (pptInp) {
                pptInp.focus();
                pptInp.value = pptVal;
                pptInp.dispatchEvent(new Event("input", { bubbles: true }));
                pptInp.dispatchEvent(new Event("change", { bubbles: true }));
                pptInp.dispatchEvent(new Event("blur", { bubbles: true }));
                try { if (window.jQuery) window.jQuery(pptInp).trigger("change"); } catch(e) {}
                console.log("IV Autofill: Filled Passport No on PrintApplication:", pptVal);
            }
        }

        // 5. Fill Application Id if present
        const appIdVal = (e.bgd_no || e.web_file_no || e.application_id || e.temp_app_id || "").trim();
        if (appIdVal) {
            const appInp = findPrintAppIdInput();
            if (appInp && (!appInp.value || appInp.value.trim() === "")) {
                appInp.focus();
                appInp.value = appIdVal;
                appInp.dispatchEvent(new Event("input", { bubbles: true }));
                appInp.dispatchEvent(new Event("change", { bubbles: true }));
                appInp.dispatchEvent(new Event("blur", { bubbles: true }));
                try { if (window.jQuery) window.jQuery(appInp).trigger("change"); } catch(e) {}
                console.log("IV Autofill: Filled Application ID on PrintApplication:", appIdVal);
            }
        }

        // 6. Auto-solve captcha
        await autoSolveAndFillCaptcha(true);
    } catch (err) {
        console.warn("IV Autofill: Error filling PrintApplication page:", err);
    }
}
 function c(e) { for (let e = 1; e <= 6; e++)i(`radioName[${e}]`, "NO"); !function (e) { const t = document.getElementById(e); t && !t.checked && (console.log(`- Clicking Checkbox #${e}`), t.click()) }("verifyQuestions") } async function m(e) { if (e) { const mS = await chrome.storage.local.get(["defaultMissionCode"]); const defMsn = mS.defaultMissionCode || "BGDD"; if (!e.missioncode_id || e._type === "PASSPORT" || !e.bgd_no || (defMsn && defMsn !== "BGDD")) { e.missioncode_id = defMsn; } if (e._type === "PASSPORT" || !e.bgd_no) { const pS = await chrome.storage.local.get(["defaultPassportArrivalPort", "defaultPassportExitPort", "defaultOccupation", "defaultEmpName", "defaultEmpDesignation", "defaultEmpAddress", "defaultJourneyDateMode", "defaultJourneyDate", "defaultPlacesToVisit", "defaultPlacesToVisitCountry", "defaultEducation"]); const dA = pS.defaultPassportArrivalPort || "BY ROAD GEDE"; const dE = pS.defaultPassportExitPort || "BY ROAD GEDE"; if (!e.entrypoint || e.entrypoint === "BY AIR/ HARIDASPUR") e.entrypoint = dA; if (!e.exitpoint || e.exitpoint === "BY AIR/ HARIDASPUR") e.exitpoint = dE; const defOcc = pS.defaultOccupation !== undefined ? pS.defaultOccupation : "LABOUR"; const defEmpName = pS.defaultEmpName !== undefined ? pS.defaultEmpName : "AGRICULTURE"; const defEmpDes = pS.defaultEmpDesignation !== undefined ? pS.defaultEmpDesignation : ""; const defEmpAddr = pS.defaultEmpAddress !== undefined ? pS.defaultEmpAddress : "KUSHTIA"; if (!e.occupation || e.occupation === "PRIVATE SERVICE") e.occupation = defOcc; if (!e.empname || e.empname === "ARB PRIVATE LIMITED") e.empname = defEmpName; if (e.empdesignation === "OFFICER" || (!e.empdesignation && defEmpDes)) e.empdesignation = defEmpDes; if (!e.empaddress || e.empaddress === "DHAKA, BANGLADESH") e.empaddress = defEmpAddr; if (!e.education || e.education === "GRADUATE") e.education = pS.defaultEducation || "MATRICULATION"; if (!e.jouryney_id) { const dM = String(pS?.defaultJourneyDateMode || ""); const dD = parseInt(dM, 10); if (["15", "30", "45"].includes(dM) && !isNaN(dD) && dD > 0) { const d = new Date(); d.setDate(d.getDate() + dD); e.jouryney_id = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; } else if (pS?.defaultJourneyDate && pS.defaultJourneyDate.trim()) { e.jouryney_id = pS.defaultJourneyDate.trim(); } else if (!isNaN(dD) && dD > 0) { const d = new Date(); d.setDate(d.getDate() + dD); e.jouryney_id = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; } } if (!e.places_to_visit) e.places_to_visit = pS?.defaultPlacesToVisit || "KOLKATA"; if (!e.places_to_visit_country) e.places_to_visit_country = pS?.defaultPlacesToVisitCountry || "INDIA"; } if (!e.jouryney_id) { const _jS = await chrome.storage.local.get(["defaultJourneyDateMode", "defaultJourneyDate"]); const _m = String(_jS?.defaultJourneyDateMode || ""); const _d = parseInt(_m, 10); if (["15", "30", "45"].includes(_m) && !isNaN(_d) && _d > 0) { const _dt = new Date(); _dt.setDate(_dt.getDate() + _d); e.jouryney_id = `${String(_dt.getDate()).padStart(2, "0")}/${String(_dt.getMonth() + 1).padStart(2, "0")}/${_dt.getFullYear()}`; } else if (_jS?.defaultJourneyDate && _jS.defaultJourneyDate.trim()) { e.jouryney_id = _jS.defaultJourneyDate.trim(); } else if (!isNaN(_d) && _d > 0) { const _dt = new Date(); _dt.setDate(_dt.getDate() + _d); e.jouryney_id = `${String(_dt.getDate()).padStart(2, "0")}/${String(_dt.getMonth() + 1).padStart(2, "0")}/${_dt.getFullYear()}`; } } const defEduFetch = await chrome.storage.local.get(["defaultEducation"]); if (!e.education || e.education === "GRADUATE") e.education = defEduFetch.defaultEducation || "MATRICULATION"; if (!e.places_to_visit) e.places_to_visit = "KOLKATA"; if (!e.places_to_visit_country) e.places_to_visit_country = "INDIA"; } console.log("IV Autofill: Running the autofill router..."), (window.location.href.toLowerCase().includes("completepartially") || (document.body && document.body.innerText.includes("Complete Partially Filled"))) ? (async function (e) {
    console.log("IV Autofill: Detected CompletePartially page in form router.");
    const tempInp = findTempAppIdInput();
    if (tempInp && (!tempInp.value || tempInp.value.trim() === "")) {
        try {
            const res = await chrome.storage.local.get(["recentTempIds"]);
            const list = res?.recentTempIds || [];
            const match = list.find(x => x.passport && e.passNo && x.passport.toUpperCase() === e.passNo.toUpperCase());
            const idToFill = e.temp_app_id || e.temporary_application_id || (match ? match.id : "");
            if (idToFill) {
                tempInp.value = idToFill;
                tempInp.dispatchEvent(new Event("input", { bubbles: true }));
                tempInp.dispatchEvent(new Event("change", { bubbles: true }));
                console.log("IV Autofill: Filled Temporary Application ID:", idToFill);
            }
        } catch (err) {
            console.warn("Error checking recentTempIds:", err);
        }
    }
    await autoSolveAndFillCaptcha(true);
})(e) : (window.location.href.toLowerCase().includes("printapplication") || (document.body && /reprint\s*form/i.test(document.body.innerText))) ? (async function (e) {
    console.log("IV Autofill: Detected PrintApplication (Reprint Form) page in form router.");
    await fillPrintApplicationPage(e);
})(e) : document.getElementById("surname") ? function (e) { console.log("IV Autofill: Detected Page 1."), t("surname", e.surname), t("givenName", e.givenName), t("birth_place", e.pobTown), t("nic_number", e.citizenId), t("identity_marks", "NA"), t("passport_no", e.passNo), t("passport_issue_place", e.passPlace), t("passport_issue_date", e.passDate), t("passport_expiry_date", e.passExpire), (function() {
    const hasOtherPpt = Boolean(
        (e.other_ppt_no && e.other_ppt_no.trim() && !["NA", "NILL", "NONE", "NO"].includes(e.other_ppt_no.trim().toUpperCase())) ||
        (e.prev_pass_no && e.prev_pass_no.trim() && !["NA", "NILL", "NONE", "NO"].includes(e.prev_pass_no.trim().toUpperCase())) ||
        (e.other_ppt_held === "YES" && (e.other_ppt_no || e.prev_pass_no))
    );

    if (hasOtherPpt) {
        console.log("IV Autofill: Previous/Other Passport details detected. Selecting YES...");
        i("appl.oth_ppt", "YES");
        const y_oth = document.querySelector('input[name="othPassYN"][value="Y"], input[name="othPassYN"][value="YES"], input[name="appl.oth_ppt"][value="YES"], input[name="appl.oth_ppt"][value="Y"]');
        y_oth && (y_oth.checked = true, y_oth.click(), y_oth.dispatchEvent(new Event("change", { bubbles: true })));

        const pptNo = (e.other_ppt_no || e.prev_pass_no || "").trim();
        const pptDate = (e.other_ppt_issue_date || "").trim();
        const pptPlace = (e.other_ppt_place || "DHAKA").trim();
        const pptCountry = (e.other_ppt_country || "BANGLADESH").trim();
        const pptNat = (e.other_ppt_nat || "BANGLADESH").trim();

        const setInp = (el, val) => {
            if (!el || !val) return;
            el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
        };

        const setSel = (el, val) => {
            if (!el || !val) return false;
            const target = String(val).trim().toUpperCase();
            let matched = false;
            for (let i = 0; i < el.options.length; i++) {
                const opt = el.options[i];
                const optVal = (opt.value || "").trim().toUpperCase();
                const optTxt = (opt.text || opt.innerText || "").trim().toUpperCase();
                if (
                    optVal === target ||
                    optTxt === target ||
                    (target === "BANGLADESH" && (optVal === "BGD" || optTxt === "BANGLADESH" || optTxt.startsWith("BANGLADESH"))) ||
                    (target === "BGD" && (optVal === "BANGLADESH" || optTxt === "BANGLADESH" || optTxt.startsWith("BANGLADESH")))
                ) {
                    el.selectedIndex = i;
                    el.value = opt.value;
                    matched = true;
                    break;
                }
            }
            if (matched) {
                console.log("- Setting Dropdown #" + (el.id || el.name) + " to: " + val);
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
                el.dispatchEvent(new Event("blur", { bubbles: true }));
                try { if (window.jQuery) window.jQuery(el).trigger("change"); } catch(e) {}
                try { y(el.id, el.value); } catch(e) {}
                return true;
            }
            return false;
        };

        const fillAllOtherFields = () => {
            // 1. Direct IDs and names
            const countryEl = document.getElementById("other_ppt_country_issue") ||
                              document.getElementById("other_ppt_country") ||
                              document.querySelector('select[name="appl.prev_passport_country_issue"]') ||
                              document.querySelector('.anyOtherNat select[name*="country"]') ||
                              document.querySelector('select[id*="country_issue"]');
            if (countryEl) setSel(countryEl, pptCountry);

            const natEl = document.getElementById("other_ppt_nat") ||
                          document.getElementById("other_ppt_nationality") ||
                          document.querySelector('select[name="appl.other ppt nationality"]') ||
                          document.querySelector('select[name="appl.other_ppt_nationality"]') ||
                          document.querySelector('.anyOtherNat select[name*="nat"]') ||
                          document.querySelector('select[id*="ppt_nat"]');
            if (natEl) setSel(natEl, pptNat);

            const noEl = document.getElementById("other_ppt_no") ||
                         document.getElementById("passport_ic_no") ||
                         document.querySelector('input[name="appl.prev_passport_no"]') ||
                         document.querySelector('.anyOtherNat input[name*="passport"]') ||
                         document.querySelector('input[id*="ppt_no"]');
            if (noEl) setInp(noEl, pptNo);

            if (pptDate) {
                const dateEl = document.getElementById("other_ppt_issue_date") ||
                               document.getElementById("date_issue") ||
                               document.querySelector('input[name="appl.prev_passport_issue_date"]') ||
                               document.querySelector('.anyOtherNat input[name*="issue_date"]') ||
                               document.querySelector('input[id*="issue_date"]');
                if (dateEl && dateEl.id !== "passport_issue_date") setInp(dateEl, pptDate);
            }

            const placeEl = document.getElementById("other_ppt_issue_place") ||
                            document.getElementById("other_ppt_place") ||
                            document.getElementById("place_issue") ||
                            document.querySelector('input[name="appl.prev_passport_place_issue"]') ||
                            document.querySelector('.anyOtherNat input[name*="place_issue"]') ||
                            document.querySelector('input[id*="issue_place"]');
            if (placeEl && placeEl.id !== "passport_issue_place") setInp(placeEl, pptPlace);

            // 2. Traversal through .anyOtherNat container rows
            document.querySelectorAll(".anyOtherNat").forEach(row => {
                const text = (row.textContent || "").toLowerCase();
                const sel = row.querySelector("select");
                if (sel) {
                    if (text.includes("country")) {
                        setSel(sel, pptCountry);
                    } else if (text.includes("nationality") || text.includes("therein")) {
                        setSel(sel, pptNat);
                    }
                }
                const inp = row.querySelector('input[type="text"]');
                if (inp) {
                    if (text.includes("passport") || text.includes("ic no")) {
                        setInp(inp, pptNo);
                    } else if (text.includes("date") && pptDate) {
                        setInp(inp, pptDate);
                    } else if (text.includes("place")) {
                        setInp(inp, pptPlace);
                    }
                }
            });
        };

        fillAllOtherFields();
        setTimeout(fillAllOtherFields, 100);
        setTimeout(fillAllOtherFields, 300);
        setTimeout(fillAllOtherFields, 600);
    } else {
        console.log("IV Autofill: No previous/other passport found. Keeping NO selected.");
        i("appl.oth_ppt", "NO");
        const n_oth = document.querySelector('input[name="othPassYN"][value="N"], input[name="othPassYN"][value="NO"], input[name="appl.oth_ppt"][value="NO"], input[name="appl.oth_ppt"][value="N"]');
        n_oth && (n_oth.checked = true, n_oth.click(), n_oth.dispatchEvent(new Event("change", { bubbles: true })));
    }
})(), t("gender", e.gender), t("country_birth", e.pobCountry), t("religion", e.religion), t("education", e.education), n("education", e.education), t("nationality", e.nationality), t("nationality_by", e.nationality) }(e) : document.getElementById("pres_add1") ? function (e) { t("pres_add1", e.pres_add1), t("pres_add2", e.pres_add2), t("pres_country", e.pres_country), t("pres_add3", e.pres_add3), t("pincode", e.pincode), t("pres_phone", e.pres_phone.slice(-11)), t("isd_code1", e.isd_code1), t("mobile", e.pres_phone.slice(-10)), t("perm_address1", e.perm_address1), t("perm_address2", e.perm_address2), t("perm_address3", e.perm_address3), t("fthrname", e.fthrname), t("father_nationality", e.father_nationality), t("father_previous_nationality", e.father_nationality), t("father_country_of_birth", e.father_nationality), t("mother_name", e.mother_name), t("mother_nationality", e.father_nationality), t("mother_previous_nationality", e.father_nationality), t("mother_country_of_birth", e.father_nationality), t("father_place_of_birth", e.father_place_of_birth), t("mother_place_of_birth", e.mother_place_of_birth), n("marital_status", e.marital_status), "0" === e.marital_status && (t("spouse_name", e.spouse_name), n("spouse_nationality", e.father_nationality), n("spouse_previous_nationality", e.father_nationality), t("spouse_place_of_birth", e.spouse_place_of_birth), n("spouse_country_of_birth", e.father_nationality)), t("occupation", e.occupation), n("occupation", e.occupation), t("empname", e.empname), (e.empdesignation ? t("empdesignation", e.empdesignation) : (document.getElementById("empdesignation") && (document.getElementById("empdesignation").value = ""))), t("empaddress", e.empaddress), i("appl.grandparent_flag", "NO"), i("appl.prev_org", "NO") }(e) : document.getElementById("email_id") ? p(e) : document.getElementById("duration") ? function (e) { t("visa_serreq_id_129", e.hsptNameMsn), t("visa_serreq_id_130", e.hsptAddMsn), t("visa_serreq_id_131", e.docNameMsn), t("visa_serreq_id_132", e.phMsn), t("visa_serreq_id_134", e.emailMsn), t("visa_serreq_id_124", e.illness), t("visa_serreq_id_112", e.places_to_visit || "KOLKATA"), t("visa_serreq_id_334", e.places_to_visit_country || "INDIA"), (function () { try { const fVal = (el, val) => { if (el && val && !el.value) { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("blur", { bubbles: true })); } }; const p1 = document.getElementById("visa_serreq_id_112"); const p2 = document.getElementById("visa_serreq_id_334"); if (p1) fVal(p1, e.places_to_visit || "KOLKATA"); if (p2) fVal(p2, e.places_to_visit_country || "INDIA"); if (!p1 || !p2 || !p1.value || !p2.value) { document.querySelectorAll(".row, tr").forEach(r => { const txt = (r.textContent || "").trim(); if (txt.includes("Places to be Visited")) { const inp = r.querySelector('input[type="text"]'); if (inp) fVal(inp, e.places_to_visit || "KOLKATA"); } else if (txt.startsWith('""') || txt.includes('"" *') || txt.includes('""*')) { const inp = r.querySelector('input[type="text"]'); if (inp) fVal(inp, e.places_to_visit_country || "INDIA"); } }); const srvs = Array.from(document.querySelectorAll('input[name="service_req_form_values"], .service_req_form_val')); if (srvs.length >= 2) { fVal(srvs[0], e.places_to_visit || "KOLKATA"); fVal(srvs[1], e.places_to_visit_country || "INDIA"); } } } catch(err) { console.warn("Places to be visited fallback error:", err); } })(), t("duration", e.duration), t("visa_entry_id", e.visa_entry_id), t("entrypoint", e.entrypoint), t("exitpointprc", e.exitpoint), e.old_visa_no && "NILL" !== e.old_visa_no.toUpperCase() && "NOTHING SHOWN" !== e.old_visa_no.toUpperCase() && "" !== e.old_visa_no.trim() ? (i("appl.old_visa_flag", "YES"), t("prv_visit_add1", e.prv_visit_add1), t("visited_city", e.visited_city), t("old_visa_no", e.old_visa_no), n("old_visa_type_id", e.old_visa_type_id), t("oldvisaissueplace", e.oldvisaissueplace), t("oldvisaissuedate", e.oldvisaissuedateRaw)) : i("appl.old_visa_flag", "NO"), i("appl.refuse_flag", "NO"), i("appl.saarc_flag", "NO"); const o = document.querySelector('input[name="othPassYN"][value="N"]'); o && o.click(), t("country_visited", e.country_visited), t("nameofsponsor_msn", !e.spouse_name || ["NILL", "NA"].includes(e.spouse_name.trim().toUpperCase()) ? e.fthrname : e.spouse_name), t("add1ofsponsor_msn", e.pres_add1), t("add2ofsponsor_msn", e.pres_add2 + ", " + e.pres_add3), t("phoneofsponsor_msn", e.pres_phone.slice(-11)), u() }(e) : document.getElementById("question_yes_1") ? c() : document.getElementById("place_of_stay1") ? (console.log("IV Autofill: Detected Page 5. Showing Hotel Selector."), u()) : (console.log("IV Autofill: Unknown page."), sessionStorage.removeItem("autofillInProgress"), sessionStorage.removeItem("autofillData")) } async function u() { if (document.getElementById("iv-modal-backdrop")) return; const t = document.createElement("link"); t.rel = "stylesheet", t.href = chrome.runtime.getURL("modal.css"), document.head.appendChild(t); const n = (await chrome.storage.local.get(["iv_custom_hotels"])).iv_custom_hotels || [], i = document.createElement("div"); i.id = "iv-modal-backdrop"; let o = ""; Object.keys(e).forEach(e => { o += `<button class="btn-default" data-key="${e}">${e}</button>` }), n.length > 0 && (o += '<div style="margin: 15px 0 5px 0; border-top: 1px dashed #ccc; padding-top:10px; font-size:11px; color:#777; font-weight:bold; text-align:left;">MY SAVED LOCATIONS</div>', n.forEach((e, t) => { o += `\n                <div class="custom-hotel-wrapper">\n                    <button class="btn-custom" data-index="${t}">${g(e.name)}</button>\n                    <div class="btn-delete-custom" data-index="${t}" title="Delete">×</div>\n                </div>` })), o += '<button id="btn-add-new-hotel" class="btn-add-new">+ Add New Hotel/Embassy</button>', i.innerHTML = `\n        <div id="iv-modal-content">\n            <h3>Select Reference</h3>\n            <div class="iv-modal-options">\n                ${o}\n            </div>\n        </div>\n    `, document.body.appendChild(i), i.querySelectorAll(".btn-default").forEach(t => { t.addEventListener("click", () => v(e[t.dataset.key])) }), i.querySelectorAll(".btn-custom").forEach(e => { e.addEventListener("click", () => v(n[e.dataset.index])) }), i.querySelectorAll(".btn-delete-custom").forEach(e => { e.addEventListener("click", async t => { if (t.stopPropagation(), confirm("Delete this saved location permanently?")) { const t = parseInt(e.dataset.index); n.splice(t, 1), await chrome.storage.local.set({ iv_custom_hotels: n }), i.remove(), u() } }) }); const a = document.getElementById("btn-add-new-hotel"); a && a.addEventListener("click", () => { i.remove(), async function () { let e = []; try { const t = chrome.runtime.getURL("states-and-districts.json"), n = await fetch(t), i = await n.json(); e = i.states } catch (e) { return void alert("Error: states-and-districts.json missing in manifest.") } const t = document.createElement("div"); t.id = "iv-modal-backdrop", t.innerHTML = '\n        <div id="iv-modal-content" style="width: 450px;">\n            <h3>Add New Reference</h3>\n            <div class="iv-modal-form">\n                <div class="iv-input-group"><label>Reference Name*</label><input type="text" id="new-name" maxlength="50" placeholder="e.g. VISHAL HOTEL (Max 50 characters)"></div>\n                <div class="iv-input-group"><label>Address*</label><input type="text" id="new-addr" maxlength="50" placeholder="e.g. 1576 MAIN BAZAR (Max 50 characters)"></div>\n                <div class="iv-input-group"><label>Address box 2</label><input type="text" id="new-pin" maxlength="50" placeholder=""></div>\n                <div class="iv-input-group"><label>State*</label><select id="new-state"><option value="">Select State</option></select></div>\n                <div class="iv-input-group"><label>District*</label><select id="new-dist"><option value="">Select District</option></select></div>\n                <div class="iv-input-group"><label>Phone*</label><input type="text" id="new-phone" placeholder="e.g. 91956040328"></div>\n                <div class="iv-action-row">\n                    <button class="btn-cancel" id="btn-cancel-add">Cancel</button>\n                    <button class="btn-save" id="btn-save-hotel">Save & Select</button>\n                </div>\n            </div>\n        </div>\n    ', document.body.appendChild(t); const n = document.getElementById("new-state"), i = document.getElementById("new-dist"); e.forEach(e => { const t = document.createElement("option"); t.value = e.state, t.text = e.state.toUpperCase(), n.appendChild(t) }), n.addEventListener("change", () => { i.innerHTML = '<option value="">Select District</option>'; const t = e.find(e => e.state === n.value); t && t.districts.forEach(e => { const t = document.createElement("option"); t.value = e, t.text = e.toUpperCase(), i.appendChild(t) }) }), document.getElementById("btn-save-hotel").addEventListener("click", async () => { const e = { name: document.getElementById("new-name").value.toUpperCase(), add1: document.getElementById("new-addr").value.toUpperCase(), state: n.options[n.selectedIndex].text, district: document.getElementById("new-dist").value.toUpperCase(), phone: document.getElementById("new-phone").value, add2_pincode: document.getElementById("new-pin").value }; if (!e.name || !e.state || !e.district || "Select State" === e.state) return void alert("Please fill all required fields."); const i = (await chrome.storage.local.get(["iv_custom_hotels"])).iv_custom_hotels || []; i.push(e), await chrome.storage.local.set({ iv_custom_hotels: i }), t.remove(), v(e) }), document.getElementById("btn-cancel-add").addEventListener("click", () => { t.remove(), u() }) }() }), i.addEventListener("click", e => { e.target === i && i.remove() }) } async function v(e) { if (!e) return; const i = document.getElementById("iv-modal-backdrop"); i && i.remove(); try { document.getElementById("nameofsponsor_ind") ? (t("nameofsponsor_ind", e.name), t("add1ofsponsor_ind", e.add1), t("add2ofsponsor_ind", e.add2_pincode), t("phoneofsponsor_ind", e.phone), n("stateofsponsor_ind", e.state), await new Promise(e => setTimeout(e, 1e3)), await a("districtofsponsor_ind", e.district), n("districtofsponsor_ind", e.district)) : document.getElementById("place_of_stay1") && (t("place_of_stay1", e.name), t("pos_address1", e.add1), t("pos_phone1", e.phone), n("pos_state_id1", e.state), await new Promise(e => setTimeout(e, 1e3)), await a("pos_dist_id1", e.district), n("pos_dist_id1", e.district)) } catch (e) { console.error(e), alert("Could not select District automatically. Please check if State is correct.") } } function y(e, t) { try { chrome.runtime.sendMessage({ type: "EXECUTE_IN_MAIN_WORLD", id: e, value: t }) } catch (e) { console.warn("Could not send chosen update message:", e) } try { const n = document.getElementById(e); if (n) { let i = ""; for (const e of n.options) if (e.value === t) { i = e.text; break } if (i) { const t = document.getElementById(e + "_chosen"); if (t) { const e = t.querySelector(".chosen-single span"); e && (e.textContent = i.trim()) } } } } catch (e) { console.warn("Could not update Chosen visual DOM:", e) } } function g(e) { return e ? e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : e } async function f(e, t) { return true; } async function b(e) { 
    if (document.getElementById('iv-float-widget-container')) return; 
    const i = document.createElement('link'); 
    i.rel = 'stylesheet', i.href = chrome.runtime.getURL('modal.css'), document.head.appendChild(i); 
    const a = document.createElement('div'); 
    a.id = 'iv-float-widget-container', a.className = 'iv-floating-widget'; 

    try {
        const savedPos = sessionStorage.getItem('iv_float_pos');
        if (savedPos) {
            const p = JSON.parse(savedPos);
            if (p && typeof p.left === 'number' && typeof p.top === 'number' && p.left < window.innerWidth && p.top < window.innerHeight) {
                a.style.bottom = 'auto';
                a.style.right = 'auto';
                a.style.left = Math.max(10, Math.min(window.innerWidth - 275, p.left)) + 'px';
                a.style.top = Math.max(10, Math.min(window.innerHeight - 250, p.top)) + 'px';
            }
        }
    } catch(err){}

    let l = ''; 
    e && (l = `
        <div class="iv-float-temp-id">
            <div style="display: flex; align-items: center; gap: 5px;">
                <span style="font-size: 9.5px; color: #991b1b; font-weight: 800; letter-spacing: 0.3px;">TEMP ID:</span>
                <span class="iv-temp-id-val">${e}</span>
            </div>
            <button class="iv-float-copy-btn" id="iv-btn-copy-id" title="Copy Temporary Application ID">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>COPY</span>
            </button>
        </div>
    `); 

    const s = `
        <div class="iv-float-body" id="iv-float-body">
            ${l}
            <div class="iv-float-toggle-row">
                <div class="iv-float-toggle-btn active" id="iv-toggle-bgd">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>BGD File
                </div>
                <div class="iv-float-toggle-btn" id="iv-toggle-pass">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>Passport
                </div>
            </div>
            <select class="iv-float-select" id="iv-float-profile-select">
                <option value="">Select Profile</option>
            </select>
            <div class="iv-float-actions">
                <button class="iv-float-btn iv-float-btn-fill" id="iv-float-btn-fill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Fill Form
                </button>
                <button class="iv-float-btn iv-float-btn-next" id="iv-float-btn-next">
                    Next Page <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
            ${window.location.href.includes('/visa/Verification') ? '<button class="iv-float-btn iv-float-btn-download" id="iv-float-btn-download"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download Draft PDF</button>' : ''}
        </div>
        <div class="iv-float-min-bar" id="iv-float-min-bar" style="display: none;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <img src="${chrome.runtime.getURL('logo.png')}" style="width: 16px; height: 16px; object-fit: contain; flex-shrink: 0;">
                <span style="font-size: 11px; font-weight: 800; color: #0f172a;">IVAC MASTER PRO</span>
            </div>
            <span style="font-size: 10.5px; color: #2563eb; font-weight: 700;">▲ Expand</span>
        </div>
    `; 

    a.innerHTML = `
        <div class="iv-float-header" id="iv-float-header">
            <div style="display: flex; align-items: center; gap: 6px;">
                <img src="${chrome.runtime.getURL('logo.png')}" style="width: 20px; height: 20px; object-fit: contain; flex-shrink: 0;">
                <span class="iv-float-title">IVAC MASTER PRO</span>
            </div>
            <div style="display: flex; align-items: center; gap: 2px;">
                <button id="iv-float-sidebar-btn" class="iv-float-ctrl-btn iv-float-sidebar-btn" title="Open Sidebar / সাইডবার খুলুন">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                </button>
                <button id="iv-float-min-btn" class="iv-float-ctrl-btn" title="Minimize">−</button>
                <button id="iv-float-close-btn" class="iv-float-ctrl-btn iv-float-close-btn" title="Close widget">&times;</button>
            </div>
        </div>
        ${s}
    `; 

    document.body.appendChild(a); 

    const fH = document.getElementById('iv-float-header'); 
    if (fH) { 
        let isD = false, sX, sY, iL, iT; 
        fH.onmousedown = e => { 
            if (e.target.closest('button') || e.target.tagName === 'BUTTON') return; 
            isD = true, sX = e.clientX, sY = e.clientY; 
            const r = a.getBoundingClientRect(); 
            iL = r.left, iT = r.top;
            a.style.bottom = 'auto', a.style.right = 'auto', a.style.left = iL + 'px', a.style.top = iT + 'px';
            fH.style.cursor = 'grabbing'; 

            const oM = e => { 
                if (!isD) return; 
                const dx = e.clientX - sX, dy = e.clientY - sY; 
                const nL = Math.max(10, Math.min(window.innerWidth - a.offsetWidth - 10, iL + dx));
                const nT = Math.max(10, Math.min(window.innerHeight - a.offsetHeight - 10, iT + dy));
                a.style.left = nL + 'px', a.style.top = nT + 'px';
            };
            const oU = () => { 
                if (isD) {
                    isD = false, fH.style.cursor = 'grab';
                    window.removeEventListener('mousemove', oM), window.removeEventListener('mouseup', oU);
                    try {
                        sessionStorage.setItem('iv_float_pos', JSON.stringify({ left: parseFloat(a.style.left), top: parseFloat(a.style.top) }));
                    } catch(err){}
                }
            }; 
            window.addEventListener('mousemove', oM), window.addEventListener('mouseup', oU); 
        }; 
    } 

    const sbBtn = document.getElementById('iv-float-sidebar-btn');
    sbBtn && (sbBtn.onclick = e => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });

    const minBtn = document.getElementById('iv-float-min-btn');
    const bdy = document.getElementById('iv-float-body');
    const minBar = document.getElementById('iv-float-min-bar');
    if (minBtn && bdy && minBar) {
        let isMin = false;
        const toggleMin = () => {
            isMin = !isMin;
            if (isMin) {
                bdy.style.display = 'none';
                fH.style.display = 'none';
                minBar.style.display = 'flex';
                a.classList.add('minimized');
            } else {
                bdy.style.display = 'block';
                fH.style.display = 'flex';
                minBar.style.display = 'none';
                a.classList.remove('minimized');
            }
        };
        minBtn.onclick = (e) => { e.stopPropagation(); toggleMin(); };
        minBar.onclick = toggleMin;
    }

    const r = document.getElementById('iv-btn-copy-id'); 
    r && (r.onclick = () => { 
        navigator.clipboard.writeText(e);
        r.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>COPIED!</span>';
        r.style.borderColor = '#10b981';
        r.style.color = '#059669';
        setTimeout(() => {
            r.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>COPY</span>';
            r.style.borderColor = '';
            r.style.color = '';
        }, 2000);
    }); 

    const d = document.getElementById('iv-float-close-btn'); 
    d && (d.onclick = () => { 
        document.getElementById('iv-float-widget-container').remove(); 
    }); 

    const p = document.getElementById('iv-toggle-bgd'), 
          c = document.getElementById('iv-toggle-pass'), 
          u = document.getElementById('iv-float-profile-select'), 
          v = async e => { 
              p.className = 'BGD' === e ? 'iv-float-toggle-btn active' : 'iv-float-toggle-btn';
              c.className = 'PASSPORT' === e ? 'iv-float-toggle-btn active' : 'iv-float-toggle-btn';
              u.innerHTML = '<option value="">Select Profile</option>'; 
              const t = await chrome.storage.local.get(null); 
              let n = t.lastSelectedProfile; 
              for (const i in t) if (i.startsWith('BGD_') || i.startsWith('PASSPORT_')) { 
                  const o = t[i]; 
                  if (o._type === e && !o._isHidden) { 
                      const e = document.createElement('option'); 
                      e.value = i, e.text = o._savedName || 'Unknown', i === n && (e.selected = !0), u.appendChild(e); 
                  } 
              } 
          }, 
          y = await chrome.storage.local.get('lastServiceMode'); 

    await v(y.lastServiceMode || 'BGD'); 

    p.onclick = async () => { 
        await chrome.storage.local.set({ lastServiceMode: 'BGD' });
        v('BGD'); 
    }; 
    c.onclick = async () => { 
        await chrome.storage.local.set({ lastServiceMode: 'PASSPORT' });
        v('PASSPORT'); 
    }; 
    u.onchange = async () => { 
        u.value && await chrome.storage.local.set({ lastSelectedProfile: u.value }); 
    }; 

    document.getElementById('iv-float-btn-fill').onclick = async () => { 
        const e = u.value; 
        if (!e) return alert('Please select a profile.'); 
        const t = await chrome.storage.local.get(e); 
        t[e] && (sessionStorage.setItem('autofillInProgress', 'true'), sessionStorage.setItem('autofillData', JSON.stringify(t[e])), m(t[e])); 
    }; 

    document.getElementById('iv-float-btn-next').onclick = () => { 
        const e = document.querySelector('input[value="Save and Continue"], input[value="Continue"], input[value*="Complete Partially" i], input[value*="Complete" i]'); 
        e && (console.log('   -> Clicking Continue button...'), e.click()); 
    }; 

    const g = document.getElementById('iv-float-btn-download'); 
    g && (g.onclick = () => { 
        const e = o('Surname (as shown in your Passport)') || o('Surname/Family Name') || '', 
              t = o('Given Name/s (Complete as in Passport)') || o('Given Name/s') || '', 
              n = o('Passport Number') || ''; 
        let i = []; 
        t && i.push(t), e && i.push(e), n && i.push(n), i.push('(Draft)'); 
        const a = i.join(' ').trim().replace(/[<>:"/\\|?*]/g, ''), 
              l = document.title; 
        document.title = a, window.print(), setTimeout(() => { document.title = l; }, 1000); 
    }); 
} async function h() {
    initAutoCaptcha();
    if (window.location.href.toLowerCase().includes("completepartially") || (document.body && document.body.innerText.includes("Complete Partially Filled"))) {
        console.log("IV Autofill: Entering CompletePartially page. Triggering immediate auto-solve...");
        autoSolveAndFillCaptcha();
        setTimeout(() => autoSolveAndFillCaptcha(), 500);
        setTimeout(() => autoSolveAndFillCaptcha(), 1500);
        try {
            const tempInp = findTempAppIdInput();
            if (tempInp && (!tempInp.value || tempInp.value.trim() === "")) {
                const sData = await chrome.storage.local.get(["lastSelectedProfile", "recentTempIds"]);
                if (sData.lastSelectedProfile) {
                    const profObj = await chrome.storage.local.get(sData.lastSelectedProfile);
                    const pData = profObj[sData.lastSelectedProfile];
                    const list = sData.recentTempIds || [];
                    const match = list.find(x => x.passport && pData && pData.passNo && x.passport.toUpperCase() === pData.passNo.toUpperCase());
                    const idToFill = pData?.temp_app_id || pData?.temporary_application_id || (match ? match.id : "");
                    if (idToFill && !tempInp.value) {
                        tempInp.value = idToFill;
                        tempInp.dispatchEvent(new Event("input", { bubbles: true }));
                        tempInp.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                }
            }
        } catch (tErr) {
            console.warn("CompletePartially temp ID autofill check error:", tErr);
        }
    }
    if (window.location.href.toLowerCase().includes("printapplication") || (document.body && /reprint\s*form/i.test(document.body.innerText))) {
        console.log("IV Autofill: Entering PrintApplication page. Triggering immediate auto-solve & autofill...");
        autoSolveAndFillCaptcha();
        setTimeout(() => autoSolveAndFillCaptcha(), 500);
        setTimeout(() => autoSolveAndFillCaptcha(), 1500);
        try {
            const sData = await chrome.storage.local.get(["lastSelectedProfile", "defaultMissionCode"]);
            if (sData.lastSelectedProfile) {
                const profObj = await chrome.storage.local.get(sData.lastSelectedProfile);
                const pData = profObj[sData.lastSelectedProfile];
                if (pData) {
                    if (sData.defaultMissionCode && (!pData.missioncode_id || pData._type === "PASSPORT" || !pData.bgd_no || sData.defaultMissionCode !== "BGDD")) {
                        pData.missioncode_id = sData.defaultMissionCode;
                    }
                    await fillPrintApplicationPage(pData);
                }
            }
        } catch (pErr) {
            console.warn("PrintApplication page load autofill error:", pErr);
        }
    }
    const e = await async function () { const e = document.body.innerText.match(/Temporary Application ID\s*:\s*([A-Z0-9]+)/i); if (!e) return null; const t = e[1]; let n = (await chrome.storage.local.get("recentTempIds")).recentTempIds || []; if (n.some(e => e.id === t)) return t; let i = "Unknown"; const o = sessionStorage.getItem("autofillData"); if (o) try { const e = JSON.parse(o); e.passNo && (i = e.passNo) } catch (e) { } return n.push({ id: t, passport: i, timestamp: Date.now() }), n.length > 20 && (n = n.sort((e, t) => t.timestamp - e.timestamp).slice(0, 20)), await chrome.storage.local.set({ recentTempIds: n }), console.log("IV Autofill: Saved Temporary ID:", t), t }(), t = await chrome.storage.local.get(["autoFillPopupEnabled", "autoFillOnLoadEnabled", "lastSelectedProfile"]); !1 !== t.autoFillPopupEnabled && b(e), !1 !== t.autoFillOnLoadEnabled && setTimeout(async () => { const e = t.lastSelectedProfile; if (e) { const t = await chrome.storage.local.get(e); if (t[e]) { if (function () { const e = Array.from(document.querySelectorAll("input, select")).filter(e => { if (0 === e.offsetWidth && 0 === e.offsetHeight) return !1; if ("captcha" === e.id || "capt" === e.id) return !1; if ("INPUT" === e.tagName) { const t = (e.type || "text").toLowerCase(); if (["button", "submit", "checkbox", "radio", "hidden", "file", "image"].includes(t)) return !1 } return !0 }), t = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(e => e.offsetWidth > 0 && e.offsetHeight > 0), n = Array.from(document.querySelectorAll('input[type="radio"]')).filter(e => e.offsetWidth > 0 && e.offsetHeight > 0 && e.name), i = [...new Set(n.map(e => e.name))], o = e.length + t.length + i.length; if (0 === o) return !1; let a = 0; e.forEach(e => { const t = e.value ? e.value.trim() : ""; "SELECT" === e.tagName ? t && "" !== t && !t.toLowerCase().includes("select") && a++ : t && "" !== t && a++ }), t.forEach(e => { e.checked && a++ }), i.forEach(e => { null !== document.querySelector(`input[name="${e}"]:checked`) && a++ }); const l = a / o; return console.log(`IV Autofill: Checked page fill status. ${a}/${o} fields filled (${Math.round(100 * l)}%).`), l >= .7 }()) return void console.log("IV Autofill: Page is already 70%+ filled. Skipping automatic load-fill to prevent overwriting user edits."); console.log("IV Autofill: Automatically filling on page load..."), sessionStorage.setItem("autofillInProgress", "true"), sessionStorage.setItem("autofillData", JSON.stringify(t[e])), m(t[e]) } } }, 500) } "complete" === document.readyState || "interactive" === document.readyState ? setTimeout(h, 500) : document.addEventListener("DOMContentLoaded", () => setTimeout(h, 500)); let x = null, w = 1, I = 100, A = 100, E = 0, $ = 0, C = !1, k = 0, _ = 0; function N() { r && x && (r.clearRect(0, 0, s.width, s.height), r.filter = `brightness(${I}%) contrast(${A}%)`, r.drawImage(x, E, $, x.width * w, x.height * w)) } function D() { if (document.getElementById("iv-undertaking-backdrop")) return; let e = { mode: "pdf", hospitalName: "", hospitalAddress: "", treatment: "", mission: "DHAKA", patient: { name: "", passport: "", dob: "", phone: "" }, attendants: [], selectedProfileIndex: 0, manualApplicantType: "patient" }; const t = document.createElement("div"); t.id = "iv-undertaking-backdrop", t.innerHTML = '\n        <div id="iv-undertaking-modal">\n            <div class="iv-modal-header">\n                <h3>Medical Undertaking Generator</h3>\n                <button class="iv-modal-close" id="iv-btn-close-wizard">&times;</button>\n            </div>\n            <div class="iv-modal-body" id="iv-wizard-body">\n                \x3c!-- Content injected dynamically --\x3e\n            </div>\n            <div class="iv-modal-footer">\n                <button class="btn-neutral-wizard" id="iv-btn-prev-step" style="visibility: hidden;">Back</button>\n                <div style="display: flex; gap: 10px;" id="iv-normal-footer">\n                    <button class="btn-primary-wizard" id="iv-btn-next-step">Next</button>\n                </div>\n                <div style="display: none; gap: 10px;" id="iv-step3-footer">\n                    <button class="btn-secondary-wizard" id="iv-btn-download-medical-cover">Download Cover Letter</button>\n                    <button class="btn-gold-wizard" id="iv-btn-download-undertaking">Download Undertaking</button>\n                </div>\n            </div>\n        </div>\n    ', document.body.appendChild(t), document.getElementById("iv-btn-close-wizard").onclick = () => { t.remove(), x = null, s && (s.onmousedown = null, s.onmousemove = null, s.onmouseup = null, s.onmouseleave = null, s = null, r = null) }; let n = 1; function i() { const t = document.getElementById("iv-wizard-body"), l = document.getElementById("iv-btn-prev-step"), d = document.getElementById("iv-btn-next-step"); l.style.visibility = 1 === n ? "hidden" : "visible"; const p = document.getElementById("iv-normal-footer"), c = document.getElementById("iv-step3-footer"); if (3 === n ? (p && (p.style.display = "none"), c && (c.style.display = "flex")) : (p && (p.style.display = "flex"), c && (c.style.display = "none"), d && (d.innerText = "Next")), 1 === n) { t.innerHTML = '\n                <div class="iv-steps-indicator">\n                    <div class="iv-step-dot active">1</div>\n                    <div class="iv-step-dot">2</div>\n                    <div class="iv-step-dot">3</div>\n                </div>\n                <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Step 1: Provide Medical Invitation Letter</h4>\n                \n                <div class="iv-upload-area" id="iv-pdf-drag-zone">\n                    <span class="iv-upload-icon">📄</span>\n                    <span class="iv-upload-text">Upload Medical Invitation PDF</span>\n                    <span class="iv-upload-subtext">Drag & drop or click to browse</span>\n                    <input type="file" id="iv-pdf-input" accept="application/pdf" style="display: none;">\n                </div>\n                \n                <div style="text-align: center; margin: 20px 0;">\n                    <span style="font-size: 12px; color: #64748b; font-weight: 600; background: #ffffff; padding: 0 10px; position: relative; z-index: 2;">OR</span>\n                    <div style="height: 1px; background: #e2e8f0; margin-top: -10px;"></div>\n                </div>\n                \n                <button class="btn-secondary-wizard" id="iv-btn-manual-mode" style="width: 100%;">Write Manually</button>\n            '; const o = document.getElementById("iv-pdf-drag-zone"), l = document.getElementById("iv-pdf-input"); o.onclick = () => l.click(), o.ondragover = e => { e.preventDefault(), o.classList.add("dragover") }, o.ondragleave = () => o.classList.remove("dragover"), o.ondrop = e => { e.preventDefault(), o.classList.remove("dragover"), e.dataTransfer.files.length > 0 && a(e.dataTransfer.files[0]) }, l.onchange = () => { l.files.length > 0 && a(l.files[0]) }, document.getElementById("iv-btn-manual-mode").onclick = () => { e.mode = "manual", e.hospitalName = "", e.hospitalAddress = "", e.treatment = "", e.patient = { name: "", passport: "", dob: "", phone: "" }, e.attendants = [{ name: "", passport: "", dob: "", phone: "", relationship: "BROTHER" }], e.selectedProfileIndex = 0, n = 2, i() } } else if (2 === n) { let n = ""; if ("pdf" === e.mode) { const t = []; e.patient && e.patient.name && t.push({ ...e.patient, role: "Patient", index: 0 }), e.attendants.forEach((e, n) => { t.push({ ...e, role: "Attendant", index: n + 1 }) }), n = `\n                    <div class="iv-profiles-section-title">Select Applicant Profile (Signer):</div>\n                    <div class="iv-profiles-grid">\n                        ${t.map(t => `\n                            <div class="iv-profile-card ${e.selectedProfileIndex === t.index ? "active" : ""}" data-idx="${t.index}">\n                                <div class="iv-profile-card-role">${t.role}</div>\n                                <div class="iv-profile-card-name">${t.name || "Unnamed"}</div>\n                                <div class="iv-profile-card-ppt">${t.passport || "No Passport"}</div>\n                            </div>\n                        `).join("")}\n                    </div>\n                ` } else n = `\n                    <div class="iv-form-group full-width" style="margin-bottom: 16px;">\n                        <label>Applicant Role</label>\n                        <select id="iv-manual-role">\n                            <option value="patient" ${"patient" === e.manualApplicantType ? "selected" : ""}>Patient (Applying for Medical Visa)</option>\n                            <option value="attendant" ${"attendant" === e.manualApplicantType ? "selected" : ""}>Attendant (Applying for Medical Attendant Visa)</option>\n                        </select>\n                    </div>\n                `; if (t.innerHTML = `\n                <div class="iv-steps-indicator">\n                    <div class="iv-step-dot completed">1</div>\n                    <div class="iv-step-dot active">2</div>\n                    <div class="iv-step-dot">3</div>\n                </div>\n                <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Step 2: Verify & Complete Information</h4>\n                \n                <div class="iv-form-grid">\n                    <div class="iv-form-group full-width">\n                        <label>Hospital Name*</label>\n                        <input type="text" id="iv-input-hosp-name" value="${g(e.hospitalName)}">\n                    </div>\n                    <div class="iv-form-group full-width">\n                        <label>Hospital Address*</label>\n                        <input type="text" id="iv-input-hosp-addr" value="${g(e.hospitalAddress)}">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Nature of Treatment*</label>\n                        <input type="text" id="iv-input-treatment" value="${g(e.treatment)}" placeholder="e.g. ORTHO CARE">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Indian Mission / Office*</label>\n                        <select id="iv-input-mission">\n                            <option value="DHAKA" ${"DHAKA" === e.mission ? "selected" : ""}>DHAKA</option>\n                            <option value="CHITTAGONG" ${"CHITTAGONG" === e.mission ? "selected" : ""}>CHITTAGONG</option>\n                            <option value="RAJSHAHI" ${"RAJSHAHI" === e.mission ? "selected" : ""}>RAJSHAHI</option>\n                            <option value="SYLHET" ${"SYLHET" === e.mission ? "selected" : ""}>SYLHET</option>\n                            <option value="KHULNA" ${"KHULNA" === e.mission ? "selected" : ""}>KHULNA</option>\n                        </select>\n                    </div>\n                </div>\n\n                ${n}\n\n                <div id="iv-dynamic-profile-details"></div>\n            `, function () { const t = document.getElementById("iv-dynamic-profile-details"); if (!t) return; const n = e.selectedProfileIndex > 0; let i = ""; if (n) { const t = e.attendants[e.selectedProfileIndex - 1] || { name: "", passport: "", dob: "", phone: "", relationship: "BROTHER" }, n = e.patient || { name: "", passport: "" }; i = `\n                <div class="iv-profiles-section-title">Signer Details (Attendant):</div>\n                <div class="iv-form-grid">\n                    <div class="iv-form-group">\n                        <label>Attendant Name*</label>\n                        <input type="text" id="iv-input-att-name" value="${g(t.name)}">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Passport Number*</label>\n                        <input type="text" id="iv-input-att-passport" value="${g(t.passport)}">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Date of Birth*</label>\n                        <input type="text" id="iv-input-att-dob" value="${g(t.dob)}" placeholder="e.g. DD/MM/YYYY">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Contact Number*</label>\n                        <input type="text" id="iv-input-att-phone" value="${g(t.phone)}">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Relationship with Patient*</label>\n                        <input type="text" id="iv-input-relationship" value="${g(t.relationship || "BROTHER")}">\n                    </div>\n                </div>\n\n                <div class="iv-profiles-section-title">Accompanying Patient Details:</div>\n                <div class="iv-form-grid">\n                    <div class="iv-form-group">\n                        <label>Patient Name*</label>\n                        <input type="text" id="iv-input-pat-name" value="${g(n.name)}">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Patient Passport*</label>\n                        <input type="text" id="iv-input-pat-passport" value="${g(n.passport)}">\n                    </div>\n                </div>\n            ` } else { const t = e.patient || { name: "", passport: "", dob: "", phone: "" }; let n = ""; e.attendants.length > 0 ? e.attendants.forEach((t, i) => { n += `\n                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 8px;">\n                            <span class="iv-profiles-section-title" style="margin: 0; font-size: 12px; font-weight: 700; color: #475569;">Accompanying Attendant ${i + 1} Details:</span>\n                            ${e.attendants.length > 1 ? `<span class="iv-remove-attendant" data-idx="${i}" style="font-size: 11px; color: #ef4444; cursor: pointer; font-weight: 600;">[Remove]</span>` : ""}\n                        </div>\n                        <div class="iv-form-grid">\n                            <div class="iv-form-group">\n                                <label>Attendant Name*</label>\n                                <input type="text" id="iv-input-att-name-${i}" value="${g(t.name)}">\n                            </div>\n                            <div class="iv-form-group">\n                                <label>Attendant Passport*</label>\n                                <input type="text" id="iv-input-att-passport-${i}" value="${g(t.passport)}">\n                            </div>\n                        </div>\n                    ` }) : n = '\n                    <div class="iv-profiles-section-title" style="margin-top: 15px;">Accompanying Attendant Details:</div>\n                    <div class="iv-form-grid">\n                        <div class="iv-form-group">\n                            <label>Attendant Name*</label>\n                            <input type="text" id="iv-input-att-name-0" value="">\n                        </div>\n                        <div class="iv-form-group">\n                            <label>Attendant Passport*</label>\n                            <input type="text" id="iv-input-att-passport-0" value="">\n                        </div>\n                    </div>\n                ', i = `\n                <div class="iv-profiles-section-title">Signer Details (Patient):</div>\n                <div class="iv-form-grid">\n                    <div class="iv-form-group">\n                        <label>Patient Name*</label>\n                        <input type="text" id="iv-input-pat-name" value="${g(t.name)}">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Passport Number*</label>\n                        <input type="text" id="iv-input-pat-passport" value="${g(t.passport)}">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Date of Birth*</label>\n                        <input type="text" id="iv-input-pat-dob" value="${g(t.dob)}" placeholder="e.g. DD/MM/YYYY">\n                    </div>\n                    <div class="iv-form-group">\n                        <label>Contact Number*</label>\n                        <input type="text" id="iv-input-pat-phone" value="${g(t.phone)}">\n                    </div>\n                </div>\n\n                ${n}\n\n                <div style="text-align: right; margin-top: 12px; margin-bottom: 8px;">\n                    <button type="button" id="iv-btn-add-attendant" class="btn-secondary-wizard" style="font-size: 11px; padding: 4px 8px; width: auto; display: inline-block; cursor: pointer; font-weight: bold; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px;">+ Add Attendant</button>\n                </div>\n            ` } t.innerHTML = i }(), 0 === e.selectedProfileIndex) { const t = document.getElementById("iv-btn-add-attendant"); t && (t.onclick = () => { o(), e.attendants.push({ name: "", passport: "", dob: "", phone: "", relationship: "BROTHER" }), i() }), document.querySelectorAll(".iv-remove-attendant").forEach(t => { t.onclick = () => { o(); const n = parseInt(t.dataset.idx); e.attendants.splice(n, 1), i() } }) } "pdf" === e.mode ? document.querySelectorAll(".iv-profile-card").forEach(t => { t.onclick = () => { o(), e.selectedProfileIndex = parseInt(t.dataset.idx), i() } }) : document.getElementById("iv-manual-role").onchange = t => { o(), e.manualApplicantType = t.target.value, e.selectedProfileIndex = "patient" === e.manualApplicantType ? 0 : 1, i() } } else if (3 === n) { t.innerHTML = '\n                <div class="iv-steps-indicator">\n                    <div class="iv-step-dot completed">1</div>\n                    <div class="iv-step-dot completed">2</div>\n                    <div class="iv-step-dot active">3</div>\n                </div>\n                <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Step 3: Signature (Optional)</h4>\n                \n                <div class="iv-form-group full-width" style="margin-bottom: 16px;">\n                    <label>Upload Signature Image</label>\n                    <input type="file" id="iv-sig-file-input" accept="image/*">\n                </div>\n\n                <div class="iv-sig-workspace" id="iv-sig-workspace-area" style="display: none;">\n                    <div class="iv-canvas-container">\n                        <canvas id="iv-sig-canvas" width="300" height="100"></canvas>\n                        <div class="iv-canvas-crop-overlay"></div>\n                    </div>\n                    <p style="font-size: 11px; color: #64748b; margin: 8px 0 0 0;">Drag image to align. Zoom signature to adjust framing.</p>\n                    \n                    <div class="iv-sig-slider-group">\n                        <div class="iv-slider-row">\n                            <label>Zoom</label>\n                            <input type="range" id="iv-sig-zoom" min="0.1" max="3" step="0.02" value="1">\n                        </div>\n                        <div class="iv-slider-row">\n                            <label>Brightness</label>\n                            <input type="range" id="iv-sig-brightness" min="50" max="200" step="1" value="100">\n                        </div>\n                        <div class="iv-slider-row">\n                            <label>Contrast</label>\n                            <input type="range" id="iv-sig-contrast" min="50" max="250" step="1" value="100">\n                        </div>\n                    </div>\n                </div>\n                \n                <p id="iv-sig-empty-note" style="font-size: 13px; color: #64748b; text-align: center; margin: 30px 0;">No signature uploaded. The downloaded PDF will have a blank space for physical signing.</p>\n            '; const e = document.getElementById("iv-sig-canvas"), n = document.getElementById("iv-sig-file-input"), i = document.getElementById("iv-sig-workspace-area"), o = document.getElementById("iv-sig-empty-note"); s = e, r = s.getContext("2d"), s.onmousedown = e => { if (!x) return; C = !0; const t = s.getBoundingClientRect(); k = e.clientX - t.left - E, _ = e.clientY - t.top - $ }, s.onmousemove = e => { if (!C || !x) return; const t = s.getBoundingClientRect(); E = e.clientX - t.left - k, $ = e.clientY - t.top - _, N() }, s.onmouseup = () => { C = !1 }, s.onmouseleave = () => { C = !1 }, n.onchange = () => { n.files.length > 0 && (i.style.display = "flex", o.style.display = "none", function (e) { const t = new FileReader; t.onload = e => { const t = new Image; t.onload = () => { x = t, w = s.height / t.height, E = (s.width - t.width * w) / 2, $ = 0, I = 100, A = 100, N() }, t.src = e.target.result }, t.readAsDataURL(e) }(n.files[0])) }; const a = document.getElementById("iv-sig-zoom"), l = document.getElementById("iv-sig-brightness"), d = document.getElementById("iv-sig-contrast"); a && (a.oninput = e => { w = parseFloat(e.target.value), N() }), l && (l.oninput = e => { I = parseInt(e.target.value), N() }), d && (d.oninput = e => { A = parseInt(e.target.value), N() }), x && (i.style.display = "flex", o.style.display = "none", a.value = w, l.value = I, d.value = A, N()) } } function o() { const t = e => { const t = document.getElementById(e); return t ? t.value.trim().toUpperCase() : "" }; e.hospitalName = t("iv-input-hosp-name"), e.hospitalAddress = t("iv-input-hosp-addr"), e.treatment = t("iv-input-treatment"); const n = document.getElementById("iv-input-mission"); n && (e.mission = n.value); if (e.selectedProfileIndex > 0) { const n = e.selectedProfileIndex - 1; e.attendants[n] || (e.attendants[n] = {}), e.attendants[n].name = t("iv-input-att-name"), e.attendants[n].passport = t("iv-input-att-passport"), e.attendants[n].dob = t("iv-input-att-dob"), e.attendants[n].phone = t("iv-input-att-phone"), e.attendants[n].relationship = t("iv-input-relationship"), e.patient || (e.patient = {}), e.patient.name = t("iv-input-pat-name"), e.patient.passport = t("iv-input-pat-passport") } else { e.patient || (e.patient = {}), e.patient.name = t("iv-input-pat-name"), e.patient.passport = t("iv-input-pat-passport"), e.patient.dob = t("iv-input-pat-dob"), e.patient.phone = t("iv-input-pat-phone"); const n = Math.max(e.attendants.length, 1); for (let i = 0; i < n; i++)e.attendants[i] || (e.attendants[i] = {}), e.attendants[i].name = t(`iv-input-att-name-${i}`), e.attendants[i].passport = t(`iv-input-att-passport-${i}`) } } async function a(t) { if (!t || "application/pdf" !== t.type) return void alert("Please upload a valid PDF file."); const o = document.createElement("div"); o.style.margin = "20px 0", o.style.textAlign = "center", o.style.fontSize = "13px", o.style.color = "#4f46e5", o.style.fontWeight = "700", o.innerText = "Parsing Invitation PDF..."; const a = document.getElementById("iv-pdf-drag-zone"); a.parentNode.insertBefore(o, a.nextSibling), a.style.opacity = "0.5"; try { const a = await async function (e) { const t = chrome.runtime.getURL("build/pdf.mjs"), { getDocument: n, GlobalWorkerOptions: i } = await import(t); i.workerSrc = chrome.runtime.getURL("build/pdf.worker.mjs"); const o = await e.arrayBuffer(), a = await n(new Uint8Array(o)).promise; let l = ""; for (let e = 1; e <= a.numPages; e++) { const t = await a.getPage(e); l += (await t.getTextContent()).items.map(e => e.str).join(" ") + " \n" } return l }(t), l = function (e) { const t = e.replace(/\s+/g, " "), n = t.match(/Hospital Details.*?Name\s+(.*?)\s+Address/i), i = t.match(/Address\s+(.*?)\s+City\/District/i), o = t.match(/City\/District\s+(.*?)\s+State/i), a = t.match(/State\s+(.*?)\s+Phone/i), l = n ? n[1].trim() : "", s = i ? i[1].trim() : "", r = o ? o[1].trim() : "", d = a ? a[1].trim() : "", p = t.match(/Diagnosis\/\s*Proposed\s*Treatment\s+(.*?)\s+(?:Name of Doctor|Department|Cost of Treatment)/i), c = p ? p[1].trim() : "MEDICAL TREATMENT", m = t.match(/Details of (?:the\s+)?Patient([\s\S]*?)(?:Details of Treatment|Details of Attendant|$)/i); let u = { name: "", passport: "", dob: "", phone: "" }; if (m) { const e = m[1], t = (e.match(/Surname\s+(.+?)\s+(?:Given|Gender)/i) || ["", ""])[1].trim(), n = (e.match(/Given\s*name\s+(.+?)\s+(?:Gender|Date)/i) || ["", ""])[1].trim(), i = (e.match(/Date of Birth\s+([\d/]+)/i) || ["", ""])[1].trim(), o = (e.match(/Passport\s*No\.?\s*([A-Z0-9]+)/i) || ["", ""])[1].trim(), a = (e.match(/Contact Number\s*\([Ii]n\s+Native\s+Country\)\s*(\d+)/i) || ["", ""])[1].trim(); u = { name: `${n} ${t}`.trim().toUpperCase(), dob: i, passport: o.toUpperCase(), phone: a } } const v = [], y = t.match(/Details of Attendant([\s\S]*?)$/i); if (y) { const e = y[1].split(/Sr\s*No\.\s*\d+/i); for (let t = 1; t < e.length; t++) { const n = e[t], i = (n.match(/Surname\s+(.+?)\s+(?:Given|Gender)/i) || ["", ""])[1].trim(), o = (n.match(/Given\s*Name\s+(.+?)\s+(?:Gender|Date)/i) || ["", ""])[1].trim(), a = (n.match(/Date of Birth\s+([\d/]+)/i) || ["", ""])[1].trim(), l = (n.match(/Passport\s*No\.?\s*([A-Z0-9]+)/i) || ["", ""])[1].trim(), s = (n.match(/Contact Number\s*\([Ii]n\s+Native\s+Country\)\s*(\d+)/i) || ["", ""])[1].trim(), r = (n.match(/Relationship with the patient\s+(\w+)/i) || ["", ""])[1].trim(); l && v.push({ name: `${o} ${i}`.trim().toUpperCase(), dob: a, passport: l.toUpperCase(), phone: s, relationship: r.toUpperCase() }) } } return { hospital: { name: l.toUpperCase(), address: `${s}, ${r}, ${d}`.replace(/,\s*,/g, ",").trim().toUpperCase(), state: d.toUpperCase(), city: r.toUpperCase() }, treatment: c.toUpperCase(), patient: u, attendants: v } }(a); e.hospitalName = l.hospital.name, e.hospitalAddress = l.hospital.address, e.treatment = l.treatment, e.patient = l.patient, e.attendants = l.attendants, e.mode = "pdf", e.selectedProfileIndex = 0, o.remove(), n = 2, i() } catch (t) { console.error(t), o.innerText = "Error parsing PDF! Switching to manual mode...", o.style.color = "#ef4444", setTimeout(() => { o.remove(), e.mode = "manual", e.attendants = [{ name: "", passport: "", dob: "", phone: "", relationship: "BROTHER" }], n = 2, i() }, 2e3) } } document.getElementById("iv-btn-next-step").onclick = () => { if (1 === n) alert("Please select a file or click Write Manually."); else if (2 === n) { o(); const t = [{ id: "iv-input-hosp-name", name: "Hospital Name", value: e.hospitalName }, { id: "iv-input-hosp-addr", name: "Hospital Address", value: e.hospitalAddress }, { id: "iv-input-treatment", name: "Proposed Treatment", value: e.treatment }]; let a = []; if (t.forEach(e => { const t = document.getElementById(e.id); e.value ? t && (t.style.borderColor = "", t.style.backgroundColor = "") : (a.push(e.name), t && (t.style.borderColor = "#ef4444", t.style.backgroundColor = "#fef2f2", t.oninput = () => { t.value.trim() && (t.style.borderColor = "", t.style.backgroundColor = "") })) }), a.length > 0) return void alert("Please fill in: " + a.join(", ")); n = 3, i() } }, document.getElementById("iv-btn-prev-step").onclick = () => { n > 1 && (2 === n && o(), n--, i()) }, document.getElementById("iv-btn-download-medical-cover").onclick = async () => { await f("cover_letter", 1) && function () { let t = null; x && s && (t = s.toDataURL("image/png")); const n = e.selectedProfileIndex > 0, i = n ? e.attendants[e.selectedProfileIndex - 1]?.name || "" : e.patient?.name || "", o = n ? e.attendants[e.selectedProfileIndex - 1]?.passport || "" : e.patient?.passport || "", a = n ? e.attendants[e.selectedProfileIndex - 1]?.phone || "" : e.patient?.phone || "", l = e.patient?.name || "", r = e.patient?.passport || "", d = e.attendants.filter(e => e.name && e.name.trim() || e.passport && e.passport.trim()); let p = n ? "Application for Indian Medical Attendant Visa" : "Application for Indian Medical Visa", c = ""; if (n) c = `\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    My name is <b>${i}</b>, holder of Bangladesh Passport No. <b>${o}</b>. I am applying for a Medical Attendant Visa to accompany my patient, <b>${l}</b> (holder of Passport No. <b>${r}</b>), who is traveling to India for necessary medical treatment.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    The patient is scheduled to receive treatment for <b>${e.treatment}</b> at <b>${e.hospitalName}</b>, located at <b>${e.hospitalAddress}</b>. As the designated medical attendant, my presence is vital to provide necessary physical and emotional support to the patient during their journey and medical stay in India.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I assure you that we will respect and comply with all visa conditions, regulations, and immigration laws of India. Neither the patient nor I have any intention of overstaying our visas, and we will return to Bangladesh immediately upon completion of the medical treatment and within the validity period of the visa granted.\n                </p>\n                <p style="margin: 0 0 20px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I kindly request you to consider my application favorably and grant me a Medical Attendant Visa so that I may accompany and assist the patient during their treatment.\n                </p>\n            `; else { let t = "", n = ""; if (d.length > 0) { t = `I will be accompanied by my medical attendant(s), namely ${d.map(e => `<b>${e.name}</b> (Passport No. <b>${e.passport}</b>)`).join(" and ")}, who will assist me during my travel and stay in India.`, n = "I assure you that neither my attendants nor I will overstay in India. We will comply with all visa regulations and return to Bangladesh immediately upon the completion of my treatment." } else t = "I am traveling to India independently for this treatment.", n = "I assure you that I will comply with all visa regulations, will not overstay in India, and will return to Bangladesh immediately upon the completion of my treatment."; c = `\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    My name is <b>${i}</b>, holder of Bangladesh Passport No. <b>${o}</b>. I respectfully submit my application for an Indian Medical Visa to receive treatment for <b>${e.treatment}</b> at <b>${e.hospitalName}</b>, located at <b>${e.hospitalAddress}</b>.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    ${t} The medical invitation and appointment letter from the hospital have been attached herewith for your kind perusal.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    ${n} All expenses related to my travel, accommodation, and medical procedures will be fully borne by me.\n                </p>\n                <p style="margin: 0 0 20px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I kindly request you to favorably consider my application and grant me the necessary Medical Visa, along with visa(s) for my accompanying attendant(s), so that I may undergo this essential treatment.\n                </p>\n            ` } const m = `${i.trim().replace(/[<>:"/\\|?*]/g, "")} - Medical Cover Letter.pdf`, u = document.createElement("div"); u.style.position = "relative", u.style.width = "170mm", u.style.background = "#ffffff", u.style.color = "#000000", u.style.display = "block"; const v = t ? `<div style="margin-bottom: 5px;"><img src="${t}" style="height: 48px; object-fit: contain; max-width: 200px;"></div>` : '<div style="height: 48px; margin-bottom: 5px;"></div>'; u.innerHTML = `\n            <div style="font-family: Arial, sans-serif; font-size: 14.5px; line-height: 1.45; color: #000000 !important; padding: 0; background: #ffffff !important; text-align: left; display: block !important; visibility: visible !important; opacity: 1 !important;">\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">To</p>\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">The Visa Officer</p>\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">High Commission of India</p>\n                <p style="margin: 0 0 25px 0; color: #000000 !important; display: block !important;">${e.mission.toUpperCase()}, Bangladesh</p>\n\n                <p style="margin: 0 0 25px 0; font-weight: bold; text-decoration: underline; color: #000000 !important; display: block !important;">\n                    Subject: ${p}.\n                </p>\n\n                <p style="margin: 0 0 20px 0; color: #000000 !important; display: block !important;">Dear Sir/Madam,</p>\n\n                ${c}\n\n                <p style="margin: 0 0 16px 0; color: #000000 !important; display: block !important;">Thank you very much for your time and kind consideration. I look forward to your positive response.</p>\n\n                <p style="margin: 0 0 25px 0; color: #000000 !important; display: block !important;">Yours faithfully,</p>\n\n                <div style="margin-top: 25px; font-size: 14.5px; color: #000000 !important; display: block !important;">\n                    ${v}\n                    <div style="width: 250px; border-top: 1px solid #000; margin-bottom: 10px;"></div>\n                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #000000 !important;">${i}</p>\n                    <p style="margin: 0 0 4px 0; color: #000000 !important;">Passport No: ${o}</p>\n                    <p style="margin: 0 0 0 0; color: #000000 !important;">Mobile: ${a}</p>\n                </div>\n            </div>\n        `, document.body.appendChild(u); const y = { margin: [15, 15, 15, 15], filename: m, image: { type: "jpeg", quality: .98 }, html2canvas: { scale: 2, useCORS: !0, logging: !1, scrollX: 0, scrollY: 0 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } }; html2pdf().from(u).set(y).save().then(() => { u.remove() }) }() }, document.getElementById("iv-btn-download-undertaking").onclick = async () => { await f("undertaking", 1) && function () { let t = null; x && s && (t = s.toDataURL("image/png")); const o = e.selectedProfileIndex > 0, a = o ? e.attendants[e.selectedProfileIndex - 1]?.name || "" : e.patient?.name || "", l = o ? e.attendants[e.selectedProfileIndex - 1]?.passport || "" : e.patient?.passport || "", r = o ? e.attendants[e.selectedProfileIndex - 1]?.phone || "" : e.patient?.phone || "", d = e.patient?.name || "", p = e.patient?.passport || "", c = o ? `I, <b>${a}</b>, holder of Bangladesh Passport No. <b>${l}</b>, am applying for a Medical Attendant Visa to accompany my patient <b>${d}</b>, holder of Bangladesh Passport No. <b>${p}</b>, who is travelling to India for medical treatment at <b>${e.hospitalName}</b>, located at <b>${e.hospitalAddress}</b>.` : `I, <b>${a}</b>, holder of Bangladesh Passport No. <b>${l}</b>, am applying for a Medical Visa to travel to India for treatment at <b>${e.hospitalName}</b>, located at <b>${e.hospitalAddress}</b>.`; let m = "", u = ""; if (o) m = `I, <b>${a}</b>, will accompany the patient only for the purpose of providing necessary assistance during the medical treatment.`, u = `\n                <p style="margin: 0 0 8px 0; color: #000000 !important; display: block !important;">Details of the patient I will be accompanying:</p>\n                <p style="margin: 0 0 4px 0; font-weight: bold; color: #000000 !important; display: block !important;">Name: ${d}</p>\n                <p style="margin: 0 0 16px 0; font-weight: bold; color: #000000 !important; display: block !important;">Passport Number: ${p}</p>\n            `; else { const t = e.attendants.filter(e => e.name && e.name.trim() || e.passport && e.passport.trim()); if (t.length > 1) { m = `My attendants, ${t.map(e => `<b>${e.name}</b>`).join(" and ")}, will accompany me only for the purpose of providing necessary assistance during my medical treatment.`, u = `\n                    <p style="margin: 0 0 8px 0; color: #000000 !important; display: block !important;">I would also like to request the issuance of a Medical Attendant Visa for my attendants:</p>\n                    ${t.map((e, t) => `\n                        <div style="margin-bottom: 6px; display: block !important;">\n                            <p style="margin: 0 0 2px 0; font-weight: bold; color: #000000 !important; display: block !important;">Attendant ${t + 1} Name: ${e.name}</p>\n                            <p style="margin: 0 0 0 0; font-weight: bold; color: #000000 !important; display: block !important;">Passport Number: ${e.passport}</p>\n                        </div>\n                    `).join("")}\n                ` } else { const e = t[0] || { name: "", passport: "" }; m = `My attendant, <b>${e.name}</b>, will accompany me only for the purpose of providing necessary assistance during my medical treatment.`, u = `\n                    <p style="margin: 0 0 8px 0; color: #000000 !important; display: block !important;">I would also like to request the issuance of a Medical Attendant Visa for my attendant:</p>\n                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #000000 !important; display: block !important;">Name: ${e.name}</p>\n                    <p style="margin: 0 0 16px 0; font-weight: bold; color: #000000 !important; display: block !important;">Passport Number: ${e.passport}</p>\n                ` } } const v = `${a.trim().replace(/[<>:"/\\|?*]/g, "")} - Medical Undertaking.pdf`, y = t ? `<div style="margin-bottom: 5px;"><img src="${t}" style="height: 48px; object-fit: contain; max-width: 200px;"></div>` : '<div style="height: 48px; margin-bottom: 5px;"></div>', g = document.createElement("div"); g.style.position = "relative", g.style.width = "170mm", g.style.background = "#ffffff", g.style.color = "#000000", g.style.display = "block", g.innerHTML = `\n            <div style="font-family: Arial, sans-serif; font-size: 14.5px; line-height: 1.45; color: #000000 !important; padding: 0; background: #ffffff !important; text-align: left; display: block !important; visibility: visible !important; opacity: 1 !important;">\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">To</p>\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">The Visa Officer</p>\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">High Commission of India</p>\n                <p style="margin: 0 0 20px 0; color: #000000 !important; display: block !important;">${e.mission.toUpperCase()}, Bangladesh</p>\n\n                <p style="margin: 0 0 20px 0; font-weight: bold; text-decoration: underline; color: #000000 !important; display: block !important;">\n                    Subject: Undertaking for ${o ? "Medical Attendant" : "Medical"} Visa Application.\n                </p>\n\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    ${c}\n                </p>\n\n                ${u}\n\n                <p style="margin: 0 0 8px 0; color: #000000 !important; display: block !important;">I undertake that:</p>\n                <ol style="margin: 0 0 16px 0; padding-left: 20px; text-align: justify; color: #000000 !important; display: block !important;">\n                    <li style="margin-bottom: 6px; color: #000000 !important;">All information provided in the visa application and supporting documents is true and correct to the best of my knowledge.</li>\n                    <li style="margin-bottom: 6px; color: #000000 !important;">${m}</li>\n                    <li style="margin-bottom: 6px; color: #000000 !important;">We shall abide by all laws, rules, and regulations of India during our stay.</li>\n                    <li style="margin-bottom: 6px; color: #000000 !important;">We shall not engage in any activity other than those permitted under the respective visa categories.</li>\n                    <li style="margin-bottom: 6px; color: #000000 !important;">We shall bear all expenses related to travel, accommodation, medical treatment, and other associated costs during our stay in India.</li>\n                    <li style="margin-bottom: 6px; color: #000000 !important;">We shall leave India upon completion of the medical treatment and within the validity period of the visa${o ? "" : "s"} granted.</li>\n                </ol>\n\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I respectfully request the High Commission of India to kindly consider ${o ? "this application" : "our visa applications"} and grant the necessary ${o ? "Medical Attendant Visa" : "Medical Visa and Medical Attendant Visa"}.\n                </p>\n\n                <p style="margin: 0 0 20px 0; color: #000000 !important; display: block !important;">Thank you for your kind consideration.</p>\n\n                <p style="margin: 0 0 16px 0; color: #000000 !important; display: block !important;">Yours faithfully,</p>\n\n                <div style="margin-top: 20px; font-size: 14.5px; color: #000000 !important; display: block !important;">\n                    ${y}\n                    <div style="width: 250px; border-top: 1px solid #000; margin-bottom: 10px;"></div>\n                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #000000 !important;">${a}</p>\n                    <p style="margin: 0 0 4px 0; color: #000000 !important;">Passport No: ${l}</p>\n                    <p style="margin: 0 0 4px 0; color: #000000 !important;">Date: ${function () { const e = new Date; return `${e.getDate()} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][e.getMonth()]} ${e.getFullYear()}` }()}</p>\n                    <p style="margin: 0 0 0 0; color: #000000 !important;">Contact Number: ${r}</p>\n                </div>\n            </div>\n        `, document.body.appendChild(g); const f = { margin: [15, 15, 15, 15], filename: v, image: { type: "jpeg", quality: .98 }, html2canvas: { scale: 2, useCORS: !0, logging: !1, scrollX: 0, scrollY: 0 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } }; html2pdf().from(g).set(f).save().then(() => { g.remove(), n = 2, i() }) }() }, i() } function B() { if (document.getElementById("iv-coverletter-backdrop")) return; let e = { category: "tourist", selectedProfileKey: "", name: "", passport: "", phone: "", email: "", mission: "DHAKA", hospitalName: "", hospitalAddress: "", treatment: "", doubleVisaType: "Student Visa", doubleCountry: "Romania", doubleCountryCustom: "" }; const t = document.createElement("div"); t.id = "iv-coverletter-backdrop", t.innerHTML = '\n        <div id="iv-coverletter-modal">\n            <div class="iv-modal-header">\n                <h3>Cover Letter Generator</h3>\n                <button class="iv-modal-close" id="iv-btn-close-cover-wizard">&times;</button>\n            </div>\n            <div class="iv-modal-body" id="iv-cover-wizard-body">\n                \x3c!-- Content injected dynamically --\x3e\n            </div>\n            <div class="iv-modal-footer" style="justify-content: flex-end; gap: 12px;">\n                <button class="btn-neutral-wizard" id="iv-btn-cancel-cover">Cancel</button>\n                <button class="btn-primary-wizard" id="iv-btn-download-cover">Generate & Download</button>\n            </div>\n        </div>\n    ', document.body.appendChild(t); const n = () => t.remove(); function i() { const t = document.getElementById("iv-cover-input-name"); t && (e.name = t.value.toUpperCase()); const n = document.getElementById("iv-cover-input-passport"); n && (e.passport = n.value.toUpperCase()); const i = document.getElementById("iv-cover-input-phone"); i && (e.phone = i.value); const o = document.getElementById("iv-cover-input-email"); o && (e.email = o.value); const a = document.getElementById("iv-cover-input-mission"); a && (e.mission = a.value); const l = document.getElementById("iv-cover-input-hosp-name"); l && (e.hospitalName = l.value.toUpperCase()); const s = document.getElementById("iv-cover-input-hosp-addr"); s && (e.hospitalAddress = s.value.toUpperCase()); const r = document.getElementById("iv-cover-input-treatment"); r && (e.treatment = r.value.toUpperCase()); const d = document.getElementById("iv-cover-input-double-visa-type"); d && (e.doubleVisaType = d.value); const p = document.getElementById("iv-cover-input-double-country"); p && (e.doubleCountry = p.value); const c = document.getElementById("iv-cover-input-double-country-custom"); c && (e.doubleCountryCustom = c.value.toUpperCase()) } document.getElementById("iv-btn-close-cover-wizard").onclick = n, document.getElementById("iv-btn-cancel-cover").onclick = n, document.getElementById("iv-btn-download-cover").onclick = async () => { i(); const t = [{ id: "iv-cover-input-name", name: "Applicant Name", value: e.name }, { id: "iv-cover-input-passport", name: "Passport Number", value: e.passport }, { id: "iv-cover-input-phone", name: "Mobile Number", value: e.phone }, { id: "iv-cover-input-email", name: "Email Address", value: e.email }]; "double" === e.category && (t.push({ id: "iv-cover-input-double-visa-type", name: "Visa Category Type", value: e.doubleVisaType }), t.push({ id: "iv-cover-input-double-country", name: "Destination Country", value: e.doubleCountry }), "Other" === e.doubleCountry && t.push({ id: "iv-cover-input-double-country-custom", name: "Custom Country Name", value: e.doubleCountryCustom })); let n = []; if (t.forEach(e => { const t = document.getElementById(e.id); e.value ? t && (t.style.borderColor = "", t.style.backgroundColor = "") : (n.push(e.name), t && (t.style.borderColor = "#ef4444", t.style.backgroundColor = "#fef2f2", t.oninput = () => { t.value.trim() && (t.style.borderColor = "", t.style.backgroundColor = "") })) }), n.length > 0) return void alert("Please fill in: " + n.join(", ")); await f("cover_letter", 1) && function () { let t = "", n = ""; if ("tourist" === e.category) t = "Application for Indian Tourist Visa", n = `\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    My name is <b>${e.name}</b>, and my passport number is <b>${e.passport}</b>. I wish to visit India solely for tourism purposes. The primary objective of my trip is to explore India's rich cultural heritage, historical landmarks, religious sites, natural beauty, local cuisine, and vibrant traditions. I have planned this journey as a short recreational visit to experience the diverse attractions that India offers.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    During my stay, I intend to visit popular tourist destinations and spend my time sightseeing, learning about the local culture, and enjoying the hospitality of the country. This visit is purely for tourism, and I have no intention of engaging in any form of employment, business, study, or any activity other than tourism.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I fully understand and respect the immigration laws and regulations of India. I assure you that I will comply with all visa conditions and will leave India before the expiry of my authorized stay. I have strong personal and professional commitments in Bangladesh, which require my timely return after completing my planned visit.\n                </p>\n                <p style="margin: 0 0 20px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I kindly request you to consider my application favorably and grant me a Tourist Visa. It would be a great opportunity for me to experience the cultural and historical richness of India.\n                </p>\n            `; else if ("medical" === e.category) t = "Application for Indian Medical Visa", n = `\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    My name is <b>${e.name}</b>, and my passport number is <b>${e.passport}</b>. I wish to travel to India solely for medical treatment. I have been diagnosed with <b>${e.treatment}</b> and require advanced medical care and consultation at <b>${e.hospitalName}</b>, located at <b>${e.hospitalAddress}</b>.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    During my stay, I intend to focus entirely on my medical treatment and recovery. This visit is purely for medical treatment purposes, and I have no intention of engaging in any form of employment, business, study, or any activity other than my medical treatment.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I fully understand and respect the immigration laws and regulations of India. I assure you that I will comply with all visa conditions and will leave India before the expiry of my authorized stay. I have strong personal and professional commitments in Bangladesh, which require my timely return after completing my medical treatment.\n                </p>\n                <p style="margin: 0 0 20px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I kindly request you to consider my application favorably and grant me a Medical Visa. It would allow me to receive the necessary medical care for my recovery.\n                </p>\n            `; else if ("double" === e.category) { const i = "Other" === e.doubleCountry ? e.doubleCountryCustom : e.doubleCountry, o = e.doubleVisaType; t = `Request for Double Entry Visa for ${i} Visa Process`; let a = ""; a = "Student Visa" === o ? `including my ${i} Student Visa approval/admission letter/appointment confirmation and other supporting documents` : `including my ${i} Work Visa approval/work permit/appointment confirmation and other supporting documents`, n = `\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    My name is <b>${e.name}</b>, holder of Passport No. <b>${e.passport}</b>. I have been granted/approved for a <b>${o}</b> for <b>${i}</b>, and I am required to appear in person at the Embassy/Consulate/Visa Application Centre of <b>${i}</b> in India to complete the mandatory visa process, including submission of documents, biometric enrolment, interview, passport collection, or any other official formalities as required by the concerned authorities.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    Therefore, I kindly request the issuance of a <b>Double Entry Visa</b>. Depending on the requirements of the <b>${i}</b> visa process, I may need to enter India more than once to attend my scheduled appointment(s), submit additional documents if requested, complete further formalities, or collect my passport after visa processing.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    The sole purpose of my visit to India is to complete the official <b>${i}</b> visa procedure. I have no intention of seeking employment, conducting business, or engaging in any activity other than the purpose stated above. I will strictly comply with all applicable laws and regulations of India and will depart the country upon completion of my official work, within the validity of my visa.\n                </p>\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    In support of my application, I have enclosed the relevant documents, ${a}, as applicable.\n                </p>\n                <p style="margin: 0 0 20px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I respectfully request you to kindly consider my application and grant me a <b>Double Entry Visa</b>, which will enable me to complete the mandatory immigration and visa formalities required by the authorities of <b>${i}</b>.\n                </p>\n            ` } const i = `${e.name.trim().replace(/[<>:"/\\|?*]/g, "")} - Cover Letter.pdf`, o = document.createElement("div"); o.style.position = "relative", o.style.width = "170mm", o.style.background = "#ffffff", o.style.color = "#000000", o.style.display = "block", o.innerHTML = `\n            <div style="font-family: Arial, sans-serif; font-size: 14.5px; line-height: 1.45; color: #000000 !important; padding: 0; background: #ffffff !important; text-align: left; display: block !important; visibility: visible !important; opacity: 1 !important;">\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">To</p>\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">The Visa Officer</p>\n                <p style="margin: 0 0 5px 0; color: #000000 !important; display: block !important;">High Commission of India</p>\n                <p style="margin: 0 0 25px 0; color: #000000 !important; display: block !important;">${e.mission.toUpperCase()}, Bangladesh</p>\n\n                <p style="margin: 0 0 25px 0; font-weight: bold; text-decoration: underline; color: #000000 !important; display: block !important;">\n                    Subject: ${t}.\n                </p>\n\n                <p style="margin: 0 0 20px 0; color: #000000 !important; display: block !important;">Dear Sir/Madam,</p>\n\n                <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important;">\n                    I respectfully submit my application for an Indian ${"medical" === e.category ? "Medical" : "double" === e.category ? "Double Entry" : "Tourist"} Visa.\n                </p>\n\n                ${n}\n\n                <p style="margin: 0 0 16px 0; color: #000000 !important; display: block !important;">Thank you very much for your time and kind consideration. I look forward to your positive response.</p>\n\n                <p style="margin: 0 0 25px 0; color: #000000 !important; display: block !important;">Yours faithfully,</p>\n\n                <div style="margin-top: 35px; font-size: 14.5px; color: #000000 !important; display: block !important;">\n                    <div style="height: 40px;"></div>\n                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #000000 !important;">${e.name}</p>\n                    <p style="margin: 0 0 4px 0; color: #000000 !important;">Passport No: ${e.passport}</p>\n                    <p style="margin: 0 0 4px 0; color: #000000 !important;">Mobile: ${e.phone}</p>\n                    <p style="margin: 0 0 0 0; color: #000000 !important;">Email: ${e.email}</p>\n                </div>\n            </div>\n        `, document.body.appendChild(o); const a = { margin: [15, 15, 15, 15], filename: i, image: { type: "jpeg", quality: .98 }, html2canvas: { scale: 2, useCORS: !0, logging: !1, scrollX: 0, scrollY: 0 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } }; html2pdf().from(o).set(a).save().then(() => { o.remove() }) }() }, async function n() { const o = document.getElementById("iv-cover-wizard-body"), a = await chrome.storage.local.get(null), l = []; for (const e in a) if (e.startsWith("BGD_") || e.startsWith("PASSPORT_")) { const t = a[e]; t._isHidden || l.push({ key: e, name: t._savedName || "Unknown", type: t._type }) } o.innerHTML = `\n            <div class="iv-segment-control">\n                <button class="iv-segment-btn ${"tourist" === e.category ? "active" : ""}" data-cat="tourist">Tourist Visa</button>\n                <button class="iv-segment-btn ${"medical" === e.category ? "active" : ""}" data-cat="medical">Medical Visa</button>\n                <button class="iv-segment-btn ${"double" === e.category ? "active" : ""}" data-cat="double">Double Entry</button>\n            </div>\n\n            <div class="iv-form-grid" style="margin-bottom: 16px;">\n                <div class="iv-form-group full-width">\n                    <label>Select Saved Profile</label>\n                    <select id="iv-cover-profile-select">\n                        <option value="">Select Profile</option>\n                        ${l.map(t => `<option value="${t.key}" ${e.selectedProfileKey === t.key ? "selected" : ""}>${g(t.name)} (${t.type})</option>`).join("")}\n                    </select>\n                </div>\n            </div>\n\n            <div class="iv-profiles-section-title">Applicant Details:</div>\n            <div class="iv-form-grid">\n                <div class="iv-form-group">\n                    <label>Applicant Name*</label>\n                    <input type="text" id="iv-cover-input-name" value="${g(e.name)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Passport Number*</label>\n                    <input type="text" id="iv-cover-input-passport" value="${g(e.passport)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Mobile Number*</label>\n                    <input type="text" id="iv-cover-input-phone" value="${g(e.phone)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Email Address*</label>\n                    <input type="text" id="iv-cover-input-email" value="${g(e.email)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Indian Mission / Office*</label>\n                    <select id="iv-cover-input-mission">\n                        <option value="DHAKA" ${"DHAKA" === e.mission ? "selected" : ""}>DHAKA</option>\n                        <option value="CHITTAGONG" ${"CHITTAGONG" === e.mission ? "selected" : ""}>CHITTAGONG</option>\n                        <option value="RAJSHAHI" ${"RAJSHAHI" === e.mission ? "selected" : ""}>RAJSHAHI</option>\n                        <option value="SYLHET" ${"SYLHET" === e.mission ? "selected" : ""}>SYLHET</option>\n                        <option value="KHULNA" ${"KHULNA" === e.mission ? "selected" : ""}>KHULNA</option>\n                    </select>\n                </div>\n            ${"double" === e.category ? `\n            <div class="iv-profiles-section-title" style="margin-top: 15px;">Double Entry Visa Details:</div>\n            <div class="iv-form-grid">\n                <div class="iv-form-group">\n                    <label>Visa Category Type*</label>\n                    <select id="iv-cover-input-double-visa-type">\n                        <option value="Student Visa" ${"Student Visa" === e.doubleVisaType ? "selected" : ""}>Student Visa</option>\n                        <option value="Work Visa" ${"Work Visa" === e.doubleVisaType ? "selected" : ""}>Work Visa</option>\n                    </select>\n                </div>\n                <div class="iv-form-group">\n                    <label>Destination Country*</label>\n                    <select id="iv-cover-input-double-country">\n                        <option value="Romania" ${"Romania" === e.doubleCountry ? "selected" : ""}>Romania</option>\n                        <option value="Croatia" ${"Croatia" === e.doubleCountry ? "selected" : ""}>Croatia</option>\n                        <option value="Poland" ${"Poland" === e.doubleCountry ? "selected" : ""}>Poland</option>\n                        <option value="Bulgaria" ${"Bulgaria" === e.doubleCountry ? "selected" : ""}>Bulgaria</option>\n                        <option value="Czech Republic" ${"Czech Republic" === e.doubleCountry ? "selected" : ""}>Czech Republic</option>\n                        <option value="Hungary" ${"Hungary" === e.doubleCountry ? "selected" : ""}>Hungary</option>\n                        <option value="Germany" ${"Germany" === e.doubleCountry ? "selected" : ""}>Germany</option>\n                        <option value="Italy" ${"Italy" === e.doubleCountry ? "selected" : ""}>Italy</option>\n                        <option value="Portugal" ${"Portugal" === e.doubleCountry ? "selected" : ""}>Portugal</option>\n                        <option value="Latvia" ${"Latvia" === e.doubleCountry ? "selected" : ""}>Latvia</option>\n                        <option value="Lithuania" ${"Lithuania" === e.doubleCountry ? "selected" : ""}>Lithuania</option>\n                        <option value="Other" ${"Other" === e.doubleCountry ? "selected" : ""}>Other</option>\n                    </select>\n                </div>\n                ${"Other" === e.doubleCountry ? `\n                <div class="iv-form-group full-width">\n                    <label>Specify Destination Country*</label>\n                    <input type="text" id="iv-cover-input-double-country-custom" value="${g(e.doubleCountryCustom)}" placeholder="e.g. FRANCE">\n                </div>\n                ` : ""}\n            </div>\n            ` : ""}\n\n            ${"medical" === e.category ? `\n            <div class="iv-profiles-section-title" style="margin-top: 15px;">Hospital & Treatment Details:</div>\n            <div class="iv-form-grid">\n                <div class="iv-form-group full-width">\n                    <label>Hospital Name*</label>\n                    <input type="text" id="iv-cover-input-hosp-name" value="${g(e.hospitalName)}">\n                </div>\n                <div class="iv-form-group full-width">\n                    <label>Hospital Address*</label>\n                    <input type="text" id="iv-cover-input-hosp-addr" value="${g(e.hospitalAddress)}">\n                </div>\n                <div class="iv-form-group full-width">\n                    <label>Proposed Treatment / Diagnosis*</label>\n                    <input type="text" id="iv-cover-input-treatment" value="${g(e.treatment)}" placeholder="e.g. ORTHO CARE">\n                </div>\n            </div>\n            ` : ""}\n        `, document.querySelectorAll(".iv-segment-btn").forEach(o => { o.onclick = () => { i(); const a = o.dataset.cat; "medical" === a ? (t.remove(), D()) : (e.category = a, n()) } }); const s = document.getElementById("iv-cover-input-double-country"); s && (s.onchange = () => { i(), n() }); const r = document.getElementById("iv-cover-profile-select"); r.onchange = async () => { const t = r.value; if (e.selectedProfileKey = t, !t) return; const i = a[t]; i && (e.name = `${i.givenName || ""} ${i.surname || ""}`.trim().toUpperCase(), e.passport = (i.passNo || "").toUpperCase(), e.phone = i.pres_phone || "", e.email = i.email_id || "", "BGDD" === i.missioncode_id ? e.mission = "DHAKA" : "BGDG" === i.missioncode_id ? e.mission = "CHITTAGONG" : "BGDR" === i.missioncode_id ? e.mission = "RAJSHAHI" : "BGDS" === i.missioncode_id ? e.mission = "SYLHET" : "BGDK" === i.missioncode_id ? e.mission = "KHULNA" : e.mission = "DHAKA", n()) } }() } function P() { if (document.getElementById("iv-noc-backdrop")) return; const e = [{ id: "pallabi", name: "ARB PRIVATE LIMITED", slogan: "Creating Advance Digital World", phone: "+8801834152556", email: "arbprivateltd.bd@gmail.com", website: "www.arbprivateltd.com", address: "45/8, Pallabi, Dhaka- 1216" }, { id: "royal", name: "ROYAL SQUARE APPARELS LTD.", slogan: "Precision Craftsmanship, Royal Style.", phone: "+880 1834 152 556", email: "royalsapparelsltdbd2@gmail.com", website: "www.royalsquare.com", address: "212/Kha, Road# 8, Block# K, Banasree, Khilgaon, Dhaka- 1219" }, { id: "dhaka_north", name: "DHAKA NORTH STITCHING HUB", slogan: "Stitching Excellence, Delivering Perfection.", phone: "+880 1624-573558", email: "dnstitchinghubltd11@yahoo.com", website: "www.dhakanorthstitching.com", address: "Rajiv Hall, R# 12, Mirpur- 6, Mirpur, Dhaka- 1216" }, { id: "advance", name: "ADVANCE FASHION TEXTILE LTD.", slogan: "Innovating the Threads of Tomorrow.", phone: "+880 1624-573558", email: "advancefashion.textilebdltd@gmail.com", website: "www.advancefashion.com", address: "5/11, Block# F, Road# 6, Aftabnagar, Badda, Dhaka- 1212" }]; let t = { category: "tourist", selectedProfileKey: "", name: "", passport: "", passportExpiry: "01/01/2035", phone: "", email: "", address: "", fatherName: "", mission: "DHAKA", includeDates: !1, dateFrom: "", dateTo: "", designation: "Executive", designationCustom: "", companyId: "pallabi", companyName: "ARB PRIVATE LIMITED", companySlogan: "Creating Advance Digital World", companyPhone: "+8801834152556", companyEmail: "arbprivateltd.bd@gmail.com", companyWebsite: "www.arbprivateltd.com", companyAddress: "45/8, Pallabi, Dhaka- 1216", doubleVisaType: "Work Visa", doubleYearsWorked: "5", doubleNewCompany: "ABC ADVANCE LTD", doubleNewCountry: "Bulgaria", doubleResignationDate: "", doubleApptLocation: "New Delhi, India", doubleApptDate: "", hospitalName: "APOLLO HOSPITALS", patientName: "", patientPassport: "", relationship: "BROTHER", nocDate: "", signeeDesignation: "Manager", signeeDesignationCustom: "" }; const n = document.createElement("div"); n.id = "iv-noc-backdrop", n.innerHTML = '\n        <div id="iv-noc-modal">\n            <div class="iv-modal-header">\n                <h3>NOC Generator</h3>\n                <button class="iv-modal-close" id="iv-btn-close-noc-wizard">&times;</button>\n            </div>\n            <div class="iv-modal-body" id="iv-noc-wizard-body">\n                \x3c!-- Content dynamically injected --\x3e\n            </div>\n            <div class="iv-modal-footer" style="justify-content: space-between; gap: 8px;">\n                <button class="btn-neutral-wizard" id="iv-btn-cancel-noc">Cancel</button>\n                <div style="display: flex; gap: 8px;">\n                    <button class="btn-secondary-wizard" id="iv-btn-download-letterhead-blank" style="padding: 10px 14px; font-size: 12px;">Download Letterhead (Blank)</button>\n                    <button class="btn-primary-wizard" id="iv-btn-download-noc" style="padding: 10px 14px; font-size: 12px;">Download NOC</button>\n                </div>\n            </div>\n        </div>\n    ', document.body.appendChild(n); const i = () => n.remove(); function o() { const e = document.getElementById("iv-noc-input-name"); e && (t.name = e.value.toUpperCase()); const n = document.getElementById("iv-noc-input-passport"); n && (t.passport = n.value.toUpperCase()); const i = document.getElementById("iv-noc-input-passport-expiry"); i && (t.passportExpiry = i.value); const o = document.getElementById("iv-noc-input-phone"); o && (t.phone = o.value); const a = document.getElementById("iv-noc-input-email"); a && (t.email = a.value); const l = document.getElementById("iv-noc-input-address"); l && (t.address = l.value.toUpperCase()); const s = document.getElementById("iv-noc-input-father"); s && (t.fatherName = s.value.toUpperCase()); const r = document.getElementById("iv-noc-input-mission"); r && (t.mission = r.value); const d = document.getElementById("iv-noc-input-include-dates"); d && (t.includeDates = d.checked); const p = document.getElementById("iv-noc-input-date-from"); p && (t.dateFrom = p.value); const c = document.getElementById("iv-noc-input-date-to"); c && (t.dateTo = c.value); const m = document.getElementById("iv-noc-input-date"); m && (t.nocDate = m.value); const u = document.getElementById("iv-noc-input-designation"); u && (t.designation = u.value); const v = document.getElementById("iv-noc-input-designation-custom"); v && (t.designationCustom = v.value.toUpperCase()); const y = document.getElementById("iv-noc-input-comp-name"); y && (t.companyName = y.value.toUpperCase()); const g = document.getElementById("iv-noc-input-comp-slogan"); g && (t.companySlogan = g.value); const f = document.getElementById("iv-noc-input-comp-phone"); f && (t.companyPhone = f.value); const b = document.getElementById("iv-noc-input-comp-email"); b && (t.companyEmail = b.value); const h = document.getElementById("iv-noc-input-comp-website"); h && (t.companyWebsite = h.value); const x = document.getElementById("iv-noc-input-comp-address"); x && (t.companyAddress = x.value.toUpperCase()); const w = document.getElementById("iv-noc-input-double-visa-type"); w && (t.doubleVisaType = w.value); const I = document.getElementById("iv-noc-input-double-years"); I && (t.doubleYearsWorked = I.value); const A = document.getElementById("iv-noc-input-double-new-company"); A && (t.doubleNewCompany = A.value.toUpperCase()); const E = document.getElementById("iv-noc-input-double-new-country"); E && (t.doubleNewCountry = E.value); const $ = document.getElementById("iv-noc-input-double-resig-date"); $ && (t.doubleResignationDate = $.value); const C = document.getElementById("iv-noc-input-double-appt-loc"); C && (t.doubleApptLocation = C.value.toUpperCase()); const k = document.getElementById("iv-noc-input-double-appt-date"); k && (t.doubleApptDate = k.value); const _ = document.getElementById("iv-noc-input-hosp-name"); _ && (t.hospitalName = _.value.toUpperCase()); const N = document.getElementById("iv-noc-input-patient-name"); N && (t.patientName = N.value.toUpperCase()); const D = document.getElementById("iv-noc-input-patient-passport"); D && (t.patientPassport = D.value.toUpperCase()); const B = document.getElementById("iv-noc-input-relationship"); B && (t.relationship = B.value.toUpperCase()); const P = document.getElementById("iv-noc-input-signee-designation"); P && (t.signeeDesignation = P.value); const S = document.getElementById("iv-noc-input-signee-designation-custom"); S && (t.signeeDesignationCustom = S.value) } function a(e) { const n = "Other" === t.designation ? t.designationCustom : t.designation, i = "Other" === t.signeeDesignation ? t.signeeDesignationCustom : t.signeeDesignation, o = e ? `${t.name.trim().replace(/[<>:"/\\|?*]/g, "")} - NOC.pdf` : `${t.companyName.trim().replace(/[<>:"/\\|?*]/g, "")} - Letterhead.pdf`, a = t.nocDate ? `Date: ${t.nocDate}` : "Date: _______________"; let l = ""; e && ("tourist" === t.category ? l = `\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        This is to certify that Mr. <b>${t.name}</b>, holder of Bangladesh Passport No: <b>${t.passport}</b>, is employed with us on a permanent, full-time basis in the position of <b>${n}</b>. He has been associated with our organization since a significant duration and has consistently demonstrated high professional standards, dedication, and integrity.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We have been informed of his upcoming personal visit to India. We hereby confirm that the management of <b>${t.companyName}</b> has no objection to his travel to India for tourist purposes${t.includeDates ? ` from <b>${t.dateFrom}</b> to <b>${t.dateTo}</b>` : ""}. His leave of absence has been officially sanctioned for this specified duration.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        All expenses related to this travel, including transportation, accommodation, medical coverage, and day-to-day expenditures, will be entirely borne by him. There are no financial liabilities or obligations on the part of our company regarding this tour. We assure you that he will resume his active duties in our company upon the completion of his travel.\n                    </p>\n                    <p style="margin: 0 0 25px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We wish him a safe, pleasant, and rewarding journey.\n                    </p>\n                ` : "medical_patient" === t.category ? l = `\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        This is to certify that Mr. <b>${t.name}</b>, holder of Bangladesh Passport No: <b>${t.passport}</b>, is employed with us on a full-time basis in the position of <b>${n}</b>.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        He has requested medical leave to travel to India for necessary advance medical treatment and consultation at <b>${t.hospitalName}</b>. We hereby state that the management of <b>${t.companyName}</b> has officially approved his medical leave${t.includeDates ? ` from <b>${t.dateFrom}</b> to <b>${t.dateTo}</b>` : ""} and has no objection to his travel.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We confirm that all medical costs, travel fares, and accommodation expenses during his stay in India will be fully funded by him. We expect him to return and rejoin his active duties in our organization upon his successful recovery and return to Bangladesh.\n                    </p>\n                    <p style="margin: 0 0 25px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We wish him a successful treatment and a speedy recovery.\n                    </p>\n                ` : "medical_attendant" === t.category ? l = `\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        This is to certify that Mr. <b>${t.name}</b>, holder of Bangladesh Passport No: <b>${t.passport}</b>, is employed with us on a full-time basis in the position of <b>${n}</b>.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        He has been granted leave${t.includeDates ? ` from <b>${t.dateFrom}</b> to <b>${t.dateTo}</b>` : ""} to travel to India as a medical attendant accompanying his <b>${t.relationship}</b>, <b>${t.patientName}</b> (holder of Passport No: <b>${t.patientPassport}</b>), who is traveling to undergo essential medical care at <b>${t.hospitalName}</b>.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We hereby declare that the management of <b>${t.companyName}</b> has no objection to his leave and travel for this purpose. We confirm that all costs associated with his journey and stay will be borne entirely by him, and we expect him to resume his active duties with us upon his return.\n                    </p>\n                    <p style="margin: 0 0 25px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We wish them a safe journey and successful medical outcomes.\n                    </p>\n                ` : "double" === t.category && (l = `\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        This is to certify that Mr. <b>${t.name}</b> (Passport No: <b>${t.passport}</b>, Expiry: <b>${t.passportExpiry}</b>), son of Mr. <b>${t.fatherName}</b>, residing at <b>${t.address}</b>, was a valued employee of our organization, <b>${t.companyName}</b>. He worked with us for a period of <b>${t.doubleYearsWorked} years</b> in the position of <b>${n}</b>.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        Mr. <b>${t.name}</b> has submitted his resignation letter, which has been accepted by the management of <b>${t.companyName}</b>. His resignation will be effective from <b>${t.doubleResignationDate}</b>. He has informed us that he is resigning because he has received an employment contract for the position of <b>${n}</b> with <b>"${t.doubleNewCompany}"</b> in <b>${t.doubleNewCountry}</b>.\n                    </p>\n                    <p style="margin: 0 0 16px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We understand that he needs to travel to <b>${t.doubleApptLocation}</b> in <b>${t.doubleApptDate}</b> to attend his visa appointment at the Embassy/Consulate of <b>${t.doubleNewCountry}</b>. <b>${t.companyName}</b> has no objection to his resignation, his travel to India for the visa application process, and his subsequent travel to <b>${t.doubleNewCountry}</b> to join his new assignment.\n                    </p>\n                    <p style="margin: 0 0 25px 0; text-align: justify; color: #000000 !important; display: block !important; line-height: 1.6; font-size: 17px; font-family: Arial, sans-serif;">\n                        We wish him the very best in his future endeavors.\n                    </p>\n                `), l += `\n                <div style="margin-top: 30px; font-size: 17px; color: #000000 !important; display: block !important; line-height: 1.45; font-family: Arial, sans-serif;">\n                    <p style="margin: 0 0 4px 0;">Sincerely yours,</p>\n                    <div style="height: 52px;"></div>\n                    <p style="margin: 0 0 4px 0; font-weight: bold;">${i}</p>\n                    <p style="margin: 0 0 0 0; font-weight: bold;">${t.companyName}</p>\n                </div>\n            `); const s = (e, t) => e.length > t ? e.substring(0, t) + "..." : e, r = s(t.companyName, 42), d = s(t.companyPhone, 50), p = s(t.companyEmail, 50), c = t.companyWebsite ? s(t.companyWebsite, 40) : ""; let m = ""; m = e ? `\n                \x3c!-- Margin between Date Line and Heading: 0.9 inches --\x3e\n                <div style="height: 0.9in;"></div>\n                \n                \x3c!-- NOC Heading (No Underline, Size 21px, and explicit border/line overrides) --\x3e\n                <h3 style="text-align: center; font-size: 21px; font-weight: bold; margin-top: 0; margin-bottom: 35px; color: #000000 !important; display: block !important; font-family: Arial, sans-serif; border: none !important; border-bottom: none !important; text-decoration: none !important; outline: none !important; box-shadow: none !important;">No Objection Certificate (NOC)</h3>\n                \n                <div style="font-size: 17px; font-family: Arial, sans-serif; color: #000000 !important;">\n                    ${l}\n                </div>\n            ` : '<div style="height: 180mm;"></div>'; let u = `\n            <div style="width: 100%; box-sizing: border-box; background: #ffffff;">\n                \n                \x3c!-- Unpadded top header block to achieve edge-to-edge borderless separator line --\x3e\n                <div style="padding: 0.3in 0 10px 0; border-bottom: 2.5px solid #0056b3; text-align: center; font-family: Arial, sans-serif; box-sizing: border-box;">\n                    <h1 style="margin: 0 0 6px 0; font-size: 34px; font-weight: bold; color: #0056b3; letter-spacing: 0.5px;">${r}</h1>\n                    <p style="margin: 0; font-size: 15px; color: #000000; line-height: 1.45; font-weight: normal;">\n                        Mobile: ${d},<br>\n                        Email: ${p}${c ? `, Web: ${c}` : ""}<br>\n                        ${s(t.companyAddress, 80)}\n                    </p>\n                </div>\n\n                \x3c!-- Padded content body wrapper (24mm side padding for narrower, cleaner margins) --\x3e\n                <div style="padding: 0 24mm; box-sizing: border-box;">\n                    \n                    <div style="text-align: right; font-family: Arial, sans-serif; font-size: 15px; font-style: italic; color: #000000; margin-top: 15px;">\n                        ${a}\n                    </div>\n\n                    ${m}\n                    \n                </div>\n            </div>\n        `; const v = document.createElement("div"); v.style.position = "relative", v.style.width = "210mm", v.style.background = "#ffffff", v.style.color = "#000000", v.style.display = "block", v.innerHTML = u, document.body.appendChild(v); const y = { margin: 0, filename: o, image: { type: "jpeg", quality: .98 }, html2canvas: { scale: 2, useCORS: !0, logging: !1, scrollX: 0, scrollY: 0 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } }; html2pdf().from(v).set(y).save().then(() => { v.remove() }) } document.getElementById("iv-btn-close-noc-wizard").onclick = i, document.getElementById("iv-btn-cancel-noc").onclick = i, document.getElementById("iv-btn-download-letterhead-blank").onclick = () => { o(), t.companyName && t.companyPhone && t.companyEmail && t.companyAddress ? a(!1) : alert("Please enter the Company Name, Phone, Email, and Address to generate the letterhead.") }, document.getElementById("iv-btn-download-noc").onclick = async () => { if ("double" === t.category && "Student Visa" === t.doubleVisaType) return void alert("NOC is not required for Student Visas. Only work visa holders require an NOC."); if (!function () { o(); const e = [{ id: "iv-noc-input-comp-name", name: "Company Name", value: t.companyName }, { id: "iv-noc-input-comp-phone", name: "Company Phone", value: t.companyPhone }, { id: "iv-noc-input-comp-email", name: "Company Email", value: t.companyEmail }, { id: "iv-noc-input-comp-address", name: "Company Address", value: t.companyAddress }, { id: "iv-noc-input-name", name: "Applicant Name", value: t.name }, { id: "iv-noc-input-passport", name: "Passport Number", value: t.passport }, { id: "iv-noc-input-phone", name: "Applicant Mobile", value: t.phone }, { id: "iv-noc-input-email", name: "Applicant Email", value: t.email }]; "Other" === t.designation && e.push({ id: "iv-noc-input-designation-custom", name: "Custom Designation Name", value: t.designationCustom }), "Other" === t.signeeDesignation && e.push({ id: "iv-noc-input-signee-designation-custom", name: "Custom Signatory Designation", value: t.signeeDesignationCustom }), t.includeDates && (e.push({ id: "iv-noc-input-date-from", name: "Leave Start Date", value: t.dateFrom }), e.push({ id: "iv-noc-input-date-to", name: "Leave End Date", value: t.dateTo })), "double" === t.category && "Work Visa" === t.doubleVisaType && (e.push({ id: "iv-noc-input-father", name: "Father Name", value: t.fatherName }), e.push({ id: "iv-noc-input-passport-expiry", name: "Passport Expiry Date", value: t.passportExpiry }), e.push({ id: "iv-noc-input-address", name: "Permanent Address", value: t.address }), e.push({ id: "iv-noc-input-double-years", name: "Years Worked", value: t.doubleYearsWorked }), e.push({ id: "iv-noc-input-double-resig-date", name: "Resignation Effective Date", value: t.doubleResignationDate }), e.push({ id: "iv-noc-input-double-new-company", name: "New Company", value: t.doubleNewCompany }), e.push({ id: "iv-noc-input-double-appt-date", name: " Delhi Embassy Appt Date", value: t.doubleApptDate }), e.push({ id: "iv-noc-input-double-appt-loc", name: "Delhi Appt Location", value: t.doubleApptLocation })), "medical_patient" === t.category && e.push({ id: "iv-noc-input-hosp-name", name: "Indian Hospital Name", value: t.hospitalName }), "medical_attendant" === t.category && (e.push({ id: "iv-noc-input-patient-name", name: "Patient Full Name", value: t.patientName }), e.push({ id: "iv-noc-input-patient-passport", name: "Patient Passport", value: t.patientPassport }), e.push({ id: "iv-noc-input-hosp-name", name: "Indian Hospital Name", value: t.hospitalName })); let n = []; return e.forEach(e => { const t = document.getElementById(e.id); e.value ? t && (t.style.borderColor = "", t.style.backgroundColor = "") : (n.push(e.name), t && (t.style.borderColor = "#ef4444", t.style.backgroundColor = "#fef2f2", t.oninput = () => { t.value.trim() && (t.style.borderColor = "", t.style.backgroundColor = "") })) }), !(n.length > 0 && (alert("Please fill in: " + n.join(", ")), 1)) }()) return; await f("noc", 2) && a(!0) }, async function n() { const i = document.getElementById("iv-noc-wizard-body"), a = await chrome.storage.local.get(null), l = []; for (const e in a) if (e.startsWith("BGD_") || e.startsWith("PASSPORT_")) { const t = a[e]; t._isHidden || l.push({ key: e, name: t._savedName || "Unknown", type: t._type }) } const s = (await chrome.storage.local.get("iv_noc_user_companies")).iv_noc_user_companies || [], r = [...e, ...s]; i.innerHTML = `\n            <div class="iv-segment-control">\n                <button class="iv-segment-btn ${"tourist" === t.category ? "active" : ""}" data-cat="tourist">Tourist</button>\n                <button class="iv-segment-btn ${"medical_patient" === t.category ? "active" : ""}" data-cat="medical_patient">Patient</button>\n                <button class="iv-segment-btn ${"medical_attendant" === t.category ? "active" : ""}" data-cat="medical_attendant">Attendant</button>\n                <button class="iv-segment-btn ${"double" === t.category ? "active" : ""}" data-cat="double">Double Entry</button>\n            </div>\n\n            ${"double" === t.category && "Student Visa" === t.doubleVisaType ? '\n            <div style="background: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: bold; margin-bottom: 16px;">\n                ⚠️ NOC is NOT required for Student Visa holders (only Work Visa holders require an NOC). Please switch the Visa Category Type below to Work Visa if applicable.\n            </div>\n            ' : ""}\n\n            <div class="iv-form-grid" style="margin-bottom: 16px;">\n                <div class="iv-form-group full-width">\n                    <label>Select Saved Profile</label>\n                    <select id="iv-noc-profile-select">\n                        <option value="">Select Profile</option>\n                        ${l.map(e => `<option value="${e.key}" ${t.selectedProfileKey === e.key ? "selected" : ""}>${g(e.name)} (${e.type})</option>`).join("")}\n                    </select>\n                </div>\n            </div>\n\n            <div class="iv-profiles-section-title">Company Letterhead Details:</div>\n            <div class="iv-form-grid" style="margin-bottom: 16px;">\n                <div class="iv-form-group full-width">\n                    <label>Select Company Profile*</label>\n                    <select id="iv-noc-company-select">\n                        ${r.map(e => `<option value="${e.id}" ${t.companyId === e.id ? "selected" : ""}>${g(e.name)}</option>`).join("")}\n                        <option value="custom" ${"custom" === t.companyId ? "selected" : ""}>+ Add New Company</option>\n                    </select>\n                </div>\n                \n                <div class="iv-form-group">\n                    <label>Company Name*</label>\n                    <input type="text" id="iv-noc-input-comp-name" value="${g(t.companyName)}" ${"custom" !== t.companyId ? 'readonly style="background: #f1f5f9; cursor: not-allowed;"' : ""}>\n                </div>\n                <div class="iv-form-group">\n                    <label>Slogan (Optional)</label>\n                    <input type="text" id="iv-noc-input-comp-slogan" value="${g(t.companySlogan)}" ${"custom" !== t.companyId ? 'readonly style="background: #f1f5f9; cursor: not-allowed;"' : ""}>\n                </div>\n                <div class="iv-form-group">\n                    <label>Phone Number*</label>\n                    <input type="text" id="iv-noc-input-comp-phone" value="${g(t.companyPhone)}" ${"custom" !== t.companyId ? 'readonly style="background: #f1f5f9; cursor: not-allowed;"' : ""}>\n                </div>\n                <div class="iv-form-group">\n                    <label>Email Address*</label>\n                    <input type="text" id="iv-noc-input-comp-email" value="${g(t.companyEmail)}" ${"custom" !== t.companyId ? 'readonly style="background: #f1f5f9; cursor: not-allowed;"' : ""}>\n                </div>\n                <div class="iv-form-group">\n                    <label>Website (Optional)</label>\n                    <input type="text" id="iv-noc-input-comp-website" value="${g(t.companyWebsite)}" ${"custom" !== t.companyId ? 'readonly style="background: #f1f5f9; cursor: not-allowed;"' : ""}>\n                </div>\n                <div class="iv-form-group">\n                    <label>Address*</label>\n                    <input type="text" id="iv-noc-input-comp-address" value="${g(t.companyAddress)}" ${"custom" !== t.companyId ? 'readonly style="background: #f1f5f9; cursor: not-allowed;"' : ""}>\n                </div>\n                \n                <div class="iv-form-group">\n                    <label>Signatory Designation*</label>\n                    <select id="iv-noc-input-signee-designation">\n                        <option value="Manager" ${"Manager" === t.signeeDesignation ? "selected" : ""}>Manager</option>\n                        <option value="HR Manager" ${"HR Manager" === t.signeeDesignation ? "selected" : ""}>HR Manager</option>\n                        <option value="Proprietor" ${"Proprietor" === t.signeeDesignation ? "selected" : ""}>Proprietor</option>\n                        <option value="Other" ${"Other" === t.signeeDesignation ? "selected" : ""}>Other</option>\n                    </select>\n                </div>\n                ${"Other" === t.signeeDesignation ? `\n                <div class="iv-form-group">\n                    <label>Specify Signatory Designation*</label>\n                    <input type="text" id="iv-noc-input-signee-designation-custom" value="${g(t.signeeDesignationCustom)}" placeholder="e.g. Managing Director">\n                </div>\n                ` : ""}\n                \n                ${"custom" === t.companyId ? '\n                <div class="iv-form-group full-width" style="text-align: right; margin-top: 4px;">\n                    <button type="button" id="iv-noc-btn-save-company" class="btn-secondary-wizard" style="font-size: 11px; padding: 6px 12px; width: auto; font-weight: bold; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 4px; cursor: pointer;">Save Company to List</button>\n                </div>\n                ' : ""}\n            </div>\n\n            <div class="iv-profiles-section-title">Employee / Applicant Details:</div>\n            <div class="iv-form-grid">\n                <div class="iv-form-group">\n                    <label>Applicant Name*</label>\n                    <input type="text" id="iv-noc-input-name" value="${g(t.name)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Passport Number*</label>\n                    <input type="text" id="iv-noc-input-passport" value="${g(t.passport)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Mobile Number*</label>\n                    <input type="text" id="iv-noc-input-phone" value="${g(t.phone)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Email Address*</label>\n                    <input type="text" id="iv-noc-input-email" value="${g(t.email)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Employee Designation*</label>\n                    <select id="iv-noc-input-designation">\n                        <option value="Manager" ${"Manager" === t.designation ? "selected" : ""}>Manager</option>\n                        <option value="Assistant Manager" ${"Assistant Manager" === t.designation ? "selected" : ""}>Assistant Manager</option>\n                        <option value="Office Assistant" ${"Office Assistant" === t.designation ? "selected" : ""}>Office Assistant</option>\n                        <option value="Computer Operator" ${"Computer Operator" === t.designation ? "selected" : ""}>Computer Operator</option>\n                        <option value="Executive" ${"Executive" === t.designation ? "selected" : ""}>Executive</option>\n                        <option value="Supervisor" ${"Supervisor" === t.designation ? "selected" : ""}>Supervisor</option>\n                        <option value="Salesman" ${"Salesman" === t.designation ? "selected" : ""}>Salesman</option>\n                        <option value="Other" ${"Other" === t.designation ? "selected" : ""}>Other</option>\n                    </select>\n                </div>\n                ${"Other" === t.designation ? `\n                <div class="iv-form-group">\n                    <label>Specify Designation*</label>\n                    <input type="text" id="iv-noc-input-designation-custom" value="${g(t.designationCustom)}">\n                </div>\n                ` : ""}\n                <div class="iv-form-group">\n                    <label>Indian Mission / Office*</label>\n                    <select id="iv-noc-input-mission">\n                        <option value="DHAKA" ${"DHAKA" === t.mission ? "selected" : ""}>DHAKA</option>\n                        <option value="CHITTAGONG" ${"CHITTAGONG" === t.mission ? "selected" : ""}>CHITTAGONG</option>\n                        <option value="RAJSHAHI" ${"RAJSHAHI" === t.mission ? "selected" : ""}>RAJSHAHI</option>\n                        <option value="SYLHET" ${"SYLHET" === t.mission ? "selected" : ""}>SYLHET</option>\n                        <option value="KHULNA" ${"KHULNA" === t.mission ? "selected" : ""}>KHULNA</option>\n                    </select>\n                </div>\n                <div class="iv-form-group">\n                    <label>Date of NOC (Leave blank for default line)</label>\n                    <input type="text" id="iv-noc-input-date" value="${g(t.nocDate)}" placeholder="e.g. 4 July 2026">\n                </div>\n            </div>\n\n            \x3c!-- Toggleable Travel Leave Dates --\x3e\n            <div style="margin-top: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">\n                <input type="checkbox" id="iv-noc-input-include-dates" ${t.includeDates ? "checked" : ""} style="width: 16px; height: 16px; cursor: pointer;">\n                <label for="iv-noc-input-include-dates" style="font-size: 13px; font-weight: bold; color: #475569; cursor: pointer; user-select: none;">Include leave travel dates (Optional)</label>\n            </div>\n            \n            ${t.includeDates ? `\n            <div class="iv-form-grid" style="margin-bottom: 16px;">\n                <div class="iv-form-group">\n                    <label>Leave From Date*</label>\n                    <input type="text" id="iv-noc-input-date-from" value="${g(t.dateFrom)}" placeholder="e.g. 01-01-2027">\n                </div>\n                <div class="iv-form-group">\n                    <label>Leave To Date*</label>\n                    <input type="text" id="iv-noc-input-date-to" value="${g(t.dateTo)}" placeholder="e.g. 01-02-2027">\n                </div>\n            </div>\n            ` : ""}\n\n            \x3c!-- Category Specific Form Groups --\x3e\n            ${"double" === t.category ? `\n            <div class="iv-profiles-section-title" style="margin-top: 15px;">Double Entry Release Details:</div>\n            <div class="iv-form-grid">\n                <div class="iv-form-group">\n                    <label>Visa Category Type*</label>\n                    <select id="iv-noc-input-double-visa-type">\n                        <option value="Work Visa" ${"Work Visa" === t.doubleVisaType ? "selected" : ""}>Work Visa</option>\n                        <option value="Student Visa" ${"Student Visa" === t.doubleVisaType ? "selected" : ""}>Student Visa</option>\n                    </select>\n                </div>\n                ${"Work Visa" === t.doubleVisaType ? `\n                <div class="iv-form-group">\n                    <label>Father's Name*</label>\n                    <input type="text" id="iv-noc-input-father" value="${g(t.fatherName)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Passport Expiry Date*</label>\n                    <input type="text" id="iv-noc-input-passport-expiry" value="${g(t.passportExpiry)}" placeholder="DD/MM/YYYY">\n                </div>\n                <div class="iv-form-group">\n                    <label>Applicant Permanent Address*</label>\n                    <input type="text" id="iv-noc-input-address" value="${g(t.address)}" placeholder="e.g. BANASREE, DHAKA">\n                </div>\n                <div class="iv-form-group">\n                    <label>Years Worked at Company*</label>\n                    <input type="number" id="iv-noc-input-double-years" value="${g(t.doubleYearsWorked)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Resignation Effective Date*</label>\n                    <input type="text" id="iv-noc-input-double-resig-date" value="${g(t.doubleResignationDate)}" placeholder="e.g. November 30, 2025">\n                </div>\n                <div class="iv-form-group">\n                    <label>New Company Name (abroad)*</label>\n                    <input type="text" id="iv-noc-input-double-new-company" value="${g(t.doubleNewCompany)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Third Country (abroad)*</label>\n                    <select id="iv-noc-input-double-new-country">\n                        <option value="Romania" ${"Romania" === t.doubleNewCountry ? "selected" : ""}>Romania</option>\n                        <option value="Croatia" ${"Croatia" === t.doubleNewCountry ? "selected" : ""}>Croatia</option>\n                        <option value="Poland" ${"Poland" === t.doubleNewCountry ? "selected" : ""}>Poland</option>\n                        <option value="Bulgaria" ${"Bulgaria" === t.doubleNewCountry ? "selected" : ""}>Bulgaria</option>\n                        <option value="Czech Republic" ${"Czech Republic" === t.doubleNewCountry ? "selected" : ""}>Czech Republic</option>\n                        <option value="Hungary" ${"Hungary" === t.doubleNewCountry ? "selected" : ""}>Hungary</option>\n                        <option value="Germany" ${"Germany" === t.doubleNewCountry ? "selected" : ""}>Germany</option>\n                        <option value="Italy" ${"Italy" === t.doubleNewCountry ? "selected" : ""}>Italy</option>\n                        <option value="Portugal" ${"Portugal" === t.doubleNewCountry ? "selected" : ""}>Portugal</option>\n                        <option value="Latvia" ${"Latvia" === t.doubleNewCountry ? "selected" : ""}>Latvia</option>\n                        <option value="Lithuania" ${"Lithuania" === t.doubleNewCountry ? "selected" : ""}>Lithuania</option>\n                    </select>\n                </div>\n                <div class="iv-form-group">\n                    <label>Delhi Embassy Appt. Date*</label>\n                    <input type="text" id="iv-noc-input-double-appt-date" value="${g(t.doubleApptDate)}" placeholder="e.g. 11 January 2026">\n                </div>\n                <div class="iv-form-group">\n                    <label>Delhi Appt. Location*</label>\n                    <input type="text" id="iv-noc-input-double-appt-loc" value="${g(t.doubleApptLocation)}">\n                </div>\n                ` : ""}\n            </div>\n            ` : ""}\n\n            ${"medical_patient" === t.category ? `\n            <div class="iv-profiles-section-title" style="margin-top: 15px;">Medical Treatment Details:</div>\n            <div class="iv-form-grid">\n                <div class="iv-form-group full-width">\n                    <label>Indian Hospital Name*</label>\n                    <input type="text" id="iv-noc-input-hosp-name" value="${g(t.hospitalName)}">\n                </div>\n            </div>\n            ` : ""}\n\n            ${"medical_attendant" === t.category ? `\n            <div class="iv-profiles-section-title" style="margin-top: 15px;">Accompanying Patient Details:</div>\n            <div class="iv-form-grid">\n                <div class="iv-form-group">\n                    <label>Patient Full Name*</label>\n                    <input type="text" id="iv-noc-input-patient-name" value="${g(t.patientName)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Patient Passport Number*</label>\n                    <input type="text" id="iv-noc-input-patient-passport" value="${g(t.patientPassport)}">\n                </div>\n                <div class="iv-form-group">\n                    <label>Relationship to Patient*</label>\n                    <select id="iv-noc-input-relationship">\n                        <option value="BROTHER" ${"BROTHER" === t.relationship ? "selected" : ""}>BROTHER</option>\n                        <option value="SISTER" ${"SISTER" === t.relationship ? "selected" : ""}>SISTER</option>\n                        <option value="FATHER" ${"FATHER" === t.relationship ? "selected" : ""}>FATHER</option>\n                        <option value="MOTHER" ${"MOTHER" === t.relationship ? "selected" : ""}>MOTHER</option>\n                        <option value="SON" ${"SON" === t.relationship ? "selected" : ""}>SON</option>\n                        <option value="DAUGHTER" ${"DAUGHTER" === t.relationship ? "selected" : ""}>DAUGHTER</option>\n                        <option value="HUSBAND" ${"HUSBAND" === t.relationship ? "selected" : ""}>HUSBAND</option>\n                        <option value="WIFE" ${"WIFE" === t.relationship ? "selected" : ""}>WIFE</option>\n                    </select>\n                </div>\n                <div class="iv-form-group">\n                    <label>Indian Hospital Name*</label>\n                    <input type="text" id="iv-noc-input-hosp-name" value="${g(t.hospitalName)}">\n                </div>\n            </div>\n            ` : ""}\n        `, document.querySelectorAll(".iv-segment-btn").forEach(e => { e.onclick = () => { o(), t.category = e.dataset.cat, n() } }); const d = document.getElementById("iv-noc-input-include-dates"); d && (d.onchange = () => { o(), n() }); const p = document.getElementById("iv-noc-input-designation"); p && (p.onchange = () => { o(), n() }); const c = document.getElementById("iv-noc-input-signee-designation"); c && (c.onchange = () => { o(), n() }); const m = document.getElementById("iv-noc-input-double-visa-type"); m && (m.onchange = () => { o(), n() }); const u = document.getElementById("iv-noc-profile-select"); u.onchange = async () => { const e = u.value; if (t.selectedProfileKey = e, !e) return; const i = a[e]; i && (t.name = `${i.givenName || ""} ${i.surname || ""}`.trim().toUpperCase(), t.passport = (i.passNo || "").toUpperCase(), t.phone = i.pres_phone || "", t.email = i.email_id || "", t.address = `${i.pres_add1 || ""} ${i.pres_add2 || ""}`.trim().toUpperCase(), t.fatherName = (i.fthrname || "").toUpperCase(), "BGDD" === i.missioncode_id ? t.mission = "DHAKA" : "BGDG" === i.missioncode_id ? t.mission = "CHITTAGONG" : "BGDR" === i.missioncode_id ? t.mission = "RAJSHAHI" : "BGDS" === i.missioncode_id ? t.mission = "SYLHET" : "BGDK" === i.missioncode_id ? t.mission = "KHULNA" : t.mission = "DHAKA", n()) }; const v = document.getElementById("iv-noc-company-select"); v.onchange = () => { const e = v.value; if (t.companyId = e, "custom" !== e) { const n = r.find(t => t.id === e); n && (t.companyName = n.name, t.companySlogan = n.slogan, t.companyPhone = n.phone, t.companyEmail = n.email, t.companyWebsite = n.website, t.companyAddress = n.address) } else t.companyName = "", t.companySlogan = "", t.companyPhone = "", t.companyEmail = "", t.companyWebsite = "", t.companyAddress = ""; n() }; const y = document.getElementById("iv-noc-btn-save-company"); y && (y.onclick = async () => { const e = document.getElementById("iv-noc-input-comp-name").value.trim().toUpperCase(), i = document.getElementById("iv-noc-input-comp-slogan").value.trim(), o = document.getElementById("iv-noc-input-comp-phone").value.trim(), a = document.getElementById("iv-noc-input-comp-email").value.trim(), l = document.getElementById("iv-noc-input-comp-website").value.trim(), s = document.getElementById("iv-noc-input-comp-address").value.trim().toUpperCase(); if (!(e && o && a && s)) return void alert("Please fill in Company Name, Phone, Email, and Address to save."); const r = (await chrome.storage.local.get("iv_noc_user_companies")).iv_noc_user_companies || [], d = { id: "user_" + Date.now(), name: e, slogan: i, phone: o, email: a, website: l, address: s }; r.push(d), await chrome.storage.local.set({ iv_noc_user_companies: r }), t.companyId = d.id, t.companyName = d.name, t.companySlogan = d.slogan, t.companyPhone = d.phone, t.companyEmail = d.email, t.companyWebsite = d.website, t.companyAddress = d.address, alert("Company saved successfully!"), n() }) }() }
;try { if (typeof initAutoCaptcha === "function") { initAutoCaptcha(); } } catch(e) { console.warn("Initial auto-captcha trigger:", e); }
