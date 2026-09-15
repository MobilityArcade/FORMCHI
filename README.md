# AKI 4.1 — Voice Identity Upgrade

AKI 4.1 keeps the Black Iridescence presentation from 4.0 and adds real startup voice selection.

## Voice behavior
- Default voice: `marin`
- “Use a man/male/masculine voice” → reconnects with `cedar`
- “Use a woman/female/feminine voice” → reconnects with `marin`
- “Use a lower female / androgynous voice” → reconnects with `willow`
- Spanish / English requests are remembered as language preferences.

The preference is stored in the browser with localStorage. Because OpenAI Live voice is startup-only, AKI reconnects the Live session when the underlying voice changes instead of asking one voice to fake another voice by changing pitch.

## Deploy
Replace `index.html`, `api/aki.js`, `package.json`, and this README in the current project. Keep `OPENAI_API_KEY` in Vercel exactly where it already is.

## Important
Built-in voices are not labeled by ethnicity/cultural identity in the API, so this build does not pretend that a voice is “African,” “Latino,” etc. Language can adapt conversationally. More culturally specific voice identity should be added only with appropriately sourced/custom voices and explicit user choice.
