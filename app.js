const defaultConfig = {
  supabaseUrl: "https://jdkbbkptgnotnbkrhleu.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka2Jia3B0Z25vdG5ia3JobGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDQzODMsImV4cCI6MjA4NjMyMDM4M30.GQaCQW7GiQkDUUXiBHqxfdrcngveHdJgXqRrzkppJQI",
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
  addRuleBtn: document.getElementById("addRuleBtn"),
  rulesContainer: document.getElementById("rulesContainer"),
  toastContainer: document.getElementById("toastContainer"),
  connectionStatus: document.getElementById("connectionStatus"),
  chart: document.getElementById("dbChart"),
  gauge: document.getElementById("dbGauge"),
};

function createRule(seed = {}) {
  return {
    id: seed.id || `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: seed.name || "Noise Alert",
    enabled: seed.enabled ?? true,
    threshold: Number(seed.threshold ?? config.threshold),
    email: seed.email ?? config.email,
    cooldownMs: Number(seed.cooldownMs ?? config.emailCooldownMs),
    quietEnabled: seed.quietEnabled ?? false,
    quietStart: seed.quietStart || "22:00",
    quietEnd: seed.quietEnd || "07:00",
    quietThreshold: Number(seed.quietThreshold ?? config.threshold),
  };
}

function loadRules() {
  const savedRules = JSON.parse(localStorage.getItem("alertRules") || "null");
  if (Array.isArray(savedRules) && savedRules.length) {
    return savedRules.map((rule) => createRule(rule));
  }

  const legacyThreshold = Number(localStorage.getItem("dbThreshold") || config.threshold);
  const legacyEmail = localStorage.getItem("alertEmail") || config.email;
  return [
    createRule({
      name: "Primary Alert",
      threshold: legacyThreshold,
      email: legacyEmail,
      cooldownMs: config.emailCooldownMs,
    }),
  ];
}

const settings = {
  rules: loadRules(),
};

const ctx = els.chart.getContext("2d");
const gaugeCtx = els.gauge.getContext("2d");
let readings = [];
const ruleLastAlertTimestamps = {};
let lastProcessedReadingId = null;
let animatedGaugeValue = null;
let gaugeAnimationFrame = null;

function getDisplayThreshold() {
  const enabledRules = settings.rules.filter((rule) => rule.enabled);
  if (!enabledRules.length) return Number(config.threshold);
  return Math.min(...enabledRules.map((rule) => Number(rule.threshold || config.threshold)));
}

function getDisplayThreshold() {
  const enabledRules = settings.rules.filter((rule) => rule.enabled);
  if (!enabledRules.length) return Number(config.threshold);
  return Math.min(...enabledRules.map((rule) => Number(rule.threshold || config.threshold)));
}

function drawGauge(value) {
  const { width, height } = els.gauge;
  const centerX = width / 2;
  const centerY = height - 10;
  const radius = Math.min(width * 0.35, height * 0.78);
  const startAngle = Math.PI;
  const endAngle = Math.PI * 2;

  gaugeCtx.clearRect(0, 0, width, height);

  // base arc
  gaugeCtx.lineWidth = 24;
  gaugeCtx.strokeStyle = "rgba(143,161,196,0.2)";
  gaugeCtx.beginPath();
  gaugeCtx.arc(centerX, centerY, radius, startAngle, endAngle, false);
  gaugeCtx.stroke();

  // safe zone arc
  const displayThreshold = getDisplayThreshold();
  const thresholdAngle = startAngle + ((Math.min(displayThreshold, 180) / 180) * (endAngle - startAngle));
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
  gaugeCtx.fillStyle = clamped >= displayThreshold ? "#ff4d6d" : "#40fff2";
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
  gaugeCtx.fillStyle = clamped >= displayThreshold ? "#ffd6df" : "#40fff2";
  gaugeCtx.textAlign = "center";
  gaugeCtx.fillText(`${clamped.toFixed(1)} dB`, centerX, centerY - 55);
}

function cancelGaugeAnimation() {
  if (gaugeAnimationFrame !== null) {
    cancelAnimationFrame(gaugeAnimationFrame);
    gaugeAnimationFrame = null;
  }
}

function animateGaugeTo(target) {
  if (typeof target !== "number") {
    cancelGaugeAnimation();
    animatedGaugeValue = null;
    drawGauge();
    return;
  }

  const clampedTarget = Math.max(0, Math.min(Number(target), 180));
  if (animatedGaugeValue === null || Number.isNaN(animatedGaugeValue)) {
    animatedGaugeValue = 0;
  }

  cancelGaugeAnimation();

  const startValue = animatedGaugeValue;
  const delta = clampedTarget - startValue;
  const durationMs = Math.min(900, Math.max(280, Math.abs(delta) * 12));
  const startTs = performance.now();

  const tick = (ts) => {
    const t = Math.min((ts - startTs) / durationMs, 1);
    const eased = 1 - ((1 - t) ** 3);
    animatedGaugeValue = startValue + (delta * eased);
    drawGauge(animatedGaugeValue);

    if (t < 1) {
      gaugeAnimationFrame = requestAnimationFrame(tick);
    } else {
      animatedGaugeValue = clampedTarget;
      gaugeAnimationFrame = null;
      drawGauge(animatedGaugeValue);
    }
  };

  gaugeAnimationFrame = requestAnimationFrame(tick);
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

  const displayThreshold = getDisplayThreshold();
  const min = Math.min(...values, displayThreshold - 12);
  const max = Math.max(...values, displayThreshold + 12);
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

  const thresholdY = height - pad - ((displayThreshold - min) / range) * (height - pad * 2);
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
    animateGaugeTo();
    return;
  }

  const values = readings.map((r) => Number(r.decibel));
  const current = values[values.length - 1];
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const peak = Math.max(...values);

  els.currentDb.textContent = `${current.toFixed(1)} dB`;
  els.avgDb.textContent = `${average.toFixed(1)} dB`;
  els.peakDb.textContent = `${peak.toFixed(1)} dB`;
  animateGaugeTo(current);
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

function persistRules() {
  localStorage.setItem("alertRules", JSON.stringify(settings.rules));
}

function minutesFromHHMM(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map((v) => Number(v) || 0);
  return (h * 60) + m;
}

function isNowInQuietHours(rule, now = new Date()) {
  if (!rule.quietEnabled) return false;

  const start = minutesFromHHMM(rule.quietStart);
  const end = minutesFromHHMM(rule.quietEnd);
  const current = (now.getHours() * 60) + now.getMinutes();

  if (start === end) return true;
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

function getRuleActiveThreshold(rule, now = new Date()) {
  if (isNowInQuietHours(rule, now)) {
    return Number(rule.quietThreshold || rule.threshold);
  }
  return Number(rule.threshold);
}

function buildAlertPayload(reading, rule, activeThreshold) {
  return {
    email: rule.email,
    decibel: Number(reading.decibel),
    created_at: reading.created_at,
    threshold: activeThreshold,
    rule_id: rule.id,
    rule_name: rule.name,
    quiet_hours_active: isNowInQuietHours(rule),
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

async function sendEmailAlert(reading, rule, activeThreshold) {
  if (!rule.email) return false;

  const payload = buildAlertPayload(reading, rule, activeThreshold);

  try {
    await sendEmailThroughEdge(payload);
    showToast("Email Sent", `${rule.name}: alert sent to ${rule.email} via Edge Function.`);
    return true;
  } catch (edgeErr) {
    console.warn("Edge function email failed, trying workaround", edgeErr);
  }

  try {
    await sendEmailThroughWebhook(payload);
    showToast("Webhook Alert Sent", `${rule.name}: webhook alert sent to ${rule.email}.`);
    return true;
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
  return true;
}

function updateRuleFromInput(event) {
  const { ruleId, field } = event.target.dataset;
  const rule = settings.rules.find((item) => item.id === ruleId);
  if (!rule) return;

  if (event.target.type === "checkbox") {
    rule[field] = event.target.checked;
  } else if (["threshold", "quietThreshold", "cooldownMs"].includes(field)) {
    rule[field] = Number(event.target.value || 0);
  } else {
    rule[field] = event.target.value;
  }

  persistRules();
  updateSummary();
}

function renderRules() {
  els.rulesContainer.innerHTML = "";

  settings.rules.forEach((rule) => {
    const card = document.createElement("article");
    card.className = "rule-card";
    card.innerHTML = `
      <div class="rule-row">
        <span class="rule-title">${rule.name || "Noise Alert"}</span>
        <button class="rule-delete" type="button" data-action="delete-rule" data-rule-id="${rule.id}">Delete</button>
      </div>
      <div class="rule-grid">
        <label>
          Rule name
          <input type="text" data-field="name" data-rule-id="${rule.id}" value="${rule.name}" />
        </label>
        <label>
          Alert email
          <input type="email" data-field="email" data-rule-id="${rule.id}" value="${rule.email || ""}" placeholder="ops@example.com" />
        </label>
        <label>
          Threshold (dB)
          <input type="number" min="1" max="180" data-field="threshold" data-rule-id="${rule.id}" value="${rule.threshold}" />
        </label>
        <label>
          Cooldown (ms)
          <input type="number" min="0" step="1000" data-field="cooldownMs" data-rule-id="${rule.id}" value="${rule.cooldownMs}" />
        </label>
        <label>
          Quiet hours enabled
          <input type="checkbox" data-field="quietEnabled" data-rule-id="${rule.id}" ${rule.quietEnabled ? "checked" : ""} />
        </label>
        <label>
          Quiet start
          <input type="time" data-field="quietStart" data-rule-id="${rule.id}" value="${rule.quietStart}" />
        </label>
        <label>
          Quiet end
          <input type="time" data-field="quietEnd" data-rule-id="${rule.id}" value="${rule.quietEnd}" />
        </label>
        <label>
          Quiet threshold (dB)
          <input type="number" min="1" max="180" data-field="quietThreshold" data-rule-id="${rule.id}" value="${rule.quietThreshold}" />
        </label>
        <label>
          Rule enabled
          <input type="checkbox" data-field="enabled" data-rule-id="${rule.id}" ${rule.enabled ? "checked" : ""} />
        </label>
      </div>
    `;

    els.rulesContainer.appendChild(card);
  });
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

  for (const rule of settings.rules) {
    if (!rule.enabled) continue;

    const activeThreshold = getRuleActiveThreshold(rule);
    if (Number(reading.decibel) < activeThreshold) continue;

    showToast(
      "Noise Threshold Exceeded",
      `${rule.name}: ${Number(reading.decibel).toFixed(1)} dB crossed ${activeThreshold} dB${isNowInQuietHours(rule) ? " (quiet hours)" : ""}.`
    );

    const now = Date.now();
    const lastRuleAlertTimestamp = Number(ruleLastAlertTimestamps[rule.id] || 0);
    if (now - lastRuleAlertTimestamp <= Number(rule.cooldownMs || config.emailCooldownMs)) {
      continue;
    }

    const notificationSent = await sendEmailAlert(reading, rule, activeThreshold);
    if (notificationSent) {
      ruleLastAlertTimestamps[rule.id] = now;
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
    renderRules();
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

els.addRuleBtn.addEventListener("click", () => {
  settings.rules.push(createRule({ name: `Rule ${settings.rules.length + 1}` }));
  persistRules();
  renderRules();
  updateSummary();
});

els.rulesContainer.addEventListener("input", (event) => {
  if (!event.target.dataset?.field) return;
  updateRuleFromInput(event);
});

els.rulesContainer.addEventListener("change", (event) => {
  if (!event.target.dataset?.field) return;
  updateRuleFromInput(event);
});

els.rulesContainer.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action='delete-rule']");
  if (!btn) return;

  settings.rules = settings.rules.filter((rule) => rule.id !== btn.dataset.ruleId);
  persistRules();
  renderRules();
  updateSummary();
});

window.addEventListener("DOMContentLoaded", init);
