# Native AQUI public webpage reader — development only

Preview only. Do not merge to main or deploy Production. Existing routes remain
unchanged except the reviewed, appended native-session webpage-reference instruction.

`POST /api/aqui-webpage` accepts only `{ "url": "http(s)://..." }` from the
existing native bearer-authenticated caller. It fails closed unless VERCEL_ENV
is `preview` and VERCEL_GIT_COMMIT_REF is `codex/aqui-native-realtime`.
Vercel Authentication still requires the existing temporary developer OIDC path.
No OpenAI API key is used by this reader; it makes no model/search API request.

## Security and limits

- Exact one URL; HTTP(S), standard ports only, no embedded username/password.
- Public IP validation for all DNS A/AAAA answers; conservative reserved/private,
  local, documentation, multicast, mapped/transition IPv6 exclusions.
- Pin validated IPs in the actual Node connection lookup, no second DNS resolution,
  no connection pooling/proxy, normal TLS hostname/certificate verification.
- Each redirect is parsed and resolved/checked again; maximum three redirects;
  HTTPS downgrade is rejected. No recursive links or subresources are fetched.
- 4 KiB incoming JSON, 16 KiB response headers, 1 MiB downloaded body, 8 seconds
  total including request parsing/DNS/redirects/body. Disconnect aborts the work.
- Request only identity encoding; reject compressed responses rather than
  decompressing them. UTF-8/ASCII text/html or text/plain only. Reject attachment
  disposition, invalid UTF-8 and PDF signatures. Unsupported pages fail closed.
- Fixed destination request headers only. Never forward bearer, OIDC, cookies,
  user headers or auth challenges to the page. No script execution/browser login.
- HTML parsing excludes scripts, style, forms, navigation, headers/footers and
  explicitly hidden elements. Main/article text preferred; otherwise body text.
  Content is not guaranteed complete or true; no paywall/login/JS bypass exists.
- Result is final source URL, title (240 UTF-8 bytes), content (4500 UTF-8 bytes),
  and partial flag. Short/empty extraction is rejected. No content or URLs logged.
- Native fetch is ephemeral, no cookies/cache/credential storage, no redirects,
  bounded to 16 KiB response and 12 seconds. Only the fixed Preview endpoint is used.

## Native lifecycle

The existing Send/readiness gate is unchanged. Ordinary non-URL text is sent
unchanged. One explicit http(s) or www URL triggers retrieval only on Send.
Multiple URL submissions are rejected with the draft retained. Bare domain prose
is not implicitly fetched. URL path/query punctuation is preserved verbatim.

The original draft and JSON-quoted untrusted page reference enter the existing
AQUITextTurn mechanism as one user input_text item, using existing 25-character
IDs, acknowledgment and response handling. The complete message must fit within
8000 UTF-8 bytes. Failure to fit retains the draft; no automatic truncation of the
user's text or retries. Fetch failures use the existing native notice and do not
pretend a page was read. Retrieved text is reference data, never system instructions.

Retrieval does not emit committed/halo events, mute audio, change VAD, or reserve
voice turns. If a voice turn takes priority, existing busy/concurrent-turn rules
apply. Power OFF cancels pending webpage work and generation guards reject late
results. Nothing is saved as history/memory. Existing Type/Paste UI is unchanged.

## Offline validation

`node --test tests/aqui-*.test.mjs` uses fake DNS, transport and model calls only.
Native AQUIOfflineTests includes detection, fixed HTTP contract, bounds/errors,
packaging, ordinary text, OFF, cancellation, stale result and duplicate-send tests.
No live page, Realtime or OpenAI calls are part of these suites.

## Required before controlled Preview validation

1. Review/publish only these local changes to the existing development branch/PR,
   separately authorized; keep main and Production unchanged.
2. Use the approved temporary instance-local admission guard: one in-progress
   request and two admissions per rolling 60 seconds, after authentication and
   before body parsing/DNS/network work. Failed/cancelled admissions still count;
   cleanup releases only concurrency. Excess returns 429 with Retry-After; guard
   failure returns sanitized 503 without fetching. Only timestamps/flags are kept.
   This is private Preview/test protection, NOT a global/distributed limiter or
   production abuse control. Cold starts reset counters; multiple instances each
   have their own allowance. Existing Vercel Authentication and bearer validation
   remain required. Do one deliberate submission, with no automatic retry.
   The plan rejected the additional WAF rule; existing Realtime WAF is unchanged.
3. Confirm branch-scoped AQUI_NATIVE_DEV_TOKEN and deployment protection metadata
   without reading values. No new credential or OpenAI scope is needed for fetching.
4. Authorize one Preview deployment (existing one-off Ignore Build Step override).
   Verify branch SHA, scope, route presence, and unchanged Production by metadata.
5. Separately authorize controlled webpage retrieval with known public fixtures,
   then physical Debug installation/provisioning and one Realtime validation.
   A new Realtime session is needed to receive the appended reference instruction.

Known limitations: no JS rendering, PDFs, media, search fallback, login, or paywall
bypass. Sites rejecting identity encoding or non-browser clients may be unreadable.
Prompts/JSON labels reduce prompt-injection risk but do not prove model immunity.
