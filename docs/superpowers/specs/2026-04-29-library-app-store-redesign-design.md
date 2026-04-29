# Library v0.3 — "App Store" redesign

Status: design approved 2026-04-29. Supersedes the page-and-modal Library shipped on `feat/library`.

## Why

The current Library is a flat list with a JSON-preview Add modal. Pier targets non-developers as well as developers, and the present surface fails them in three ways:

1. The Add modal exposes raw `tools.json`, signaling "you must understand this before clicking Add."
2. Cards carry no icon, category, or trust signal — every tool looks equally arbitrary.
3. Library reads as a config screen, not a place you browse. We chose the Chrome Web Store / Raycast Store mental model as the target.

Decisions taken during brainstorming:

- **A — App store model.** Library is a distinct destination with store affordances.
- **A2 — Curated landing + browse.** The landing is editorial rows; full browsing is its own page.
- **C1 — Minimal-store cards.** Icon + name + outcome line + optional audience tag. Trust details live on the detail page.
- **D1 — Full-page detail route.** The JSON modal is removed; detail is a routable page.
- **P3 — Hybrid permissions.** Three-axis chips for scanning, plain-English sentence list for reading.
- **I1 — Disabled "Added" state.** Installed tools stay visible with a check badge and a Remove affordance on detail.

## Information architecture

Library remains a top-level sidebar destination. Internally it has three routes:

- `/library` — curated landing.
- `/library/all` — full browse (search + filters + grid).
- `/library/<tool-id>` — detail page.

The current single-page Library plus `AddToolDialog` modal is removed.

### Curated landing (`/library`)

Editorial rows, each a horizontal-scroll strip of ~6 cards with a `See all →` link:

1. **Featured** — entries flagged `featured: true` in the catalog.
2. **New this week** — entries whose `addedAt` is within the last 7 days.
3. **For developers** — entries whose `audience` includes `developer`.
4. **Popular** — placeholder ordering (catalog order) until usage telemetry exists. The row exists from day one; the *ranking source* is the deferred question.

Empty rows are hidden, not shown empty.

### Full browse (`/library/all`)

- Search bar (matches `name`, `outcome`, `category`, `tags`).
- Category chip row (single-select, with "All").
- Responsive grid of cards.
- No editorial rows here; this is the exhaustive surface.

### Detail page (`/library/<tool-id>`)

Top-to-bottom:

1. **Hero** — large icon, name (h1), outcome (subhead), primary `Add to my tools` button on the right. If already installed: button is disabled and labeled `Added ✓`, with a small `Remove` text link beneath.
2. **Permissions panel** (hybrid):
   - Chip row: three axes (Network / Files / System) each rendered as a neutral chip with an icon and a value.
   - Sentence list: 1–4 short sentences from a fixed allowlist (see schema), chosen by the catalog author.
3. **What it does** — short paragraph (`description`) plus zero to two example invocations rendered as code snippets.
4. **Provenance footer** — `From pier-tools · verified` line with a checkmark indicating minisign signature verification, and a link to the source repo.
5. **Advanced ▸** — collapsed disclosure. Expanded, it shows the raw `tools.json` entry that will be appended on Add. Closed by default.

Browser back / sidebar Library link returns to wherever the user came from.

## Tool card (C1)

Fixed shape across rows and grid:

- Icon (emoji or remote PNG from catalog).
- Name — single line, truncated with ellipsis.
- Outcome — single line, written as a result, not a description.
- Audience tag — only rendered if `audience` is non-empty; rendered in muted small caps.
- Installed state — small `✓` badge in the top-right corner; card stays clickable but visually muted (reduced opacity on the card body, badge stays full opacity).
- Hover: subtle lift; click: navigates to `/library/<tool-id>`.

## Catalog schema additions

`pier-tools` catalog entries grow new fields. All fields are covered by the existing minisign signature; no new key material.

```jsonc
{
  "id": "kill-port",
  "name": "Kill process on port",
  "outcome": "Free up a stuck port",
  "icon": "🔪",
  "category": "system",
  "audience": ["developer"],
  "permissions": {
    "network": "none" | "localhost" | "internet",
    "files":   "none" | "read-only" | "writes",
    "system":  "none" | "runs-commands" | "kills-processes",
    "sentences": [
      "runs-locally",
      "no-network",
      "may-terminate-processes",
      "reads-files-you-point-it-at"
    ]
  },
  "examples": ["pier kill-port 3000"],
  "featured": false,
  "addedAt": "2026-04-20",
  "tool": { /* the existing tools.json entry, unchanged */ }
}
```

Rules:

- `outcome`, `permissions` — **required** going forward. Catalog publish should fail validation if missing.
- `category`, `audience`, `examples`, `featured`, `addedAt`, `icon` — **optional**. Frontend treats missing values as: no audience tag, no examples shown, not featured, no "New" eligibility, default icon.
- `audience` is an array; `[]` means "everyone". The legacy `DEV` tier label is removed in favor of this field.
- `permissions.sentences` is a closed allowlist; the frontend has the canonical strings for each key. Adding a new sentence requires a frontend release. This is intentional — the trust language must not be free-form.
- The three-axis values are also closed enums; the frontend renders the chip label and icon from a lookup table.

The catalog loader accepts entries missing the new fields during the migration window so an older `pier-tools` build keeps loading. Required-field enforcement runs in the *publish* tooling, not the runtime, so a stale catalog never bricks the app.

## Frontend changes

Layering follows the existing `domain → application → infrastructure → ui` split.

- `src/domain/library.ts` — extend `CatalogEntry` with the new fields. Add closed-enum types for `Permissions`, `Audience`, and `PermissionSentence`. Pure types, no React.
- `src/application/ports.ts` — `CatalogLoader` port shape unchanged; the entries it returns are richer.
- `src/infrastructure/` — update the catalog loader to parse new fields and tolerate missing optional ones. Add a small frontend-only lookup table for permission chip labels and sentence strings (this is UI copy, lives in the UI layer, but the *keys* are domain).
- `src/state/LibraryContext` — already exists; expose `installedToolIds: Set<string>` derived from `AppContext`'s tools list so cards and detail render installed state without prop drilling.
- `src/state/AppContext` — gains a `removeTool(id)` action used by the detail page's Remove link.
- `src/ui/pages/LibraryPage.tsx` — replaced. Becomes the curated landing.
- `src/ui/pages/LibraryAllPage.tsx` — new. Search + chips + grid.
- `src/ui/pages/LibraryToolPage.tsx` — new. Detail route.
- `src/ui/organisms/CatalogRow.tsx` — new. Horizontal scroll strip with `See all`.
- `src/ui/organisms/CatalogCard.tsx` — new. Replaces the inline card markup.
- `src/ui/organisms/PermissionPanel.tsx` — new. Chips + sentences.
- `src/ui/organisms/AddToolDialog.tsx` — **deleted**.

Routing: extend whatever the sidebar router uses today (`feat/library` already wired Library as a sidebar destination — the new sub-routes piggyback on that mechanism rather than introducing a new router).

## Backend changes

None required for this scope. The Add flow still goes through the existing path that appends to `~/.pier/tools.json`. Removal uses the existing tools-config write path.

If the catalog tooling lives in this repo (it doesn't currently — `pier-tools` is its own repo), the publish-time validator that enforces required fields lands there, not here.

## Accessibility

- The detail page is a real route, so back-button and screen-reader heading order work without dialog scaffolding.
- Cards are `<a>` elements (or buttons that navigate) — keyboard tabbable, with visible focus rings using existing tokens.
- The Advanced disclosure uses `<details>` so it is keyboard-operable for free.
- The Remove link, when shown, opens a confirmation using the existing dialog-a11y hook (`useDialogA11y`).

## Out of scope

- Star ratings, install counts, real popularity ranking — deferred until catalog usage telemetry exists. The "Popular" row ships using catalog order as a placeholder; the data source is the open question, not the UI.
- In-Library search of the curated landing — search lives on `/library/all`.
- User-submitted tools or third-party catalogs.
- Updating an installed tool when its catalog version bumps — separate spec.
- Detailed visual design (typography, exact spacing, motion) — handled during implementation against existing tokens; this spec sets structure, not pixels.

## Risks

- **Schema split-brain.** If a `pier-tools` build ships without the new required fields, the new UI degrades gracefully (no chips, no audience tag) but the trust story weakens. Mitigation: enforce required fields in publish tooling; treat the existing build as the migration baseline.
- **"Added" state regressions in muted styling.** Reduced opacity is easy to over-do; the check badge must remain unambiguously legible. Visual review during implementation.
- **Detail-route deep links from a fresh catalog load.** Visiting `/library/<id>` before the catalog has loaded should show a skeleton, then either the tool or a "not found" state if the entry is gone. Spelled out in the implementation plan, not here.
