import { getDocument as e, GlobalWorkerOptions as t } from "./build/pdf.mjs";
t.workerSrc = "./build/pdf.worker.mjs";

// ===== 🔒 ANTI-TAMPER & DEVTOOLS PROTECTION =====
(function _secShield() {
    function _guard() {
        const start = Date.now();
        debugger;
        if (Date.now() - start > 100) {
            window.location.reload();
        }
    }
    setInterval(_guard, 3500);
})();

// ===== 🛡️ DESKTOP SOFTWARE & LICENSE ENFORCEMENT GATE =====
let isFormFillUnlocked = false;

function enforceLicenseStatus() {
    chrome.runtime.sendMessage({ action: 'checkLicenseStatus' }, (resp) => {
        const overlay = document.getElementById('license-lock-overlay');
        const lockMsg = document.getElementById('license-lock-msg');
        const appView = document.getElementById('app-view');
        
        if (chrome.runtime.lastError || !resp || resp.active !== true) {
            isFormFillUnlocked = false;
            if (overlay) overlay.style.display = 'flex';
            if (appView) appView.style.pointerEvents = 'none';
            if (lockMsg) {
                if (resp && resp.error && resp.error.toLowerCase().includes('offline')) {
                    lockMsg.innerText = "❌ IVAC Master Pro ডেস্কটপ সফটওয়্যার চালু নেই!";
                } else {
                    lockMsg.innerText = "🔒 লাইসেন্স সক্রিয় নেই! অনুগ্রহ করে সফটওয়্যারে লাইসেন্স কি প্রবেশ করান।";
                }
            }
        } else {
            isFormFillUnlocked = true;
            if (overlay) overlay.style.display = 'none';
            if (appView) appView.style.pointerEvents = 'auto';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    enforceLicenseStatus();
    const btnRetry = document.getElementById('btnRetryLicenseCheck');
    if (btnRetry) btnRetry.addEventListener('click', enforceLicenseStatus);
});
setInterval(enforceLicenseStatus, 3000);

const o = e => document.getElementById(e);

function getCalculatedJourneyDate(appSettings) {
    const mode = String(appSettings?.defaultJourneyDateMode || "");
    const days = parseInt(mode, 10);
    if (["15", "30", "45"].includes(mode) && !isNaN(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
    if (appSettings?.defaultJourneyDate && appSettings.defaultJourneyDate.trim()) {
        return appSettings.defaultJourneyDate.trim();
    }
    if (!isNaN(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
    return "";
}

function formatBgdDate(str) {
    if (!str) return "";
    str = str.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
    const m = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})$/);
    if (m) {
        const months = {
            JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
            JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12"
        };
        const dd = String(m[1]).padStart(2, "0");
        const mm = months[m[2].toUpperCase()] || "01";
        const yyyy = m[3];
        return `${dd}/${mm}/${yyyy}`;
    }
    const m2 = str.match(/^(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{4})$/);
    if (m2) {
        const dd = String(m2[1]).padStart(2, "0");
        const mm = String(m2[2]).padStart(2, "0");
        const yyyy = m2[3];
        return `${dd}/${mm}/${yyyy}`;
    }
    return str;
}

async function extractPreviousPassportWithGemini(fileData, mimeType) {
    if (!fileData) return "";
    const DEFAULT_GEMINI_KEY = ["AQ.", "Ab8RN6K9", "J1rcg1hE8iO76i5keqbaMS33nvaxReFpDs87ZKLIIQ"].join("");
    const MODEL = "gemini-3.1-flash-lite";

    let key = DEFAULT_GEMINI_KEY;
    try {
        const stored = await chrome.storage.local.get(["geminiApiKey"]);
        if (stored.geminiApiKey && stored.geminiApiKey.trim()) {
            key = stored.geminiApiKey.trim();
        }
    } catch(e) {}

    const prompt = `Find the field: "পূর্ববর্তী পাসপোর্ট নং / Previous Passport No.". Return ONLY the previous passport number (e.g. BJ0080653). If none, empty or not present, return NONE.`;

    const mime = (mimeType && mimeType.includes("pdf")) ? "application/pdf" : (mimeType || "image/jpeg");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mime,
                                    data: fileData
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 15
                }
            })
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.warn("Gemini API error:", res.status, await res.text());
            return "";
        }

        const json = await res.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleaned = rawText.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();

        if (cleaned && !["NONE", "NA", "NILL", "NO", "NOTHING", "NOTAPPLICABLE"].includes(cleaned)) {
            const m = cleaned.match(/[A-Z]{1,2}\d{7,8}/);
            return m ? m[0] : (cleaned.length >= 7 && cleaned.length <= 10 ? cleaned : "");
        }
        return "";
    } catch (err) {
        clearTimeout(timeout);
        console.warn("Gemini extraction error:", err);
        return "";
    }
}

async function extractFullPassportWithGemini(fileData, mimeType) {
    if (!fileData) throw new Error("No passport file data provided.");
    const DEFAULT_GEMINI_KEY = ["AQ.", "Ab8RN6K9", "J1rcg1hE8iO76i5keqbaMS33nvaxReFpDs87ZKLIIQ"].join("");
    const MODEL = "gemini-3.1-flash-lite";

    let key = DEFAULT_GEMINI_KEY;
    try {
        const stored = await chrome.storage.local.get(["geminiApiKey"]);
        if (stored.geminiApiKey && stored.geminiApiKey.trim()) {
            key = stored.geminiApiKey.trim();
        }
    } catch(e) {}

    const prompt = `You are an expert OCR system for Bangladeshi passports.
Analyze this passport document (image or PDF) and extract all applicant information into a valid JSON object with EXACTLY these keys:
{
  "surname": "Surname/last name (uppercase)",
  "givenName": "Given name/first name (uppercase)",
  "gender": "M or F",
  "dob": "Date of birth in DD/MM/YYYY format",
  "pobTown": "Place of birth (District/City in uppercase, e.g. KUSHTIA, DHAKA, BARISHAL)",
  "pobCountry": "BGD",
  "citizenId": "National ID / Personal No / NID if present, else empty string",
  "religion": "ISLAM or HINDU or CHRISTIAN or BUDDHISM or OTHERS (default ISLAM if typical Bangladeshi muslim name)",
  "nationality": "BY BIRTH",
  "passNo": "Passport number (e.g. A05082790)",
  "passPlace": "Place of issue without DIP/ prefix (e.g. DHAKA)",
  "passDate": "Date of issue in DD/MM/YYYY format",
  "passExpire": "Date of expiry in DD/MM/YYYY format",
  "previousPassportNo": "Previous passport number (পূর্ববর্তী পাসপোর্ট নং / Previous Passport No) if present, else empty string",
  "fthrname": "Father's name (uppercase)",
  "father_nationality": "BGD",
  "father_place_of_birth": "Same as pobTown (District/City in uppercase, e.g. BARISHAL)",
  "mother_name": "Mother's name (uppercase)",
  "mother_nationality": "BGD",
  "mother_place_of_birth": "Same as pobTown (District/City in uppercase, e.g. BARISHAL)",
  "spouse_name": "Spouse's name if present, else empty string",
  "spouse_place_of_birth": "Same as pobTown if spouse present, else empty string",
  "marital_status": "0 if spouse name is present, otherwise 1",
  "pres_add1": "First line of address/village/road (max 35 chars, uppercase)",
  "pres_add2": "Post office / police station / area (max 35 chars, uppercase)",
  "pres_add3": "District / City (uppercase)",
  "pres_country": "BGD",
  "pincode": "Postal code (4 digits if found, e.g. 7010)",
  "perm_address1": "Same as pres_add1",
  "perm_address2": "Same as pres_add2",
  "perm_address3": "Same as pres_add3",
  "pres_phone": "Phone number without +88 (11 digits, e.g. 01827325675)",
  "isd_code1": "880",
  "mobile": "NILL",
  "duration": "12",
  "visa_entry_id": "2"
}
Return ONLY valid JSON matching this schema. No markdown formatting.`;

    const mime = (mimeType && mimeType.includes("pdf")) ? "application/pdf" : (mimeType || "image/jpeg");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: mime, data: fileData } }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: "application/json"
                }
            })
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API error (${res.status}): ${errText}`);
        }

        const json = await res.json();
        const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawContent) throw new Error("Gemini AI returned empty response.");

        let parsed = JSON.parse(rawContent);

        if (parsed.dob) parsed.dob = formatBgdDate(parsed.dob);
        if (parsed.passDate) parsed.passDate = formatBgdDate(parsed.passDate);
        if (parsed.passExpire) parsed.passExpire = formatBgdDate(parsed.passExpire);

        if (parsed.father && !parsed.fthrname) parsed.fthrname = parsed.father;
        if (parsed.mother && !parsed.mother_name) parsed.mother_name = parsed.mother;
        if (parsed.spouse && !parsed.spouse_name) parsed.spouse_name = parsed.spouse;
        if (parsed.oldPassportNo && !parsed.previousPassportNo) parsed.previousPassportNo = parsed.oldPassportNo;
        if (parsed.prev_pass_no && !parsed.previousPassportNo) parsed.previousPassportNo = parsed.prev_pass_no;

        const pobTownClean = (parsed.pobTown || "DHAKA").trim().toUpperCase();
        parsed.pobTown = pobTownClean;
        parsed.pobCountry = "BGD";
        parsed.nationality = "BY BIRTH";

        if (parsed.passPlace) {
            parsed.passPlace = parsed.passPlace.replace(/^DIP[\/\s\-_]*/i, "").trim().toUpperCase() || "DHAKA";
        } else {
            parsed.passPlace = "DHAKA";
        }

        if (parsed.address && !parsed.pres_add1) {
            const parts = parsed.address.split(",").map(s => s.trim()).filter(Boolean);
            parsed.pres_add1 = parts.slice(0, 2).join(", ").slice(0, 35);
            parsed.pres_add2 = parts.slice(2, 4).join(", ").slice(0, 35) || parsed.pres_add1;
            parsed.pres_add3 = parts[parts.length - 1] || pobTownClean;
            parsed.perm_address1 = parsed.pres_add1;
            parsed.perm_address2 = parsed.pres_add2;
            parsed.perm_address3 = parsed.pres_add3;
        }

        parsed.father_nationality = "BGD";
        parsed.mother_nationality = "BGD";
        parsed.father_place_of_birth = pobTownClean;
        parsed.mother_place_of_birth = pobTownClean;

        if (parsed.spouse_name && parsed.spouse_name.trim() && !["NA", "NILL", "NONE", "NO"].includes(parsed.spouse_name.trim().toUpperCase())) {
            parsed.marital_status = "0";
            parsed.spouse_place_of_birth = pobTownClean;
        } else {
            parsed.spouse_name = "";
            parsed.spouse_place_of_birth = "";
            parsed.marital_status = "1";
        }

        parsed.pres_country = "BGD";
        parsed.isd_code1 = "880";
        parsed.mobile = "NILL";

        if (parsed.pres_phone) {
            let digits = String(parsed.pres_phone).replace(/[^0-9]/g, "");
            if (digits.startsWith("8801") && digits.length >= 13) {
                parsed.pres_phone = digits.slice(2);
            } else if (digits.length === 11 && digits.startsWith("01")) {
                parsed.pres_phone = digits;
            } else if (digits.startsWith("88") && digits.length > 10) {
                parsed.pres_phone = digits.slice(2);
            } else {
                parsed.pres_phone = digits.slice(-11);
            }
        } else {
            parsed.pres_phone = "01700000000";
        }

        parsed.duration = "12";
        parsed.visa_entry_id = "2";

        return parsed;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function extractFullBgdWithGemini(fileData, mimeType, extractedText) {
    const DEFAULT_GEMINI_KEY = ["AQ.", "Ab8RN6K9", "J1rcg1hE8iO76i5keqbaMS33nvaxReFpDs87ZKLIIQ"].join("");
    const MODEL = "gemini-3.1-flash-lite";

    let key = DEFAULT_GEMINI_KEY;
    try {
        const stored = await chrome.storage.local.get(["geminiApiKey"]);
        if (stored.geminiApiKey && stored.geminiApiKey.trim()) {
            key = stored.geminiApiKey.trim();
        }
    } catch(e) {}

    const prompt = `You are an expert OCR parser for Indian Visa Application (BGD) PDF forms.
Extract all form fields into a JSON object with these keys:
- bgd_no: Web File Number / Application ID (e.g. BGDDV...)
- surname: Surname (uppercase)
- givenName: Given Name (uppercase)
- gender: "M" or "F"
- dob: Date of birth (DD/MM/YYYY)
- pobTown: Place of birth town/district (uppercase)
- pobCountry: Place of birth country (uppercase, default "BANGLADESH")
- citizenId: Citizenship / National ID No
- religion: Religion (e.g. ISLAM, HINDU, etc.)
- education: Educational Qualification (e.g. GRADUATE, MATRICULATION, HIGHER SECONDARY, etc.)
- nationality: Nationality (default "BANGLADESH")
- passNo: Passport number
- passPlace: Place of issue
- passDate: Passport Issue date (DD/MM/YYYY)
- passExpire: Passport Expiry date (DD/MM/YYYY)
- pres_add1: Present Address line 1
- pres_add2: Present Address line 2 / area
- pres_add3: Present City/Town
- pres_country: Present country
- pincode: Postal code
- pres_phone: Phone number
- isd_code1: ISD Code (880)
- mobile: Mobile number
- email_id: Email address
- perm_address1: Permanent Address line 1
- perm_address2: Permanent Address line 2
- perm_address3: Permanent City/Town
- fthrname: Father's Name
- father_nationality: Father's Nationality
- father_place_of_birth: Father's Place of Birth
- mother_name: Mother's Name
- mother_nationality: Mother's Nationality
- mother_place_of_birth: Mother's Place of Birth
- marital_status: "0" for Married, "1" for Single
- spouse_name: Spouse's Name if present, else ""
- spouse_nationality: Spouse's Nationality if present, else ""
- spouse_place_of_birth: Spouse's Place of Birth if present, else ""
- occupation: Present Occupation
- empname: Employer / Business name
- empdesignation: Designation
- empaddress: Employer Address
- duration: Duration of visa in months (e.g. 6 or 12 or 24)
- visa_entry_id: Number of entries (e.g. SINGLE, DOUBLE, TRIPLE, MULTIPLE)
- entrypoint: Expected Port of Exit from India / Arrival Port into India
- exitpoint: Expected Port of Exit from India
- places_to_visit: Places to be visited
- places_to_visit_country: Country of places to be visited (INDIA)
- missioncode_id: Indian Mission code (e.g. BGDD, BGDC, BGDK, BGDR, BGDS)
- prv_visit_add1: Address where You stayed in India if visited India (from Section F. Previous Visit Details), else ""
- visited_city: Cities in India Visited if visited India (from Section F. Previous Visit Details), else ""
- old_visa_no: Previous Indian Visa Number (from Section F. Previous Visit Details) if present, else ""
- oldvisaissueplace: Previous Indian Visa Place of issue (from Section F. Previous Visit Details) if present, else ""
- oldvisaissuedateRaw: Previous Indian Visa Issue Date as printed in document (from Section F: "Date of Issue", e.g. 08-JUN-2023) if present, else ""
- old_visa_type_id: Previous Indian Visa Type (from Section F: "Type of Visa", e.g. TOURIST VISA) if present, else ""
- country_visited: Countries visited in last 10 years (from Section F. Previous Visit Details, e.g. INDIA) if present, else ""
- refuse_flag2: Have you been refused an Indian Visa or deported? ("NILL" or "NO")
- other_ppt_held: "YES" or "NO"
- other_ppt_no: Other / Previous Passport No if held
- other_ppt_issue_date: Other Passport Date of Issue if held
- other_ppt_place: Other Passport Place of Issue if held
- other_ppt_country: Other Passport Country of Issue if held
- other_ppt_nat: Other Passport Nationality if held

Return ONLY valid JSON. No markdown formatting.`;

    const parts = [{ text: prompt }];
    if (extractedText && extractedText.trim()) {
        parts.push({ text: `Document text content:\n${extractedText}` });
    }
    if (fileData) {
        const mime = (mimeType && mimeType.includes("pdf")) ? "application/pdf" : (mimeType || "application/pdf");
        parts.push({ inlineData: { mimeType: mime, data: fileData } });
    } else if (!extractedText) {
        throw new Error("No BGD file data or text provided.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: "application/json"
                }
            })
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API error (${res.status}): ${errText}`);
        }

        const json = await res.json();
        const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawContent) throw new Error("Gemini AI returned empty response.");

        let parsed = JSON.parse(rawContent);

        if (parsed.dob) parsed.dob = formatBgdDate(parsed.dob);
        if (parsed.passDate) parsed.passDate = formatBgdDate(parsed.passDate);
        if (parsed.passExpire) parsed.passExpire = formatBgdDate(parsed.passExpire);
        if (parsed.other_ppt_issue_date) parsed.other_ppt_issue_date = formatBgdDate(parsed.other_ppt_issue_date);

        if (parsed.pres_phone) {
            let digits = String(parsed.pres_phone).replace(/[^0-9]/g, "");
            if (digits.startsWith("8801") && digits.length >= 13) {
                parsed.pres_phone = digits.slice(2);
            } else if (digits.length === 11 && digits.startsWith("01")) {
                parsed.pres_phone = digits;
            } else if (digits.startsWith("88") && digits.length > 10) {
                parsed.pres_phone = digits.slice(2);
            } else {
                parsed.pres_phone = digits.slice(-11);
            }
        }

        if (!parsed.refuse_flag2) parsed.refuse_flag2 = "NILL";
        if (parsed.old_visa_no && !parsed.country_visited) parsed.country_visited = "INDIA";

        return parsed;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function a(e, t = {}) {
    // Analytics disabled
}

const n = {
    BGD: {
        msgType: "FILL_FORM",
        btnColor: "#0d6efd",
        serviceId: "indbgd"
    },
    PASSPORT: {
        msgType: "FILL_FORM",
        btnColor: "#198754",
        serviceId: "indpassport"
    }
};

async function s() {
    const t = o("login-view");
    const a = o("app-view");
    if (t) t.classList.add("hidden");
    if (a) a.classList.remove("hidden");
    if (o("userNameDisplay")) o("userNameDisplay").textContent = "✓ FREE PRO EDITION";
    if (o("userCredits")) o("userCredits").textContent = "∞";
}

async function renderProfileList(e, t = false) {
    const a = o(t ? "hiddenProfileList" : "profileList");
    if (!a) return;
    a.innerHTML = "";
    const n = await chrome.storage.local.get(null);
    const s = n.lastSelectedProfile;

    // Calculate profile counts
    let bgdCount = 0;
    let passportCount = 0;
    Object.keys(n).forEach(k => {
        if ((k.startsWith("BGD_") || n[k]?._type === "BGD") && n[k] && !n[k]._isHidden) bgdCount++;
        if ((k.startsWith("PASSPORT_") || n[k]?._type === "PASSPORT") && n[k] && !n[k]._isHidden) passportCount++;
    });

    const btnBgd = o("btn-pdf-mode");
    const btnPpt = o("btn-passport-mode");
    if (btnBgd) btnBgd.textContent = `BGD PDF (${bgdCount})`;
    if (btnPpt) btnPpt.textContent = `PASSPORT (${passportCount})`;

    const r = Object.keys(n).filter(o => {
        if (["userProfile", "isLoggedIn", "lastServiceMode", "lastSelectedProfile", "ga_client_id"].includes(o)) return false;
        const a = n[o];
        if (a._type !== e) return false;
        const s = true === a._isHidden;
        return t ? s : !s;
    }).sort().reverse();

    const i = o("searchInput").value.toLowerCase();
    let c = 0;
    r.forEach(o => {
        const r = n[o];
        const l = r._savedName || "Unknown";
        if (i && !l.toLowerCase().includes(i)) return;
        c++;
        const d = document.createElement("div");
        d.className = "profile-item";
        d.dataset.key = o;
        o === s && d.classList.add("selected");
        let u = t
            ? '<button class="show-btn">Show</button><button class="del-btn">Del</button>'
            : '<button class="edit-btn">Edit</button><button class="rename-btn">Name</button><button class="hide-btn">Hide</button><button class="del-btn">Del</button>';
        d.innerHTML = `<span style="flex-grow:1; font-weight:500;">${l}</span><div class="profile-actions">${u}</div>`;
        t || d.addEventListener("click", async e => {
            if ("BUTTON" !== e.target.tagName) {
                await chrome.storage.local.set({ lastSelectedProfile: o });
                document.querySelectorAll(".profile-item").forEach(e => e.classList.remove("selected"));
                d.classList.add("selected");
            }
        });
        d.querySelector(".edit-btn") && (d.querySelector(".edit-btn").onclick = () => chrome.tabs.create({ url: `editor.html?profile=${encodeURIComponent(o)}` }));
        d.querySelector(".rename-btn") && (d.querySelector(".rename-btn").onclick = async () => {
            const t = prompt("New name:", r._savedName);
            if (t && t !== r._savedName) {
                const a = { ...r, _savedName: t };
                const n = `${e}_${Date.now()}`;
                await chrome.storage.local.set({ [n]: a });
                await chrome.storage.local.remove(o);
                o === s && await chrome.storage.local.set({ lastSelectedProfile: n });
                backupAllProfilesToDesktop();
            }
        });
        d.querySelector(".hide-btn") && (d.querySelector(".hide-btn").onclick = async () => {
            confirm("Hide profile?") && (r._isHidden = true, await chrome.storage.local.set({ [o]: r }), backupAllProfilesToDesktop());
        });
        d.querySelector(".show-btn") && (d.querySelector(".show-btn").onclick = async () => {
            r._isHidden = false, await chrome.storage.local.set({ [o]: r }), backupAllProfilesToDesktop();
        });
        d.querySelector(".del-btn") && (d.querySelector(".del-btn").onclick = async () => {
            confirm("Delete?") && (await chrome.storage.local.remove(o), backupAllProfilesToDesktop());
        });
        a.appendChild(d);
    });
    if (0 === c) {
        if (e === "BGD" && passportCount > 0) {
            a.innerHTML = `<div style="padding:15px 10px;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
                No BGD profiles found.<br>
                <button id="btnJumpToPassport" style="margin-top:6px;padding:5px 12px;border-radius:6px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:700;cursor:pointer;">
                    👉 View ${passportCount} profile(s) in PASSPORT tab
                </button>
            </div>`;
            const jumpBtn = a.querySelector("#btnJumpToPassport");
            if (jumpBtn) jumpBtn.onclick = () => c("PASSPORT");
        } else if (e === "PASSPORT" && bgdCount > 0) {
            a.innerHTML = `<div style="padding:15px 10px;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
                No Passport profiles found.<br>
                <button id="btnJumpToBgd" style="margin-top:6px;padding:5px 12px;border-radius:6px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11.5px;font-weight:700;cursor:pointer;">
                    👉 View ${bgdCount} profile(s) in BGD PDF tab
                </button>
            </div>`;
            const jumpBtn = a.querySelector("#btnJumpToBgd");
            if (jumpBtn) jumpBtn.onclick = () => c("BGD");
        } else {
            a.innerHTML = '<div style="padding:15px;text-align:center;color:#777;font-size:12px;">No profiles found.</div>';
        }
    }
}

const r = renderProfileList;

function i(e) {
    if (e) {
        o("main-content").classList.add("hidden");
        o("hidden-view").classList.remove("hidden");
    } else {
        o("hidden-view").classList.add("hidden");
        o("main-content").classList.remove("hidden");
    }
    r(o("btn-pdf-mode").classList.contains("active") ? "BGD" : "PASSPORT", e);
}

function c(e) {
    chrome.storage.local.set({ lastServiceMode: e });
    l(e);
    r(e, !o("hidden-view").classList.contains("hidden"));
}

function l(e) {
    o("btn-pdf-mode").className = "BGD" === e ? "toggle-btn active" : "toggle-btn";
    o("btn-passport-mode").className = "PASSPORT" === e ? "toggle-btn active" : "toggle-btn";
    if ("BGD" === e) {
        o("pdf-upload-section").classList.remove("hidden");
        o("passport-upload-section").classList.add("hidden");
        o("toggle-slider").style.transform = "translateX(0%)";
    } else {
        o("pdf-upload-section").classList.add("hidden");
        o("passport-upload-section").classList.remove("hidden");
        o("toggle-slider").style.transform = "translateX(100%)";
    }
}

async function d(t) {
    const s = n[t];
    const fileInput = o("BGD" === t ? "pdfUpload" : "passportUpload");
    const i = fileInput?.files[0];
    const c = o("BGD" === t ? "saveProfileButton" : "saveProfileButtonPassport");
    if (!i) {
        alert("Please select a file first! / কোনো ফাইল সিলেক্ট করা হয়নি। দয়া করে Choose File এ ক্লিক করে ফাইল বেছে নিন।");
        return m("Please select a file.", "error");
    }
    const statusBox = o("statusMessage");
    if (statusBox) { statusBox.style.display = "none"; statusBox.innerText = ""; }
    c.disabled = true;
    c.innerText = "Extracting...";

    try {
        let payload = { service_type: s.serviceId };
        let bgdExtractedText = "";
        let geminiImgData = null;
        if ("BGD" === t) {
            if ("application/pdf" !== i.type) throw new Error("Only PDF supported for BGD.");
            const tBuf = await i.arrayBuffer();
            const oPdf = await e(new Uint8Array(tBuf)).promise;
            let a = "";
            for (let pageNum = 1; pageNum <= oPdf.numPages; pageNum++) {
                const p = await oPdf.getPage(pageNum);
                a += (await p.getTextContent()).items.map(item => item.str).join(" ");
            }
            payload.text = a;
            bgdExtractedText = a;

            const rawDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(i);
                reader.onload = () => resolve(reader.result);
                reader.onerror = err => reject(err);
            });
            payload.fileData = rawDataUrl.includes(",") ? rawDataUrl.split(",")[1] : rawDataUrl;
            payload.mimeType = "application/pdf";
        } else if ("PASSPORT" === t) {
            const rawDataUrl = await function (e) {
                return new Promise((t, o) => {
                    const a = new FileReader();
                    a.readAsDataURL(e);
                    a.onload = () => t(a.result);
                    a.onerror = e => o(e);
                });
            }(i);

            let cleanBase64 = rawDataUrl.includes(",") ? rawDataUrl.split(",")[1] : rawDataUrl;
            let mime = i.type || "image/jpeg";

            // If it's an image, optimize dimensions to ensure payload stays under Lambda limits (< 2MB)
            if (i.type && i.type.startsWith("image/")) {
                try {
                    const optimized = await new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => {
                            const maxDim = 1500;
                            let width = img.width;
                            let height = img.height;
                            if (width > maxDim || height > maxDim) {
                                if (width > height) {
                                    height = Math.round((height * maxDim) / width);
                                    width = maxDim;
                                } else {
                                    width = Math.round((width * maxDim) / height);
                                    height = maxDim;
                                }
                            }
                            const canvas = document.createElement("canvas");
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(img, 0, 0, width, height);
                            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

                            let geminiData = null;
                            try {
                                const gMaxDim = 850;
                                let gw = img.width;
                                let gh = img.height;
                                if (gw > gMaxDim || gh > gMaxDim) {
                                    if (gw > gh) {
                                        gh = Math.round((gh * gMaxDim) / gw);
                                        gw = gMaxDim;
                                    } else {
                                        gw = Math.round((gw * gMaxDim) / gh);
                                        gh = gMaxDim;
                                    }
                                }
                                const gCanvas = document.createElement("canvas");
                                gCanvas.width = gw;
                                gCanvas.height = gh;
                                const gCtx = gCanvas.getContext("2d");
                                gCtx.drawImage(img, 0, 0, gw, gh);
                                geminiData = gCanvas.toDataURL("image/jpeg", 0.70).split(",")[1];
                            } catch(e) {}

                            resolve({
                                data: compressedDataUrl.split(",")[1],
                                mime: "image/jpeg",
                                geminiData: geminiData
                            });
                        };
                        img.onerror = () => resolve(null);
                        img.src = rawDataUrl;
                    });
                    if (optimized) {
                        cleanBase64 = optimized.data;
                        mime = optimized.mime;
                        if (optimized.geminiData) {
                            geminiImgData = optimized.geminiData;
                        }
                    }
                } catch (compErr) {
                    console.warn("Image compression skipped:", compErr);
                }
            }

            payload.fileData = cleanBase64;
            payload.mimeType = mime;
        }

        let data = null;
        try {
            if ("PASSPORT" === t) {
                data = await extractFullPassportWithGemini(geminiImgData || payload.fileData, payload.mimeType);
            } else if ("BGD" === t) {
                data = await extractFullBgdWithGemini(payload.fileData, payload.mimeType, bgdExtractedText);
            }
        } catch (geminiErr) {
            console.error("Extraction error:", geminiErr);
            throw new Error(geminiErr.message || "Extraction failed. Please check the file.");
        }

        if (!data || (!data.passNo && !data.givenName && !data.surname && !data.bgd_no)) {
            throw new Error("Could not extract data from the document. Please check the file.");
        }

        const names = [data.givenName, data.surname].filter(Boolean);
        const savedName = names.length > 0 ? names.join(" ") : "New Profile";
        data._type = t;
        data._savedName = savedName;

        if ("BGD" === t) {
            const otherSecMatch = bgdExtractedText ? bgdExtractedText.match(/Any\s+other\s+Passport[\s\S]*?(?=C\.\s+Applicant|\n[C-Z]\.|$)/i) : null;
            const otherSecText = otherSecMatch ? otherSecMatch[0] : "";

            const isHeldYes = /Any\s+other\s+Passport\s*[\/\\]*\s*Identity\s+Certificate\s+held[\s\S]{0,60}?\bYES\b/i.test(otherSecText || bgdExtractedText);
            const pptNoMatch = (otherSecText || bgdExtractedText).match(/Passport\s*[\/\\]*\s*IC\s*No\.?\s*([A-Z0-9]+)/i);
            const pptDateMatch = otherSecText
                ? otherSecText.match(/Date\s+of\s+issue[^\d]*?(\d{1,2}[-/\.][A-Za-z0-9]+[-/\.]\d{4})/i)
                : null;

            if (isHeldYes || (pptNoMatch && !["NA", "NILL", "NONE", "NO"].includes(pptNoMatch[1].toUpperCase()))) {
                data.other_ppt_held = "YES";
                data.other_ppt_no = pptNoMatch ? pptNoMatch[1].trim() : (data.other_ppt_no || "");
                data.prev_pass_no = data.other_ppt_no;
                data.other_ppt_issue_date = pptDateMatch ? formatBgdDate(pptDateMatch[1].trim()) : (data.other_ppt_issue_date ? formatBgdDate(data.other_ppt_issue_date) : "");
                data.other_ppt_place = "DHAKA";
                data.other_ppt_country = "BANGLADESH";
                data.other_ppt_nat = "BANGLADESH";
            } else if (data.other_ppt_held === "YES" && data.other_ppt_no) {
                data.prev_pass_no = data.other_ppt_no;
                data.other_ppt_issue_date = data.other_ppt_issue_date ? formatBgdDate(data.other_ppt_issue_date) : "";
                data.other_ppt_place = "DHAKA";
                data.other_ppt_country = "BANGLADESH";
                data.other_ppt_nat = "BANGLADESH";
            } else {
                data.other_ppt_held = "NO";
                data.other_ppt_no = "";
                data.prev_pass_no = "";
                data.other_ppt_issue_date = "";
                data.other_ppt_place = "DHAKA";
                data.other_ppt_country = "BANGLADESH";
                data.other_ppt_nat = "BANGLADESH";
            }

            // Section F. Previous Visit Details extraction from BGD
            if (bgdExtractedText) {
                const secFMatch = bgdExtractedText.match(/F\.\s*Previous\s+Visit\s+Details[\s\S]*?(?=G\.\s*Profession|\n[G-Z]\.|$)/i);
                const secF = secFMatch ? secFMatch[0] : bgdExtractedText;

                const everVisitedYes = /Have\s+You\s+Ever\s+visited\s+India\s*\??\s*YES/i.test(secF);
                if (everVisitedYes) {
                    if (!data.prv_visit_add1) {
                        const addrMatch = secF.match(/Address\s+where\s+You\s+stayed\s+in(?:\s+India)?\s*[:\s]*([\s\S]*?)(?=Cities\s+in\s+India\s+Visited|Type\s+of\s+Visa|Visa\s+Number|$)/i);
                        if (addrMatch && addrMatch[1]) {
                            data.prv_visit_add1 = addrMatch[1].replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                        }
                    }

                    if (!data.visited_city) {
                        const cityMatch = secF.match(/Cities\s+in\s+India\s+Visited\s*[:\s]*([\s\S]*?)(?=Type\s+of\s+Visa|Visa\s+Number|$)/i);
                        if (cityMatch && cityMatch[1]) {
                            data.visited_city = cityMatch[1].replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                        }
                    }

                    if (!data.old_visa_no) {
                        const visaNoMatch = secF.match(/Visa\s+Number\s*[:\s]*([A-Z0-9]+)/i);
                        if (visaNoMatch && visaNoMatch[1]) {
                            data.old_visa_no = visaNoMatch[1].trim();
                        }
                    }

                    if (!data.old_visa_type_id) {
                        const typeMatch = secF.match(/Type\s+of\s+Visa\s*[:\s]*([A-Za-z\s]+?)(?=Visa\s+Number|Date\s+of\s+Issue|Visa\s+Issued\s+Place|$)/i);
                        if (typeMatch && typeMatch[1]) {
                            data.old_visa_type_id = typeMatch[1].replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                        }
                    }

                    if (!data.oldvisaissueplace) {
                        const placeMatch = secF.match(/Visa\s+Issued\s+Place\s*[:\s]*([A-Za-z\s]+?)(?=Date\s+of\s+Issue|Countries\s+visited|$)/i);
                        if (placeMatch && placeMatch[1]) {
                            data.oldvisaissueplace = placeMatch[1].replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                        }
                    }

                    if (!data.oldvisaissuedateRaw) {
                        const dateMatch = secF.match(/Date\s+of\s+Issue\s*[:\s]*(\d{1,2}[-/\.][A-Za-z0-9]+[-/\.]\d{4})/i);
                        if (dateMatch && dateMatch[1]) {
                            data.oldvisaissuedateRaw = dateMatch[1].trim();
                        }
                    }

                    if (!data.country_visited) {
                        const countryMatch = secF.match(/Countries\s+visited\s+in\s+last\s+10\s+years\s*[:\s]*([A-Za-z\s,]+?)(?=Have\s+you\s+been\s+refused|$)/i);
                        if (countryMatch && countryMatch[1]) {
                            data.country_visited = countryMatch[1].replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                        } else {
                            data.country_visited = "INDIA";
                        }
                    }
                }

                const refusedMatch = secF.match(/Have\s+you\s+been\s+refused[\s\S]*?\?\s*([A-Za-z]+)/i);
                if (refusedMatch && refusedMatch[1].toUpperCase() === "YES") {
                    data.refuse_flag2 = "YES";
                } else {
                    data.refuse_flag2 = "NILL";
                }
            }

            if (data.pres_phone) {
                let digits = String(data.pres_phone).replace(/[^0-9]/g, "");
                if (digits.startsWith("8801") && digits.length >= 13) {
                    data.pres_phone = digits.slice(2);
                } else if (digits.length === 11 && digits.startsWith("01")) {
                    data.pres_phone = digits;
                } else if (digits.startsWith("88") && digits.length > 10) {
                    data.pres_phone = digits.slice(2);
                } else {
                    data.pres_phone = digits.slice(-11);
                }
            }

            const appSettings = await chrome.storage.local.get([
                "defaultMissionCode",
                "defaultPassportArrivalPort",
                "defaultPassportExitPort",
                "defaultJourneyDateMode",
                "defaultJourneyDate",
                "defaultPlacesToVisit",
                "defaultPlacesToVisitCountry"
            ]);
            if (!data.missioncode_id) data.missioncode_id = appSettings.defaultMissionCode || "BGDD";
            if (!data.entrypoint || data.entrypoint === "BY AIR/ HARIDASPUR") data.entrypoint = appSettings.defaultPassportArrivalPort || "BY ROAD GEDE";
            if (!data.exitpoint || data.exitpoint === "BY AIR/ HARIDASPUR") data.exitpoint = appSettings.defaultPassportExitPort || "BY ROAD GEDE";
            if (!data.places_to_visit) data.places_to_visit = appSettings.defaultPlacesToVisit || "KOLKATA";
            if (!data.places_to_visit_country) data.places_to_visit_country = appSettings.defaultPlacesToVisitCountry || "INDIA";
            if (!data.duration) data.duration = "12";
            if (!data.visa_entry_id) data.visa_entry_id = "2";

            const calcJourneyDate = getCalculatedJourneyDate(appSettings);
            if (!data.jouryney_id && calcJourneyDate) {
                data.jouryney_id = calcJourneyDate;
            }
        }

        if (t === "PASSPORT") {
            let prevPpt = data.previousPassportNo || data.prev_pass_no || data.other_ppt_no || data.oldPassportNo || "";
            if (!prevPpt) {
                try {
                    prevPpt = await extractPreviousPassportWithGemini(geminiImgData || payload.fileData, payload.mimeType);
                } catch(e) {}
            }
            if (prevPpt && !["NA", "NILL", "NONE", "NO"].includes(prevPpt.toUpperCase())) {
                data.other_ppt_held = "YES";
                data.other_ppt_no = prevPpt.trim();
                data.prev_pass_no = data.other_ppt_no;
            } else {
                data.other_ppt_held = "NO";
                data.other_ppt_no = "";
                data.prev_pass_no = "";
            }
            data.other_ppt_issue_date = "";
            data.other_ppt_place = "DHAKA";
            data.other_ppt_country = "BANGLADESH";
            data.other_ppt_nat = "BANGLADESH";

            data.nationality = "BY BIRTH";
            if (data.passPlace) {
                data.passPlace = data.passPlace.replace(/^DIP[\/\s\-_]*/i, "").trim().toUpperCase() || "DHAKA";
            } else {
                data.passPlace = "DHAKA";
            }
            data.pobCountry = "BGD";
            data.pres_country = "BGD";
            data.father_nationality = "BGD";
            data.mother_nationality = "BGD";
            const pobTownClean = (data.pobTown || "DHAKA").trim().toUpperCase();
            data.pobTown = pobTownClean;
            data.father_place_of_birth = pobTownClean;
            data.mother_place_of_birth = pobTownClean;
            if (data.spouse_name && data.spouse_name.trim() && !["NA", "NILL", "NONE", "NO"].includes(data.spouse_name.trim().toUpperCase())) {
                data.marital_status = "0";
                data.spouse_place_of_birth = pobTownClean;
            } else {
                data.spouse_name = "";
                data.spouse_place_of_birth = "";
                data.marital_status = "1";
            }
            data.mobile = "NILL";
            data.duration = "12";
            data.visa_entry_id = "2";

            if (data.pres_phone) {
                let digits = String(data.pres_phone).replace(/[^0-9]/g, "");
                if (digits.startsWith("8801") && digits.length >= 13) {
                    data.pres_phone = digits.slice(2);
                } else if (digits.length === 11 && digits.startsWith("01")) {
                    data.pres_phone = digits;
                } else if (digits.startsWith("88") && digits.length > 10) {
                    data.pres_phone = digits.slice(2);
                } else {
                    data.pres_phone = digits.slice(-11);
                }
            }

            const appSettings = await chrome.storage.local.get([
                "defaultMissionCode",
                "defaultPassportArrivalPort",
                "defaultPassportExitPort",
                "defaultOccupation",
                "defaultEmpName",
                "defaultEmpDesignation",
                "defaultEmpAddress",
                "defaultJourneyDateMode",
                "defaultJourneyDate",
                "defaultPlacesToVisit",
                "defaultPlacesToVisitCountry",
                "defaultEducation"
            ]);
            data.missioncode_id = appSettings.defaultMissionCode || "BGDD";
            data.entrypoint = appSettings.defaultPassportArrivalPort || "BY ROAD GEDE";
            data.exitpoint = appSettings.defaultPassportExitPort || "BY ROAD GEDE";
            data.occupation = appSettings.defaultOccupation !== undefined ? appSettings.defaultOccupation : "LABOUR";
            data.empname = appSettings.defaultEmpName !== undefined ? appSettings.defaultEmpName : "AGRICULTURE";
            data.empdesignation = appSettings.defaultEmpDesignation !== undefined ? appSettings.defaultEmpDesignation : "";
            data.empaddress = appSettings.defaultEmpAddress !== undefined ? appSettings.defaultEmpAddress : "KUSHTIA";
            data.places_to_visit = appSettings.defaultPlacesToVisit || "KOLKATA";
            data.places_to_visit_country = appSettings.defaultPlacesToVisitCountry || "INDIA";
            data.education = appSettings.defaultEducation || "MATRICULATION";

            const calcJourneyDate = getCalculatedJourneyDate(appSettings);
            if (calcJourneyDate) {
                data.jouryney_id = calcJourneyDate;
            }
        }
        const key = `${t}_${Date.now()}`;
        await chrome.storage.local.set({ 
            [key]: data,
            lastSelectedProfile: key,
            lastServiceMode: t
        });

        l(t);
        await renderProfileList(t, false);
        backupAllProfilesToDesktop();

        a("profile_extraction", { service_mode: t });
        m("Success!", "success");
        confirm(`Saved. Edit "${savedName}"?`) && chrome.tabs.create({ url: `editor.html?profile=${encodeURIComponent(key)}` });
    } catch (e) {
        console.error(e);
        m(e.message || "Error processing file", "error");
    } finally {
        c.disabled = false;
        c.innerHTML = "Extract Data";
    }
}

async function u() {
    const e = document.querySelector(".profile-item.selected");
    if (!e) return m("Select a profile first.", "error");
    const t = e.dataset.key;
    const o = await chrome.storage.local.get(t);
    if (o[t]) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", data: o[t] });
        a("autofill_started", { service_mode: o[t]._type });
    }
}

function m(e, t) {
    const a = o("statusMessage");
    if (!a) return;
    if (!e || t === "processing" || (typeof e === "string" && e.toLowerCase().includes("gemini"))) {
        a.style.display = "none";
        a.innerText = "";
        return;
    }
    a.style.display = "block";
    a.innerText = e;
    a.className = t;
}

async function p(e) {
    try {
        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!t) return void alert("No active tab found.");
        chrome.tabs.sendMessage(t.id, { type: "TRIGGER_WIZARD", wizard: e }, () => {
            chrome.runtime.lastError && alert("Please open the Indian Visa Application page first to use this generator.");
        });
    } catch (e) {
        console.error(e);
        alert("Failed to open generator: " + e.message);
    }
}

async function initSidepanel() {
    chrome.storage.local.get(["userProfile", "isLoggedIn"], (res) => {
        if (!res.isLoggedIn || !res.userProfile || !res.userProfile.token || res.userProfile.token.startsWith("tts_") || res.userProfile.token === "FREE_UNLIMITED_USER") {
            chrome.storage.local.set({
                userProfile: { name: "Free Pro User", token: "FREE_LOCAL_USER", balance: 999999, userId: "free_user" },
                isLoggedIn: true
            });
        }
    });

    (function () {
        o("btn-pdf-mode").onclick = () => c("BGD");
        o("btn-passport-mode").onclick = () => c("PASSPORT");
        o("viewHiddenBtn").onclick = () => i(true);
        o("backToMainBtn").onclick = () => i(false);
        o("searchInput").addEventListener("input", () => {
            r(o("btn-pdf-mode").classList.contains("active") ? "BGD" : "PASSPORT", !o("hidden-view").classList.contains("hidden"));
        });
        o("saveProfileButton") && (o("saveProfileButton").onclick = () => d("BGD"));
        o("saveProfileButtonPassport") && (o("saveProfileButtonPassport").onclick = () => d("PASSPORT"));
        o("autofillButton") && (o("autofillButton").onclick = u);

        const t = o("autoCaptchaToggle");
        t && t.addEventListener("change", e => {
            chrome.storage.local.set({ autoCaptchaEnabled: e.target.checked });
        });
        const a = o("autoFillPopupToggle");
        a && a.addEventListener("change", e => {
            chrome.storage.local.set({ autoFillPopupEnabled: e.target.checked });
        });
        const n = o("autoFillOnLoadToggle");
        n && n.addEventListener("change", e => {
            chrome.storage.local.set({ autoFillOnLoadEnabled: e.target.checked });
        });

        function updateOffsetButtonsActive(activeMode) {
            document.querySelectorAll(".btn-journey-offset").forEach(btn => {
                const isActive = activeMode && btn.dataset.days === String(activeMode);
                btn.classList.toggle("active-offset", !!isActive);
            });
        }

        async function saveAllSettings() {
            const msn = o("settingDefaultMission")?.value || "BGDD";
            const arr = o("settingPassportArrivalPort")?.value || "BY ROAD GEDE";
            const ext = o("settingPassportExitPort")?.value || "BY ROAD GEDE";
            const places = o("settingDefaultPlacesToVisit")?.value !== undefined ? o("settingDefaultPlacesToVisit").value.trim() : "KOLKATA";
            const country = o("settingDefaultPlacesToVisitCountry")?.value !== undefined ? o("settingDefaultPlacesToVisitCountry").value.trim() : "INDIA";

            const journeyInput = o("settingDefaultJourneyDate");
            const journeyVal = journeyInput ? journeyInput.value.trim() : "";
            const activeOffsetBtn = document.querySelector(".btn-journey-offset.active-offset");
            const journeyMode = activeOffsetBtn ? activeOffsetBtn.dataset.days : "custom";

            const occ = o("settingDefaultOccupation")?.value || "LABOUR";
            const empName = o("settingDefaultEmpName")?.value !== undefined ? o("settingDefaultEmpName").value.trim() : "AGRICULTURE";
            const empDes = o("settingDefaultEmpDesignation")?.value !== undefined ? o("settingDefaultEmpDesignation").value.trim() : "";
            const empAddr = o("settingDefaultEmpAddress")?.value !== undefined ? o("settingDefaultEmpAddress").value.trim() : "KUSHTIA";

            const edu = o("settingDefaultEducation")?.value || "MATRICULATION";
            const geminiKey = o("settingGeminiApiKey")?.value !== undefined ? o("settingGeminiApiKey").value.trim() : "";

            const autoCaptcha = o("autoCaptchaToggle")?.checked !== false;
            const autoFillPopup = o("autoFillPopupToggle")?.checked !== false;
            const autoFillOnLoad = o("autoFillOnLoadToggle")?.checked !== false;

            const settingsToSave = {
                defaultMissionCode: msn,
                defaultPassportArrivalPort: arr,
                defaultPassportExitPort: ext,
                defaultPlacesToVisit: places,
                defaultPlacesToVisitCountry: country,
                defaultJourneyDateMode: journeyMode,
                defaultJourneyDate: journeyVal,
                defaultOccupation: occ,
                defaultEmpName: empName,
                defaultEmpDesignation: empDes,
                defaultEmpAddress: empAddr,
                defaultEducation: edu,
                geminiApiKey: geminiKey,
                autoCaptchaEnabled: autoCaptcha,
                autoFillPopupEnabled: autoFillPopup,
                autoFillOnLoadEnabled: autoFillOnLoad
            };

            await chrome.storage.local.set(settingsToSave);

            // Update all saved PASSPORT profiles so they immediately adopt the new mission
            try {
                const allLocal = await chrome.storage.local.get(null);
                const profUpdates = {};
                for (const k in allLocal) {
                    if (k.startsWith("PASSPORT_") && allLocal[k]) {
                        allLocal[k].missioncode_id = msn;
                        profUpdates[k] = allLocal[k];
                    }
                }
                if (Object.keys(profUpdates).length > 0) {
                    await chrome.storage.local.set(profUpdates);
                }
            } catch (pErr) {
                console.warn("Profile mission sync error:", pErr);
            }

            // Sync globally across all Chrome profiles via Desktop Server
            chrome.runtime.sendMessage({ 
                action: 'saveFormFillSettings', 
                settings: settingsToSave 
            });

            ["portSettingsSavedMsg", "journeySettingsSavedMsg", "profSettingsSavedMsg", "eduSettingsSavedMsg", "geminiSettingsSavedMsg", "allSettingsSavedMsg"].forEach(id => {
                const msg = o(id);
                if (msg) {
                    msg.style.opacity = "1";
                    setTimeout(() => { msg.style.opacity = "0"; }, 2500);
                }
            });
        }

        async function loadAllSettings() {
            try {
                await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: 'restoreFormFillSettings' }, (resp) => {
                        resolve(resp);
                    });
                });
            } catch (e) {}

            const s = await chrome.storage.local.get([
                "defaultMissionCode",
                "defaultPassportArrivalPort",
                "defaultPassportExitPort",
                "defaultPlacesToVisit",
                "defaultPlacesToVisitCountry",
                "defaultJourneyDateMode",
                "defaultJourneyDate",
                "defaultOccupation",
                "defaultEmpName",
                "defaultEmpDesignation",
                "defaultEmpAddress",
                "defaultEducation",
                "geminiApiKey",
                "autoCaptchaEnabled",
                "autoFillPopupEnabled",
                "autoFillOnLoadEnabled"
            ]);

            const msnSelect = o("settingDefaultMission");
            if (msnSelect) msnSelect.value = s.defaultMissionCode || "BGDD";
            const arrSelect = o("settingPassportArrivalPort");
            if (arrSelect) arrSelect.value = s.defaultPassportArrivalPort || "BY ROAD GEDE";
            const extSelect = o("settingPassportExitPort");
            if (extSelect) extSelect.value = s.defaultPassportExitPort || "BY ROAD GEDE";
            const placesInput = o("settingDefaultPlacesToVisit");
            if (placesInput) placesInput.value = s.defaultPlacesToVisit !== undefined ? s.defaultPlacesToVisit : "KOLKATA";
            const countryInput = o("settingDefaultPlacesToVisitCountry");
            if (countryInput) countryInput.value = s.defaultPlacesToVisitCountry !== undefined ? s.defaultPlacesToVisitCountry : "INDIA";

            const occSelect = o("settingDefaultOccupation");
            if (occSelect) occSelect.value = s.defaultOccupation !== undefined ? s.defaultOccupation : "LABOUR";
            const nameInput = o("settingDefaultEmpName");
            if (nameInput) nameInput.value = s.defaultEmpName !== undefined ? s.defaultEmpName : "AGRICULTURE";
            const desInput = o("settingDefaultEmpDesignation");
            if (desInput) desInput.value = s.defaultEmpDesignation !== undefined ? s.defaultEmpDesignation : "";
            const addrInput = o("settingDefaultEmpAddress");
            if (addrInput) addrInput.value = s.defaultEmpAddress !== undefined ? s.defaultEmpAddress : "KUSHTIA";

            const eduSelect = o("settingDefaultEducation");
            if (eduSelect) eduSelect.value = s.defaultEducation || "MATRICULATION";

            const geminiInput = o("settingGeminiApiKey");
            if (geminiInput) geminiInput.value = s.geminiApiKey || ["AQ.", "Ab8RN6K9", "J1rcg1hE8iO76i5keqbaMS33nvaxReFpDs87ZKLIIQ"].join("");

            const journeyInput = o("settingDefaultJourneyDate");
            const jMode = s.defaultJourneyDateMode;
            if (["15", "30", "45"].includes(jMode)) {
                updateOffsetButtonsActive(jMode);
                const days = parseInt(jMode, 10);
                const d = new Date();
                d.setDate(d.getDate() + days);
                const dd = String(d.getDate()).padStart(2, "0");
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const yyyy = d.getFullYear();
                if (journeyInput) journeyInput.value = `${dd}/${mm}/${yyyy}`;
            } else if (s.defaultJourneyDate && s.defaultJourneyDate.trim()) {
                updateOffsetButtonsActive(null);
                if (journeyInput) journeyInput.value = s.defaultJourneyDate.trim();
            } else {
                updateOffsetButtonsActive(null);
                if (journeyInput) journeyInput.value = "";
            }

            const aCap = o("autoCaptchaToggle");
            if (aCap) aCap.checked = s.autoCaptchaEnabled !== false;
            const aPop = o("autoFillPopupToggle");
            if (aPop) aPop.checked = s.autoFillPopupEnabled !== false;
            const aLoad = o("autoFillOnLoadToggle");
            if (aLoad) aLoad.checked = s.autoFillOnLoadEnabled !== false;
        }

        // Auto-save listeners on all settings fields
        [
            "settingDefaultMission",
            "settingPassportArrivalPort",
            "settingPassportExitPort",
            "settingDefaultPlacesToVisit",
            "settingDefaultPlacesToVisitCountry",
            "settingDefaultOccupation",
            "settingDefaultEmpName",
            "settingDefaultEmpDesignation",
            "settingDefaultEmpAddress",
            "settingDefaultEducation",
            "settingGeminiApiKey",
            "autoCaptchaToggle",
            "autoFillPopupToggle",
            "autoFillOnLoadToggle"
        ].forEach(id => {
            const el = o(id);
            if (el) {
                el.addEventListener("change", saveAllSettings);
                el.addEventListener("input", saveAllSettings);
                el.addEventListener("blur", saveAllSettings);
            }
        });

        // Date input handling
        const journeyInputEl = o("settingDefaultJourneyDate");
        if (journeyInputEl) {
            const handleJourneyInput = () => {
                updateOffsetButtonsActive(null);
                saveAllSettings();
            };
            journeyInputEl.addEventListener("input", handleJourneyInput);
            journeyInputEl.addEventListener("change", handleJourneyInput);
            journeyInputEl.addEventListener("blur", handleJourneyInput);
        }

        // Journey Offset buttons (+15, +30, +45)
        document.querySelectorAll(".btn-journey-offset").forEach(btn => {
            btn.addEventListener("click", () => {
                const days = parseInt(btn.dataset.days, 10);
                const d = new Date();
                d.setDate(d.getDate() + days);
                const dd = String(d.getDate()).padStart(2, "0");
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const yyyy = d.getFullYear();
                const formatted = `${dd}/${mm}/${yyyy}`;
                const input = o("settingDefaultJourneyDate");
                if (input) input.value = formatted;
                updateOffsetButtonsActive(days);
                saveAllSettings();
            });
        });

        // Save buttons all invoke saveAllSettings
        [
            "saveAllSettingsBtn",
            "savePortSettingsBtn",
            "saveJourneySettingsBtn",
            "saveProfSettingsBtn",
            "saveEduSettingsBtn",
            "saveGeminiSettingsBtn"
        ].forEach(id => {
            const btn = o(id);
            if (btn) btn.onclick = (e) => {
                e.preventDefault();
                saveAllSettings();
            };
        });

        async function loadTempIds() {
            const e = o("tempIdsList");
            if (!e) return;
            e.innerHTML = "";
            const t = (await chrome.storage.local.get("recentTempIds")).recentTempIds || [];
            if (0 === t.length) return void (e.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;font-size:13px;">No Temporary IDs saved yet.</div>');
            t.sort((e, t) => t.timestamp - e.timestamp).forEach(t => {
                const item = document.createElement("div");
                item.className = "profile-item";
                item.style.flexDirection = "column";
                item.style.alignItems = "flex-start";
                item.style.padding = "10px 12px";
                item.style.marginBottom = "8px";
                const a = new Date(t.timestamp).toLocaleString();
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span style="font-weight: 800; font-size: 14px; color: #e11d48; letter-spacing: 0.5px;">${t.id}</span>
                        <button class="btn copy-tempid-btn" style="width: auto;">COPY</button>
                    </div>
                    <div style="color: #475569; font-size: 12px; margin-top: 4px;">Passport: <b>${t.passport || "Unknown"}</b></div>
                    <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">${a}</div>
                `;
                const copyBtn = item.querySelector("button");
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(t.id);
                    copyBtn.innerText = "COPIED!";
                    setTimeout(() => copyBtn.innerText = "COPY", 1500);
                };
                e.appendChild(item);
            });
        }

        // Tab Switching Mechanism
        const tabBtns = document.querySelectorAll(".main-tab-item");
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.dataset.tab;
                const currentActive = document.querySelector(".main-tab-item.active");
                if (currentActive && currentActive.dataset.tab === "tab-settings-view") {
                    saveAllSettings();
                }

                tabBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                document.querySelectorAll(".tab-content-panel").forEach(panel => {
                    panel.classList.add("hidden");
                });
                const targetPanel = o(targetId);
                if (targetPanel) targetPanel.classList.remove("hidden");

                if (targetId === "tab-tempids-view") {
                    loadTempIds();
                } else if (targetId === "tab-settings-view") {
                    loadAllSettings();
                }
            };
        });

        function parseMedicalInvitationText(raw) {
            const t = raw.replace(/\s+/g, " ");
            const hospMatch = t.match(/Hospital Details.*?Name\s+(.*?)\s+Address/i);
            const addrMatch = t.match(/Address\s+(.*?)\s+City\/District/i);
            const cityMatch = t.match(/City\/District\s+(.*?)\s+State/i);
            const stateMatch = t.match(/State\s+(.*?)\s+Phone/i);
            const hospName = hospMatch ? hospMatch[1].trim() : "";
            const addr = addrMatch ? addrMatch[1].trim() : "";
            const city = cityMatch ? cityMatch[1].trim() : "";
            const stateVal = stateMatch ? stateMatch[1].trim() : "";

            const treatMatch = t.match(/Diagnosis\/\s*Proposed\s*Treatment\s+(.*?)\s+(?:Name of Doctor|Department|Cost of Treatment)/i);
            const treatment = treatMatch ? treatMatch[1].trim() : "MEDICAL TREATMENT";

            let patient = { name: "", passport: "", dob: "", phone: "" };
            const patMatch = t.match(/Details of (?:the\s+)?Patient([\s\S]*?)(?:Details of Treatment|Details of Attendant|$)/i);
            if (patMatch) {
                const pChunk = patMatch[1];
                const sName = (pChunk.match(/Surname\s+(.+?)\s+(?:Given|Gender)/i) || ["", ""])[1].trim();
                const gName = (pChunk.match(/Given\s*name\s+(.+?)\s+(?:Gender|Date)/i) || ["", ""])[1].trim();
                const dob = (pChunk.match(/Date of Birth\s+([\d/]+)/i) || ["", ""])[1].trim();
                const ppt = (pChunk.match(/Passport\s*No\.?\s*([A-Z0-9]+)/i) || ["", ""])[1].trim();
                const phone = (pChunk.match(/Contact Number\s*\([Ii]n\s+Native\s+Country\)\s*(\d+)/i) || ["", ""])[1].trim();
                patient = { name: `${gName} ${sName}`.trim().toUpperCase(), dob, passport: ppt.toUpperCase(), phone };
            }

            const attendants = [];
            const attMatch = t.match(/Details of Attendant([\s\S]*?)$/i);
            if (attMatch) {
                const chunks = attMatch[1].split(/Sr\s*No\.\s*\d+/i);
                for (let i = 1; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const sName = (chunk.match(/Surname\s+(.+?)\s+(?:Given|Gender)/i) || ["", ""])[1].trim();
                    const gName = (chunk.match(/Given\s*Name\s+(.+?)\s+(?:Gender|Date)/i) || ["", ""])[1].trim();
                    const dob = (chunk.match(/Date of Birth\s+([\d/]+)/i) || ["", ""])[1].trim();
                    const ppt = (chunk.match(/Passport\s*No\.?\s*([A-Z0-9]+)/i) || ["", ""])[1].trim();
                    const phone = (chunk.match(/Contact Number\s*\([Ii]n\s+Native\s+Country\)\s*(\d+)/i) || ["", ""])[1].trim();
                    const rel = (chunk.match(/Relationship with the patient\s+(\w+)/i) || ["", ""])[1].trim();
                    const fullName = `${gName} ${sName}`.trim().toUpperCase();

                    const cleanPpt = (ppt || "").trim().toUpperCase();
                    const invalidWords = ["ADDRESS", "GENDER", "SURNAME", "NAME", "PASSPORT", "NUMBER", "NONE", "NIL", "NA", "NOT", "DETAILS"];
                    const isValidPpt = cleanPpt && /\d/.test(cleanPpt) && cleanPpt.length >= 6 && cleanPpt.length <= 15 && !invalidWords.includes(cleanPpt);
                    const isValidName = fullName && fullName.length >= 2 && !/^(GENDER|GIVEN|SURNAME|NAME|\s)+$/i.test(fullName) && !fullName.includes("GENDER") && !fullName.includes("GIVEN NAME");

                    if (isValidPpt && isValidName) {
                        attendants.push({
                            name: fullName,
                            dob,
                            passport: cleanPpt,
                            phone,
                            relationship: rel.toUpperCase() || "BROTHER"
                        });
                    }
                }
            }

            return {
                hospital: {
                    name: hospName.toUpperCase(),
                    address: `${addr}, ${city}, ${stateVal}`.replace(/,\s*,/g, ",").trim().toUpperCase()
                },
                treatment: treatment.toUpperCase(),
                patient,
                attendants
            };
        }

        const dropZone = o("sideDocPdfDropZone");
        const pdfInput = o("sideDocPdfInput");
        const statusEl = o("sideDocStatus");

        if (dropZone && pdfInput) {
            dropZone.onclick = () => pdfInput.click();

            dropZone.ondragover = (ev) => {
                ev.preventDefault();
                dropZone.style.borderColor = "#2563eb";
                dropZone.style.background = "#eff6ff";
            };
            dropZone.ondragleave = () => {
                dropZone.style.borderColor = "#cbd5e1";
                dropZone.style.background = "#f8fafc";
            };
            dropZone.ondrop = (ev) => {
                ev.preventDefault();
                dropZone.style.borderColor = "#cbd5e1";
                dropZone.style.background = "#f8fafc";
                if (ev.dataTransfer.files && ev.dataTransfer.files[0]) {
                    processInvitationFile(ev.dataTransfer.files[0]);
                }
            };

            pdfInput.onchange = (ev) => {
                if (ev.target.files && ev.target.files[0]) {
                    processInvitationFile(ev.target.files[0]);
                }
            };
        }

        async function processInvitationFile(file) {
            if (!statusEl) return;
            statusEl.style.display = "block";
            statusEl.style.background = "#eff6ff";
            statusEl.style.color = "#1d4ed8";
            statusEl.innerText = "Processing invitation PDF...";

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await e(new Uint8Array(arrayBuffer)).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    fullText += content.items.map(item => item.str).join(" ") + " \n";
                }

                const parsed = parseMedicalInvitationText(fullText);
                const undertakingData = {
                    mode: "pdf",
                    hospitalName: parsed.hospital.name,
                    hospitalAddress: parsed.hospital.address,
                    treatment: parsed.treatment,
                    mission: "RAJSHAHI",
                    patient: parsed.patient,
                    attendants: parsed.attendants,
                    selectedProfileIndex: 0,
                    manualApplicantType: "patient"
                };

                await chrome.storage.local.set({ pendingUndertakingData: undertakingData });
                statusEl.style.background = "#f0fdf4";
                statusEl.style.color = "#15803d";
                statusEl.innerText = "Extracted! Opening generator tab...";
                setTimeout(() => {
                    statusEl.style.display = "none";
                    chrome.tabs.create({ url: "undertaking.html" });
                }, 500);
            } catch (err) {
                console.error(err);
                statusEl.style.background = "#fef2f2";
                statusEl.style.color = "#b91c1c";
                statusEl.innerText = "Failed to parse PDF. Please try another or Write Manually.";
            } finally {
                if (pdfInput) pdfInput.value = "";
            }
        }

        const writeManualBtn = o("sideDocWriteManualBtn");
        if (writeManualBtn) {
            writeManualBtn.onclick = async () => {
                const manualData = {
                    mode: "manual",
                    hospitalName: "",
                    hospitalAddress: "",
                    treatment: "",
                    mission: "RAJSHAHI",
                    patient: { name: "", passport: "", dob: "", phone: "" },
                    attendants: [],
                    selectedProfileIndex: 0,
                    manualApplicantType: "patient"
                };
                await chrome.storage.local.set({ pendingUndertakingData: manualData });
                chrome.tabs.create({ url: "undertaking.html" });
            };
        }
    })();

    // Switch to Registration Side Panel button
    const btnSwitchReg = o("btnSwitchToRegPanel");
    if (btnSwitchReg) {
        btnSwitchReg.onclick = async () => {
            await chrome.storage.local.set({ activeSidePanelPath: "sidepanel.html" });
            if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === "function") {
                await chrome.sidePanel.setOptions({ path: "sidepanel.html" });
            }
            window.location.href = "sidepanel.html";
        };
    }

    await (async function () {
        await s();
        const stored = await chrome.storage.local.get(null);
        let e = stored.lastServiceMode;
        if (!e) {
            const hasPassport = Object.keys(stored).some(k => (k.startsWith("PASSPORT_") || stored[k]?._type === "PASSPORT") && !stored[k]?._isHidden);
            const hasBgd = Object.keys(stored).some(k => (k.startsWith("BGD_") || stored[k]?._type === "BGD") && !stored[k]?._isHidden);
            if (hasPassport && !hasBgd) {
                e = "PASSPORT";
            } else {
                e = "BGD";
            }
        }
        l(e);
        r(e, false);
        await loadAllSettings();
        restoreAllProfilesFromDesktop();
    })();
}

// ===== PERMANENT PROFILE BACKUP & RESTORE (SURVIVES UPDATES) =====
async function backupAllProfilesToDesktop() {
    try {
        const all = await chrome.storage.local.get(null);
        const profilesToBackup = {};
        Object.keys(all).forEach(k => {
            if ((k.startsWith("BGD_") || k.startsWith("PASSPORT_")) && all[k]) {
                profilesToBackup[k] = all[k];
            }
        });
        if (Object.keys(profilesToBackup).length > 0) {
            chrome.runtime.sendMessage({ 
                action: 'backupFormFillProfiles', 
                profiles: profilesToBackup 
            });
        }
    } catch(err) {
        console.warn("Desktop backup skipped:", err);
    }
}

async function restoreAllProfilesFromDesktop() {
    try {
        chrome.runtime.sendMessage({ action: 'restoreFormFillProfiles' }, async (resp) => {
            if (resp && resp.success && resp.profiles && Object.keys(resp.profiles).length > 0) {
                const current = await chrome.storage.local.get(null);
                const toSave = {};
                let restoredCount = 0;
                Object.keys(resp.profiles).forEach(k => {
                    if (!current[k]) {
                        toSave[k] = resp.profiles[k];
                        restoredCount++;
                    }
                });
                if (restoredCount > 0) {
                    await chrome.storage.local.set(toSave);
                    console.log(`Successfully restored ${restoredCount} profiles from desktop backup!`);
                    const activeMode = o("btn-pdf-mode")?.classList.contains("active") ? "BGD" : "PASSPORT";
                    renderProfileList(activeMode, false);
                }
            }
        });
    } catch(err) {
        console.warn("Desktop restore skipped:", err);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidepanel);
} else {
    initSidepanel();
}

chrome.storage.onChanged.addListener((e, t) => {
    if ("local" === t) {
        if (e.lastServiceMode) {
            const t = e.lastServiceMode.newValue || "BGD";
            l(t);
            r(t, !o("hidden-view").classList.contains("hidden"));
        }
        if (e.lastSelectedProfile) {
            r(o("btn-pdf-mode").classList.contains("active") ? "BGD" : "PASSPORT", !o("hidden-view").classList.contains("hidden"));
        }
        if (Object.keys(e).some(e => e.startsWith("BGD_") || e.startsWith("PASSPORT_"))) {
            r(o("btn-pdf-mode").classList.contains("active") ? "BGD" : "PASSPORT", !o("hidden-view").classList.contains("hidden"));
        }
        if (Object.keys(e).some(k => k.startsWith("default") || k.includes("Captcha") || k.includes("AutoFill"))) {
            const currentActive = document.querySelector(".main-tab-item.active");
            if (currentActive && currentActive.dataset.tab === "tab-settings-view") {
                loadAllSettings();
            }
        }
    }
});