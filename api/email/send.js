const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_aJNYFU4z_L3HGSzQJZi4PUksWYVzM8hFi";
const RESEND_FROM = process.env.RESEND_FROM || "CyberPulse Alerts <onboarding@resend.dev>";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).json({});
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const text = String(body.text || "").trim();
    const html = String(body.html || "").trim();

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        ok: false,
        error: "validation_error",
        message: "Fields required: to, subject, and text or html",
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
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

    const contentType = resendResponse.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await resendResponse.json()
      : { message: await resendResponse.text() };

    if (!resendResponse.ok) {
      return res.status(resendResponse.status).json({
        ok: false,
        error: payload?.message || payload?.error || "resend_error",
        details: payload,
      });
    }

    return res.status(200).json({ ok: true, id: payload.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "server_error" });
  }
};
