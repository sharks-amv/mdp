# CyberPulse Decibel Dashboard

A cyberpunk-style dashboard that reads live decibel values from Supabase and sends rule-based popup + email alerts when thresholds are exceeded.

## Features
- Real-time decibel feed from `public.sound` using Supabase Realtime.
- Continuous Supabase polling (default every 3s) to keep data fresh even if realtime events are delayed.
- Current / average / peak stats for the last 60 readings.
- Car-style speedometer dial for current dB level (0-180) with smooth needle animation.
- Popup toast alerts when threshold is exceeded.
- Multi-rule alerts (per-rule threshold, cooldown, enable/disable).
- Quiet-hour overrides per rule (custom time window + alternate threshold).
- Email notifications through external EmailSender API (`/send` with bearer auth).
- Neon cyberpunk visual style.

## Quick start
1. Set up the table from `supabase/schema.sql`.
2. Configure Supabase Realtime for `sound` inserts.
3. Provide config before loading `app.js`:

```html
<script>
  window.CYBERPULSE_CONFIG = {
    supabaseUrl: "https://YOUR-PROJECT.supabase.co",
    supabaseAnonKey: "YOUR-ANON-KEY",
    table: "sound",
    pollIntervalMs: 3000,
    threshold: 90,
    alertCooldownMs: 30000,
    emailApiProxyPath: "/api/email/send",
    emailType: "noise-alert",
    defaultAlertEmail: "ops@example.com"
  };
</script>
```

Then open `index.html` from any static server.

## External email microservice integration
The project includes:
- reusable Node email client: `services/emailClient.js`
- local backend proxy endpoint: `POST /api/email/send` in `server.js`

The browser calls only the local proxy endpoint. The API key stays server-side in environment variables.

### Environment
Create `.env.local` (based on `.env.example`):

```env
EMAIL_API_URL=https://your-emailsender-url
EMAIL_API_KEY=your_api_key
PORT=8787
```

Run the proxy:

```bash
node server.js
```

### Client
```js
const { sendEmail, getLogs, getStatus, safeSend } = require("./services/emailClient");
```

### Usage example
```js
const { sendEmail } = require("./services/emailClient");

await sendEmail({
  to: "ops@example.com",
  subject: "Noise alert",
  type: "noise-alert",
  data: { decibel: 96.2, threshold: 90 },
});
```

## Multi-rule + quiet hours
Use the Alert Controls panel to define multiple alert rules. Each rule supports:
- Name
- Base decibel threshold
- Per-rule cooldown in milliseconds
- Optional quiet hours (`start`, `end`) with a separate threshold
- Enable/disable toggle

Current deployment is configured to send alert emails to `sharks.amv11@gmail.com`.
