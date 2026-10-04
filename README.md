# Writer's Studio

A writing-practice web app for writers ages 11–13 that **pays real money** for real work.

- **Story atlas design** — an illustrated book-and-landscape welcome, warm paper surfaces, distinct writing worlds, and a responsive reading layout
- **Daily missions** — finish a piece, write 100 words, and explore two modes; completion is derived from saved entries and resets on the local calendar day
- **Adventure trail** — five XP ranks from Apprentice to Author, with the next rank and remaining XP shown
- **Writing worlds** — completion counts unique prompts, so repeating a challenge does not inflate the map
- **A week in words** — seven days of writing activity, with encouraging feedback for both busy and quiet weeks
- **Achievement cabinet** — collectible medallions, earned dates, progress toward locked badges, and the three closest goals
- **A clearer finish** — result screens show XP gained, rank progress, level-up celebrations, today's mission progress, and targeted coach feedback
- Four writing modes (Scene, Story, Mystery, Word Upgrade) with 34 prompts
- AI coach via **Google Gemini** (`gemini-3.1-flash-lite` by default) grades each piece on 5 dimensions: vocabulary, imagery, voice, structure, originality
- Heuristic fallback works fully offline
- **Persistent writer-memory** — the coach remembers each writer across sessions (per-dimension mastery, growth edge, a vocabulary vault) and personalizes feedback. Memory is stored on the device. When the Gemini coach is enabled, selected derived coaching context is sent with the writing; the context instructs the coach to personalize feedback without changing the rubric score. Submission delimiters help separate writing from instructions.
- **"Did you grow?"** — the coach recalls the skill it last nudged and celebrates real improvement
- **Craft Skills library** — 14 fact-checked mini-lessons from great writers (classic public-domain mentor texts + modern techniques), with a memory-driven "recommended for you" card targeting the writer's weakest dimension
- **Revise & resubmit** — improve the same piece (up to 2×) aimed at your weakest dimension; feedback reflects the latest draft while recorded earnings are preserved
- **Adaptive prompts** — the prompt list surfaces challenges that build your weakest skill first
- **Parent growth dashboard** — behind the PIN: a now-vs-start "writing shape" radar, per-dimension trends, words learned, and skills mastered
- **Growth visuals** — a "writing shape" radar (this piece vs. your usual), per-dimension sparklines, and dimension-colored score bars
- Tiered earnings: **Bronze $0.10**, **Silver $0.25**, **Gold $0.50**, **Platinum $1.00**
- Parent-pays-IRL ledger gated by a 4-digit PIN
- Configurable daily cap ($0.50–$5.00)
- Streaks, achievements, grace tokens, journal of every piece

Built with **Vite + React + TypeScript + Tailwind**. Static SPA — no backend.

See [`docs/BENCHMARK-AND-BUILD.md`](docs/BENCHMARK-AND-BUILD.md) for the category benchmark and roadmap behind the latest features.

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

Writing, earnings, and progress are saved in this browser. With Gemini enabled, the submitted piece, challenge, audience age, and selected derived coaching context are sent to Google for feedback. Without a key, or when the coach is unavailable, scoring runs locally.

## Revision rewards

Revisions keep the original journal entry and add a small XP bonus. A higher tier can increase an unpaid reward from the same local day, within the remaining daily cap. Paid rewards, closed rewards, and rewards from earlier days stay unchanged; those revisions are for practice. The latest draft can receive different feedback without reducing its recorded earnings.
