const API = process.env.EMAIL_API_URL;
const KEY = process.env.EMAIL_API_KEY;

function buildHeaders(includeJson = false) {
  const headers = {
    Authorization: `Bearer ${KEY}`,
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function ensureConfig() {
  if (!API || !KEY) {
    throw new Error("Missing EMAIL_API_URL or EMAIL_API_KEY environment variables");
  }
}

async function parseJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { ok: false, error: "invalid_response_format", status: response.status };
  }

  return response.json();
}

function normalizeError(result, status) {
  if (result?.ok !== false) return result;

  const code = String(result.error || result.code || "").toLowerCase();
  if (status === 401 || code.includes("unauthorized") || code.includes("invalid_api_key")) {
    return { ...result, error: "unauthorized", status };
  }
  if (code.includes("spam")) {
    return { ...result, error: "spam_detected", status };
  }
  if (code.includes("queue") && code.includes("full")) {
    return { ...result, error: "queue_full", status };
  }

  return { ...result, status };
}

async function sendEmail(d) {
  ensureConfig();

  const r = await fetch(`${API}/send`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(d),
  });

  const result = await parseJson(r);
  return normalizeError(result, r.status);
}

async function getLogs() {
  ensureConfig();

  const r = await fetch(`${API}/logs`, {
    headers: buildHeaders(false),
  });

  const result = await parseJson(r);
  return normalizeError(result, r.status);
}

async function getStatus(id) {
  ensureConfig();

  const r = await fetch(`${API}/status/${id}`, {
    headers: buildHeaders(false),
  });

  const result = await parseJson(r);
  return normalizeError(result, r.status);
}

async function safeSend(d) {
  try {
    return await sendEmail(d);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendEmail, getLogs, getStatus, safeSend };
