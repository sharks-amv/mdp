# CyberPulse Decibel Dashboard

A cyberpunk-style dashboard that reads live decibel values from Supabase and shows popup alerts when thresholds are exceeded.

## Features
- Real-time decibel feed from `public.sound` using Supabase Realtime.
- Continuous Supabase polling (default every 3s) to keep data fresh even if realtime events are delayed.
- Current / average / peak stats for the last 60 readings.
- Car-style speedometer dial for current dB level (0-180) with smooth needle animation.
- Popup toast alerts when threshold is exceeded.
- Multi-rule alerts (per-rule threshold, cooldown, enable/disable).
- Quiet-hour overrides per rule (custom time window + alternate threshold).
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
    alertCooldownMs: 30000
  };
</script>
```

Then open `index.html` from any static server.

## Multi-rule + quiet hours
Use the Alert Controls panel to define multiple alert rules. Each rule supports:
- Name
- Base decibel threshold
- Per-rule cooldown in milliseconds
- Optional quiet hours (`start`, `end`) with a separate threshold
- Enable/disable toggle
