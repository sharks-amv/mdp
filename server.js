const http = require("node:http");

const PORT = Number(process.env.PORT || 8787);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_aJNYFU4z_L3HGSzQJZi4PUksWYVzM8hFi";
const RESEND_FROM = process.env.RESEND_FROM || "CyberPulse Alerts <onboarding@resend.dev>";

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

async function sendResendEmail({ to, subject, text, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.message || payload?.error || "resend_error",
      details: payload,
    };
  }

  return { ok: true, id: payload.id };
}

async function handleEmailSend(req, res) {
  try {
    const body = await readBody(req);
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const text = String(body.text || "").trim();
    const html = String(body.html || "").trim();

    if (!to || !subject || (!text && !html)) {
      return sendJson(res, 400, {
        ok: false,
        error: "validation_error",
        message: "Fields required: to, subject, and text or html",
      });
    }

    const result = await sendResendEmail({ to, subject, text, html });
    if (!result.ok) {
      return sendJson(res, result.status || 502, result);
    }

    return sendJson(res, 200, result);
  } catch (err) {
    if (err.message === "invalid_json") {
      return sendJson(res, 400, { ok: false, error: "invalid_json" });
    }

    return sendJson(res, 500, { ok: false, error: err.message || "server_error" });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  return sendJson(res, 404, { ok: false, error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
