/* =====================================================
   LinguaAI — ocr.js
   OCR, camera, and gallery logic (Tesseract.js)
   ===================================================== */

let imgFile = null;
let camStream = null;

// ---- IMAGE LOADING ----
function loadImg(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast('Format tidak didukung (JPG/PNG/WEBP)', 'error'); return;
  }
  if (file.size > 10 * 1024 * 1024) { toast('File terlalu besar (maks 10MB)', 'error'); return; }
  imgFile = file;
  const r = new FileReader();
  r.onload = e => {
    $('ocrImg').src = e.target.result;
    $('ocrPrev').classList.add('show');
    runOCRandTranslate();
  };
  r.readAsDataURL(file);
  toast('Memproses gambar...', 'info');
}

// ---- OCR + AUTO TRANSLATE ----
async function runOCRandTranslate() {
  if (!imgFile) return;
  const sel = $('ocrLang').value;
  const lang = sel === 'auto' ? 'eng+jpn+ind+kor' : sel;

  $('ocrProg').classList.add('show');
  $('progFill').style.width = '0%';
  $('progLbl').textContent = 'Mendeteksi teks...';

  try {
    const worker = await Tesseract.createWorker(lang, 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 80);
          $('progFill').style.width = pct + '%';
          $('progLbl').textContent = `Membaca teks... ${Math.round(m.progress * 100)}%`;
        } else if (m.status.includes('load language') || m.status.includes('loading')) {
          $('progFill').style.width = '15%';
          $('progLbl').textContent = 'Memuat bahasa OCR...';
        } else if (m.status.includes('initializ')) {
          $('progFill').style.width = '30%';
          $('progLbl').textContent = 'Menginisialisasi...';
        }
      }
    });

    const { data: { text } } = await worker.recognize(imgFile);
    await worker.terminate();

    const cleaned = text.trim();
    if (!cleaned) {
      toast('Tidak ada teks terdeteksi di gambar', 'error');
      $('ocrProg').classList.remove('show');
      return;
    }

    $('progFill').style.width = '85%';
    $('progLbl').textContent = 'Menerjemahkan...';

    switchTab('tr');
    $('srcTxt').value = cleaned;
    updateChar();
    resize($('srcTxt'));

    await translate();

    $('progFill').style.width = '100%';
    $('progLbl').textContent = 'Selesai!';
    setTimeout(() => $('ocrProg').classList.remove('show'), 1200);

  } catch(err) {
    toast('Gagal: ' + (err.message || 'error'), 'error');
    $('ocrProg').classList.remove('show');
  }
}

// ---- CAMERA ----
async function openCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Fallback langsung ke file input
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.onchange = e => { if (e.target.files[0]) loadImg(e.target.files[0]); };
    inp.click(); return;
  }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    $('camVid').srcObject = camStream;
    $('camModal').classList.add('open');
  } catch(e) {
    console.error('Camera error:', e.name, e.message);
    // Fallback untuk semua error kamera
    toast('Membuka galeri...', 'info');
    setTimeout(() => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.onchange = e => { if (e.target.files[0]) loadImg(e.target.files[0]); };
      inp.click();
    }, 400);
  }
}

function closeCam() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  $('camVid').srcObject = null;
  $('camModal').classList.remove('open');
}

function capturePhoto() {
  const v = $('camVid'), c = $('camCanvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  c.toBlob(blob => {
    loadImg(new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
    closeCam();
    switchTab('ocr');
  }, 'image/jpeg', 0.92);
}

// ---- OCR EVENTS ----
function bindOCREvents() {
  $('imgInput').onchange = e => { if (e.target.files[0]) loadImg(e.target.files[0]); };
  $('camInput').onchange = e => { if (e.target.files[0]) loadImg(e.target.files[0]); };
  $('galInput').onchange = e => { if (e.target.files[0]) loadImg(e.target.files[0]); };

  $('removeImg').onclick = () => {
    imgFile = null;
    $('ocrPrev').classList.remove('show');
    $('ocrImg').src = '';
    $('imgInput').value = '';
  };

  // Drag & drop (desktop only)
  const dz = $('dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag');
    if (e.dataTransfer && e.dataTransfer.files[0]) loadImg(e.dataTransfer.files[0]);
  });

  // Camera modal
  $('capBtn').onclick = capturePhoto;
  $('closeCam').onclick = closeCam;
  $('camCancel').onclick = closeCam;
  $('camModal').onclick = e => { if (e.target === $('camModal')) closeCam(); };
}
