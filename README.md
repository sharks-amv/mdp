# CyberPulse Decibel Dashboard

A cyberpunk-style dashboard that reads live decibel values from Supabase, shows popup alerts, and sends email notifications through a Supabase Edge Function.

## Features
- Real-time decibel feed from `public.sound` using Supabase Realtime.
- Continuous Supabase polling (default every 3s) to keep data fresh even if realtime events are delayed.
- Current / average / peak stats for the last 60 readings.
- Car-style speedometer dial for current dB level (0-180).
- Popup toast alerts when threshold is exceeded.
- Email notifications via Supabase Edge Function `send-noise-alert`.
- Neon cyberpunk visual style.

## Quick start
1. Set up the table from `supabase/schema.sql`.
2. Configure Supabase Realtime for `sound` inserts.
3. Create an edge function named `send-noise-alert` that sends email (Resend/SendGrid/etc.).
4. Provide config before loading `app.js`:

```html
<script>
  window.CYBERPULSE_CONFIG = {
    supabaseUrl: "https://YOUR-PROJECT.supabase.co",
    supabaseAnonKey: "YOUR-ANON-KEY",
    table: "sound",
    threshold: 90,
    email: "ops@example.com",
    emailCooldownMs: 300000
  };
</script>
```

Then open `index.html` from any static server.

## Suggested edge function shape
Your edge function should accept this body:

```json
{
  "email": "ops@example.com",
  "decibel": 96.2,
  "created_at": "2026-03-11T05:53:44.000Z",
  "threshold": 90
}
```

And send a formatted message like: `Noise alert: 96.2 dB from sound table exceeded threshold 90 dB at ...`.
