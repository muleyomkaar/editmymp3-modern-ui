const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const uploadBox = $("uploadBox");
const editor = $("editor");
const audioPlayer = $("audioPlayer");
const resultPlayer = $("resultPlayer");
const processBtn = $("processBtn");
const progressCard = $("progressCard");
const progressFill = $("progressFill");
const progressPercent = $("progressPercent");
const progressLabel = $("progressLabel");
const resultCard = $("resultCard");
const downloadBtn = $("downloadBtn");
const engineLoader = $("engineLoader");
const uploadStatus = $("uploadStatus");

let selectedFile = null;
let selectedSpeed = 1;
let sourceUrl = null;
let resultUrl = null;
let decodedBuffer = null;
let audioContext = null;
let previewStopTimer = null;
let currentAiPlan = null;

function updateTrimUI() {
  const startRange = $("startRange");
  const endRange = $("endRange");
  if (!startRange || !endRange) return;

  const max = Number(endRange.max) || 1;
  let start = Number(startRange.value) || 0;
  let end = Number(endRange.value) || max;
  const minGap = Math.min(0.1, max);

  if (start > end - minGap) {
    start = Math.max(0, end - minGap);
    startRange.value = String(start);
  }
  if (end < start + minGap) {
    end = Math.min(max, start + minGap);
    endRange.value = String(end);
  }

  $("startTimeLabel").textContent = formatTimePrecise(start);
  $("endTimeLabel").textContent = formatTimePrecise(end);

  const startPct = (start / max) * 100;
  const endPct = (end / max) * 100;
  const selection = $("trimSelection");
  selection.style.left = `${startPct}%`;
  selection.style.width = `${Math.max(0, endPct - startPct)}%`;
}

function setTrimDuration(duration) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const startRange = $("startRange");
  const endRange = $("endRange");
  startRange.min = "0";
  startRange.max = String(safeDuration);
  startRange.value = "0";
  endRange.min = "0";
  endRange.max = String(safeDuration);
  endRange.value = String(safeDuration);
  updateTrimUI();
}

function formatTimePrecise(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatSize(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

function setUploadStatus(text, type = "") {
  uploadStatus.textContent = text;
  uploadStatus.className = `upload-status ${type}`.trim();
}

function setProgress(percent, label) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  progressFill.style.width = `${value}%`;
  progressPercent.textContent = `${value}%`;
  if (label) progressLabel.textContent = label;
}

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error("Web Audio is not supported by this browser.");
    audioContext = new AudioCtx();
  }
  return audioContext;
}

async function decodeSelectedFile(file) {
  const context = getAudioContext();
  const bytes = await file.arrayBuffer();
  // Safari can detach the ArrayBuffer passed to decodeAudioData, so use a copy.
  return await context.decodeAudioData(bytes.slice(0));
}



/* ---------- Dedicated SEO page focus ---------- */
function focusCurrentToolAfterUpload() {
  const focus = document.body?.dataset?.focus || "ai";
  if (focus === "ai" || focus === "merge" || focus === "converter") return;
  const map = { cutter: "trimToolCard", volume: "volumeToolCard", speed: "speedToolCard" };
  const target = document.getElementById(map[focus]);
  if (!target) return;
  setEditMode("manual");
  document.querySelectorAll(".tool-card.focused-tool").forEach(el => el.classList.remove("focused-tool"));
  target.classList.add("focused-tool");
  window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
}

async function openFile(file) {
  if (!file) return;

  const lowerName = (file.name || "").toLowerCase();
  const isMp3 = lowerName.endsWith(".mp3") || file.type === "audio/mpeg" || file.type === "audio/mp3";
  if (!isMp3) {
    setUploadStatus("Please choose an MP3 file.", "error");
    fileInput.value = "";
    return;
  }

  selectedFile = file;
  decodedBuffer = null;
  resultCard.classList.add("hidden");
  setUploadStatus(`Selected: ${file.name}`, "ok");

  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  audioPlayer.src = sourceUrl;
  audioPlayer.load();

  $("fileName").textContent = file.name;
  $("fileSize").textContent = formatSize(file.size);
  $("durationText").textContent = "Loading…";
  setTrimDuration(1);

  editor.classList.remove("hidden");
  editor.scrollIntoView({ behavior: "smooth", block: "start" });

  const updateMetadata = () => {
    if (Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
      $("durationText").textContent = formatTime(audioPlayer.duration);
      setTrimDuration(audioPlayer.duration);
    }
  };
  audioPlayer.onloadedmetadata = updateMetadata;
  audioPlayer.ondurationchange = updateMetadata;

  engineLoader.classList.remove("hidden");
  engineLoader.querySelector("strong").textContent = "Reading your MP3…";
  engineLoader.querySelector("p").textContent = "The file stays on this device.";

  try {
    decodedBuffer = await decodeSelectedFile(file);
    $("durationText").textContent = formatTime(decodedBuffer.duration);
    setTrimDuration(decodedBuffer.duration);
    setUploadStatus("MP3 loaded successfully.", "ok");
    focusCurrentToolAfterUpload();
  } catch (error) {
    console.error(error);
    setUploadStatus("This MP3 could not be decoded by your browser. Try another MP3 file.", "error");
  } finally {
    engineLoader.classList.add("hidden");
  }
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  openFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  uploadBox.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadBox.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadBox.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadBox.classList.remove("dragover");
  });
});

uploadBox.addEventListener("drop", (event) => {
  openFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
});

function chooseReplacement() {
  fileInput.value = ""; // Allows choosing the same file again.
  fileInput.click();
}

$("replaceFileBtn").addEventListener("click", chooseReplacement);
$("editAgainBtn").addEventListener("click", chooseReplacement);

$("startRange").addEventListener("input", () => {
  const end = Number($("endRange").value);
  const max = Number($("startRange").max) || 1;
  const minGap = Math.min(0.1, max);
  if (Number($("startRange").value) > end - minGap) {
    $("startRange").value = String(Math.max(0, end - minGap));
  }
  audioPlayer.currentTime = Number($("startRange").value);
  updateTrimUI();
});

$("endRange").addEventListener("input", () => {
  const start = Number($("startRange").value);
  const max = Number($("endRange").max) || 1;
  const minGap = Math.min(0.1, max);
  if (Number($("endRange").value) < start + minGap) {
    $("endRange").value = String(Math.min(max, start + minGap));
  }
  audioPlayer.currentTime = Math.max(0, Number($("endRange").value) - 0.15);
  updateTrimUI();
});

$("previewSelectionBtn").addEventListener("click", async () => {
  const start = Number($("startRange").value);
  const end = Number($("endRange").value);
  if (!selectedFile || end <= start) return;

  if (previewStopTimer) clearInterval(previewStopTimer);
  audioPlayer.currentTime = start;
  try {
    await audioPlayer.play();
  } catch {}
  previewStopTimer = setInterval(() => {
    if (audioPlayer.currentTime >= end || audioPlayer.ended) {
      audioPlayer.pause();
      clearInterval(previewStopTimer);
      previewStopTimer = null;
    }
  }, 50);
});

$("resetTrimBtn").addEventListener("click", () => {
  const duration = decodedBuffer?.duration || audioPlayer.duration || 1;
  setTrimDuration(duration);
  audioPlayer.currentTime = 0;
});

$("volumeRange").addEventListener("input", (event) => {
  $("volumeOutput").textContent = `${event.target.value}%`;
});

document.querySelectorAll("[data-speed]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-speed]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedSpeed = Number(button.dataset.speed);
    audioPlayer.playbackRate = selectedSpeed;
  });
});

/* ---------- AI edit planner ---------- */

function setEditMode(mode) {
  const aiMode = mode === "ai";
  $("aiPanel").classList.toggle("hidden", !aiMode);
  $("manualPanel").classList.toggle("hidden", aiMode);
  $("aiModeBtn").classList.toggle("active", aiMode);
  $("manualModeBtn").classList.toggle("active", !aiMode);
  $("aiModeBtn").setAttribute("aria-selected", String(aiMode));
  $("manualModeBtn").setAttribute("aria-selected", String(!aiMode));
}

$("aiModeBtn").addEventListener("click", () => setEditMode("ai"));
$("manualModeBtn").addEventListener("click", () => setEditMode("manual"));

document.querySelectorAll(".example-chip").forEach((button) => {
  button.addEventListener("click", () => {
    $("aiCommand").value = button.textContent.trim();
    $("aiCommand").focus();
  });
});

function showAiError(message) {
  const box = $("aiError");
  box.textContent = message;
  box.classList.remove("hidden");
}

function clearAiError() {
  $("aiError").classList.add("hidden");
  $("aiError").textContent = "";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeAiPlan(plan, duration) {
  const allowedSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const allowedFades = [0, 1, 2, 3, 5];
  const speed = allowedSpeeds.includes(Number(plan.speed)) ? Number(plan.speed) : 1;
  const fadeIn = allowedFades.includes(Number(plan.fade_in_seconds)) ? Number(plan.fade_in_seconds) : 0;
  const fadeOut = allowedFades.includes(Number(plan.fade_out_seconds)) ? Number(plan.fade_out_seconds) : 0;
  let start = clamp(Number(plan.trim_start) || 0, 0, duration);
  let end = clamp(Number(plan.trim_end) || duration, 0, duration);
  if (end <= start) { start = 0; end = duration; }

  return {
    can_apply: plan.can_apply !== false,
    summary: String(plan.summary || "AI edit plan"),
    message: String(plan.message || ""),
    trim_start: start,
    trim_end: end,
    volume_percent: Math.round(clamp(Number(plan.volume_percent) || 100, 25, 200) / 5) * 5,
    speed,
    fade_in_seconds: fadeIn,
    fade_out_seconds: fadeOut,
    normalize: Boolean(plan.normalize),
    reverse: Boolean(plan.reverse),
  };
}

function renderAiPlan(plan) {
  $("aiPlanSummary").textContent = plan.summary;
  const list = $("aiPlanList");
  list.innerHTML = "";

  const items = [
    ["✂️ Trim", `${formatTimePrecise(plan.trim_start)} → ${formatTimePrecise(plan.trim_end)}`],
    ["🔊 Volume", `${plan.volume_percent}%`],
    ["⚡ Speed", `${plan.speed}×`],
    ["🌊 Fade", `in ${plan.fade_in_seconds}s • out ${plan.fade_out_seconds}s`],
    ["🎚️ Normalize", plan.normalize ? "On" : "Off"],
    ["↩️ Reverse", plan.reverse ? "On" : "Off"],
  ];

  for (const [label, value] of items) {
    const row = document.createElement("div");
    row.className = "ai-plan-item";
    const left = document.createElement("span");
    left.textContent = label;
    const right = document.createElement("strong");
    right.textContent = value;
    row.append(left, right);
    list.appendChild(row);
  }

  $("aiApplyBtn").classList.toggle("hidden", !plan.can_apply);
  $("aiPlanCard").classList.remove("hidden");
  if (!plan.can_apply && plan.message) showAiError(plan.message);
}

async function createAiPlan() {
  clearAiError();
  $("aiPlanCard").classList.add("hidden");

  if (!decodedBuffer) {
    showAiError("Choose and load an MP3 first.");
    return;
  }

  const command = $("aiCommand").value.trim();
  if (!command) {
    showAiError("Tell the AI what you want to change, or tap one of the examples.");
    return;
  }

  $("aiPlanBtn").disabled = true;
  $("aiLoading").classList.remove("hidden");

  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command,
        duration: decodedBuffer.duration,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "AI could not create a plan.");
    }

    currentAiPlan = sanitizeAiPlan(data.plan, decodedBuffer.duration);
    renderAiPlan(currentAiPlan);
  } catch (error) {
    console.error(error);
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const message = error?.message === "Failed to fetch"
      ? "The AI backend could not be reached. If you just deployed the site, make sure _worker.js was uploaded and GROQ_API_KEY is set in Cloudflare."
      : (error.message || "AI is temporarily unavailable.");
    const localHint = isLocal
      ? " For local AI testing, use Cloudflare Pages dev instead of a basic static server."
      : "";
    showAiError(message + localHint);
  } finally {
    $("aiPlanBtn").disabled = false;
    $("aiLoading").classList.add("hidden");
  }
}

$("aiPlanBtn").addEventListener("click", createAiPlan);
$("aiCommand").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") createAiPlan();
});

function applyAiPlanToControls(plan) {
  $("startRange").value = String(plan.trim_start);
  $("endRange").value = String(plan.trim_end);
  updateTrimUI();

  $("volumeRange").value = String(plan.volume_percent);
  $("volumeOutput").textContent = `${plan.volume_percent}%`;

  selectedSpeed = plan.speed;
  document.querySelectorAll("[data-speed]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.speed) === plan.speed);
  });
  audioPlayer.playbackRate = plan.speed;

  $("fadeIn").value = String(plan.fade_in_seconds);
  $("fadeOut").value = String(plan.fade_out_seconds);
  $("normalizeCheck").checked = plan.normalize;
  $("reverseCheck").checked = plan.reverse;
}

$("aiApplyBtn").addEventListener("click", () => {
  if (!currentAiPlan || !currentAiPlan.can_apply) return;
  applyAiPlanToControls(currentAiPlan);
  processBtn.click();
});

$("aiAdjustBtn").addEventListener("click", () => {
  if (currentAiPlan) applyAiPlanToControls(currentAiPlan);
  setEditMode("manual");
  $("manualPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

function toInt16(floatArray) {
  const out = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i++) {
    const sample = Math.max(-1, Math.min(1, floatArray[i]));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

function linearResample(input, speed) {
  if (speed === 1) return input;
  const outputLength = Math.max(1, Math.floor(input.length / speed));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const source = i * speed;
    const left = Math.floor(source);
    const right = Math.min(left + 1, input.length - 1);
    const mix = source - left;
    output[i] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
}

function makeEditedChannels(buffer, startSeconds, endSeconds) {
  const sampleRate = buffer.sampleRate;
  const startFrame = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endFrame = Math.min(buffer.length, Math.ceil(endSeconds * sampleRate));
  const frameCount = Math.max(1, endFrame - startFrame);
  const channelCount = Math.min(2, buffer.numberOfChannels);
  const channels = [];

  for (let c = 0; c < channelCount; c++) {
    const source = buffer.getChannelData(c).subarray(startFrame, endFrame);
    channels.push(linearResample(new Float32Array(source), selectedSpeed));
  }

  // Downmix unusual multichannel audio to stereo by adding remaining channels softly.
  if (buffer.numberOfChannels > 2) {
    for (let c = 2; c < buffer.numberOfChannels; c++) {
      const extra = linearResample(new Float32Array(buffer.getChannelData(c).subarray(startFrame, endFrame)), selectedSpeed);
      const target = channels[c % 2];
      const count = Math.min(target.length, extra.length);
      for (let i = 0; i < count; i++) target[i] = (target[i] + extra[i] * 0.5) / 1.5;
    }
  }

  return { channels, sampleRate, originalFrames: frameCount };
}

function applyEffects(channels, sampleRate) {
  const volume = Number($("volumeRange").value) / 100;
  const fadeInFrames = Math.floor(Number($("fadeIn").value) * sampleRate / selectedSpeed);
  const fadeOutFrames = Math.floor(Number($("fadeOut").value) * sampleRate / selectedSpeed);
  const reverse = $("reverseCheck").checked;
  const normalize = $("normalizeCheck").checked;

  let normalizationGain = 1;
  if (normalize) {
    let peak = 0;
    for (const channel of channels) {
      for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
    }
    if (peak > 0) normalizationGain = 0.98 / peak;
  }

  for (const channel of channels) {
    const n = channel.length;
    for (let i = 0; i < n; i++) {
      let gain = volume * normalizationGain;
      if (fadeInFrames > 0 && i < fadeInFrames) gain *= i / fadeInFrames;
      if (fadeOutFrames > 0 && i >= n - fadeOutFrames) gain *= Math.max(0, (n - 1 - i) / fadeOutFrames);
      channel[i] *= gain;
    }
    if (reverse) channel.reverse();
  }
}

function encodeMp3(channels, sampleRate, progressCallback = null) {
  if (!window.lamejs || !window.lamejs.Mp3Encoder) {
    throw new Error("MP3 encoder library did not load. Check your internet connection and refresh the page.");
  }

  const channelCount = channels.length === 1 ? 1 : 2;
  const kbps = 192;
  const encoder = new lamejs.Mp3Encoder(channelCount, sampleRate, kbps);
  const left = toInt16(channels[0]);
  const right = channelCount === 2 ? toInt16(channels[1]) : null;
  const blockSize = 1152;
  const parts = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const encoded = channelCount === 2
      ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize))
      : encoder.encodeBuffer(leftChunk);
    if (encoded.length) parts.push(new Int8Array(encoded));
    if (i % (blockSize * 40) === 0) {
      const ratio = i / Math.max(1, left.length);
      if (progressCallback) progressCallback(ratio);
      else setProgress(45 + ratio * 50, "Encoding MP3…");
    }
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length) parts.push(new Int8Array(finalChunk));
  return new Blob(parts, { type: "audio/mpeg" });
}

processBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    setUploadStatus("Choose an MP3 file first.", "error");
    return;
  }

  if (!decodedBuffer) {
    setUploadStatus("The MP3 is still loading or could not be decoded.", "error");
    return;
  }

  const start = Number($("startRange").value);
  const end = Number($("endRange").value);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    alert("Please move the trim handles to choose a valid section.");
    return;
  }
  if (end > decodedBuffer.duration + 0.25) {
    alert("The end time cannot be longer than the MP3.");
    return;
  }

  processBtn.disabled = true;
  resultCard.classList.add("hidden");
  progressCard.classList.remove("hidden");
  setProgress(5, "Preparing audio…");

  try {
    // Give the browser a paint opportunity before CPU-heavy work.
    await new Promise((resolve) => setTimeout(resolve, 30));

    const { channels, sampleRate } = makeEditedChannels(decodedBuffer, start, end);
    setProgress(25, "Applying edits…");
    applyEffects(channels, sampleRate);
    setProgress(45, "Encoding MP3…");

    await new Promise((resolve) => setTimeout(resolve, 30));
    const blob = encodeMp3(channels, sampleRate);

    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    resultPlayer.src = resultUrl;
    downloadBtn.href = resultUrl;
    const baseName = selectedFile.name.replace(/\.mp3$/i, "");
    downloadBtn.download = `${baseName}-edited.mp3`;

    setProgress(100, "Done");
    setTimeout(() => {
      progressCard.classList.add("hidden");
      resultCard.classList.remove("hidden");
      resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
  } catch (error) {
    console.error(error);
    progressCard.classList.add("hidden");
    alert(error.message || "Something went wrong while processing this MP3.");
  } finally {
    processBtn.disabled = false;
  }
});


/* ---------- Merge MP3 tool ---------- */

const mergeFileInput = $("mergeFileInput");
const mergeUploadBox = $("mergeUploadBox");
const mergeList = $("mergeList");
const mergeBtn = $("mergeBtn");
const mergeSummary = $("mergeSummary");
const mergeStatus = $("mergeStatus");
const mergeResultCard = $("mergeResultCard");
const mergeResultPlayer = $("mergeResultPlayer");
const mergeDownloadBtn = $("mergeDownloadBtn");
const mergeProgressCard = $("mergeProgressCard");

let mergeItems = [];
let mergeResultUrl = null;

function setMergeStatus(text, type = "") {
  mergeStatus.textContent = text;
  mergeStatus.className = `upload-status ${type}`.trim();
}

function setMergeProgress(percent, label) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  $("mergeProgressFill").style.width = `${value}%`;
  $("mergeProgressPercent").textContent = `${value}%`;
  if (label) $("mergeProgressLabel").textContent = label;
}

function isMp3File(file) {
  const name = (file?.name || "").toLowerCase();
  return name.endsWith(".mp3") || file?.type === "audio/mpeg" || file?.type === "audio/mp3";
}

function totalMergeDuration() {
  return mergeItems.reduce((sum, item) => sum + (item.buffer?.duration || 0), 0);
}

function updateMergeSummary() {
  $("mergeCount").textContent = String(mergeItems.length);
  $("mergeDuration").textContent = formatTime(totalMergeDuration());

  const hasFiles = mergeItems.length > 0;
  mergeList.classList.toggle("hidden", !hasFiles);
  mergeSummary.classList.toggle("hidden", !hasFiles);
  mergeBtn.classList.toggle("hidden", mergeItems.length < 2);
}

function renderMergeList() {
  mergeList.innerHTML = "";

  mergeItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "merge-item";

    const order = document.createElement("div");
    order.className = "merge-order";
    order.textContent = String(index + 1);

    const info = document.createElement("div");
    info.className = "merge-file-info";

    const name = document.createElement("strong");
    name.textContent = item.file.name;

    const meta = document.createElement("small");
    meta.textContent = `${formatTime(item.buffer.duration)} • ${formatSize(item.file.size)}`;

    info.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "merge-actions";

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.title = "Move up";
    up.disabled = index === 0;
    up.addEventListener("click", () => {
      [mergeItems[index - 1], mergeItems[index]] = [mergeItems[index], mergeItems[index - 1]];
      renderMergeList();
    });

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.title = "Move down";
    down.disabled = index === mergeItems.length - 1;
    down.addEventListener("click", () => {
      [mergeItems[index], mergeItems[index + 1]] = [mergeItems[index + 1], mergeItems[index]];
      renderMergeList();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove";
    remove.addEventListener("click", () => {
      mergeItems.splice(index, 1);
      renderMergeList();
    });

    actions.append(up, down, remove);
    row.append(order, info, actions);
    mergeList.appendChild(row);
  });

  updateMergeSummary();
}

async function addMergeFiles(fileList) {
  const files = Array.from(fileList || []).filter(isMp3File);

  if (!files.length) {
    setMergeStatus("Please select MP3 files.", "error");
    return;
  }

  mergeResultCard.classList.add("hidden");
  setMergeStatus(`Reading ${files.length} file${files.length === 1 ? "" : "s"}…`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Avoid adding the exact same File object twice in the same selection.
    const duplicate = mergeItems.some(
      (item) =>
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
    );
    if (duplicate) continue;

    try {
      const buffer = await decodeSelectedFile(file);
      mergeItems.push({ file, buffer });
      setMergeStatus(`Loaded ${i + 1} of ${files.length}…`, "ok");
      renderMergeList();
      await new Promise((resolve) => setTimeout(resolve, 10));
    } catch (error) {
      console.error(error);
      setMergeStatus(`Could not read "${file.name}". Other valid MP3s were kept.`, "error");
    }
  }

  if (mergeItems.length) {
    setMergeStatus(
      mergeItems.length >= 2
        ? `${mergeItems.length} MP3 files ready to merge.`
        : "Add at least one more MP3 file.",
      "ok"
    );
  }

  mergeFileInput.value = "";
}

mergeFileInput.addEventListener("change", (event) => {
  addMergeFiles(event.target.files);
});

["dragenter", "dragover"].forEach((eventName) => {
  mergeUploadBox.addEventListener(eventName, (event) => {
    event.preventDefault();
    mergeUploadBox.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  mergeUploadBox.addEventListener(eventName, (event) => {
    event.preventDefault();
    mergeUploadBox.classList.remove("dragover");
  });
});

mergeUploadBox.addEventListener("drop", (event) => {
  addMergeFiles(event.dataTransfer?.files);
});

function resampleChannelToRate(channel, sourceRate, targetRate) {
  if (sourceRate === targetRate) return new Float32Array(channel);

  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(channel.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, channel.length - 1);
    const mix = sourceIndex - left;
    output[i] = channel[left] * (1 - mix) + channel[right] * mix;
  }
  return output;
}

function bufferToStereoAtRate(buffer, targetRate) {
  let left;
  let right;

  if (buffer.numberOfChannels === 1) {
    const mono = buffer.getChannelData(0);
    left = resampleChannelToRate(mono, buffer.sampleRate, targetRate);
    right = new Float32Array(left);
  } else {
    left = resampleChannelToRate(buffer.getChannelData(0), buffer.sampleRate, targetRate);
    right = resampleChannelToRate(buffer.getChannelData(1), buffer.sampleRate, targetRate);

    // Softly downmix any additional channels.
    for (let c = 2; c < buffer.numberOfChannels; c++) {
      const extra = resampleChannelToRate(buffer.getChannelData(c), buffer.sampleRate, targetRate);
      const target = c % 2 === 0 ? left : right;
      const count = Math.min(target.length, extra.length);
      for (let i = 0; i < count; i++) {
        target[i] = (target[i] + extra[i] * 0.5) / 1.5;
      }
    }
  }

  return [left, right];
}

function concatenateStereoBuffers(items, targetRate) {
  const converted = items.map((item) => bufferToStereoAtRate(item.buffer, targetRate));
  const totalFrames = converted.reduce((sum, pair) => sum + pair[0].length, 0);

  const left = new Float32Array(totalFrames);
  const right = new Float32Array(totalFrames);

  let offset = 0;
  for (const [l, r] of converted) {
    left.set(l, offset);
    right.set(r, offset);
    offset += l.length;
  }

  return [left, right];
}

mergeBtn.addEventListener("click", async () => {
  if (mergeItems.length < 2) {
    setMergeStatus("Choose at least 2 MP3 files.", "error");
    return;
  }

  mergeBtn.disabled = true;
  mergeResultCard.classList.add("hidden");
  mergeProgressCard.classList.remove("hidden");
  setMergeProgress(5, "Preparing files…");

  try {
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Common MP3 sample rates supported well by lamejs.
    const firstRate = mergeItems[0].buffer.sampleRate;
    const targetRate =
      firstRate >= 47000 ? 48000 :
      firstRate >= 40000 ? 44100 :
      firstRate >= 30000 ? 32000 :
      firstRate >= 22000 ? 24000 :
      22050;

    setMergeProgress(18, "Matching audio formats…");
    const channels = concatenateStereoBuffers(mergeItems, targetRate);

    setMergeProgress(40, "Joining MP3 files…");
    await new Promise((resolve) => setTimeout(resolve, 30));

    const blob = encodeMp3(channels, targetRate, (ratio) => {
      setMergeProgress(45 + ratio * 50, "Encoding merged MP3…");
    });

    if (mergeResultUrl) URL.revokeObjectURL(mergeResultUrl);
    mergeResultUrl = URL.createObjectURL(blob);

    mergeResultPlayer.src = mergeResultUrl;
    mergeDownloadBtn.href = mergeResultUrl;
    mergeDownloadBtn.download = "merged-mp3.mp3";

    setMergeProgress(100, "Done");
    setTimeout(() => {
      mergeProgressCard.classList.add("hidden");
      mergeResultCard.classList.remove("hidden");
      mergeResultCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  } catch (error) {
    console.error(error);
    mergeProgressCard.classList.add("hidden");
    setMergeStatus(error.message || "The MP3 files could not be merged.", "error");
  } finally {
    mergeBtn.disabled = false;
  }
});

$("clearMergeBtn").addEventListener("click", () => {
  mergeItems = [];
  if (mergeResultUrl) {
    URL.revokeObjectURL(mergeResultUrl);
    mergeResultUrl = null;
  }
  mergeResultPlayer.removeAttribute("src");
  mergeResultPlayer.load();
  mergeResultCard.classList.add("hidden");
  mergeProgressCard.classList.add("hidden");
  setMergeStatus("");
  renderMergeList();
  mergeFileInput.value = "";
  mergeUploadBox.scrollIntoView({ behavior: "smooth", block: "center" });
});
