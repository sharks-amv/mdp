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

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  return sendJson(res, 404, { ok: false, error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
