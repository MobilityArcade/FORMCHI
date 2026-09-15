# AKI
A minimal voice-first living presence prototype.

## Deploy
This project needs a tiny serverless backend to protect the OpenAI API key. GitHub Pages alone cannot safely hold the secret key.

1. Create a GitHub repository and upload all files/folders from this project.
2. Import that GitHub repository into a serverless host such as Vercel.
3. Add an environment variable named `OPENAI_API_KEY` in the host's project settings.
4. Deploy and open the HTTPS URL on your phone.
5. Tap the living surface once to grant microphone permission. Then speak naturally.

Never put your API key in index.html or commit it to GitHub.
