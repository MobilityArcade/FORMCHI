# AKI 4.7 — Response Guarantee

This release is intentionally focused on latency. It does not redesign AKI.

## Preserved from 4.6
- Constant slow torus: no visual response states.
- Slow breathing and rotation remain unchanged.
- AKI letters remain the ON/OFF control.
- Fresh microphone + Live session on each ON cycle.
- Multilingual conversation and translation.
- Session-level voice switching.
- Thinking chime.

## 4.7 latency changes
- Stronger latency-first conversation instructions: AKI begins with one useful piece instead of silently constructing a comprehensive answer.
- Complex/deep questions are reduced to one thread at a time.
- 3-second slow-response diagnostic.
- 15-second hard recovery watchdog: if a recognized user turn produces no output audio for 15 seconds, AKI treats the Live session as stalled and cleanly reconnects rather than hanging indefinitely.
- The watchdog does NOT invent a placeholder answer. It is a connection recovery mechanism.
- Timing diagnostics remain invisible in normal use and record user-turn-ended, response-started, first-audio, slow-response-warning, and 15-second-recovery.

## Important
The 15-second watchdog cannot guarantee that every complex answer is completed within 15 seconds. Its purpose is to prevent an apparently dead session from hanging forever.

Keep OPENAI_API_KEY in Vercel exactly as before. Upload the CONTENTS of AKI_4.7 to the repository root, replacing 4.6.
