# Writer's Studio — Benchmark & Build (May 2026)

Two multi-agent research workflows benchmarked the kids'/tween writing-app category
and designed the enrichments that were then implemented. This doc records the
findings and what shipped.

## How the benchmark was run

- **Workflow 1 — Benchmark & memory design** (20 agents): 6 parallel research facets
  (competitors, gamification, pedagogy, AI learner-memory, safety/trust, retention),
  each with adversarial fact-checking, then a synthesis pass. The raw synthesis
  (`_synthesis_raw.json`) is a local research artifact and is excluded from GitHub.
- **Workflow 2 — Craft & visuals** (10 agents): research on classic mentor texts,
  contemporary writers' techniques, and no-backend visuals, with author/technique
  attribution checks, then a build-ready design. The raw design
  (`_craft_design_raw.json`) is a local research artifact and is excluded from GitHub.

## Headline finding

Writer's Studio already sits in the upper tier of the category on three axes the best
products treat as core (a multi-dimensional rubric, a real gamification shell, and a
differentiated trust posture). But it trailed the leaders on the dimensions that drive
*learning and retention*, and nearly all of those traced to **one root cause: the coach
was stateless.** Versus Quill (adaptive routing, 5-revision loop), Khanmigo (draft-history
awareness), Night Zookeeper (a world that grows with each piece), and Duolingo (per-user
learner model), Writer's Studio re-judged every piece from zero.

So persistent writer-memory wasn't one feature among many — it was the substrate the
others sit on. It appeared as the key unlock in four of six research facets independently.

## High-severity competitive gaps

1. **Stateless coach / no learner model** — the #1 gap.
2. **No revision/resubmit loop** — the most evidence-backed pedagogy in the whole benchmark.
3. **Payout rewards output (score) only, not input** (showing up, finishing, revising).
4. **Un-hardened LLM grading path with real money attached** — the child's text was
   concatenated into the prompt with no isolation.

## Prioritized roadmap (P0/P1 — abridged)

| Pri | Feature | Status |
|-----|---------|--------|
| P0 | Persistent writer-memory (mastery EWMA, growth edge, vocab vault) | ✅ shipped |
| P0 | Inject memory into the coaching prompt on a **score-blind** path | ✅ shipped |
| P0 | Prompt-injection hardening (delimit the submission) | ✅ shipped |
| P0 | "Did you grow?" callback | ✅ shipped |
| P1 | Adaptive skill recommendation by weakest dimension | ✅ shipped |
| P1 | Learner-facing growth view (radar + sparklines) | ✅ shipped |
| P1 | Revise-and-resubmit loop (up to two revisions) | ✅ shipped |
| P1 | Parent growth dashboard behind the PIN | ✅ shipped |
| P1 | Adaptive **prompt** selection by weakest dimension | ✅ shipped |
| P1 | Input-weighted payout (effort floor + tier bonus) | ◻︎ deferred — changes money semantics; see note |

> **Input-weighted payout** is intentionally NOT shipped. It would guarantee a small floor (e.g. $0.10) for any genuine, effort-meeting piece — but that contradicts the app's stated philosophy that a tier is *earned* ("not a participation trophy", baked into the coach prompt). It pays for sub-50 work the current design deliberately doesn't. Flag for the owner to decide before building.

## What shipped this pass

### 1. Persistent writer-memory (the core deliverable)
- `src/services/writerMemory.ts` — a pure module: EWMA mastery per dimension, derived
  strength/growth-edge, a vivid-word vault, the "did you grow?" signal, skill
  recommendation, and chart helpers. `foldEntry` runs on every submit; `buildMemory`
  backfills from history.
- `WriterMemory` + `CraftState` added to `AppState`; persisted in localStorage with a
  **v2→v3 migration** that rebuilds memory from any existing entries (returning writers
  get a populated coach immediately). Memory is stored on the device; selected
  derived coaching context is sent with a submission when Gemini is enabled.

### 2. Coach integration + safety (`src/services/gemini.ts`)
- A compact **WRITER CONTEXT** block is injected before the prompt — it personalizes
  tone and which suggestion to stress, with an explicit guardrail that it must **never**
  move the score.
- The writer's submission is wrapped in `<<<WRITER_SUBMISSION>>>` delimiters with a
  system instruction to treat it as text to evaluate. This helps separate writing
  from instructions in the Gemini grading path; it is not a guarantee against
  prompt manipulation. The heuristic fallback evaluates the writing locally.

### 3. Craft Skills library (classic + contemporary)
- `src/data/skillCards.ts` — 14 fact-checked Skill Cards. Classics quote short
  public-domain excerpts (Twain, Dickens, London, Poe, Conan Doyle, Verne, Grimm,
  Melville, Chekhov); contemporary cards teach the technique in our own words with
  original examples (King, Bradbury, Dahl, Provost). `verified` is true only where the
  attribution was confirmed.
- `CraftLibraryScreen` (new nav tab) — browsable, dimension-filtered, with a
  memory-driven "Recommended for you" card targeting the writer's weakest dimension.

### 4. Visual system (no backend, no image API)
- `src/data/dimensionTheme.ts` — one color + glyph + kid-label per dimension, reused
  everywhere so a writer learns to associate a color with a skill.
- `WritingShapeRadar` — hand-rolled 5-axis SVG radar (this piece vs. your usual shape).
- `DimensionSparklines` — per-dimension trend lines over recent pieces.
- Result screen: dimension-colored breakdown bars + the radar + a "You grew!" callback.
- Home screen: "Today's craft focus" + "My writing journey" growth strip.

## Second pass — P1 features

### Revise-and-resubmit loop (the benchmark's top-rated pedagogy)
- After a grade, a "Make it even better" CTA opens the same piece for revision (up to 2×),
  pointing the writer at their lowest dimension. On resubmit the piece is updated **in place**
  (`REVISE_ENTRY`) — no duplicate journal entry. Feedback reflects the latest draft while
  recorded earnings are preserved. Eligible payout increases must fit the daily cap;
  paid and older ledger rows must not be reopened by a revision.
  Memory is recomputed from the corrected history so the radar/growth reflect the improvement.

### Parent growth dashboard (behind the existing PIN)
- A read-only "Skill growth" section on `ParentDashboardScreen`: a now-vs-when-they-started
  radar, per-dimension sparklines, strongest/growth-edge summary, vocab-vault size, and craft
  skills mastered/tried — all computed from existing on-device data.

### Adaptive prompt selection
- `src/data/promptSkills.ts` maps each prompt's `skill` label to grading dimension(s). The mode
  list now surfaces prompts that build the writer's weakest dimension first, badged "Grows your …".

## Validation contracts
Preserve entries and earnings during the v2→v3 migration. Check that recommendations
follow the weakest dimension, growth feedback reflects actual improvement, and the
radar, score bars, and craft library render across mobile and desktop. Revision checks
must preserve paid rows and apply daily caps to every positive earnings delta.

Current release details are in [the October 2026 release notes](RELEASE-2026-10-03.md).
