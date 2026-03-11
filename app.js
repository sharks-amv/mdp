const defaultConfig = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  table: "sound",
  pollIntervalMs: 3000,
  threshold: 90,
  email: "",
  emailCooldownMs: 5 * 60 * 1000,
  alertWebhookUrl: "",
  useMailtoFallback: true,
  queueFailedAlerts: true,
};

const envConfig = window.CYBERPULSE_CONFIG || {};
const config = { ...defaultConfig, ...envConfig };

const els = {
  currentDb: document.getElementById("currentDb"),
  avgDb: document.getElementById("avgDb"),
  peakDb: document.getElementById("peakDb"),
  lastUpdated: document.getElementById("lastUpdated"),
  thresholdInput: document.getElementById("thresholdInput"),
  emailInput: document.getElementById("emailInput"),
  saveSettings: document.getElementById("saveSettings"),
  toastContainer: document.getElementById("toastContainer"),
  connectionStatus: document.getElementById("connectionStatus"),
  chart: document.getElementById("dbChart"),
  gauge: document.getElementById("dbGauge"),
};

const settings = {
  threshold: Number(localStorage.getItem("dbThreshold") || config.threshold),
  email: localStorage.getItem("alertEmail") || config.email,
};
els.thresholdInput.value = settings.threshold;
els.emailInput.value = settings.email;

const ctx = els.chart.getContext("2d");
const gaugeCtx = els.gauge.getContext("2d");
let readings = [];
let lastAlertTimestamp = 0;
let lastProcessedReadingId = null;

function drawGauge(value) {
  const { width, height } = els.gauge;
  const centerX = width / 2;
  const centerY = height - 22;
  const radius = Math.min(width * 0.35, height * 0.85);
  const startAngle = Math.PI;
  const endAngle = 0;

  gaugeCtx.clearRect(0, 0, width, height);

  // base arc
  gaugeCtx.lineWidth = 24;
  gaugeCtx.strokeStyle = "rgba(143,161,196,0.2)";
  gaugeCtx.beginPath();
  gaugeCtx.arc(centerX, centerY, radius, startAngle, endAngle, false);
  gaugeCtx.stroke();

  // safe zone arc
  const thresholdAngle = startAngle + ((Math.min(settings.threshold, 180) / 180) * (endAngle - startAngle));
  gaugeCtx.strokeStyle = "rgba(64,255,242,0.55)";
  gaugeCtx.beginPath();
  gaugeCtx.arc(centerX, centerY, radius, startAngle, thresholdAngle, false);
  gaugeCtx.stroke();

  // danger zone arc
  gaugeCtx.strokeStyle = "rgba(255,77,109,0.65)";
  gaugeCtx.beginPath();
  gaugeCtx.arc(centerX, centerY, radius, thresholdAngle, endAngle, false);
  gaugeCtx.stroke();

  // ticks
  for (let db = 0; db <= 180; db += 30) {
    const angle = startAngle + (db / 180) * (endAngle - startAngle);
    const x1 = centerX + Math.cos(angle) * (radius - 28);
    const y1 = centerY + Math.sin(angle) * (radius - 28);
    const x2 = centerX + Math.cos(angle) * (radius + 6);
    const y2 = centerY + Math.sin(angle) * (radius + 6);
    gaugeCtx.lineWidth = 2;
    gaugeCtx.strokeStyle = "rgba(232,239,255,0.42)";
    gaugeCtx.beginPath();
    gaugeCtx.moveTo(x1, y1);
    gaugeCtx.lineTo(x2, y2);
    gaugeCtx.stroke();

    const lx = centerX + Math.cos(angle) * (radius - 48);
    const ly = centerY + Math.sin(angle) * (radius - 48);
    gaugeCtx.fillStyle = "#8fa1c4";
    gaugeCtx.font = "12px Inter";
    gaugeCtx.textAlign = "center";
    gaugeCtx.fillText(String(db), lx, ly + 4);
  }

  if (typeof value !== "number") {
    gaugeCtx.fillStyle = "#8fa1c4";
    gaugeCtx.font = "16px Inter";
    gaugeCtx.textAlign = "center";
    gaugeCtx.fillText("Waiting for readings", centerX, centerY - 20);
    return;
  }

  const clamped = Math.max(0, Math.min(value, 180));
  const angle = startAngle + (clamped / 180) * (endAngle - startAngle);

  // needle
  gaugeCtx.save();
  gaugeCtx.translate(centerX, centerY);
  gaugeCtx.rotate(angle);
  gaugeCtx.fillStyle = clamped >= settings.threshold ? "#ff4d6d" : "#40fff2";
  gaugeCtx.beginPath();
  gaugeCtx.moveTo(-7, 0);
  gaugeCtx.lineTo(0, -8);
  gaugeCtx.lineTo(radius - 18, 0);
  gaugeCtx.lineTo(0, 8);
  gaugeCtx.closePath();
  gaugeCtx.fill();
  gaugeCtx.restore();

  gaugeCtx.fillStyle = "#e8efff";
  gaugeCtx.beginPath();
  gaugeCtx.arc(centerX, centerY, 9, 0, Math.PI * 2);
  gaugeCtx.fill();

  gaugeCtx.font = "600 26px Orbitron";
  gaugeCtx.fillStyle = clamped >= settings.threshold ? "#ffd6df" : "#40fff2";
  gaugeCtx.textAlign = "center";
  gaugeCtx.fillText(`${clamped.toFixed(1)} dB`, centerX, centerY - 55);
}

function drawChart(values) {
  const { width, height } = els.chart;
  ctx.clearRect(0, 0, width, height);

  if (!values.length) {
    ctx.fillStyle = "#8fa1c4";
    ctx.font = "16px Inter";
    ctx.fillText("No sensor readings yet.", 24, 48);
    return;
  }

  const min = Math.min(...values, settings.threshold - 12);
  const max = Math.max(...values, settings.threshold + 12);
  const range = Math.max(max - min, 10);
  const pad = 20;

  ctx.strokeStyle = "rgba(64,255,242,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + ((height - pad * 2) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  const thresholdY = height - pad - ((settings.threshold - min) / range) * (height - pad * 2);
  ctx.strokeStyle = "rgba(255,46,166,0.75)";
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(pad, thresholdY);
  ctx.lineTo(width - pad, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#40fff2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function updateSummary() {
  if (!readings.length) {
    els.currentDb.textContent = "-- dB";
    els.avgDb.textContent = "-- dB";
    els.peakDb.textContent = "-- dB";
    drawGauge();
    return;
  }

  const values = readings.map((r) => Number(r.decibel));
  const current = values[values.length - 1];
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const peak = Math.max(...values);

  els.currentDb.textContent = `${current.toFixed(1)} dB`;
  els.avgDb.textContent = `${average.toFixed(1)} dB`;
  els.peakDb.textContent = `${peak.toFixed(1)} dB`;
  drawGauge(current);
  drawChart(values);
}

function showToast(title, text) {
  const el = document.createElement("article");
  el.className = "toast";
  el.innerHTML = `<strong>${title}</strong><br/><small>${text}</small>`;
  els.toastContainer.prepend(el);
  setTimeout(() => {
    el.remove();
  }, 7000);
}

function buildAlertPayload(reading) {
  return {
    email: settings.email,
    decibel: Number(reading.decibel),
    created_at: reading.created_at,
    threshold: settings.threshold,
    source: "cyberpulse-dashboard",
  };
}

async function sendEmailThroughEdge(payload) {
  const { error } = await window.supabaseClient.functions.invoke("send-noise-alert", {
    body: payload,
  });

  if (error) throw error;
}

async function sendEmailThroughWebhook(payload) {
  if (!config.alertWebhookUrl) {
    throw new Error("No alertWebhookUrl configured");
  }

  const response = await fetch(config.alertWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook request failed (${response.status})`);
  }
}

function buildAlertMessage(payload) {
  return `CyberPulse Noise Alert

Decibel: ${payload.decibel.toFixed(1)} dB
Threshold: ${payload.threshold} dB
Time: ${payload.created_at}`;
}

function queueFailedAlert(payload) {
  if (!config.queueFailedAlerts) return;

  const key = "failedAlertQueue";
  const queue = JSON.parse(localStorage.getItem(key) || "[]");
  queue.unshift({ ...payload, queued_at: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(queue.slice(0, 100)));
}

async function copyAlertToClipboard(payload) {
  const msg = buildAlertMessage(payload);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(msg);
    return true;
  }
  return false;
}

function downloadEmlFallback(payload) {
  const subject = `Noise alert: ${payload.decibel.toFixed(1)} dB exceeded threshold`;
  const eml = [
    `To: ${payload.email}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    buildAlertMessage(payload),
  ].join("\n");

  const blob = new Blob([eml], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cyberpulse-alert-${Date.now()}.eml`;
  a.click();
  URL.revokeObjectURL(url);
}

function openMailtoFallback(payload) {
  const subject = encodeURIComponent(`Noise alert: ${payload.decibel.toFixed(1)} dB exceeded threshold`);
  const body = encodeURIComponent(buildAlertMessage(payload));
  window.open(`mailto:${payload.email}?subject=${subject}&body=${body}`, "_blank");
}

async function sendEmailAlert(reading) {
  if (!settings.email) return;

  const payload = buildAlertPayload(reading);

  try {
    await sendEmailThroughEdge(payload);
    showToast("Email Sent", `Alert email dispatched to ${settings.email} via Edge Function.`);
    return;
  } catch (edgeErr) {
    console.warn("Edge function email failed, trying workaround", edgeErr);
  }

  try {
    await sendEmailThroughWebhook(payload);
    showToast("Webhook Alert Sent", `Edge Function failed, but webhook alert was sent to ${settings.email}.`);
    return;
  } catch (webhookErr) {
    console.warn("Webhook email fallback failed", webhookErr);
  }

  queueFailedAlert(payload);

  try {
    const copied = await copyAlertToClipboard(payload);
    if (copied) {
      showToast("Copied Alert", "Edge/webhook failed. Alert text copied to clipboard.");
    }
  } catch (clipboardErr) {
    console.warn("Clipboard fallback failed", clipboardErr);
  }

  if (config.useMailtoFallback) {
    openMailtoFallback(payload);
  }

  downloadEmlFallback(payload);
  showToast("Fallback Created", "Edge/webhook failed. Downloaded .eml + queued alert locally.");
}

async function handleIncomingReading(reading) {
  if (reading?.id != null && lastProcessedReadingId !== null && Number(reading.id) <= Number(lastProcessedReadingId)) {
    return;
  }

  readings.push(reading);
  if (reading?.id != null) {
    lastProcessedReadingId = Number(reading.id);
  }

  readings.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  readings = readings.slice(-60);
  els.lastUpdated.textContent = `Updated ${new Date(reading.created_at).toLocaleTimeString()}`;
  updateSummary();

  if (reading.decibel >= settings.threshold) {
    showToast(
      "Noise Threshold Exceeded",
      `${reading.decibel.toFixed(1)} dB crossed your ${settings.threshold} dB limit.`
    );

    const now = Date.now();
    if (now - lastAlertTimestamp > config.emailCooldownMs) {
      lastAlertTimestamp = now;
      await sendEmailAlert(reading);
    }
  }
}

async function loadInitialData() {
  const { data, error } = await window.supabaseClient
    .from(config.table)
    .select("id, decibel, created_at")
    .order("created_at", { ascending: true })
    .limit(60);

  if (error) throw error;

  readings = data || [];
  if (readings.length) {
    lastProcessedReadingId = Number(readings[readings.length - 1].id);
  }
  updateSummary();
  if (readings.length) {
    const latest = readings[readings.length - 1];
    els.lastUpdated.textContent = `Updated ${new Date(latest.created_at).toLocaleTimeString()}`;
  }
}

async function fetchNewReadings() {
  let query = window.supabaseClient
    .from(config.table)
    .select("id, decibel, created_at")
    .order("id", { ascending: true })
    .limit(60);

  if (lastProcessedReadingId !== null) {
    query = query.gt("id", lastProcessedReadingId);
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!data?.length) return;

  for (const row of data) {
    await handleIncomingReading(row);
  }
}

function startPolling() {
  const intervalMs = Number(config.pollIntervalMs) > 0 ? Number(config.pollIntervalMs) : 3000;

  setInterval(async () => {
    try {
      await fetchNewReadings();
      els.connectionStatus.textContent = "Live + Polling";
      els.connectionStatus.style.color = "#40fff2";
    } catch (err) {
      els.connectionStatus.textContent = "Polling issue";
      els.connectionStatus.style.color = "#ffd6df";
      console.error("Polling error", err);
    }
  }, intervalMs);
}

function saveSettings() {
  settings.threshold = Number(els.thresholdInput.value || config.threshold);
  settings.email = els.emailInput.value.trim();
  localStorage.setItem("dbThreshold", String(settings.threshold));
  localStorage.setItem("alertEmail", settings.email);
  showToast("Settings Saved", "Alert settings have been updated.");
  updateSummary();
}

async function init() {
  if (config.supabaseUrl.includes("YOUR_SUPABASE") || config.supabaseAnonKey.includes("YOUR_SUPABASE")) {
    els.connectionStatus.textContent = "Set Supabase credentials in CYBERPULSE_CONFIG";
    els.connectionStatus.style.color = "#ffd6df";
    showToast("Config Required", "Set CYBERPULSE_CONFIG with Supabase URL and anon key.");
    drawChart([]);
    drawGauge();
    return;
  }

  window.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  try {
    await loadInitialData();
    els.connectionStatus.textContent = "Live + Polling";

    startPolling();

    window.supabaseClient
      .channel("db-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: config.table },
        (payload) => handleIncomingReading(payload.new)
      )
      .subscribe();
  } catch (err) {
    els.connectionStatus.textContent = "Connection failed";
    els.connectionStatus.style.color = "#ffd6df";
    showToast("Supabase Error", err.message || "Unable to load readings.");
  }
}

els.saveSettings.addEventListener("click", saveSettings);
window.addEventListener("DOMContentLoaded", init);
