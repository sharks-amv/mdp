const http = require("node:http");
const { safeSend } = require("./services/emailClient");

const PORT = Number(process.env.PORT || 8787);

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
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

async function handleEmailSend(req, res) {
  try {
    const payload = await readBody(req);
    const result = await safeSend(payload);

    if (result?.ok === false) {
      if (result.error === "unauthorized") return sendJson(res, 401, result);
      if (result.error === "spam_detected") return sendJson(res, 429, result);
      if (result.error === "queue_full") return sendJson(res, 503, result);
      return sendJson(res, 400, result);
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

  if (req.method === "POST" && req.url === "/api/email/send") {
    return handleEmailSend(req, res);
  }

  return sendJson(res, 404, { ok: false, error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Email proxy server running on http://localhost:${PORT}`);
});
