# AKI 3.0 — Connection Repair

This repair keeps the AKI 3.0 visual design and fast-response prompt, but removes unsupported Live session fields that caused the 400 errors.

The backend now uses the minimal currently documented Live WebRTC session shape:
- `session.model = gpt-live-1`
- `session.instructions = ...`
- `transport.type = webrtc`
- `transport.sdp = browser SDP offer`

Replace `api/aki.js` in GitHub, redeploy on Vercel, then hard-refresh.

Keep `OPENAI_API_KEY` unchanged.
