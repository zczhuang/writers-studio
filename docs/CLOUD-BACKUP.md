# Writer's Studio cloud backup

> Last updated: 2026-10-03

Writer's Studio is offline-first. Local saves remain authoritative while offline, and the Supabase layer adds private backup, recovery, and multi-device merging without asking the child for an email address.

## Setup checklist

1. Create a dedicated Supabase project. Do not share a project that contains unrelated customer data.
2. Enable anonymous sign-ins in Supabase Auth. Anonymous users receive the `authenticated` Postgres role; the migration grants `anon` no data access.
3. Apply `supabase/migrations/202610030001_writers_studio_cloud_history.sql` through the normal reviewed migration workflow.
4. Copy `.env.example` to `.env` for local development and set:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

5. Configure the same two public values in the deployment environment. Never expose a service-role key in Vite, source control, or the browser.
6. Review Supabase Auth's anonymous-user rate limits and enable CAPTCHA/Turnstile if the public deployment needs stronger sign-up abuse protection.
7. Run the live isolation/round-trip checks below before calling cloud backup operational.

If the environment variables are absent, the app remains fully usable and does not attempt auth or database calls. The device badge reports the verified local-storage result; quota, recovery-checkpoint, damaged-save, and update-required states are shown as unsaved/actionable instead of claiming success.

## Data and security model

The migration is additive and creates these membership-scoped, read-only API tables:

- `writer_spaces`: one mutable head per lineage, with generation and CAS version fences.
- `writer_space_memberships`: device-auth users linked by server-side RPC only.
- `writer_snapshots`: full accepted and conflicting payloads, append-only.
- `writer_entry_versions`: immutable first drafts, revisions, recovered legacy drafts, and conflicts.
- `writer_progress_events`: unique post-baseline XP/word/challenge deltas.
- `writer_legacy_baselines`: exact imported legacy counters; ambiguous baselines are retained, never added together.

Recovery hashes, claim throttles, and RPC idempotency records live in the non-exposed `writers_private` schema. The raw recovery code is never stored in a database row. The browser sends it over TLS to a `SECURITY DEFINER` claim RPC, which hashes it with SHA-256 and creates membership itself.

All exposed tables have RLS enabled. `authenticated` receives SELECT only through membership policies. `PUBLIC`, `anon`, and `authenticated` receive no direct INSERT, UPDATE, or DELETE privileges. The four public RPCs:

- check `auth.uid()`;
- check or establish the exact writer-space membership appropriate to that operation;
- use `SECURITY DEFINER SET search_path = ''` and fully qualified relations;
- validate safe payload keys and size;
- preserve terminal paid/forfeited ledger rows;
- reject a meaningful-head-to-empty replacement and dropped entry/ledger IDs;
- archive stale CAS uploads as conflicts rather than replacing the head;
- deduplicate exact operation retries and reject operation-ID reuse with different content.

There is no cloud delete/reset RPC. A parent reset rotates to a new local lineage; later sync creates a new writer space. The old space, snapshots, and recovery path remain intact.

## What is and is not uploaded

The cloud/export allowlist includes schema version, writer progress, earnings ledger, entries and immutable versions, coaching memory, craft progress, safe model/cap/age settings, exact legacy baseline provenance, and unique post-baseline operations.

It excludes:

- Gemini API key;
- parent PIN hash and salt;
- public app unlock and parent-access deadline;
- Supabase auth/session tokens;
- cloud recovery code;
- navigation, current screen/challenge, last result, and other ephemeral UI state.

In-progress `ws_draft_*` text remains device-local. Completed first drafts and every new revision are backed up. Old entries that predate schema 4 get a clearly marked `legacy-current` version; the app does not invent an original draft, word count, or XP award that no longer exists.

## Sync behavior and merge rules

- Local persistence completes independently of network availability.
- Sync starts only after the public app access screen has been unlocked.
- A blank profile does not sign in or create/upload a writer space.
- Each cycle pulls and merges before uploading.
- One device serializes its requests. A local edit made during pull/upload schedules a follow-up; “Cloud saved” appears only after the server acknowledges the latest payload.
- CAS/version checks and durable operation IDs make retries and StrictMode duplicate starts idempotent.
- Entry IDs are unioned, and divergent versions remain available in Journal.
- One exact legacy baseline is authoritative. Different/overlapping baselines are retained as conflicts, not summed.
- Only unique operations tied to the chosen baseline add XP, first-draft words, or challenge counts.
- Ledger IDs are unioned; paid and forfeited rows never return to pending.
- Cloud/import hydration uses a dedicated merge action. It never calls `SUBMIT_ENTRY` or `REVISE_ENTRY`, so it cannot award XP or money again.
- A reset changes both lineage and generation. Responses captured before the reset cannot hydrate or mark the new line as saved.

## Parent recovery instructions

### Save the code

1. Unlock Parent mode and open Settings.
2. Under **Cloud backup & recovery**, wait until at least one piece has been backed up.
3. Choose **Show recovery code**.
4. Copy it into a private password manager or choose **Save as file** and store that file securely.

The code is 43 URL-safe characters representing 32 random bytes (256 bits). It is different from both four-digit PINs. Anyone with the recovery code can link an authenticated device to the private writing space, so treat it like a password.

### Restore another device

1. Open Writer's Studio and pass the normal app access screen.
2. On a fresh browser, complete the local parent-PIN setup. The PIN protects settings on that device; it is not sent to Supabase.
3. Unlock Parent mode, open Settings, and paste the code into **Restore with a recovery code**.
4. Choose **Restore & link this device**.

The server rate-limits failed claims. A successful claim pulls and merges the current cloud state. A wrong code, expired parent-access window, sign-in error, or network failure never clears local progress.

JSON export/import is a second parent-gated recovery route. Exports deliberately omit all credentials and the cloud recovery code. Imports are additive; ambiguous legacy totals are preserved as separate baselines instead of being summed.

## Hydration recovery

Before migrating `ws_state_v2`, the app checkpoints the exact raw string under bounded `ws_state_recovery_v1_first` and `ws_state_recovery_v1_latest` localStorage keys. The first source is retained, with at most one rolling later source. Malformed or newer-schema saves remain in place and block writes; a failed migration checkpoint also blocks writes while keeping recoverable writing visible. Field-by-field normalization preserves recoverable entry text when grading metadata is malformed. Coaching memory rebuilds from valid graded history while keeping recommendation rotation and craft progress.

## Required live verification after provisioning

The repository tests cover the pure merge/sync controller and SQL contract, but a provisioned project is still required for these integration checks:

1. User A creates a writer space; user B cannot select A's space, membership, snapshots, versions, events, or baselines.
2. A direct authenticated INSERT/UPDATE/DELETE, including a forged membership row, is denied.
3. Five wrong recovery claims persist and trigger throttling; a valid code links B and never reveals the stored hash.
4. An exact operation retry creates one effective snapshot/version/event. Reusing its ID with different content is rejected.
5. A stale CAS upload becomes a conflict snapshot and does not change the head; the client repulls, merges, and retries.
6. A nonempty head rejects an empty/dropping client and any paid/forfeited ledger regression.
7. Two browsers edit offline, reconnect, retain both entries/revisions, and do not double XP, words, challenges, or money.
8. Reset creates a new lineage; delayed old responses do not revive it, and the old recovery code still reaches the old backups.
9. Clear a second browser, restore with the recovery code, and verify the Journal, counters, ledger, memory, craft, and revision history round-trip.

Until those live checks pass, the implementation is build/test verified but cloud saving is not operationally verified.
