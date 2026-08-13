# EditMyMP3 — SEO / multi-page build

This is the Cloudflare Pages build of the browser MP3 editor.

## Search-focused URLs

- `/` — Free Online MP3 Editor / AI MP3 Editor
- `/mp3-cutter/` — MP3 Cutter / Trim MP3
- `/merge-mp3/` — Merge MP3 / MP3 Joiner
- `/mp3-volume-booster/` — MP3 Volume Booster
- `/audio-speed-changer/` — Audio Speed Changer
- `/mp3-converter/` — MP3 to WAV converter

Each page has its own title, meta description, H1, canonical URL, Open Graph metadata, copy and a real usable tool.

## Cloudflare deployment

Upload the contents of this folder to Cloudflare Pages. Keep `_worker.js` at the project root.

Add an encrypted environment secret named `GROQ_API_KEY` under your Pages project settings, then redeploy. The AI endpoint is `/api/ai`.

`_worker.js` also serves `/robots.txt` and `/sitemap.xml` dynamically using the deployed domain, so you do not need to replace a domain placeholder.

## Groq model

The AI planner currently uses `openai/gpt-oss-20b`.

## Before public launch

1. Replace the placeholder contact sentence in `privacy.html` with your real public support/contact method.
2. If you enable analytics or ads, update the privacy/consent setup to match the services you actually deploy.
3. Verify the site in Google Search Console and submit `/sitemap.xml`.
4. Test the pages on iPhone Safari and Android Chrome with small and medium MP3s.

## Privacy architecture

The actual audio editing/merge/conversion runs in the browser. AI planning sends the user's text instruction and audio duration to the server-side Groq endpoint; the MP3 itself is not required for the planning request.
