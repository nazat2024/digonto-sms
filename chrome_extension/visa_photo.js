(function () {
    'use strict';

    const MAX_BYTES = 25 * 1024 * 1024;
    const OUT_SIZE = 600;
    const API_URL = 'http://127.0.0.1:5000/api/visa-photo/prepare';

    const $ = s => document.querySelector(s);
    const uploadCard = $('#uploadCard');
    const editor = $('#editor');
    const fileInput = $('#fileInput');
    const dropZone = $('#dropZone');
    const chooseBtn = $('#chooseBtn');
    const errorEl = $('#error');
    const originalPreview = $('#originalPreview');
    const canvas = $('#resultCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const zoomSlider = $('#zoom');
    const zoomVal = $('#zoomVal');
    const brightSlider = $('#brightness');
    const brightVal = $('#brightVal');
    const contrastSlider = $('#contrast');
    const contrastVal = $('#contrastVal');
    const brushSlider = $('#brush');
    const brushVal = $('#brushVal');
    const warningBox = $('#warningBox');
    const statusEl = $('#status');
    const sizeBadge = $('#sizeBadge');
    const downloadBtn = $('#downloadBtn');
    const guideOverlay = $('#guideOverlay');
    const guideBtn = $('#guideBtn');

    // State
    let fgImage = null;          // Transparent foreground
    let originalImage = null;    // Cropped original
    let aiPreparedBase64 = null; // 100% pristine AI output from backend
    let aiPreparedImage = null;
    let hasUserEdited = false;   // Only true if user moves sliders, pans, or brushes
    let panOffset = { x: 0, y: 0 };
    let zoomLevel = 1.0;
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let brushMode = null;        // 'erase' | 'restore' | null
    let brushPainting = false;
    let historyStack = [];
    let initialZoom = 1.0;

    // Raw input image & corner detection state
    let currentRawDataUrl = null;
    let currentRawImage = null;
    let currentDetectedCorners = null;

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }

    function clearError() {
        if (!errorEl) return;
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    function setStatus(text, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.style.color = isError ? '#dc2626' : '#15803d';
    }

    function renderWarnings(list) {
        if (!warningBox) return;
        if (!list || !list.length) {
            warningBox.classList.add('hidden');
            warningBox.innerHTML = '';
            return;
        }
        warningBox.innerHTML = '<b>সাবধানতা / পরামর্শ:</b><ul>' +
            list.map(x => '<li>' + String(x).replace(/[&<>]/g, '') + '</li>').join('') +
            '</ul>';
        warningBox.classList.remove('hidden');
    }

    function pushHistory() {
        if (historyStack.length > 10) historyStack.shift();
        historyStack.push(ctx.getImageData(0, 0, OUT_SIZE, OUT_SIZE));
        const undoBtn = $('#undoBtn');
        if (undoBtn) undoBtn.disabled = false;
    }

    function drawScene() {
        if (!fgImage && !aiPreparedImage) return;

        ctx.save();
        // 1. Pure White Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);

        // If user hasn't made custom edits, show pristine AI prepared image
        if (!hasUserEdited && aiPreparedImage) {
            ctx.drawImage(aiPreparedImage, 0, 0, OUT_SIZE, OUT_SIZE);
            ctx.restore();
            updateSizeEstimate();
            return;
        }

        // 2. Brightness & Contrast Filter
        const b = Number(brightSlider.value);
        const c = Number(contrastSlider.value);
        ctx.filter = `brightness(${100 + b}%) contrast(${100 + c}%)`;

        // 3. Draw Foreground with Zoom & Pan
        const scaledW = OUT_SIZE * zoomLevel;
        const scaledH = OUT_SIZE * zoomLevel;
        const drawX = (OUT_SIZE - scaledW) / 2 + panOffset.x;
        const drawY = (OUT_SIZE - scaledH) / 2 + panOffset.y;

        ctx.drawImage(fgImage, drawX, drawY, scaledW, scaledH);
        ctx.restore();

        updateSizeEstimate();
    }

    function updateSizeEstimate() {
        try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const head = 'data:image/jpeg;base64,';
            const bytes = Math.round((dataUrl.length - head.length) * 3 / 4);
            const kb = Math.round(bytes / 1024);
            if (sizeBadge) {
                sizeBadge.textContent = `${kb} KB • 600×600 px`;
                sizeBadge.style.background = kb < 500 ? '#dcfce7' : '#fee2e2';
                sizeBadge.style.color = kb < 500 ? '#15803d' : '#b91c1c';
            }
        } catch (_) { }
    }

    function jpegDensity(bytes) {
        if (!bytes || bytes.length < 20) return bytes;
        let out = bytes;
        for (let i = 2; i < out.length - 18;) {
            if (out[i] !== 0xff) { i++; continue; }
            const marker = out[i + 1];
            if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
            const len = (out[i + 2] << 8) | out[i + 3];
            if (marker === 0xe0 && out[i + 4] === 0x4a && out[i + 5] === 0x46 && out[i + 6] === 0x49 && out[i + 7] === 0x46) {
                out[i + 11] = 1; // Units: 1 = dots per inch (DPI)
                out[i + 12] = 1; out[i + 13] = 44; // 300 DPI X (0x012C)
                out[i + 14] = 1; out[i + 15] = 44; // 300 DPI Y (0x012C)
                return out;
            }
            i += 2 + len;
        }
        return out;
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('ছবি লোড করা যায়নি।'));
            img.src = src;
        });
    }

    async function processImagePayload(blobOrFile, corners = null) {
        clearError();
        setStatus('লোকাল AI দিয়ে ফেস ডিটেক্ট ও ব্যাকগ্রাউন্ড রিমুভ হচ্ছে...');
        if (chooseBtn) chooseBtn.disabled = true;

        // Convert blob/file or string to base64
        let b64 = null;
        if (typeof blobOrFile === 'string' && blobOrFile.startsWith('data:')) {
            b64 = blobOrFile;
            currentRawDataUrl = b64;
            if (!currentRawImage) {
                try {
                    currentRawImage = await loadImage(b64);
                } catch (_) { }
            }
        } else {
            try {
                b64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('ছবি পড়তে সমস্যা হয়েছে।'));
                    reader.readAsDataURL(blobOrFile);
                });
                if (b64) {
                    currentRawDataUrl = b64;
                    try {
                        currentRawImage = await loadImage(b64);
                    } catch (_) { }
                }
            } catch (readErr) {
                console.warn('FileReader error:', readErr);
            }
        }

        let data = null;

        // Strategy 1: Send via chrome.runtime.sendMessage to background worker (bypasses all browser CORS/PNA restrictions)
        if (b64 && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                data = await new Promise((resolve) => {
                    const timer = setTimeout(() => resolve(null), 45000);
                    const msgPayload = {
                        type: 'PREPARE_VISA_PHOTO',
                        imageBase64: b64
                    };
                    if (corners && corners.length === 4) {
                        msgPayload.corners = corners;
                    }
                    chrome.runtime.sendMessage(msgPayload, (resp) => {
                        clearTimeout(timer);
                        if (chrome.runtime.lastError || !resp) {
                            console.warn('Background worker error:', chrome.runtime.lastError);
                            resolve(null);
                        } else {
                            resolve(resp);
                        }
                    });
                });
            } catch (bgErr) {
                console.warn('Background messaging failed:', bgErr);
                data = null;
            }
        }

        // If background worker returned a valid complete response with images
        if (data && data.success && data.white_bg && data.foreground) {
            if (chooseBtn) chooseBtn.disabled = false;
            return data;
        } else if (data && data.success === false) {
            if (chooseBtn) chooseBtn.disabled = false;
            throw new Error(data.message || 'ছবি প্রসেসিং ব্যর্থ হয়েছে।');
        }

        // Strategy 2: Direct fetch to API_URL (fallback if background worker is unavailable or returned incomplete)
        let res;
        try {
            if (b64) {
                const payload = { image: b64 };
                if (corners && corners.length === 4) {
                    payload.corners = corners;
                }
                res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout ? AbortSignal.timeout(90000) : undefined
                });
            } else {
                const fd = new FormData();
                fd.append('image', blobOrFile, blobOrFile.name || 'photo.jpg');
                if (corners) {
                    fd.append('corners', JSON.stringify(corners));
                }
                res = await fetch(API_URL, {
                    method: 'POST',
                    body: fd,
                    signal: AbortSignal.timeout ? AbortSignal.timeout(90000) : undefined
                });
            }
        } catch (e) {
            if (chooseBtn) chooseBtn.disabled = false;
            throw new Error(e.name === 'TimeoutError'
                ? 'ছবি প্রসেসিং সময় বেশি লেগেছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
                : 'IVAC লোকাল সার্ভার সক্রিয় নেই। সফটওয়্যারটি চালু আছে কিনা পরীক্ষা করুন।');
        }

        try {
            data = await res.json();
        } catch (_) {
            if (chooseBtn) chooseBtn.disabled = false;
            throw new Error('সার্ভার থেকে সঠিক তথ্য পাওয়া যায়নি।');
        }

        if (chooseBtn) chooseBtn.disabled = false;
        if (!data || !data.success) {
            throw new Error((data && data.message) || 'ছবি প্রসেসিং ব্যর্থ হয়েছে।');
        }

        return data;
    }

    function showProcessingModal(title, sub) {
        const modal = document.getElementById('processingModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        if (title) {
            const el = document.getElementById('procMainTitle');
            if (el) el.textContent = title;
        }
        if (sub) {
            const el = document.getElementById('procSubTitle');
            if (el) el.textContent = sub;
        }
        setProcStep(1);
    }

    function setProcStep(step) {
        const row1 = document.getElementById('procStepRow1');
        const row2 = document.getElementById('procStepRow2');
        const row3 = document.getElementById('procStepRow3');
        const b1 = document.getElementById('stepBadge1');
        const b2 = document.getElementById('stepBadge2');
        const b3 = document.getElementById('stepBadge3');

        if (!row1 || !row2 || !row3) return;

        [row1, row2, row3].forEach(r => r.className = 'proc-step-row');
        [b1, b2, b3].forEach(b => b.className = 'step-badge');

        if (step === 1) {
            row1.className = 'proc-step-row active running';
            b1.className = 'step-badge running';
            b1.textContent = 'চলছে...';
            b2.textContent = 'অপেক্ষমাণ';
            b3.textContent = 'অপেক্ষমাণ';
        } else if (step === 2) {
            row1.className = 'proc-step-row completed';
            b1.className = 'step-badge done';
            b1.textContent = 'সম্পন্ন ✓';

            row2.className = 'proc-step-row active running';
            b2.className = 'step-badge running';
            b2.textContent = 'চলছে...';
            b3.textContent = 'অপেক্ষমাণ';
        } else if (step >= 3) {
            row1.className = 'proc-step-row completed';
            b1.className = 'step-badge done';
            b1.textContent = 'সম্পন্ন ✓';

            row2.className = 'proc-step-row completed';
            b2.className = 'step-badge done';
            b2.textContent = 'সম্পন্ন ✓';

            row3.className = 'proc-step-row active running';
            b3.className = 'step-badge running';
            b3.textContent = 'চূড়ান্ত হচ্ছে...';
        }
    }

    function hideProcessingModal() {
        const modal = document.getElementById('processingModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    let isProcessing = false;

    async function handleImageFile(file) {
        if (isProcessing) {
            console.log('Already processing, ignoring duplicate call');
            return;
        }
        if (!file || !file.type.startsWith('image/')) {
            showError('শুধুমাত্র JPG, PNG বা WebP ছবি ফাইল প্রদান করুন।');
            return;
        }
        if (file.size > MAX_BYTES) {
            showError('ছবির আকার সর্বোচ্চ ২৫ MB হতে পারে।');
            return;
        }

        isProcessing = true;
        showProcessingModal('ছবি প্রসেস হচ্ছে...', 'লোকাল AI দিয়ে ফেস ডিটেক্ট ও ব্যাকগ্রাউন্ড রিমুভ করা হচ্ছে');
        setProcStep(1);
        setTimeout(() => { if (isProcessing) setProcStep(2); }, 300);

        if (chooseBtn) {
            chooseBtn.disabled = true;
            chooseBtn.textContent = 'প্রসেসিং হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন';
        }

        try {
            const data = await processImagePayload(file);
            setProcStep(3);
            await setupEditor(data);
        } catch (err) {
            showError(err.message || 'ছবি প্রসেসিংয়ে সমস্যা হয়েছে।');
            setStatus('');
        } finally {
            hideProcessingModal();
            isProcessing = false;
            if (chooseBtn) {
                chooseBtn.disabled = false;
                chooseBtn.textContent = 'Upload Photo (ছবি আপলোড)';
            }
            if (fileInput) fileInput.value = '';
        }
    }

    async function handleDataUrl(dataUrl, fileName) {
        if (isProcessing) return;
        isProcessing = true;
        showProcessingModal('ছবি প্রসেস হচ্ছে...', 'লোকাল AI দিয়ে ফেস ডিটেক্ট ও ব্যাকগ্রাউন্ড রিমুভ করা হচ্ছে');
        setProcStep(1);
        setTimeout(() => { if (isProcessing) setProcStep(2); }, 300);

        if (chooseBtn) {
            chooseBtn.disabled = true;
            chooseBtn.textContent = 'প্রসেসিং হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন';
        }

        try {
            clearError();
            setStatus('ছবি কনভার্ট ও প্রসেসিং হচ্ছে...');
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], fileName || 'uploaded.jpg', { type: blob.type || 'image/jpeg' });
            const data = await processImagePayload(file);
            setProcStep(3);
            await setupEditor(data);
        } catch (err) {
            showError(err.message || 'ছবি প্রসেসিংয়ে সমস্যা হয়েছে।');
            setStatus('');
        } finally {
            hideProcessingModal();
            isProcessing = false;
            if (chooseBtn) {
                chooseBtn.disabled = false;
                chooseBtn.textContent = 'Upload Photo (ছবি আপলোড)';
            }
        }
    }

    async function setupEditor(data) {
        // Load pristine AI image, foreground & cropped original
        aiPreparedBase64 = data.white_bg || null;
        if (data.white_bg) {
            try {
                aiPreparedImage = await loadImage(data.white_bg);
            } catch (_) {
                aiPreparedImage = null;
            }
        } else {
            aiPreparedImage = null;
        }
        hasUserEdited = false;

        fgImage = await loadImage(data.foreground);
        if (data.cropped_original) {
            originalImage = await loadImage(data.cropped_original);
            originalPreview.src = data.cropped_original;
        } else if (data.foreground) {
            originalPreview.src = data.foreground;
        }

        // Reset adjustments
        panOffset = { x: 0, y: 0 };
        initialZoom = 1.0;
        zoomLevel = 1.0;
        zoomSlider.value = '1';
        zoomVal.textContent = '1.0x';
        brightSlider.value = '0';
        brightVal.textContent = '0';
        contrastSlider.value = '0';
        contrastVal.textContent = '0';
        brushMode = null;
        historyStack = [];

        $('#eraseBtn')?.classList.remove('active');
        $('#restoreBtn')?.classList.remove('active');
        $('#undoBtn')?.setAttribute('disabled', 'true');

        renderWarnings(data.warnings);

        currentDetectedCorners = data.detected_corners || null;

        const srcLbl = $('#sourceLabel');
        if (srcLbl) {
            if (data.crop && data.crop.is_manual) {
                srcLbl.textContent = 'Custom Cropped Region';
            } else {
                srcLbl.textContent = 'Auto-cropped Region';
            }
        }

        uploadCard.classList.add('hidden');
        editor.classList.remove('hidden');
        downloadBtn.disabled = false;
        setStatus('✓ তৈরি সম্পন্ন! প্রয়োজনে জুম বা পজিশন অ্যাডজাস্ট করুন।');

        drawScene();
    }

    // Canvas Mouse / Touch Controls for Pan and Brush
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (OUT_SIZE / rect.width),
            y: (e.clientY - rect.top) * (OUT_SIZE / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !fgImage) return;
        canvas.setPointerCapture(e.pointerId);

        if (brushMode) {
            pushHistory();
            brushPainting = true;
            paintBrush(e);
        } else {
            isDragging = true;
            dragStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (brushMode && brushPainting) {
            hasUserEdited = true;
            paintBrush(e);
        } else if (isDragging) {
            hasUserEdited = true;
            panOffset.x = Math.max(-70, Math.min(70, e.clientX - dragStart.x));
            panOffset.y = Math.max(-70, Math.min(70, e.clientY - dragStart.y));
            drawScene();
        }
    });

    function stopDrag() {
        isDragging = false;
        brushPainting = false;
    }

    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);

    function paintBrush(e) {
        const pos = getCanvasCoords(e);
        const radius = Number(brushSlider.value);

        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.clip();

        if (brushMode === 'erase') {
            // Paint pure white to erase foreground
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
        } else if (brushMode === 'restore' && originalImage) {
            // Restore from original cropped image
            const scaledW = OUT_SIZE * zoomLevel;
            const scaledH = OUT_SIZE * zoomLevel;
            const drawX = (OUT_SIZE - scaledW) / 2 + panOffset.x;
            const drawY = (OUT_SIZE - scaledH) / 2 + panOffset.y;
            ctx.drawImage(originalImage, drawX, drawY, scaledW, scaledH);
        }
        ctx.restore();
        updateSizeEstimate();
    }

    // Sliders
    zoomSlider.addEventListener('input', () => {
        hasUserEdited = true;
        zoomLevel = Number(zoomSlider.value);
        zoomVal.textContent = zoomLevel.toFixed(2) + 'x';
        drawScene();
    });

    brightSlider.addEventListener('input', () => {
        hasUserEdited = true;
        brightVal.textContent = (brightSlider.value > 0 ? '+' : '') + brightSlider.value;
        drawScene();
    });

    contrastSlider.addEventListener('input', () => {
        hasUserEdited = true;
        contrastVal.textContent = (contrastSlider.value > 0 ? '+' : '') + contrastSlider.value;
        drawScene();
    });

    brushSlider.addEventListener('input', () => {
        brushVal.textContent = brushSlider.value + 'px';
    });

    // Toolbar Buttons
    $('#centerBtn')?.addEventListener('click', () => {
        hasUserEdited = false;
        panOffset = { x: 0, y: 0 };
        zoomLevel = 1.0;
        zoomSlider.value = '1';
        zoomVal.textContent = '1.0x';
        brightSlider.value = '0';
        brightVal.textContent = '0';
        contrastSlider.value = '0';
        contrastVal.textContent = '0';
        brushMode = null;
        $('#eraseBtn')?.classList.remove('active');
        $('#restoreBtn')?.classList.remove('active');
        canvas.style.cursor = 'grab';
        drawScene();
    });

    guideBtn?.addEventListener('click', () => {
        guideOverlay.classList.toggle('hidden');
        guideBtn.classList.toggle('active', !guideOverlay.classList.contains('hidden'));
    });

    $('#eraseBtn')?.addEventListener('click', () => {
        if (brushMode === 'erase') {
            brushMode = null;
            $('#eraseBtn').classList.remove('active');
            canvas.style.cursor = 'grab';
        } else {
            brushMode = 'erase';
            $('#eraseBtn').classList.add('active');
            $('#restoreBtn').classList.remove('active');
            canvas.style.cursor = 'crosshair';
        }
    });

    $('#restoreBtn')?.addEventListener('click', () => {
        if (brushMode === 'restore') {
            brushMode = null;
            $('#restoreBtn').classList.remove('active');
            canvas.style.cursor = 'grab';
        } else {
            brushMode = 'restore';
            $('#restoreBtn').classList.add('active');
            $('#eraseBtn').classList.remove('active');
            canvas.style.cursor = 'crosshair';
        }
    });

    $('#undoBtn')?.addEventListener('click', () => {
        const lastState = historyStack.pop();
        if (lastState) {
            ctx.putImageData(lastState, 0, 0);
            updateSizeEstimate();
        }
        if (!historyStack.length) {
            $('#undoBtn').disabled = true;
        }
    });

    // File Input & Drag and Drop on Main Page
    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            handleImageFile(fileInput.files[0]);
        }
    });

    chooseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
    });

    dropZone.addEventListener('click', (e) => {
        if (e.target !== fileInput && !chooseBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag');
        });
    });

    ['dragleave'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleImageFile(file);
    });

    // Download Handler
    function exportFinalJpeg() {
        if (!hasUserEdited && aiPreparedBase64) {
            const b64 = aiPreparedBase64.split(',')[1];
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
            }
            return new Blob([bytes], { type: 'image/jpeg' });
        }

        const exCanvas = document.createElement('canvas');
        exCanvas.width = OUT_SIZE;
        exCanvas.height = OUT_SIZE;
        const exCtx = exCanvas.getContext('2d');

        // Pure white background composite
        exCtx.fillStyle = '#ffffff';
        exCtx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
        exCtx.drawImage(canvas, 0, 0);

        let quality = 0.93;
        let bytes;
        do {
            const b64 = exCanvas.toDataURL('image/jpeg', quality).split(',')[1];
            const bin = atob(b64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
            }
            quality -= 0.05;
        } while (bytes.length > 350000 && quality > 0.4);

        bytes = jpegDensity(bytes);
        return new Blob([bytes], { type: 'image/jpeg' });
    }

    downloadBtn.addEventListener('click', () => {
        try {
            const blob = exportFinalJpeg();
            const fileName = 'IVAC_Visa_Photo_600x600.jpg';

            if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
                const reader = new FileReader();
                reader.onload = function () {
                    chrome.downloads.download({
                        url: reader.result,
                        filename: fileName,
                        conflictAction: 'overwrite',
                        saveAs: false
                    }, () => {
                        setStatus('✓ ডাউনলোড সম্পন্ন হয়েছে!');
                    });
                };
                reader.readAsDataURL(blob);
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                setStatus('✓ ডাউনলোড সম্পন্ন হয়েছে!');
            }
        } catch (err) {
            showError('ডাউনলোড করতে ত্রুটি: ' + err.message);
        }
    });

    $('#newBtn')?.addEventListener('click', () => {
        editor.classList.add('hidden');
        uploadCard.classList.remove('hidden');
        fileInput.value = '';
        clearError();
        setStatus('');
        fgImage = null;
        originalImage = null;
        if (sizeBadge) sizeBadge.textContent = '600 × 600 px';
    });

    $('#closeBtn')?.addEventListener('click', () => window.close());

    // ==========================================
    // CAMSCANNER 4-CORNER PERSPECTIVE CROP LOGIC
    // ==========================================
    const camModal = $('#perspectiveModal');
    const camCanvas = $('#camCanvas');
    const camCtx = camCanvas ? camCanvas.getContext('2d') : null;
    const camLoupe = $('#camLoupe');
    const loupeCanvas = $('#loupeCanvas');
    const loupeCtx = loupeCanvas ? loupeCanvas.getContext('2d') : null;
    const camCropBtn = $('#camCropBtn');
    const closeCamModal = $('#closeCamModal');
    const camCancelBtn = $('#camCancelBtn');
    const camApplyBtn = $('#camApplyBtn');
    const camRotateLeft = $('#camRotateLeft');
    const camRotateRight = $('#camRotateRight');
    const camResetPoints = $('#camResetPoints');

    let camPoints = [];          // [{x, y}, {x, y}, {x, y}, {x, y}] (TL, TR, BR, BL)
    let camScale = 1.0;          // canvas width / image width
    let activeDragIdx = -1;      // 0..3 for corners, 10..13 for midpoints
    let dragStartPos = { x: 0, y: 0 };
    let dragStartPoints = [];

    function openCamScanner() {
        if (!currentRawImage) {
            showError('মূল ছবিটি পাওয়া যায়নি। অনুগ্রহ করে আবার আপলোড করুন।');
            return;
        }
        if (!camModal || !camCanvas) return;

        camModal.classList.remove('hidden');

        // Determine canvas display size
        const maxW = Math.min(window.innerWidth - 64, 760);
        const maxH = Math.min(window.innerHeight - 220, 520);
        camScale = Math.min(maxW / currentRawImage.width, maxH / currentRawImage.height);
        if (camScale > 1.0) camScale = 1.0;

        const dispW = Math.round(currentRawImage.width * camScale);
        const dispH = Math.round(currentRawImage.height * camScale);

        camCanvas.width = dispW;
        camCanvas.height = dispH;

        if (currentDetectedCorners && currentDetectedCorners.length === 4) {
            camPoints = currentDetectedCorners.map(p => ({
                x: Math.round(p.x * camScale),
                y: Math.round(p.y * camScale)
            }));
        } else {
            resetCamPoints();
        }

        renderCamCanvas();
    }

    function resetCamPoints() {
        const w = camCanvas.width;
        const h = camCanvas.height;
        camPoints = [
            { x: Math.round(w * 0.05), y: Math.round(h * 0.05) }, // TL
            { x: Math.round(w * 0.95), y: Math.round(h * 0.05) }, // TR
            { x: Math.round(w * 0.95), y: Math.round(h * 0.95) }, // BR
            { x: Math.round(w * 0.05), y: Math.round(h * 0.95) }  // BL
        ];
    }

    async function rotateRawImage(clockwise = true) {
        if (!currentRawImage) return;
        const off = document.createElement('canvas');
        off.width = currentRawImage.height;
        off.height = currentRawImage.width;
        const oCtx = off.getContext('2d');
        oCtx.translate(off.width / 2, off.height / 2);
        oCtx.rotate(clockwise ? 90 * Math.PI / 180 : -90 * Math.PI / 180);
        oCtx.drawImage(currentRawImage, -currentRawImage.width / 2, -currentRawImage.height / 2);

        currentRawDataUrl = off.toDataURL('image/jpeg', 0.95);
        currentRawImage = await loadImage(currentRawDataUrl);
        currentDetectedCorners = null;
        openCamScanner();
    }

    function renderCamCanvas() {
        if (!camCtx || !currentRawImage) return;
        const w = camCanvas.width;
        const h = camCanvas.height;

        // 1. Draw base photo
        camCtx.clearRect(0, 0, w, h);
        camCtx.drawImage(currentRawImage, 0, 0, w, h);

        if (camPoints.length !== 4) return;

        // 2. Dim outside polygon
        camCtx.save();
        camCtx.fillStyle = 'rgba(0, 0, 0, 0.58)';
        camCtx.fillRect(0, 0, w, h);
        camCtx.globalCompositeOperation = 'destination-out';
        camCtx.beginPath();
        camCtx.moveTo(camPoints[0].x, camPoints[0].y);
        camCtx.lineTo(camPoints[1].x, camPoints[1].y);
        camCtx.lineTo(camPoints[2].x, camPoints[2].y);
        camCtx.lineTo(camPoints[3].x, camPoints[3].y);
        camCtx.closePath();
        camCtx.fill();
        camCtx.restore();

        // 3. Draw polygon edges
        camCtx.save();
        camCtx.strokeStyle = '#10b981';
        camCtx.lineWidth = 2.8;
        camCtx.shadowColor = 'rgba(16, 185, 129, 0.5)';
        camCtx.shadowBlur = 6;
        camCtx.beginPath();
        camCtx.moveTo(camPoints[0].x, camPoints[0].y);
        camCtx.lineTo(camPoints[1].x, camPoints[1].y);
        camCtx.lineTo(camPoints[2].x, camPoints[2].y);
        camCtx.lineTo(camPoints[3].x, camPoints[3].y);
        camCtx.closePath();
        camCtx.stroke();
        camCtx.restore();

        // 4. Draw edge midpoint pills
        for (let i = 0; i < 4; i++) {
            const pA = camPoints[i];
            const pB = camPoints[(i + 1) % 4];
            const mx = (pA.x + pB.x) / 2;
            const my = (pA.y + pB.y) / 2;
            const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);

            camCtx.save();
            camCtx.translate(mx, my);
            camCtx.rotate(angle);
            camCtx.fillStyle = '#ffffff';
            camCtx.strokeStyle = '#10b981';
            camCtx.lineWidth = 2.5;
            camCtx.beginPath();
            if (camCtx.roundRect) {
                camCtx.roundRect(-12, -5, 24, 10, 4);
            } else {
                camCtx.rect(-12, -5, 24, 10);
            }
            camCtx.fill();
            camCtx.stroke();
            camCtx.restore();
        }

        // 5. Draw corner handles
        for (let i = 0; i < 4; i++) {
            const p = camPoints[i];
            camCtx.save();
            camCtx.fillStyle = '#ffffff';
            camCtx.strokeStyle = '#10b981';
            camCtx.lineWidth = 4;
            camCtx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            camCtx.shadowBlur = 5;
            camCtx.beginPath();
            camCtx.arc(p.x, p.y, 11, 0, Math.PI * 2);
            camCtx.fill();
            camCtx.stroke();

            // Center green dot
            camCtx.fillStyle = '#10b981';
            camCtx.beginPath();
            camCtx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            camCtx.fill();
            camCtx.restore();
        }
    }

    function updateLoupe(cx, cy) {
        if (!camLoupe || !loupeCtx || !currentRawImage) return;
        camLoupe.classList.remove('hidden');

        // Position loupe in opposite corner
        const isLeft = cx < camCanvas.width / 2;
        const isTop = cy < camCanvas.height / 2;
        camLoupe.style.left = isLeft ? `${camCanvas.width - 124}px` : '14px';
        camLoupe.style.top = isTop ? `${camCanvas.height - 124}px` : '14px';

        const loupeW = loupeCanvas.width;
        const loupeH = loupeCanvas.height;
        loupeCtx.clearRect(0, 0, loupeW, loupeH);

        const zoomFactor = 2.4;
        const srcW = loupeW / (camScale * zoomFactor);
        const srcH = loupeH / (camScale * zoomFactor);
        const imgX = (cx / camScale) - srcW / 2;
        const imgY = (cy / camScale) - srcH / 2;

        loupeCtx.drawImage(
            currentRawImage,
            imgX, imgY, srcW, srcH,
            0, 0, loupeW, loupeH
        );
    }

    function getCamPointerPos(e) {
        const rect = camCanvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(camCanvas.width, e.clientX - rect.left)),
            y: Math.max(0, Math.min(camCanvas.height, e.clientY - rect.top))
        };
    }

    if (camCanvas) {
        camCanvas.addEventListener('pointerdown', (e) => {
            const pos = getCamPointerPos(e);
            activeDragIdx = -1;

            // 1. Check corner proximity (within 24px)
            for (let i = 0; i < 4; i++) {
                if (Math.hypot(camPoints[i].x - pos.x, camPoints[i].y - pos.y) < 24) {
                    activeDragIdx = i;
                    break;
                }
            }

            // 2. Check edge midpoint proximity (within 20px)
            if (activeDragIdx === -1) {
                for (let i = 0; i < 4; i++) {
                    const pA = camPoints[i];
                    const pB = camPoints[(i + 1) % 4];
                    const mx = (pA.x + pB.x) / 2;
                    const my = (pA.y + pB.y) / 2;
                    if (Math.hypot(mx - pos.x, my - pos.y) < 20) {
                        activeDragIdx = 10 + i;
                        dragStartPos = { ...pos };
                        dragStartPoints = camPoints.map(p => ({ ...p }));
                        break;
                    }
                }
            }

            if (activeDragIdx !== -1) {
                camCanvas.setPointerCapture(e.pointerId);
                updateLoupe(pos.x, pos.y);
            }
        });

        camCanvas.addEventListener('pointermove', (e) => {
            const pos = getCamPointerPos(e);

            if (activeDragIdx === -1) {
                let hover = false;
                for (let i = 0; i < 4; i++) {
                    if (Math.hypot(camPoints[i].x - pos.x, camPoints[i].y - pos.y) < 24) {
                        hover = true;
                        break;
                    }
                }
                if (!hover) {
                    for (let i = 0; i < 4; i++) {
                        const pA = camPoints[i];
                        const pB = camPoints[(i + 1) % 4];
                        const mx = (pA.x + pB.x) / 2;
                        const my = (pA.y + pB.y) / 2;
                        if (Math.hypot(mx - pos.x, my - pos.y) < 20) {
                            hover = true;
                            break;
                        }
                    }
                }
                camCanvas.style.cursor = hover ? 'grab' : 'crosshair';
                return;
            }

            camCanvas.style.cursor = 'grabbing';

            if (activeDragIdx >= 0 && activeDragIdx < 4) {
                camPoints[activeDragIdx].x = pos.x;
                camPoints[activeDragIdx].y = pos.y;
                updateLoupe(pos.x, pos.y);
            } else if (activeDragIdx >= 10 && activeDragIdx <= 13) {
                const edgeIdx = activeDragIdx - 10;
                const idxA = edgeIdx;
                const idxB = (edgeIdx + 1) % 4;
                const dx = pos.x - dragStartPos.x;
                const dy = pos.y - dragStartPos.y;

                camPoints[idxA].x = Math.max(0, Math.min(camCanvas.width, dragStartPoints[idxA].x + dx));
                camPoints[idxA].y = Math.max(0, Math.min(camCanvas.height, dragStartPoints[idxA].y + dy));
                camPoints[idxB].x = Math.max(0, Math.min(camCanvas.width, dragStartPoints[idxB].x + dx));
                camPoints[idxB].y = Math.max(0, Math.min(camCanvas.height, dragStartPoints[idxB].y + dy));
                updateLoupe(pos.x, pos.y);
            }

            renderCamCanvas();
        });

        function stopCamDrag(e) {
            if (activeDragIdx !== -1) {
                activeDragIdx = -1;
                if (e && e.pointerId) {
                    try { camCanvas.releasePointerCapture(e.pointerId); } catch (_) { }
                }
            }
            if (camLoupe) camLoupe.classList.add('hidden');
            camCanvas.style.cursor = 'crosshair';
        }

        camCanvas.addEventListener('pointerup', stopCamDrag);
        camCanvas.addEventListener('pointercancel', stopCamDrag);
    }

    if (camCropBtn) camCropBtn.addEventListener('click', openCamScanner);
    if (closeCamModal) closeCamModal.addEventListener('click', () => camModal.classList.add('hidden'));
    if (camCancelBtn) camCancelBtn.addEventListener('click', () => camModal.classList.add('hidden'));
    if (camResetPoints) {
        camResetPoints.addEventListener('click', () => {
            resetCamPoints();
            renderCamCanvas();
        });
    }
    if (camRotateLeft) camRotateLeft.addEventListener('click', () => rotateRawImage(false));
    if (camRotateRight) camRotateRight.addEventListener('click', () => rotateRawImage(true));

    if (camApplyBtn) {
        camApplyBtn.addEventListener('click', async () => {
            if (!currentRawDataUrl || !currentRawImage) return;

            camApplyBtn.disabled = true;
            camApplyBtn.textContent = 'প্রসেসিং হচ্ছে...';
            camModal.classList.add('hidden');
            showProcessingModal('কর্নার ক্রপ প্রসেস হচ্ছে...', 'পারসপেক্টিভ ট্রান্সফর্ম ও নতুন ২"×২" ছবি তৈরি করা হচ্ছে');
            setProcStep(2);

            try {
                const origCorners = camPoints.map(p => ({
                    x: Math.round(p.x / camScale),
                    y: Math.round(p.y / camScale)
                }));

                const data = await processImagePayload(currentRawDataUrl, origCorners);
                setProcStep(3);
                await setupEditor(data);
                setStatus('✓ কর্নার ক্রপ সম্পন্ন! ৬০০×৬০০ ভিসা ছবি প্রস্তুত।');
            } catch (err) {
                showError('কর্নার ক্রপ ব্যর্থ হয়েছে: ' + (err.message || ''));
            } finally {
                hideProcessingModal();
                camApplyBtn.disabled = false;
                camApplyBtn.textContent = '✓ ক্রপ ও প্রসেস করুন';
            }
        });
    }

    // Check for pending photo from SidePanel / Docs tab
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['pendingVisaPhoto'], (res) => {
            if (res && res.pendingVisaPhoto && res.pendingVisaPhoto.dataUrl) {
                const photo = res.pendingVisaPhoto;
                chrome.storage.local.remove(['pendingVisaPhoto']);
                handleDataUrl(photo.dataUrl, photo.name);
            }
        });
    }
})();
