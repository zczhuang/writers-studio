# Writer's Studio

A writing-practice web app for writers ages 11–13 that **pays real money** for real work.

- Four writing modes (Scene, Story, Mystery, Word Upgrade) with 34 prompts
- AI coach via **Google Gemini** (`gemini-3.1-flash-lite` by default) grades each piece on 5 dimensions: vocabulary, imagery, voice, structure, originality
- Heuristic fallback works fully offline
- Tiered earnings: **Bronze $0.10**, **Silver $0.25**, **Gold $0.50**, **Platinum $1.00**
- Parent-pays-IRL ledger gated by a 4-digit PIN
- Configurable daily cap ($0.50–$5.00)
- Streaks, achievements, grace tokens, journal of every piece

Built with **Vite + React + TypeScript + Tailwind**. Static SPA — no backend.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`. Deployable to any static host (Vercel, Netlify, GitHub Pages, plain S3).

## API key

The Gemini API key is **never** committed — it lives in the browser's localStorage on the user's device. Get a free key at <https://aistudio.google.com/apikey> and paste it during onboarding or in Settings.
