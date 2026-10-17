# iGusta v1 — movement game

Open `index.html` in a browser to try **Instant mix** without any API key. On iPhone, serve over HTTPS for reliable speech and audio. Select a category, duration, coach, language, voice preference and start. The app plays a three-count, start chime, halfway chime and end buzzer. Voice uses the browser's built-in speech synthesis; available male/female voices depend on the device. Coach Off disables speech but leaves the chimes active. Coach name is saved only in the visible field for this prototype; it is not announced.

For AI-generated cues, deploy the directory as a Vercel project and set the server-side environment variable `OPENAI_API_KEY`. Choose **AI mix · online**. The `api/igusta.js` serverless function calls the OpenAI Responses API, returns short movement cues, and the browser schedules them locally. If unavailable, the app falls back to the instant mix. No API key should be put into HTML or client JavaScript.

This prototype is NOT a live microphone chatbot. It is a working guided movement player with optional AI cue generation. Live voice conversations would require a separate realtime voice session implementation. Browser speech synthesis may interrupt or skip words on some devices when cues change rapidly. Test sound on a physical device, and stop movements that cause pain or dizziness.
