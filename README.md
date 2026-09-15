# AKI Voice MVP — GA Realtime

Minimal voice-first living presence using OpenAI Realtime over WebRTC.

## Vercel

1. Keep `OPENAI_API_KEY` in Vercel Environment Variables (Production).
2. Upload/commit `index.html`, `package.json`, and the `api` folder to the repository root.
3. Redeploy the Production deployment.
4. Open the HTTPS site, tap the living AKI surface once to grant microphone permission, then say **“Aki.”**

AKI should answer: **“I am here. How can I help you?”** and continue as a natural voice conversation.

The browser never receives the standard OpenAI API key. `/api/session` sends the browser's SDP offer to the GA `POST /v1/realtime/calls` endpoint server-side.
