# Native AQUI development Realtime route

New route only: POST /api/aqui-realtime. Existing web routes are unchanged.
Node runtime with native fetch, FormData and AbortSignal.timeout is required.

## Contract

Send Authorization: Bearer <development token> and Content-Type: application/sdp.
Body: raw audio WebRTC SDP offer, at most 64 KiB. Returns 200 application/sdp
with the answer and Cache-Control: no-store. No OpenAI credential is returned.
Errors: 400 invalid SDP, 401 unauthorized, 405 method, 413 size, 415 media type,
429 upstream capacity, 502 upstream failure, 503 missing configuration, 504 timeout.
No credentials, SDP, or raw upstream errors are logged by this route.

## Required before deployment/testing

- Keep the existing Production OPENAI_API_KEY value and scope unchanged.
- Provision a separate OpenAI development-project key as AQUI_NATIVE_OPENAI_API_KEY,
  Sensitive, Preview only, scoped to codex/aqui-native-realtime in Vercel.
  Enter the key directly through secure secret provisioning, never Git or chat.
  This route reads only AQUI_NATIVE_OPENAI_API_KEY and fails closed when absent;
  it never falls back to OPENAI_API_KEY. Existing web routes remain unchanged.
- Add AQUI_NATIVE_DEV_TOKEN through a secure provisioning flow: 32 cryptographically
  random bytes encoded as unpadded base64url (43 characters). No real token belongs
  in Git, Swift source, logs, or chat. Provision the same token privately to the test
  device's Keychain. The route fails closed if it is absent or malformed.
- Configure a Vercel Firewall rate-limit rule only for /api/aqui-realtime:
  initially 5 requests per 60 seconds per IP, returning 429. Check plan/rule
  availability first. No in-memory limiter is claimed as distributed protection.
  Do not enable the endpoint for testing until the external rule is verified.
- Confirm permission to deploy and to incur a small Realtime test charge.

The route uses GA POST /v1/realtime/calls (multipart sdp + session), never Live or
beta endpoints. It fixes model, voice, instructions and response-token limit
server-side. Audio flows directly over WebRTC after negotiation. The native
beep/greeting remains local and should finish before microphone transmission.

Development bearer authentication is intentionally replaceable via authenticate().
It is not production user/device identity. Rotate the token to block new sessions;
rotation does not stop existing calls. Rate limits constrain creation, not total
conversation cost. Client session updates are not a hard server-side spending cap.
This change does not secure or alter the existing AKI web endpoints.

## Local verification (no API access)

Run: node --test tests/aqui-realtime.test.mjs
Tests replace fetch entirely and generate disposable random credentials in memory.
They never load .env files or call OpenAI. No dependency installation is needed.

Tests also verify that a disposable legacy OPENAI_API_KEY cannot substitute for
a missing native key and is not used for upstream authorization.
