/* global supabase, jspdf */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOURPROJECT.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || 'YOURANONKEY';
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD || 'YOUR_CLOUD';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET || 'unsigned_preset';
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY || 'YOURGEMINIKEY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
let photos = [];

// ---------- AUTH ----------
loginBtn.onclick = () => sb.auth.signInWithOAuth({provider:'google'});
sb.auth.onAuthStateChange((e,s)=>{if(s)loginBtn.style.display='none';});

// ---------- CAMERA ----------
navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
  .then(s=>video.srcObject=s);

snapBtn.onclick = () => {
  const can = document.createElement('canvas');
  can.width = video.videoWidth;
  can.height = video.videoHeight;
  can.getContext('2d').drawImage(video,0,0);
  can.toBlob(async blob=>{
    const url = await uploadImg(blob);
    photos.push(url);
    renderGallery();
    if(photos.length===1){step1.hidden=true;step2.hidden=false;}
  },'image/jpeg',0.8);
};

async function uploadImg(blob){
  const fd = new FormData();
  fd.append('file',blob);
  fd.append('upload_preset',UPLOAD_PRESET);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd});
  return (await r.json()).secure_url;
}

function renderGallery(){
  gallery.innerHTML = photos.map(p=>`<img src="${p}">`).join('');
}

// ---------- VOICE ----------
micBtn.onclick = () => {
  const rec = new webkitSpeechRecognition();
  rec.lang='en-US'; rec.interimResults=false;
  rec.onresult = e => notes.value += e.results[0][0].transcript+'. ';
  rec.start();
};

// ---------- PDF ----------
genBtn.onclick = async () => {
  genBtn.disabled = true; genBtn.textContent = 'Creating…';
  const summary = await cleanNote(notes.value);
  const pdfBlob = await buildPDF(summary);
  const pdfUrl = await uploadPDF(pdfBlob);
  pdfLink.href = pdfUrl;
  step2.hidden = true; step3.hidden = false;
};

async function cleanNote(raw){
  const prompt = `Turn these notes into 3 short customer-ready bullets:\n${raw}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
  });
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || raw;
}

async function buildPDF(text){
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({format:'a4',unit:'pt'});
  doc.setFontSize(22);
  doc.text('Job Report',40,60);
  doc.setFontSize(12);
  doc.text(`Date: ${new Date().toLocaleDateString()}`,40,90);
  doc.text(text,40,120);
  let y = 180;
  for(let i=0;i<photos.length;i++){
    if(i&&i%2===0)y+=160;
    const img = await fetch(photos[i]).then(r=>r.blob()).then(b=>new Promise(r=>{
      const reader = new FileReader(); reader.onloadend=()=>r(reader.result.split(',')[1]); reader.readAsDataURL(b);
    }));
    doc.addImage(img,'JPEG',40+(i%2)*250,y,220,140);
  }
  return doc.output('blob');
}

async function uploadPDF(blob){
  const fname = `report_${Date.now()}.pdf`;
  const {data,error} = await sb.storage.from('reports').upload(fname,blob,{contentType:'application/pdf'});
  if(error){alert(error.message);return;}
  const {data:{publicUrl}} = sb.storage.from('reports').getPublicUrl(fname);
  await sb.from('jobs').insert({user_id:sb.auth.user()?.id,photos,notes:notes.value,pdf_url:publicUrl});
  return publicUrl;
}
