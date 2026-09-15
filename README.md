# AKI 2.0

A voice-first living presence prototype.

## 2.0 changes
- Larger AKI wordmark.
- Softer recessed/valley-style engraving instead of sharp carved edges.
- Darker pearl/stone background so the iridescence is visible.
- Visual states for listening, thinking, and speaking; no status labels or UI chrome.
- Faster conversational prompt: short immediate responses first.
- Voice preference by conversation: requests containing “masculine/male voice” switch to Cedar; “feminine/female voice” switch to Marin. The preference is stored in the browser and AKI reconnects invisibly.
- No text box, buttons, menus, or visible settings.

## Deploy
Keep these files at the repository root:

```
api/aki.js
index.html
package.json
README.md
```

In Vercel, keep `OPENAI_API_KEY` configured as a Production environment variable. Deploy/redeploy, open the HTTPS URL, tap once for browser microphone permission, then say “Aki.”

## Notes
The first tap is required by browser microphone/autoplay security. After permission is granted, the experience is voice-first.
