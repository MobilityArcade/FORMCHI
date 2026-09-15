# AKI 4.0 — Black Iridescence

Replace the existing project files with these files and keep `api/aki.js` inside the `api` folder.

Keep the existing Vercel `OPENAI_API_KEY` environment variable unchanged.

## 4.0 changes
- Black liquid/oil center with cyan, violet, magenta and warm iridescent edge light.
- Custom ultra-thin single-stroke AKI SVG mark; no external font file required.
- Listening, thinking and speaking visual states.
- A short two-tone thinking chime when AKI enters a deeper-processing state.
- Shorter visual handoff into thinking (300 ms after transcript activity settles).
- Backend connection intentionally stays on the minimal verified `gpt-live-1` + WebRTC Live session structure from the repaired 3.0 build.
- Prompt continues to prioritize concise, conclusion-first spoken responses.

After Vercel reports Ready, hard-refresh the site. Tap once to grant microphone/audio permission, then say “Aki.”
