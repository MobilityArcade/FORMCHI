AKI 4.8 VISION

Upload these TWO files to the existing FORMCHI repo:
1) index.html -> replace the current root index.html
2) api/vision.js -> add this new file inside the existing api folder

KEEP your existing api/aki.js, manifest, icons, package.json, and OPENAI_API_KEY exactly as they are.

What is added:
- Minimal reactive voice bar (does not change the torus)
- Camera + Photo buttons appear only while AKI is ON
- Rear camera, front-camera flip, close
- No AKI logo over the camera image
- Camera frame is sent only when you tap the center Look button
- Native iPhone photo picker; up to two images can be selected
- Vision result is handed back into the existing AKI Live conversation so AKI speaks naturally about what it saw
- Camera/photo controls disappear when closed / AKI is off

Privacy/cost behavior:
- Camera is only opened after user action/recognized visual intent and iOS permission
- No continuous video is sent to OpenAI
- Only a still frame captured when Look is pressed is analyzed
- Photos are analyzed only after Send

Note: voice-triggered opening depends on user transcript events already being available in the current Live session. The visible camera/photo buttons are the reliable fallback.
