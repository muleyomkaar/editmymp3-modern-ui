const $ = (id) => document.getElementById(id);
const input = $("convertFileInput");
const upload = $("convertUploadBox");
const workspace = $("converterWorkspace");
const sourcePlayer = $("convertSourcePlayer");
const resultPlayer = $("convertResultPlayer");
let file = null;
let buffer = null;
let sourceUrl = null;
let resultUrl = null;
let ctx = null;

function audioContext() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("Web Audio is not supported by this browser.");
    ctx = new Ctx();
  }
  return ctx;
}
function fmt(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function size(bytes) { const mb = bytes / 1048576; return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`; }
function status(text, type="") { const el=$("convertStatus"); el.textContent=text; el.className=`upload-status ${type}`.trim(); }
function progress(value, label) { const v=Math.max(0,Math.min(100,Math.round(value))); $("convertProgressFill").style.width=`${v}%`; $("convertProgressPercent").textContent=`${v}%`; if(label) $("convertProgressLabel").textContent=label; }

async function openFile(next) {
  if (!next) return;
  const okay = (next.name || "").toLowerCase().endsWith(".mp3") || next.type === "audio/mpeg" || next.type === "audio/mp3";
  if (!okay) { status("Please choose an MP3 file.", "error"); input.value=""; return; }
  file = next; buffer = null; $("convertResult").classList.add("hidden");
  if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = URL.createObjectURL(file); sourcePlayer.src = sourceUrl;
  $("convertFileName").textContent=file.name; $("convertFileSize").textContent=size(file.size); $("convertDuration").textContent="Loading…"; workspace.classList.remove("hidden"); status(`Selected: ${file.name}`, "ok");
  try { const bytes=await file.arrayBuffer(); buffer=await audioContext().decodeAudioData(bytes.slice(0)); $("convertDuration").textContent=fmt(buffer.duration); status("MP3 ready to convert.", "ok"); }
  catch(e){ console.error(e); status("This MP3 could not be decoded by your browser.", "error"); }
}
input.addEventListener("change", e => openFile(e.target.files?.[0]));
$("convertReplaceBtn").addEventListener("click", ()=>{ input.value=""; input.click(); });
["dragenter","dragover"].forEach(n=>upload.addEventListener(n,e=>{e.preventDefault(); upload.classList.add("dragover");}));
["dragleave","drop"].forEach(n=>upload.addEventListener(n,e=>{e.preventDefault(); upload.classList.remove("dragover");}));
upload.addEventListener("drop", e=>openFile(e.dataTransfer?.files?.[0]));

function writeString(view, offset, string){ for(let i=0;i<string.length;i++) view.setUint8(offset+i,string.charCodeAt(i)); }
function toWav(audioBuffer) {
  const channels=Math.min(2,audioBuffer.numberOfChannels), rate=audioBuffer.sampleRate, frames=audioBuffer.length, bytesPerSample=2, blockAlign=channels*bytesPerSample;
  const ab=new ArrayBuffer(44 + frames*blockAlign), view=new DataView(ab);
  writeString(view,0,"RIFF"); view.setUint32(4,36+frames*blockAlign,true); writeString(view,8,"WAVE"); writeString(view,12,"fmt "); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true); view.setUint32(24,rate,true); view.setUint32(28,rate*blockAlign,true); view.setUint16(32,blockAlign,true); view.setUint16(34,16,true); writeString(view,36,"data"); view.setUint32(40,frames*blockAlign,true);
  const data=[]; for(let c=0;c<channels;c++) data.push(audioBuffer.getChannelData(c)); let offset=44;
  for(let i=0;i<frames;i++) { for(let c=0;c<channels;c++) { let sample=Math.max(-1,Math.min(1,data[c][i])); sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; view.setInt16(offset, sample, true); offset += 2; } }
  return new Blob([ab], {type:"audio/wav"});
}
$("convertBtn").addEventListener("click", async ()=>{
  if(!buffer){ status("Choose and load an MP3 first.","error"); return; }
  const btn=$("convertBtn"); btn.disabled=true; $("convertResult").classList.add("hidden"); $("convertProgress").classList.remove("hidden"); progress(10,"Preparing audio…");
  try { await new Promise(r=>setTimeout(r,30)); progress(35,"Writing WAV…"); const blob=toWav(buffer); progress(100,"Done"); if(resultUrl) URL.revokeObjectURL(resultUrl); resultUrl=URL.createObjectURL(blob); resultPlayer.src=resultUrl; $("convertDownloadBtn").href=resultUrl; $("convertDownloadBtn").download=file.name.replace(/\.mp3$/i,"")+".wav"; setTimeout(()=>{ $("convertProgress").classList.add("hidden"); $("convertResult").classList.remove("hidden"); $("convertResult").scrollIntoView({behavior:"smooth",block:"center"}); },180); }
  catch(e){ console.error(e); $("convertProgress").classList.add("hidden"); status(e.message || "Conversion failed.","error"); }
  finally { btn.disabled=false; }
});