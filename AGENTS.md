  <!-- frontend-design:start -->
  # Frontend Design Protocol

  Any task touching UI, components, pages, layouts, styling, motion, landing
  pages, portfolios, or redesigns runs in two phases: **design first**, then
  **audit**. Do not write frontend code before the design phase has run.

  ## Phase 1 — Design (before any code)

  Load `frontend-ui-engineering` first. It is the mandatory entry point.

  Before building, state the design thinking explicitly:

  1. **Goal and audience** — what the screen must accomplish, for whom.
  2. **Direction** — visual tone, typography, color, density. One accent only.
  3. **Structure** — layout, hierarchy, component inventory, and states (empty,
    loading, error, full).
  4. **Interaction and motion plan** — what moves, why, and for how long.
  5. **Accessibility** — keyboard path, focus handling, contrast,
    `prefers-reduced-motion`.

  Do not start implementing until those five are written down. "I'll figure out
  the styling as I go" is a rationalization, not a plan.

  `design-taste-frontend` may be loaded at this point to infer direction and set
  dials. That is the only other skill allowed before the build starts.

  ## Phase 2 — Audit (after the build)

  Load these only once there is something to audit:

  - `impeccable` — run `polish` or `audit` on the shipped result.
  - `review-animations` — when the diff contains motion code.
  - `improve-animations` — codebase-wide animation audit, produces plans.
  - `emil-design-eng` — easing, spring, and transform physics when motion needs
    real tuning.
  - `apple-design` — gesture-driven UI, sheets, drawers, velocity handoff.
  - `animation-vocabulary` — when the correct name for an effect is unclear.

  ## Design principles

  - **No AI slop**: no purple gradients, no Inter default, no three equal cards,
    no em-dashes, no cream/beige default bg
  - **Motion must be motivated**: every animation justified in one sentence
  - **Easing**: ease-out for UI interactions, never ease-in, custom cubic-bezier
  - **Duration**: UI animations under 300ms, button press 100-160ms
  - **Physicality**: never `scale(0)`; start from `scale(0.95)` + opacity,
    popovers scale from trigger
  - **Interruptibility**: CSS transitions over keyframes for dynamic UI, springs
    for gestures
  - **Performance**: animate only `transform` and `opacity`, GPU-only properties
  - **Accessibility**: honor `prefers-reduced-motion`, gate hover behind
    `(hover: hover)`
  - **Typography**: avoid Inter; prefer Geist/Satoshi/Cabinet Grotesk; serif
    only when justified
  - **Color**: one accent per project, OKLCH preferred, no AI-purple default
  <!-- frontend-design:end -->
