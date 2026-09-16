# AKI 4.5 — Presence + Tempo + Voice Fix

Upload the CONTENTS of this folder to the root of your GitHub repository, replacing the older AKI files.

## What changed
- Much slower resting torus drift (roughly 28–38 seconds per rotation layer).
- Slower, smaller visual breathing (8.4 seconds at rest).
- Thinking/speaking states stay calm instead of accelerating into urgency.
- Center black core now feathers into the torus instead of ending as a crisp disk.
- AKI glyph is softer, more translucent and tempered-glass-like.
- Complex questions are explicitly reduced to one thread / one next step.
- AKI naturally follows the language being spoken; no language selector is required.
- Voice requests now reconnect with a different underlying built-in voice.
- Male/man requests use `ash`; female/woman requests use `marin`; "another voice" cycles to `cedar`.
- Removed the unsupported `willow` voice from the prior build.
- App icon files use the exact supplied AKI artwork and are included at the repository root AND in /icons.
- Page/app title updated to AKI 4.5.

## Deployment
Keep `OPENAI_API_KEY` configured in Vercel. Do not put the key in GitHub.
After GitHub updates, let Vercel finish deploying, then fully close/reopen Safari before testing Add to Home Screen.

## Voice note
The application now performs a real session-level voice change. Built-in OpenAI voice names are not officially gender labels, so `ash` is used as a clearly different alternate voice rather than claiming an official gender classification.
