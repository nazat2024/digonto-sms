import { getDocument, GlobalWorkerOptions } from "./build/pdf.mjs";
GlobalWorkerOptions.workerSrc = "./build/pdf.worker.mjs";

let state = {
    mode: "pdf", // 'pdf' or 'manual'
    hospitalName: "",
    hospitalAddress: "",
    treatment: "",
    mission: "RAJSHAHI",
    patient: { name: "", passport: "", dob: "", phone: "" },
    attendants: [],
    selectedProfileIndex: 0, // 0 = patient, 1..N = attendant index
    manualApplicantType: "patient"
};

let sigImage = null;
let sigZoom = 1;
let sigBrightness = 100;
let sigContrast = 100;
let sigOffsetX = 0;
let sigOffsetY = 0;
let isDraggingSig = false;
let dragStartX = 0;
let dragStartY = 0;

// Helper to escape HTML
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(msg) {
    const toast = document.getElementById("toastFeedback");
    const txt = document.getElementById("toastText");
    if (toast && txt) {
        txt.innerText = msg;
        toast.style.display = "flex";
        setTimeout(() => {
            toast.style.display = "none";
        }, 3000);
    }
}

// ----------------------------------------------------
// 1. INITIALIZATION & DATA LOADING
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const stored = await chrome.storage.local.get("pendingUndertakingData");
        if (stored && stored.pendingUndertakingData) {
            state = { ...state, ...stored.pendingUndertakingData };
        }
    } catch (err) {
        console.error("Failed to load initial undertaking data:", err);
    }

    initUI();
    initSignatureControls();
    initNavbarControls();
});

function initUI() {
    // Populate Hospital details
    document.getElementById("inputHospitalName").value = state.hospitalName || "";
    document.getElementById("inputHospitalAddress").value = state.hospitalAddress || "";
    document.getElementById("inputTreatment").value = state.treatment || "";
    document.getElementById("inputMission").value = state.mission || "RAJSHAHI";

    // Bind Hospital inputs to state
    document.getElementById("inputHospitalName").addEventListener("input", e => state.hospitalName = e.target.value.toUpperCase());
    document.getElementById("inputHospitalAddress").addEventListener("input", e => state.hospitalAddress = e.target.value.toUpperCase());
    document.getElementById("inputTreatment").addEventListener("input", e => state.treatment = e.target.value.toUpperCase());
    document.getElementById("inputMission").addEventListener("change", e => state.mission = e.target.value);

    renderProfilePicker();
    renderSignerAndAccompanying();

    // Bind Download buttons
    const btnUndertaking = document.getElementById("btnDownloadUndertaking");
    if (btnUndertaking) {
        btnUndertaking.addEventListener("click", generateUndertakingPdf);
    }
}

// ----------------------------------------------------
// 2. PROFILE PICKER (PATIENT VS ATTENDANTS)
// ----------------------------------------------------
function renderProfilePicker() {
    const grid = document.getElementById("profilePickerGrid");
    const manualRoleCont = document.getElementById("manualRoleSelectContainer");

    if (state.mode === "manual") {
        grid.style.display = "none";
        manualRoleCont.style.display = "block";

        const sel = document.getElementById("selectManualRole");
        sel.value = state.manualApplicantType || "patient";
        sel.onchange = e => {
            state.manualApplicantType = e.target.value;
            if (e.target.value === "attendant") {
                if (!Array.isArray(state.attendants) || state.attendants.length === 0) {
                    state.attendants = [{ name: "", passport: "", dob: "", phone: "", relationship: "BROTHER" }];
                }
                state.selectedProfileIndex = 1;
            } else {
                state.selectedProfileIndex = 0;
            }
            renderSignerAndAccompanying();
        };
        return;
    }

    grid.style.display = "grid";
    manualRoleCont.style.display = "none";
    grid.innerHTML = "";

    const profiles = [];
    if (state.patient && (state.patient.name || state.patient.passport)) {
        profiles.push({ ...state.patient, role: "Patient", index: 0 });
    } else {
        profiles.push({ name: "Patient", passport: "", role: "Patient", index: 0 });
    }

    if (Array.isArray(state.attendants)) {
        state.attendants.forEach((att, idx) => {
            profiles.push({ ...att, role: `Attendant ${idx + 1}`, index: idx + 1 });
        });
    }

    profiles.forEach(p => {
        const card = document.createElement("div");
        const isSelected = state.selectedProfileIndex === p.index;
        card.className = `profile-select-card ${isSelected ? "selected" : ""}`;
        card.innerHTML = `
            <span class="profile-badge ${p.index === 0 ? "patient" : "attendant"}">${escapeHtml(p.role)}</span>
            <div class="profile-card-name">${escapeHtml(p.name || "Unnamed")}</div>
            <div class="profile-card-ppt">${escapeHtml(p.passport || "No Passport")}</div>
        `;
        card.onclick = () => {
            state.selectedProfileIndex = p.index;
            renderProfilePicker();
            renderSignerAndAccompanying();
        };
        grid.appendChild(card);
    });
}

// ----------------------------------------------------
// 3. SIGNER & ACCOMPANYING DETAILS
// ----------------------------------------------------
function renderSignerAndAccompanying() {
    const isAttendant = state.selectedProfileIndex > 0;
    const relRow = document.getElementById("signerRelationshipRow");
    const accHeader = document.getElementById("accompanyingHeader");
    const accBody = document.getElementById("accompanyingBody");
    const signerHdr = document.getElementById("signerDetailsHeader");

    if (isAttendant) {
        signerHdr.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Signer Details (Attendant / সহকারী)
        `;
        relRow.style.display = "block";
        const att = state.attendants[state.selectedProfileIndex - 1] || { name: "", passport: "", dob: "", phone: "", relationship: "BROTHER" };

        document.getElementById("inputSignerName").value = att.name || "";
        document.getElementById("inputSignerPassport").value = att.passport || "";
        document.getElementById("inputSignerDob").value = att.dob || "";
        document.getElementById("inputSignerPhone").value = att.phone || "";
        document.getElementById("inputSignerRelationship").value = att.relationship || "BROTHER";

        document.getElementById("inputSignerName").oninput = e => att.name = e.target.value.toUpperCase();
        document.getElementById("inputSignerPassport").oninput = e => att.passport = e.target.value.toUpperCase();
        document.getElementById("inputSignerDob").oninput = e => att.dob = e.target.value;
        document.getElementById("inputSignerPhone").oninput = e => att.phone = e.target.value;
        document.getElementById("inputSignerRelationship").oninput = e => att.relationship = e.target.value.toUpperCase();

        // Accompanying Patient Details
        accHeader.innerText = "Accompanying Patient Details (সঙ্গী রোগী)";
        const pat = state.patient || { name: "", passport: "" };
        accBody.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Patient Full Name*</label>
                    <input type="text" id="inputAccPatName" value="${escapeHtml(pat.name || "")}" placeholder="Patient's Name">
                </div>
                <div class="form-group">
                    <label>Patient Passport Number*</label>
                    <input type="text" id="inputAccPatPassport" value="${escapeHtml(pat.passport || "")}" placeholder="Patient's Passport">
                </div>
            </div>
        `;
        document.getElementById("inputAccPatName").oninput = e => state.patient.name = e.target.value.toUpperCase();
        document.getElementById("inputAccPatPassport").oninput = e => state.patient.passport = e.target.value.toUpperCase();

    } else {
        signerHdr.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Signer Details (Patient / রোগী)
        `;
        relRow.style.display = "none";
        const pat = state.patient || { name: "", passport: "", dob: "", phone: "" };

        document.getElementById("inputSignerName").value = pat.name || "";
        document.getElementById("inputSignerPassport").value = pat.passport || "";
        document.getElementById("inputSignerDob").value = pat.dob || "";
        document.getElementById("inputSignerPhone").value = pat.phone || "";

        document.getElementById("inputSignerName").oninput = e => pat.name = e.target.value.toUpperCase();
        document.getElementById("inputSignerPassport").oninput = e => pat.passport = e.target.value.toUpperCase();
        document.getElementById("inputSignerDob").oninput = e => pat.dob = e.target.value;
        document.getElementById("inputSignerPhone").oninput = e => pat.phone = e.target.value;

        // Accompanying Attendants List
        accHeader.innerText = "Accompanying Attendants Details (সঙ্গী সহকারীগণ)";
        renderAccompanyingAttendantsList();
    }
}

function renderAccompanyingAttendantsList() {
    const accBody = document.getElementById("accompanyingBody");
    accBody.innerHTML = "";

    if (!Array.isArray(state.attendants)) state.attendants = [];

    if (state.attendants.length === 0) {
        const noAtt = document.createElement("div");
        noAtt.style.cssText = "font-size: 12.5px; color: #64748b; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; text-align: center;";
        noAtt.innerText = "কোনো সঙ্গী সহকারী নেই (রোগী একাই ভ্রমণ করবেন)";
        accBody.appendChild(noAtt);
    }

    state.attendants.forEach((att, idx) => {
        const item = document.createElement("div");
        item.className = "attendant-item";
        item.innerHTML = `
            <button class="btn-remove-att" data-idx="${idx}" title="Remove Attendant">✕ Remove</button>
            <div style="font-size: 12px; font-weight: 800; color: #334155; margin-bottom: 8px;">Attendant ${idx + 1}</div>
            <div class="form-row">
                <div class="form-group">
                    <label>Attendant Name*</label>
                    <input type="text" class="input-att-name" value="${escapeHtml(att.name || "")}" placeholder="Full Name">
                </div>
                <div class="form-group">
                    <label>Passport Number*</label>
                    <input type="text" class="input-att-ppt" value="${escapeHtml(att.passport || "")}" placeholder="Passport No">
                </div>
            </div>
        `;

        item.querySelector(".btn-remove-att").onclick = () => {
            state.attendants.splice(idx, 1);
            if (state.selectedProfileIndex > state.attendants.length) {
                state.selectedProfileIndex = 0;
            }
            renderProfilePicker();
            renderSignerAndAccompanying();
        };

        item.querySelector(".input-att-name").oninput = e => att.name = e.target.value.toUpperCase();
        item.querySelector(".input-att-ppt").oninput = e => att.passport = e.target.value.toUpperCase();

        accBody.appendChild(item);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "btn-add-att";
    addBtn.innerText = state.attendants.length === 0 ? "+ Add Attendant" : "+ Add Another Attendant";
    addBtn.onclick = () => {
        state.attendants.push({ name: "", passport: "", dob: "", phone: "", relationship: "BROTHER" });
        renderProfilePicker();
        renderSignerAndAccompanying();
    };
    accBody.appendChild(addBtn);
}

// ----------------------------------------------------
// 4. SIGNATURE CANVAS LOGIC
// ----------------------------------------------------
function initSignatureControls() {
    const dropZone = document.getElementById("sigDropZone");
    const fileInput = document.getElementById("sigFileInput");
    const canvas = document.getElementById("sigCanvas");
    const placeholder = document.getElementById("sigPlaceholder");
    const controls = document.getElementById("sigControlsContainer");

    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = e => {
        if (e.target.files && e.target.files[0]) {
            loadSigImage(e.target.files[0]);
        }
    };

    dropZone.ondragover = e => { e.preventDefault(); dropZone.style.borderColor = "#2563eb"; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = "#cbd5e1"; };
    dropZone.ondrop = e => {
        e.preventDefault();
        dropZone.style.borderColor = "#cbd5e1";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            loadSigImage(e.dataTransfer.files[0]);
        }
    };

    function loadSigImage(file) {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                sigImage = img;
                sigZoom = 1;
                sigBrightness = 100;
                sigContrast = 100;
                sigOffsetX = 0;
                sigOffsetY = 0;

                canvas.style.display = "block";
                placeholder.style.display = "none";
                controls.style.display = "flex";
                drawSignatureCanvas();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Sliders
    const zoomSlider = document.getElementById("sliderZoom");
    const brightSlider = document.getElementById("sliderBrightness");
    const contrastSlider = document.getElementById("sliderContrast");

    zoomSlider.oninput = e => { sigZoom = parseFloat(e.target.value); drawSignatureCanvas(); };
    brightSlider.oninput = e => { sigBrightness = parseInt(e.target.value, 10); drawSignatureCanvas(); };
    contrastSlider.oninput = e => { sigContrast = parseInt(e.target.value, 10); drawSignatureCanvas(); };

    document.getElementById("btnResetSig").onclick = () => {
        sigZoom = 1;
        sigBrightness = 100;
        sigContrast = 100;
        sigOffsetX = 0;
        sigOffsetY = 0;
        zoomSlider.value = 1;
        brightSlider.value = 100;
        contrastSlider.value = 100;
        drawSignatureCanvas();
    };

    document.getElementById("btnClearSig").onclick = () => {
        sigImage = null;
        canvas.style.display = "none";
        placeholder.style.display = "block";
        controls.style.display = "none";
        fileInput.value = "";
    };

    // Canvas Pan/Drag
    canvas.onmousedown = e => {
        if (!sigImage) return;
        isDraggingSig = true;
        dragStartX = e.clientX - sigOffsetX;
        dragStartY = e.clientY - sigOffsetY;
    };
    window.addEventListener("mousemove", e => {
        if (!isDraggingSig) return;
        sigOffsetX = e.clientX - dragStartX;
        sigOffsetY = e.clientY - dragStartY;
        drawSignatureCanvas();
    });
    window.addEventListener("mouseup", () => { isDraggingSig = false; });
}

function drawSignatureCanvas() {
    const canvas = document.getElementById("sigCanvas");
    if (!canvas || !sigImage) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `brightness(${sigBrightness}%) contrast(${sigContrast}%)`;

    // Center and scale image
    const fitScale = Math.min((canvas.width * 0.9) / sigImage.width, (canvas.height * 0.9) / sigImage.height);
    const finalScale = fitScale * sigZoom;
    const w = sigImage.width * finalScale;
    const h = sigImage.height * finalScale;
    const x = (canvas.width - w) / 2 + sigOffsetX;
    const y = (canvas.height - h) / 2 + sigOffsetY;

    ctx.drawImage(sigImage, x, y, w, h);
}

// ----------------------------------------------------
// 5. NAVBAR & INVITATION PDF RE-UPLOAD
// ----------------------------------------------------
function initNavbarControls() {
    document.getElementById("btnCloseTab").onclick = () => window.close();

    const btnSwitch = document.getElementById("btnSwitchFile");
    const fileIn = document.getElementById("navFileInput");
    btnSwitch.onclick = () => fileIn.click();

    fileIn.onchange = async e => {
        if (e.target.files && e.target.files[0]) {
            btnSwitch.innerText = "Extracting...";
            try {
                const file = e.target.files[0];
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await getDocument(new Uint8Array(arrayBuffer)).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    fullText += content.items.map(item => item.str).join(" ") + " \n";
                }
                const parsed = parseInvitationText(fullText);
                state.hospitalName = parsed.hospital.name;
                state.hospitalAddress = parsed.hospital.address;
                state.treatment = parsed.treatment;
                state.patient = parsed.patient;
                state.attendants = parsed.attendants;
                state.mode = "pdf";
                state.selectedProfileIndex = 0;

                initUI();
                showToast("New invitation PDF extracted successfully!");
            } catch (err) {
                console.error(err);
                alert("Could not parse this PDF. Please check if it's a valid medical invitation letter.");
            } finally {
                btnSwitch.innerText = "📄 Upload New PDF";
                fileIn.value = "";
            }
        }
    };
}

// ----------------------------------------------------
// 6. INVITATION TEXT PARSER (PORTED FROM CONTENT.JS)
// ----------------------------------------------------
function parseInvitationText(raw) {
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

// ----------------------------------------------------
// 7. PDF GENERATION LOGIC
// ----------------------------------------------------
function getSignerData() {
    const isAttendant = state.selectedProfileIndex > 0;
    if (isAttendant) {
        const att = state.attendants[state.selectedProfileIndex - 1] || {};
        return {
            isAttendant: true,
            signerName: att.name || "Signer",
            signerPassport: att.passport || "",
            signerPhone: att.phone || "",
            signerDob: att.dob || "",
            relationship: att.relationship || "BROTHER",
            patientName: state.patient?.name || "",
            patientPassport: state.patient?.passport || ""
        };
    } else {
        return {
            isAttendant: false,
            signerName: state.patient?.name || "Signer",
            signerPassport: state.patient?.passport || "",
            signerPhone: state.patient?.phone || "",
            signerDob: state.patient?.dob || "",
            relationship: "",
            patientName: state.patient?.name || "",
            patientPassport: state.patient?.passport || ""
        };
    }
}

function getSignatureImageSrc() {
    const canvas = document.getElementById("sigCanvas");
    if (sigImage && canvas) {
        return canvas.toDataURL("image/png");
    }
    return null;
}

function generateUndertakingPdf() {
    const s = getSignerData();
    const sigSrc = getSignatureImageSrc();

    if (!state.hospitalName || !s.signerName) {
        alert("Please ensure Hospital Name and Signer Name are filled.");
        return;
    }

    const validAtts = (Array.isArray(state.attendants) ? state.attendants : []).filter(a => a.name && a.name.trim());
    let companionDetailsHtml = "";
    let listItemsHtml = "";
    let requestText = "";

    if (s.isAttendant) {
        companionDetailsHtml = `
            <p style="margin: 0 0 3px 0; color: #000000 !important;">Details of the patient I will be accompanying:</p>
            <p style="margin: 0 0 2px 0; font-weight: bold; color: #000000 !important;">Name: ${escapeHtml(s.patientName)}</p>
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #000000 !important;">Passport Number: ${escapeHtml(s.patientPassport)}</p>
        `;
        listItemsHtml = `
            <li style="margin-bottom: 3.5px;">All information provided in the visa application and supporting documents is true and correct to the best of my knowledge.</li>
            <li style="margin-bottom: 3.5px;">I, <b>${escapeHtml(s.signerName)}</b>, will accompany the patient only for the purpose of providing necessary assistance during the medical treatment.</li>
            <li style="margin-bottom: 3.5px;">We shall abide by all laws, rules, and regulations of India during our stay.</li>
            <li style="margin-bottom: 3.5px;">We shall not engage in any activity other than those permitted under the respective visa categories.</li>
            <li style="margin-bottom: 3.5px;">We shall bear all expenses related to travel, accommodation, medical treatment, and other associated costs during our stay in India.</li>
            <li style="margin-bottom: 3.5px;">We shall leave India upon completion of the medical treatment and within the validity period of the visa granted.</li>
        `;
        requestText = `I respectfully request the High Commission of India to kindly consider this application and grant the necessary Medical Attendant Visa.`;
    } else if (validAtts.length > 0) {
        if (validAtts.length > 1) {
            companionDetailsHtml = `
                <p style="margin: 0 0 4px 0; color: #000000 !important;">I would also like to request the issuance of a Medical Attendant Visa for my attendants:</p>
                ${validAtts.map((a, i) => `
                    <div style="margin-bottom: 4px;">
                        <p style="margin: 0 0 1px 0; font-weight: bold; color: #000000 !important;">Attendant ${i + 1} Name: ${escapeHtml(a.name)}</p>
                        <p style="margin: 0 0 0 0; font-weight: bold; color: #000000 !important;">Passport Number: ${escapeHtml(a.passport)}</p>
                    </div>
                `).join("")}
            `;
            const attNamesStr = validAtts.map(a => `<b>${escapeHtml(a.name)}</b>`).join(" and ");
            listItemsHtml = `
                <li style="margin-bottom: 3.5px;">All information provided in the visa application and supporting documents is true and correct to the best of my knowledge.</li>
                <li style="margin-bottom: 3.5px;">My attendants, ${attNamesStr}, will accompany me only for the purpose of providing necessary assistance during my medical treatment.</li>
                <li style="margin-bottom: 3.5px;">We shall abide by all laws, rules, and regulations of India during our stay.</li>
                <li style="margin-bottom: 3.5px;">We shall not engage in any activity other than those permitted under the respective visa categories.</li>
                <li style="margin-bottom: 3.5px;">We shall bear all expenses related to travel, accommodation, medical treatment, and other associated costs during our stay in India.</li>
                <li style="margin-bottom: 3.5px;">We shall leave India upon completion of the medical treatment and within the validity period of the visas granted.</li>
            `;
        } else {
            const a = validAtts[0];
            companionDetailsHtml = `
                <p style="margin: 0 0 3px 0; color: #000000 !important;">I would also like to request the issuance of a Medical Attendant Visa for my attendant:</p>
                <p style="margin: 0 0 2px 0; font-weight: bold; color: #000000 !important;">Name: ${escapeHtml(a.name)}</p>
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #000000 !important;">Passport Number: ${escapeHtml(a.passport)}</p>
            `;
            listItemsHtml = `
                <li style="margin-bottom: 3.5px;">All information provided in the visa application and supporting documents is true and correct to the best of my knowledge.</li>
                <li style="margin-bottom: 3.5px;">My attendant, <b>${escapeHtml(a.name)}</b>, will accompany me only for the purpose of providing necessary assistance during my medical treatment.</li>
                <li style="margin-bottom: 3.5px;">We shall abide by all laws, rules, and regulations of India during our stay.</li>
                <li style="margin-bottom: 3.5px;">We shall not engage in any activity other than those permitted under the respective visa categories.</li>
                <li style="margin-bottom: 3.5px;">We shall bear all expenses related to travel, accommodation, medical treatment, and other associated costs during our stay in India.</li>
                <li style="margin-bottom: 3.5px;">We shall leave India upon completion of the medical treatment and within the validity period of the visas granted.</li>
            `;
        }
        requestText = `I respectfully request the High Commission of India to kindly consider our visa applications and grant the necessary visas.`;
    } else {
        // Solo Patient (0 Attendants)
        companionDetailsHtml = "";
        listItemsHtml = `
            <li style="margin-bottom: 3.5px;">All information provided in the visa application and supporting documents is true and correct to the best of my knowledge.</li>
            <li style="margin-bottom: 3.5px;">I shall travel to India solely for the purpose of receiving medical treatment.</li>
            <li style="margin-bottom: 3.5px;">I shall abide by all laws, rules, and regulations of India during my stay.</li>
            <li style="margin-bottom: 3.5px;">I shall not engage in any activity other than those permitted under the medical visa category.</li>
            <li style="margin-bottom: 3.5px;">I shall bear all expenses related to travel, accommodation, medical treatment, and other associated costs during my stay in India.</li>
            <li style="margin-bottom: 3.5px;">I shall leave India upon completion of the medical treatment and within the validity period of the visa granted.</li>
        `;
        requestText = `I respectfully request the High Commission of India to kindly consider my visa application and grant the necessary Medical Visa.`;
    }

    const firstParagraph = s.isAttendant
        ? `I, <b>${escapeHtml(s.signerName)}</b>, holder of Bangladesh Passport No. <b>${escapeHtml(s.signerPassport)}</b>, am applying for a Medical Attendant Visa to accompany my patient <b>${escapeHtml(s.patientName)}</b>, holder of Bangladesh Passport No. <b>${escapeHtml(s.patientPassport)}</b>, who is travelling to India for medical treatment at <b>${escapeHtml(state.hospitalName)}</b>, located at <b>${escapeHtml(state.hospitalAddress)}</b>.`
        : `I, <b>${escapeHtml(s.signerName)}</b>, holder of Bangladesh Passport No. <b>${escapeHtml(s.signerPassport)}</b>, am applying for a Medical Visa to travel to India for treatment at <b>${escapeHtml(state.hospitalName)}</b>, located at <b>${escapeHtml(state.hospitalAddress)}</b>.`;

    const sigBlock = sigSrc
        ? `<div style="margin: 4px 0 6px 0;"><img src="${sigSrc}" style="height: 38px; object-fit: contain; max-width: 180px;"></div>`
        : `<div style="height: 28px; margin: 4px 0 6px 0;"></div>`;

    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = "180mm";
    container.style.boxSizing = "border-box";
    container.style.background = "#ffffff";
    container.style.color = "#000000";
    container.style.padding = "0";
    container.style.margin = "0";
    container.style.display = "block";
    container.style.pageBreakInside = "avoid";
    container.style.breakInside = "avoid";
    container.innerHTML = `
        <div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.38; color: #000000 !important; text-align: left;">
            <p style="margin: 0 0 2px 0; color: #000000 !important;">To</p>
            <p style="margin: 0 0 2px 0; color: #000000 !important;">The Visa Officer</p>
            <p style="margin: 0 0 2px 0; color: #000000 !important;">High Commission of India</p>
            <p style="margin: 0 0 12px 0; color: #000000 !important;">${escapeHtml((state.mission || "RAJSHAHI").toUpperCase())}, Bangladesh</p>

            <p style="margin: 0 0 12px 0; font-weight: bold; text-decoration: underline; color: #000000 !important;">
                Subject: Undertaking for ${s.isAttendant ? "Medical Attendant" : "Medical"} Visa Application.
            </p>

            <p style="margin: 0 0 10px 0; text-align: justify; color: #000000 !important;">
                ${firstParagraph}
            </p>

            ${companionDetailsHtml}

            <p style="margin: 0 0 5px 0; font-weight: bold; color: #000000 !important;">I undertake that:</p>
            <ol style="margin: 0 0 10px 0; padding-left: 20px; text-align: justify; color: #000000 !important;">
                ${listItemsHtml}
            </ol>

            <p style="margin: 0 0 12px 0; text-align: justify; color: #000000 !important;">
                ${requestText}
            </p>

            <p style="margin: 0 0 4px 0; color: #000000 !important;">Sincerely yours,</p>
            ${sigBlock}
            <p style="margin: 0 0 2px 0; font-weight: bold; color: #000000 !important;">(${escapeHtml(s.signerName)})</p>
            <p style="margin: 0 0 2px 0; color: #000000 !important;">Passport Number: ${escapeHtml(s.signerPassport)}</p>
            ${s.signerPhone ? `<p style="margin: 0 0 2px 0; color: #000000 !important;">Contact Number: ${escapeHtml(s.signerPhone)}</p>` : ""}
        </div>
    `;

    const filename = `${s.signerName.trim().replace(/[<>:"/\\|?*]/g, "")} - Medical Undertaking.pdf`;
    const opt = {
        margin: [10, 14, 10, 14],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };

    html2pdf().from(container).set(opt).save().then(() => {
        showToast("Medical Undertaking downloaded!");
    });
}
