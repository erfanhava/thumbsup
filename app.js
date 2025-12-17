/* global supabase, jspdf */

// 0. CONFIG – paste your own keys here (or use Vercel env variables)
const SUPABASE_URL = 'https://YOURPROJECT.supabase.co';
const SUPABASE_ANON = 'YOURANONKEY';
const CLOUDINARY_CLOUD = 'YOUR_CLOUD';
const CLOUDINARY_PRESET = 'unsigned_upload_preset'; // create in Cloudinary settings → Upload → Add preset → unsigned
const GEMINI_KEY = 'YOUR_GEMINI_KEY';

// 1. INIT
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
let photos = []; // {file, url} objects

// 2. AUTH (Google one-click)
loginBtn.onclick = async () => {
  await sb.auth.signInWithOAuth({provider:'google'});
};
sb.auth.onAuthStateChange((e, session) => {
  if (session) loginBtn.style.display = 'none';
});

// 3. CAMERA
const video = document.getElementById('video');
navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
  .then(stream => video.srcObject = stream);

snapBtn.onclick = () => {
  const canvas = document.getElementById('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(async blob => {
    const file = new File([blob], `photo_${Date.now()}.jpg`, {type:'image/jpeg'});
    const url = await uploadToCloudinary(file);
    photos.push({file, url});
    renderGallery();
  }, 'image/jpeg', 0.8);
};

function renderGallery() {
  gallery.innerHTML = photos.map(p => `<img src="${p.url}" />`).join('');
  photoCount.textContent = photos.length;
}

// 4. VOICE NOTE (Web Speech API)
micBtn.onclick = () => {
  const rec = new webkitSpeechRecognition();
  rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
  rec.onresult = e => notes.value += e.results[0][0].transcript + '. ';
  rec.start();
};

// 5. GENERATE PDF + UPLOAD
genBtn.onclick = async () => {
  genBtn.disabled = true; genBtn.textContent = 'Working…';
  const rawNotes = notes.value;
  const cleanNotes = await cleanWithAI(rawNotes);
  const pdfBlob = await buildPDF(cleanNotes);
  const pdfUrl = await uploadToSupabase(pdfBlob);
  pdfLink.href = pdfLink.textContent = pdfUrl;
  resultSec.hidden = false;
  genBtn.disabled = false; genBtn.textContent = 'Generate PDF & Share Link';
};

// 6. HELPERS
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {method:'POST', body:fd});
  const data = await res.json();
  return data.secure_url;
}

async function cleanWithAI(text) {
  const prompt = `Clean up these job notes into 3 short bullets for a customer report:\n${text}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
  });
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || text;
}

async function buildPDF(cleanNotes) {
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'p', unit:'pt', format:'a4'});
  doc.setFontSize(20);
  doc.text('Job Report', 40, 50);
  doc.setFontSize(12);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 40, 80);
  doc.text('Summary:', 40, 110);
  const split = doc.splitTextToSize(cleanNotes, 500);
  doc.text(split, 40, 130);
  // add photos (max 4 per page)
  let y = 180;
  for (let i = 0; i < photos.length; i++) {
    if (i % 2 === 0 && i > 0) y += 220;
    const imgData = await fetch(photos[i].url).then(r => r.blob()).then(b => new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result.split(',')[1]);
      reader.readAsDataURL(b);
    }));
    doc.addImage(imgData, 'JPEG', 40 + (i % 2) * 260, y, 240, 180);
  }
  return doc.output('blob');
}

async function uploadToSupabase(blob) {
  const fileName = `report_${Date.now()}.pdf`;
  const {data, error} = await sb.storage.from('reports').upload(fileName, blob, {
    cacheControl:'3600',
    upsert:false,
    contentType:'application/pdf'
  });
  if (error) { alert(error.message); return ''; }
  const {data:{publicUrl}} = sb.storage.from('reports').getPublicUrl(fileName);
  // also save row
  await sb.from('jobs').insert({
    user_id: sb.auth.user()?.id,
    photos: photos.map(p => p.url),
    notes: notes.value,
    pdf_url: publicUrl
  });
  return publicUrl;
}
