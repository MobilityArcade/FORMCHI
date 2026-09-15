# AKI — Realtime GA SDP Fix

Minimal voice-first AKI prototype.

## Deploy
1. Replace the existing root files with this package.
2. Keep `api/aki.js` inside the `api` folder.
3. Keep `OPENAI_API_KEY` configured in Vercel.
4. Redeploy.
5. Open the HTTPS deployment, tap once to grant microphone access, then speak naturally.

This version sends the browser-generated SDP to Vercel as JSON, then the server forwards it to OpenAI `/v1/realtime/calls` as the required multipart `sdp` field.
