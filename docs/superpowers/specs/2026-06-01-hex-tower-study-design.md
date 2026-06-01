# Hex Tower Bin-Finding Study — Design

## Context

BrickBatch sorts LEGO into physical **hexagonal sorting towers**. A bin's location is
communicated by an *address* (which column, which layer, which bin-in-section). We don't
yet know which addressing/labeling scheme people can act on fastest and most accurately.

This project is a web app that **measures bin-finding speed and accuracy** under different
addressing schemes. A participant is shown a target address and a 3D hex tower they can
spin; they click the bin they think it is. We record time and every mistake (including
*where* they clicked). The goal is to discover the most intuitive scheme, and to make it
fun (leaderboard, "beat the average") so people share it. Deploys to Vercel from GitHub.

## The tower

- **Hexagonal prism**: 6 vertical faces = **6 columns**. Faces are fixed at 6.
- **Layers**: configurable horizontal bands (3–6).
- **Section** = one column × one layer. Each section is subdivided into **1–5 bins**
  side by side (uniform count, or varied per section).
- **Top cap**: plain, no labels.
- **Column header**: a non-counted cell at the very top of each column that **always shows
  that column's id** (color / letter / number / icon). This is the *only* label visible
  during the real test.
- **Layer and bin labels are hidden during the test.** The participant must infer them by
  counting position. Their intuitiveness is exactly what we measure.

## Addressing scheme (configurable + randomizable)

A scheme is the full set of choices a participant either inherits (default), randomizes, or
customizes before a round:

| Setting | Options |
|---|---|
| Address order | any permutation of {column, layer, bin} |
| Column type | color · letter · number · icon |
| Layer type | letter · number · icon |
| Bin type | letter · number ·  Handed (L, LM, M, RM, R) Right/Left/Middle (M for 1 bin, no M for 4 bins, etc) |
| Layer counts from | top · bottom |
| Bin counts from | left · right |
| Layers | 3–8 |
| Bins per section | 1–5, or "varied 1-2", "varied 1-3", "varied 1-4", "varied 1-5" |

The target prompt is rendered **in the scheme's own representation** (e.g. a color chip · "2" · "b")
and centered just above the tower. A round always uses one fixed scheme.

## Session flow (hybrid model)

1. **Start screen** — optional name (pseudonymous; collisions allowed, links shared with
   trusted people only). Shows the default scheme with controls to **keep / randomize /
   customize** (the configurator panel). Start button.
2. **Round screen — "beat the clock," 60 seconds.**
   - Target address shown centered above the 3D tower.
   - Participant **click-drags to spin** the tower around its **vertical axis only**
     (center-locked); no other rotation.
   - **Single-click** a bin to guess.
   - **Wrong click**: record the click + which bin was hit; participant keeps trying;
     clock keeps running.
   - **Correct click**: immediately serve the next (random) target.
   - Repeat until 60s elapse.
3. **Results screen** — personal summary (finds, score, avg time/find, accuracy), comparison
   to the aggregate ("you beat X% of players"), and leaderboards (overall + this scheme).
   Play again.

## Architecture

- **Next.js (App Router)** deployed on Vercel.
- **react-three-fiber + Three.js** for the tower. Each bin and header is an individual mesh;
  clicks resolved by **raycasting**. Rotation handled by a custom drag handler constrained to
  the Y axis (not full OrbitControls).
- **Tower generation**: a pure module turns a scheme + layout into the bin geometry and the
  mapping `(column, rowFromTop, leftRank) → displayed address`, honoring the direction
  settings. Reused by both the renderer and the correctness check.
- **Supabase (Postgres)** for storage. Writes go through Next.js **route handlers** so keys
  stay server-side; leaderboard reads via the same.

### Components (each independently testable)

- `scheme` — types + helpers: build/validate/randomize a scheme; format an address segment
  in a given representation; canonical scheme key (for per-scheme leaderboards).
- `tower-model` — pure: scheme+layout → bins with ids and the address mapping. No rendering.
- `Tower3D` — R3F component: renders model, Y-axis drag, raycast click → emits clicked bin.
- `round-engine` — pure: timer, target sequence, scoring, records finds/clicks.
- `Configurator` — the scheme/layout panel.
- `api/rounds`, `api/leaderboard` — route handlers to Supabase.
- Pages: `start`, `round`, `results`.

## Data model (Supabase)

- **rounds**: `id`, `name`, `created_at`, `scheme` (jsonb), `scheme_key`, `duration_s`,
  `finds_count`, `score`, `accuracy`, `wrong_clicks_total`, `valid` (bool).
- **finds**: `id`, `round_id`, `seq`, `target_column`, `target_layer`, `target_bin`,
  `target_display` (text), `time_ms`, `wrong_clicks`.
- **clicks**: `id`, `find_id`, `clicked_column`, `clicked_layer`, `clicked_bin`,
  `is_correct`, `time_ms`. (Captures *where they pressed* by bin identity.)

## Scoring, leaderboard, culling

- **Score** = number of correct finds in 60s. **Accuracy** = correct / (correct + wrong clicks).
- **Leaderboards**: overall + per-scheme (keyed by `scheme_key`). Comparison shows the
  participant's percentile vs valid rounds.
- **Culling** (`valid=false`, excluded from leaderboards/averages): no finds at all; accuracy
  below a low threshold (e.g. < 0.2, i.e. mostly wrong clicks); or a round where the only
  activity was failing to find a single bin. Rules computed at save time and stored.

## Out of scope (YAGNI)

- Accounts / auth (names are free-text, unverified).
- Mobile-perfect layout (desktop drag-to-spin first; touch is a bonus).
- Admin UI for editing the default scheme (default lives in config/code initially).
- Non-vertical rotation, zoom, pan.

## Verification

- Unit tests for `scheme` (formatting, randomize, key) and `tower-model` (address mapping
  under every direction combo — the correctness-critical piece).
- `round-engine` tests for scoring/accuracy/culling rules.
- Manual end-to-end: run `next dev`, complete a 60s round (rotate, mis-click, correct-click),
  confirm a row lands in Supabase and the results screen + leaderboard reflect it.
