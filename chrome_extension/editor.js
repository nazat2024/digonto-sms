const e = document.getElementById("profileName"),
    t = document.querySelectorAll(".saveButton"),
    o = document.querySelectorAll(".status"),
    n = document.querySelector(".container");
let a = "",
    r = {};

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

document.addEventListener("DOMContentLoaded", async () => {
    const t = new URLSearchParams(window.location.search).get("profile");
    if (!t) return void (document.body.innerHTML = "<h1>Error: No profile selected.</h1>");
    a = t;
    e.textContent = "Loading...";
    const o = await chrome.storage.local.get(t);
    if (!o[t]) return void (document.body.innerHTML = `<h1>Error: Could not load data for ${t}.</h1>`);
    r = o[t];
    e.textContent = r._savedName || t;

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
    const defMission = appSettings.defaultMissionCode || "BGDD";
    const defArrival = appSettings.defaultPassportArrivalPort || "BY ROAD GEDE";
    const defExit = appSettings.defaultPassportExitPort || "BY ROAD GEDE";
    const defPlaces = appSettings.defaultPlacesToVisit || "KOLKATA";
    const defPlacesCountry = appSettings.defaultPlacesToVisitCountry || "INDIA";
    const defEdu = appSettings.defaultEducation || "MATRICULATION";
    const calcJourneyDate = getCalculatedJourneyDate(appSettings);

    if (!r.missioncode_id) {
        r.missioncode_id = defMission;
    }
    if (!r.entrypoint || r.entrypoint === "BY AIR/ HARIDASPUR") {
        r.entrypoint = defArrival;
    }
    if (!r.exitpoint || r.exitpoint === "BY AIR/ HARIDASPUR") {
        r.exitpoint = defExit;
    }
    if (!r.places_to_visit) {
        r.places_to_visit = defPlaces;
    }
    if (!r.places_to_visit_country) {
        r.places_to_visit_country = defPlacesCountry;
    }
    if (!r.education || r.education === "GRADUATE") {
        r.education = defEdu;
    }

    // Expected Date of Journey from Settings page (for both PASSPORT and BGD profiles)
    if (!r.jouryney_id || !r.jouryney_id.trim()) {
        if (calcJourneyDate) {
            r.jouryney_id = calcJourneyDate;
        }
    }

    if (a.startsWith("PASSPORT") || r._type === "PASSPORT") {
        const defOcc = appSettings.defaultOccupation !== undefined ? appSettings.defaultOccupation : "LABOUR";
        const defEmpName = appSettings.defaultEmpName !== undefined ? appSettings.defaultEmpName : "AGRICULTURE";
        const defEmpDes = appSettings.defaultEmpDesignation !== undefined ? appSettings.defaultEmpDesignation : "";
        const defEmpAddr = appSettings.defaultEmpAddress !== undefined ? appSettings.defaultEmpAddress : "KUSHTIA";

        if (!r.occupation || r.occupation === "PRIVATE SERVICE") {
            r.occupation = defOcc;
        }
        if (!r.empname || r.empname === "ARB PRIVATE LIMITED") {
            r.empname = defEmpName;
        }
        if (r.empdesignation === "OFFICER" || (!r.empdesignation && defEmpDes)) {
            r.empdesignation = defEmpDes;
        }
        if (!r.empaddress || r.empaddress === "DHAKA, BANGLADESH") {
            r.empaddress = defEmpAddr;
        }
    }

    if (!r.places_to_visit) r.places_to_visit = "KOLKATA";
    if (!r.places_to_visit_country) r.places_to_visit_country = "INDIA";

    if (!r.other_ppt_place) r.other_ppt_place = "DHAKA";
    if (!r.other_ppt_country) r.other_ppt_country = "BANGLADESH";
    if (!r.other_ppt_nat) r.other_ppt_nat = "BANGLADESH";
    if (r.prev_pass_no && !r.other_ppt_no) {
        r.other_ppt_no = r.prev_pass_no;
    }
    if (r.other_ppt_no && r.other_ppt_no.trim() && !["NA", "NILL", "NONE", "NO"].includes(r.other_ppt_no.trim().toUpperCase())) {
        r.other_ppt_held = "YES";
    } else {
        r.other_ppt_held = r.other_ppt_held || "NO";
    }

    // 1. Nationality -> "BY BIRTH"
    if (!r.nationality || r.nationality === "BANGLADESH" || r.nationality === "BGD") {
        r.nationality = "BY BIRTH";
    }

    // 2. Passport Place of Issue -> strip "DIP/" prefix
    if (r.passPlace) {
        r.passPlace = r.passPlace.replace(/^DIP[\/\s\-_]*/i, "").trim().toUpperCase() || "DHAKA";
    } else {
        r.passPlace = "DHAKA";
    }

    // 3. Mobile No -> "NILL"
    if (!r.mobile || r.mobile === r.pres_phone || /^[0-9+]+$/.test(r.mobile)) {
        r.mobile = "NILL";
    }

    // 4. Father's Nationality & Mother's Nationality -> "BGD"
    if (!r.father_nationality || r.father_nationality === "BANGLADESH") {
        r.father_nationality = "BGD";
    }
    if (!r.mother_nationality || r.mother_nationality === "BANGLADESH") {
        r.mother_nationality = "BGD";
    }

    // 5 & 6. Father's & Mother's Place of Birth -> match applicant POB district
    const pobTownClean = (r.pobTown || "DHAKA").trim().toUpperCase();
    if (!r.father_place_of_birth || r.father_place_of_birth === "BANGLADESH" || r.father_place_of_birth === "BGD") {
        r.father_place_of_birth = pobTownClean;
    }
    if (!r.mother_place_of_birth || r.mother_place_of_birth === "BANGLADESH" || r.mother_place_of_birth === "BGD") {
        r.mother_place_of_birth = pobTownClean;
    }

    // 7. Spouse's Place of Birth -> match applicant POB district if married
    if (r.spouse_name && r.spouse_name.trim() && !["NA", "NILL", "NONE", "NO"].includes(r.spouse_name.trim().toUpperCase())) {
        r.marital_status = "0";
        if (!r.spouse_place_of_birth || r.spouse_place_of_birth === "BANGLADESH" || r.spouse_place_of_birth === "BGD") {
            r.spouse_place_of_birth = pobTownClean;
        }
    } else {
        r.spouse_place_of_birth = "";
        r.marital_status = "1";
    }

    // 8. Visa Duration (Months) -> "12"
    if (!r.duration) {
        r.duration = "12";
    }

    // 9. No. of Entries -> "2" (MULTIPLE)
    if (!r.visa_entry_id || r.visa_entry_id === "1" || r.visa_entry_id === "SINGLE") {
        r.visa_entry_id = "2";
    }

    // Additional country code and phone formatting
    if (!r.pobCountry || r.pobCountry === "BANGLADESH") {
        r.pobCountry = "BGD";
    }
    if (!r.pres_country || r.pres_country === "BANGLADESH") {
        r.pres_country = "BGD";
    }
    // Phone number without +88
    if (r.pres_phone) {
        let digits = String(r.pres_phone).replace(/[^0-9]/g, "");
        if (digits.startsWith("8801") && digits.length >= 13) {
            r.pres_phone = digits.slice(2);
        } else if (digits.length === 11 && digits.startsWith("01")) {
            r.pres_phone = digits;
        } else if (digits.startsWith("88") && digits.length > 10) {
            r.pres_phone = digits.slice(2);
        } else {
            r.pres_phone = digits.slice(-11);
        }
    }

    // Previous Visit Details defaults
    if (!r.refuse_flag2) {
        r.refuse_flag2 = "NILL";
    }
    if ((r.old_visa_no || r.prv_visit_add1 || r.visited_city) && !r.country_visited) {
        r.country_visited = "INDIA";
    }

    n.querySelectorAll("input, select, textarea").forEach(e => {
        if (r.hasOwnProperty(e.id)) {
            if ("SELECT" === e.tagName) {
                if (Array.from(e.options).some(t => t.value === String(r[e.id]))) {
                    e.value = r[e.id];
                } else {
                    const t = Array.from(e.options).find(t => t.text.toUpperCase() === String(r[e.id]).toUpperCase());
                    t && (e.value = t.value);
                }
            } else {
                e.value = r[e.id];
            }
        }
    });

    const journeyInputEl = document.getElementById("jouryney_id");
    if (journeyInputEl) {
        if (r.jouryney_id && r.jouryney_id.trim()) {
            journeyInputEl.value = r.jouryney_id.trim();
        } else if (calcJourneyDate) {
            journeyInputEl.value = calcJourneyDate;
            r.jouryney_id = calcJourneyDate;
        }
    }

    const otherPptNoInput = document.getElementById("other_ppt_no");
    const otherPptHeldSelect = document.getElementById("other_ppt_held");
    if (otherPptNoInput && otherPptHeldSelect) {
        otherPptNoInput.addEventListener("input", () => {
            const val = otherPptNoInput.value.trim();
            if (val && !["NA", "NILL", "NONE", "NO"].includes(val.toUpperCase())) {
                otherPptHeldSelect.value = "YES";
            } else {
                otherPptHeldSelect.value = "NO";
            }
        });
        otherPptHeldSelect.addEventListener("change", () => {
            if (otherPptHeldSelect.value === "NO") {
                otherPptNoInput.value = "";
            }
        });
    }

    function updatePreviousPassportInForm(val) {
        if (!val || ["NA", "NILL", "NONE", "NO"].includes(val.toUpperCase())) return;
        r.other_ppt_held = "YES";
        r.other_ppt_no = val;
        r.prev_pass_no = val;
        const pptNoEl = document.getElementById("other_ppt_no");
        const pptHeldEl = document.getElementById("other_ppt_held");
        if (pptNoEl) {
            pptNoEl.value = val;
        }
        if (pptHeldEl) {
            pptHeldEl.value = "YES";
            pptHeldEl.dispatchEvent(new Event("change"));
        }
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "ASYNC_PREV_PASSPORT" && msg.profileKey === a) {
            updatePreviousPassportInForm(msg.prevPassportNo);
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[a] && changes[a].newValue) {
            const updated = changes[a].newValue;
            if (updated.other_ppt_no && (!r.other_ppt_no || r.other_ppt_no !== updated.other_ppt_no)) {
                updatePreviousPassportInForm(updated.other_ppt_no);
            }
        }
    });
});

t.forEach(e => {
    e.addEventListener("click", async () => {
        o.forEach(e => e.textContent = "Saving...");
        let e = { ...r };
        n.querySelectorAll("input, select, textarea").forEach(t => {
            t.id && (e[t.id] = t.value);
        });
        if (e.other_ppt_no) {
            e.prev_pass_no = e.other_ppt_no;
        }
        const t = document.getElementById("old_visa_type_id");
        if (t) {
            const o = t.options[t.selectedIndex]?.text || "";
            e.oldVisaTypeRaw = o;
        }
        await chrome.storage.local.set({ [a]: e });
        r = e;
        try {
            chrome.runtime.sendMessage({
                action: 'backupFormFillProfiles',
                profiles: { [a]: e }
            });
        } catch(bErr) {}
        o.forEach(e => e.textContent = "Saved!");
        setTimeout(() => {
            o.forEach(e => e.textContent = "");
        }, 2e3);
    });
});