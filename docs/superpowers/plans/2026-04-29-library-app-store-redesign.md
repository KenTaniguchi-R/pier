# Library v0.3 — App Store Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page Library + JSON-modal with an "app-store" experience: curated landing → full browse → full-page detail, minimal cards, hybrid plain-English permissions, and an "Added" affordance with Remove.

**Architecture:** Library remains a sidebar destination but expands into three internal views (`landing`, `all`, `detail`) carried on the existing `Selection` discriminated union in `HomePage`. New domain fields (`outcome`, `audience`, `examples`, `featured`, `addedAt`, three-axis `permissions` + sentence allowlist) are added to `CatalogTool` as optional, permissive readers — the catalog (`pier-tools` repo) ships them in a coordinated release. New UI organisms: `CatalogCard`, `CatalogRow`, `PermissionPanel`. New pages: `LibraryLandingPage`, `LibraryAllPage`, `LibraryToolDetailPage`. The old `LibraryBrowser`, `LibraryToolCard`, and `AddToolDialog` are removed at the end. Remove flow gets one new Tauri command (`library_commit_remove`).

**Tech Stack:** React 19, TypeScript, Tailwind v4 (CSS tokens), Vitest + jsdom, Tauri 2 (Rust shim only — no business logic added there). Follows existing `domain → application → infrastructure → ui` layering.

**Spec:** `docs/superpowers/specs/2026-04-29-library-app-store-redesign-design.md`

**Coordination note:** The `pier-tools` catalog repo must publish a build with the new optional fields populated before users see chips/featured rows. The frontend tolerates their absence, so the rollout is safe in either order, but the visual goal is met only once the catalog ships them.

---

## File Map

### New files (frontend)
- `src/ui/organisms/CatalogCard.tsx` — minimal-store card (icon + name + outcome + optional audience tag + installed badge)
- `src/ui/organisms/CatalogRow.tsx` — horizontal-scroll editorial row with title and "See all"
- `src/ui/organisms/PermissionPanel.tsx` — three-axis chip row + sentence list
- `src/ui/pages/LibraryLandingPage.tsx` — curated rows
- `src/ui/pages/LibraryAllPage.tsx` — search + chips + grid
- `src/ui/pages/LibraryToolDetailPage.tsx` — hero, permissions, examples, advanced disclosure
- `src/ui/organisms/__tests__/CatalogCard.test.tsx`
- `src/ui/organisms/__tests__/PermissionPanel.test.tsx`
- `src/ui/pages/__tests__/LibraryLandingPage.test.tsx`
- `src/ui/pages/__tests__/LibraryAllPage.test.tsx`
- `src/ui/pages/__tests__/LibraryToolDetailPage.test.tsx`

### Modified files (frontend)
- `src/domain/library.ts` — add fields to `CatalogTool`; add `Permissions`, `Audience`, `PermissionSentence`, `Category` types
- `src/domain/__tests__/library.test.ts` — cover new optional-field parsing
- `src/application/ports.ts` — extend `LibraryClient` with `commitRemove(toolId)`
- `src/infrastructure/tauriLibraryClient.ts` — wire the new client method
- `src/ui/organisms/Sidebar.tsx` — extend `Selection` union to carry library subview/toolId
- `src/ui/pages/HomePage.tsx` — replace `LibraryBrowser` with the three new pages; add `removeTool` flow
- `src/setupTests.ts` — extend the in-test fake catalog/library client if needed

### Deleted files (frontend)
- `src/ui/molecules/AddToolDialog.tsx`
- `src/ui/molecules/__tests__/AddToolDialog.test.tsx`
- `src/ui/molecules/LibraryToolCard.tsx`
- `src/ui/molecules/__tests__/LibraryToolCard.test.tsx`
- `src/ui/organisms/LibraryBrowser.tsx`
- `src/ui/organisms/__tests__/LibraryBrowser.test.tsx`

### Modified files (Rust backend)
- `src-tauri/src/application/library.rs` (or wherever `library_commit_add` lives — discover at task time): add `library_commit_remove(tool_id: String)` use case
- `src-tauri/src/commands.rs` — `#[tauri::command]` shim for `library_commit_remove`
- `src-tauri/src/lib.rs` — register new command in `invoke_handler!`

---

## Phase 0 — Domain types and permission lookup

### Task 1: Extend `CatalogTool` with new optional fields

**Files:**
- Modify: `src/domain/library.ts`
- Modify: `src/domain/__tests__/library.test.ts`

- [ ] **Step 1: Read the current domain file end-to-end so types compose with what's there**

Run: `cat src/domain/library.ts`
Expected: file contents matching the spec's "before" shape (CatalogTool with `permissions: { network: boolean; fsRead: string[]; fsWrite: string[] }`).

- [ ] **Step 2: Write a failing test for the new optional fields**

Add to `src/domain/__tests__/library.test.ts` (create the file if absent — use a sibling next to other domain tests if there's a different convention):

```typescript
import { describe, it, expect } from "vitest";
import type { CatalogTool } from "../library";

describe("CatalogTool optional v0.3 fields", () => {
  it("accepts outcome, audience, examples, featured, addedAt", () => {
    const t: CatalogTool = {
      id: "kill-port",
      name: "Kill process on port",
      version: "1.0.0",
      description: "Free up a port held by a stuck process.",
      category: "system",
      outcome: "Free up a stuck port",
      audience: ["developer"],
      examples: ["pier kill-port 3000"],
      featured: true,
      addedAt: "2026-04-20",
      permissions: {
        network: "none",
        files: "read-only",
        system: "kills-processes",
        sentences: ["runs-locally", "may-terminate-processes"],
      },
    };
    expect(t.outcome).toBe("Free up a stuck port");
    expect(t.audience).toEqual(["developer"]);
    expect(t.permissions.sentences).toContain("runs-locally");
  });

  it("treats outcome/audience/examples/featured/addedAt as optional", () => {
    const t: CatalogTool = {
      id: "x",
      name: "X",
      version: "1.0.0",
      description: "y",
      category: "general",
      permissions: { network: "none", files: "none", system: "none", sentences: [] },
    };
    expect(t.outcome).toBeUndefined();
    expect(t.audience).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify the type-shape change is needed**

Run: `npx vitest run src/domain/__tests__/library.test.ts`
Expected: FAIL — `CatalogTool` does not currently accept `outcome`, `audience`, the new `permissions` shape, etc.

- [ ] **Step 4: Update `CatalogTool` and add supporting types**

Replace the body of `src/domain/library.ts` with:

```typescript
import type { Parameter } from "./tool";

export interface PlatformAsset {
  url: string;
  sha256: string;
}

export type NetworkAccess = "none" | "localhost" | "internet";
export type FilesAccess = "none" | "read-only" | "writes";
export type SystemAccess = "none" | "runs-commands" | "kills-processes";

export type PermissionSentence =
  | "runs-locally"
  | "no-network"
  | "may-terminate-processes"
  | "reads-files-you-point-it-at"
  | "writes-files-you-point-it-at"
  | "reaches-out-to-the-internet";

export type Audience = "developer";

export interface CatalogPermissions {
  network: NetworkAccess;
  files: FilesAccess;
  system: SystemAccess;
  sentences: PermissionSentence[];
}

export interface CatalogTool {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  /** Same shape as Tool["parameters"] */
  params?: Parameter[];
  permissions: CatalogPermissions;
  /** One-line outcome ("Free up a stuck port"). Optional during migration. */
  outcome?: string;
  /** Audience tags. `[]` or absent means "everyone". */
  audience?: Audience[];
  /** Optional example invocations rendered as code snippets on the detail page. */
  examples?: string[];
  /** Curation flag for the Featured row. */
  featured?: boolean;
  /** ISO date (YYYY-MM-DD). Drives "New this week" eligibility. */
  addedAt?: string;
  /** "darwin-arm64" etc. Absent for shell tools. */
  platforms?: Record<string, PlatformAsset>;
  script?: string;
  minPierVersion?: string;
  deprecated?: boolean;
}

export interface Catalog {
  catalogSchemaVersion: 1;
  publishedAt: string;
  tools: CatalogTool[];
}
```

- [ ] **Step 5: Re-run the test**

Run: `npx vitest run src/domain/__tests__/library.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full typecheck — old call sites consuming `permissions.fsRead/fsWrite/network: boolean` will now break**

Run: `npm run build`
Expected: errors in `src/ui/molecules/AddToolDialog.tsx`, `src/ui/molecules/LibraryToolCard.tsx` (the latter only if it touches permissions), and possibly `src/ui/organisms/LibraryBrowser.tsx`. **Leave these errors** — those files are deleted in Phase 4. Make a note and continue. If errors leak into files we are NOT deleting, fix them now by reading the file and migrating to the new shape.

- [ ] **Step 7: Commit**

```bash
git add src/domain/library.ts src/domain/__tests__/library.test.ts
git commit -m "feat(library): extend CatalogTool with v0.3 fields (outcome, audience, hybrid permissions)"
```

---

### Task 2: Permission display lookup table

**Files:**
- Create: `src/ui/organisms/permissionLabels.ts`
- Create: `src/ui/organisms/__tests__/permissionLabels.test.ts`

- [ ] **Step 1: Write a failing test that asserts every enum value has a label**

Create `src/ui/organisms/__tests__/permissionLabels.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  NETWORK_LABELS, FILES_LABELS, SYSTEM_LABELS, SENTENCE_TEXT,
} from "../permissionLabels";
import type {
  NetworkAccess, FilesAccess, SystemAccess, PermissionSentence,
} from "../../../domain/library";

const allNetwork: NetworkAccess[] = ["none", "localhost", "internet"];
const allFiles: FilesAccess[] = ["none", "read-only", "writes"];
const allSystem: SystemAccess[] = ["none", "runs-commands", "kills-processes"];
const allSentences: PermissionSentence[] = [
  "runs-locally", "no-network", "may-terminate-processes",
  "reads-files-you-point-it-at", "writes-files-you-point-it-at",
  "reaches-out-to-the-internet",
];

describe("permissionLabels", () => {
  it("has a label for every NetworkAccess value", () => {
    for (const v of allNetwork) expect(NETWORK_LABELS[v]).toBeTruthy();
  });
  it("has a label for every FilesAccess value", () => {
    for (const v of allFiles) expect(FILES_LABELS[v]).toBeTruthy();
  });
  it("has a label for every SystemAccess value", () => {
    for (const v of allSystem) expect(SYSTEM_LABELS[v]).toBeTruthy();
  });
  it("has copy for every PermissionSentence", () => {
    for (const v of allSentences) expect(SENTENCE_TEXT[v]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/organisms/__tests__/permissionLabels.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the lookup table**

Create `src/ui/organisms/permissionLabels.ts`:

```typescript
import type {
  NetworkAccess, FilesAccess, SystemAccess, PermissionSentence,
} from "../../domain/library";

export const NETWORK_LABELS: Record<NetworkAccess, string> = {
  "none": "No network",
  "localhost": "Localhost only",
  "internet": "Internet",
};

export const FILES_LABELS: Record<FilesAccess, string> = {
  "none": "No file access",
  "read-only": "Reads files",
  "writes": "Writes files",
};

export const SYSTEM_LABELS: Record<SystemAccess, string> = {
  "none": "No system commands",
  "runs-commands": "Runs commands",
  "kills-processes": "Kills processes",
};

export const SENTENCE_TEXT: Record<PermissionSentence, string> = {
  "runs-locally": "Runs locally on your machine.",
  "no-network": "Does not access the network.",
  "may-terminate-processes": "May terminate processes you own.",
  "reads-files-you-point-it-at": "Reads files you point it at.",
  "writes-files-you-point-it-at": "Writes files you point it at.",
  "reaches-out-to-the-internet": "Reaches out to the internet.",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/organisms/__tests__/permissionLabels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/organisms/permissionLabels.ts src/ui/organisms/__tests__/permissionLabels.test.ts
git commit -m "feat(library): add permission display lookup table"
```

---

## Phase 1 — Sidebar selection model

### Task 3: Extend `Selection` to carry library subview

**Files:**
- Modify: `src/ui/organisms/Sidebar.tsx` (the `Selection` type only)
- Modify: `src/ui/pages/HomePage.tsx` (consumers — temporary stub branches)

- [ ] **Step 1: Read both files**

Run: `cat src/ui/organisms/Sidebar.tsx src/ui/pages/HomePage.tsx`

- [ ] **Step 2: Update `Selection` discriminated union**

In `src/ui/organisms/Sidebar.tsx`, replace the existing `Selection` definition with:

```typescript
export type LibrarySelection =
  | { kind: "library"; view: "landing" }
  | { kind: "library"; view: "all" }
  | { kind: "library"; view: "detail"; toolId: string };

export type Selection =
  | { kind: "all" }
  | { kind: "category"; name: string }
  | { kind: "tool"; id: string }
  | { kind: "help" }
  | LibrarySelection
  | { kind: "settings" };
```

The Sidebar itself only navigates to `{ kind: "library", view: "landing" }` when the user clicks the Library item — so update the click handler to match. Find any spot in the Sidebar component that emits `{ kind: "library" }` and replace with `{ kind: "library", view: "landing" }`.

- [ ] **Step 3: Update `HomePage` consumer to compile**

In `src/ui/pages/HomePage.tsx`, the existing branch is `} else if (selection.kind === "library") {`. Leave that comparison — it still narrows correctly because all three library variants share `kind: "library"`. The narrowed `selection` now has `.view` and possibly `.toolId`. For now, render a temporary placeholder so the file compiles:

```typescript
} else if (selection.kind === "library") {
  // Temporary — replaced in Task 10
  main = <LibraryBrowser />;
}
```

(`LibraryBrowser` still exists at this phase.)

- [ ] **Step 4: Run typecheck**

Run: `npm run build`
Expected: no new errors beyond the ones inherited from Task 1's deleted-files list.

- [ ] **Step 5: Run frontend tests**

Run: `npm run test:run`
Expected: all currently-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/organisms/Sidebar.tsx src/ui/pages/HomePage.tsx
git commit -m "refactor(library): extend Selection union with library subview"
```

---

## Phase 2 — UI primitives

### Task 4: `CatalogCard`

**Files:**
- Create: `src/ui/organisms/CatalogCard.tsx`
- Create: `src/ui/organisms/__tests__/CatalogCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/ui/organisms/__tests__/CatalogCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogCard } from "../CatalogCard";
import type { CatalogTool } from "../../../domain/library";

const baseTool: CatalogTool = {
  id: "kill-port",
  name: "Kill process on port",
  version: "1.0.0",
  description: "Free up a port held by a stuck process.",
  category: "system",
  outcome: "Free up a stuck port",
  audience: ["developer"],
  permissions: { network: "none", files: "none", system: "kills-processes", sentences: [] },
};

describe("CatalogCard", () => {
  it("renders name and outcome", () => {
    render(<CatalogCard tool={baseTool} installed={false} onSelect={() => {}} />);
    expect(screen.getByText("Kill process on port")).toBeInTheDocument();
    expect(screen.getByText("Free up a stuck port")).toBeInTheDocument();
  });

  it("falls back to description if outcome is missing", () => {
    const t = { ...baseTool, outcome: undefined };
    render(<CatalogCard tool={t} installed={false} onSelect={() => {}} />);
    expect(screen.getByText("Free up a port held by a stuck process.")).toBeInTheDocument();
  });

  it("hides audience tag when audience is empty", () => {
    const t = { ...baseTool, audience: [] };
    render(<CatalogCard tool={t} installed={false} onSelect={() => {}} />);
    expect(screen.queryByText(/developer/i)).not.toBeInTheDocument();
  });

  it("shows installed badge and adds aria-label when installed", () => {
    render(<CatalogCard tool={baseTool} installed={true} onSelect={() => {}} />);
    expect(screen.getByLabelText(/already added/i)).toBeInTheDocument();
  });

  it("calls onSelect with the tool when clicked", async () => {
    const onSelect = vi.fn();
    render(<CatalogCard tool={baseTool} installed={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(baseTool);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/organisms/__tests__/CatalogCard.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the card**

Create `src/ui/organisms/CatalogCard.tsx`:

```tsx
import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import type { CatalogTool } from "../../domain/library";

interface Props {
  tool: CatalogTool;
  installed: boolean;
  onSelect: (t: CatalogTool) => void;
  style?: CSSProperties;
}

export function CatalogCard({ tool, installed, onSelect, style }: Props) {
  const outcome = tool.outcome ?? tool.description;
  const audienceTag =
    tool.audience && tool.audience.length > 0 ? tool.audience[0] : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      style={style}
      className={`
        relative group text-left
        bg-surface border border-line rounded-2 px-4 py-3.5
        flex flex-col gap-1.5
        transition-[border-color,box-shadow,transform] duration-150 ease-(--ease-smooth)
        hover:border-line-hi hover:shadow-2
        focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]
        animate-tile-in
        ${installed ? "opacity-70" : ""}
      `}
    >
      {installed && (
        <span
          aria-label="Already added"
          className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white"
        >
          <Check size={12} aria-hidden />
        </span>
      )}
      <span className="font-display text-[17px] leading-tight text-ink truncate">
        {tool.name}
      </span>
      <p className="text-[13px] leading-snug text-ink-3 line-clamp-2">
        {outcome}
      </p>
      {audienceTag && (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-4">
          <span className="font-mono uppercase tracking-wider">{audienceTag}</span>
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run src/ui/organisms/__tests__/CatalogCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/organisms/CatalogCard.tsx src/ui/organisms/__tests__/CatalogCard.test.tsx
git commit -m "feat(library): CatalogCard with outcome, audience tag, and installed badge"
```

---

### Task 5: `PermissionPanel`

**Files:**
- Create: `src/ui/organisms/PermissionPanel.tsx`
- Create: `src/ui/organisms/__tests__/PermissionPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/ui/organisms/__tests__/PermissionPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionPanel } from "../PermissionPanel";

describe("PermissionPanel", () => {
  it("renders three axis chips", () => {
    render(
      <PermissionPanel
        permissions={{
          network: "none",
          files: "read-only",
          system: "runs-commands",
          sentences: [],
        }}
      />
    );
    expect(screen.getByText(/no network/i)).toBeInTheDocument();
    expect(screen.getByText(/reads files/i)).toBeInTheDocument();
    expect(screen.getByText(/runs commands/i)).toBeInTheDocument();
  });

  it("renders provided sentences", () => {
    render(
      <PermissionPanel
        permissions={{
          network: "none",
          files: "none",
          system: "kills-processes",
          sentences: ["runs-locally", "may-terminate-processes"],
        }}
      />
    );
    expect(screen.getByText("Runs locally on your machine.")).toBeInTheDocument();
    expect(screen.getByText("May terminate processes you own.")).toBeInTheDocument();
  });

  it("hides the sentence list when empty", () => {
    const { container } = render(
      <PermissionPanel
        permissions={{ network: "none", files: "none", system: "none", sentences: [] }}
      />
    );
    expect(container.querySelector("ul")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/organisms/__tests__/PermissionPanel.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the panel**

Create `src/ui/organisms/PermissionPanel.tsx`:

```tsx
import type { CatalogPermissions } from "../../domain/library";
import {
  NETWORK_LABELS, FILES_LABELS, SYSTEM_LABELS, SENTENCE_TEXT,
} from "./permissionLabels";

interface Props {
  permissions: CatalogPermissions;
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-bg-2 border border-line text-[12px] text-ink-2 font-mono">
      {label}
    </span>
  );
}

export function PermissionPanel({ permissions }: Props) {
  const { network, files, system, sentences } = permissions;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip label={NETWORK_LABELS[network]} />
        <Chip label={FILES_LABELS[files]} />
        <Chip label={SYSTEM_LABELS[system]} />
      </div>
      {sentences.length > 0 && (
        <ul className="list-disc pl-5 text-[13px] text-ink-2 leading-relaxed">
          {sentences.map((s) => (
            <li key={s}>{SENTENCE_TEXT[s]}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/organisms/__tests__/PermissionPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/organisms/PermissionPanel.tsx src/ui/organisms/__tests__/PermissionPanel.test.tsx
git commit -m "feat(library): PermissionPanel — three-axis chips + sentence list"
```

---

### Task 6: `CatalogRow`

**Files:**
- Create: `src/ui/organisms/CatalogRow.tsx`
- Create: `src/ui/organisms/__tests__/CatalogRow.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogRow } from "../CatalogRow";
import type { CatalogTool } from "../../../domain/library";

const tool = (id: string): CatalogTool => ({
  id, name: `Tool ${id}`, version: "1.0.0", description: "", category: "x",
  outcome: `Does ${id}`,
  permissions: { network: "none", files: "none", system: "none", sentences: [] },
});

describe("CatalogRow", () => {
  it("renders title and cards", () => {
    render(
      <CatalogRow
        title="Featured"
        tools={[tool("a"), tool("b")]}
        installedIds={new Set()}
        onSelectTool={() => {}}
      />
    );
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("Tool a")).toBeInTheDocument();
    expect(screen.getByText("Tool b")).toBeInTheDocument();
  });

  it("renders See all when onSeeAll is provided", async () => {
    const onSeeAll = vi.fn();
    render(
      <CatalogRow
        title="New"
        tools={[tool("a")]}
        installedIds={new Set()}
        onSelectTool={() => {}}
        onSeeAll={onSeeAll}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /see all/i }));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it("returns null when tools is empty", () => {
    const { container } = render(
      <CatalogRow title="Featured" tools={[]} installedIds={new Set()} onSelectTool={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/organisms/__tests__/CatalogRow.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import type { CatalogTool } from "../../domain/library";
import { CatalogCard } from "./CatalogCard";

interface Props {
  title: string;
  tools: CatalogTool[];
  installedIds: Set<string>;
  onSelectTool: (t: CatalogTool) => void;
  onSeeAll?: () => void;
}

export function CatalogRow({ title, tools, installedIds, onSelectTool, onSeeAll }: Props) {
  if (tools.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[13px] text-ink-3 hover:text-ink"
          >
            See all →
          </button>
        )}
      </header>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {tools.map((t) => (
          <div key={t.id} className="snap-start shrink-0 w-[280px]">
            <CatalogCard
              tool={t}
              installed={installedIds.has(t.id)}
              onSelect={onSelectTool}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/organisms/__tests__/CatalogRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/organisms/CatalogRow.tsx src/ui/organisms/__tests__/CatalogRow.test.tsx
git commit -m "feat(library): CatalogRow horizontal-scroll editorial strip"
```

---

## Phase 3 — Pages

### Task 7: `LibraryLandingPage`

**Files:**
- Create: `src/ui/pages/LibraryLandingPage.tsx`
- Create: `src/ui/pages/__tests__/LibraryLandingPage.test.tsx`

The landing page renders four rows: Featured, New this week, For developers, Popular. It receives the catalog and `installedIds` via props (the parent fetches), and emits navigation callbacks.

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryLandingPage } from "../LibraryLandingPage";
import type { CatalogTool } from "../../../domain/library";

function tool(id: string, overrides: Partial<CatalogTool> = {}): CatalogTool {
  return {
    id, name: `T-${id}`, version: "1.0.0", description: "", category: "x",
    outcome: `Does ${id}`,
    permissions: { network: "none", files: "none", system: "none", sentences: [] },
    ...overrides,
  };
}

describe("LibraryLandingPage", () => {
  const today = new Date("2026-04-29T00:00:00Z");

  it("renders Featured row when there are featured tools", () => {
    const tools = [tool("a", { featured: true }), tool("b")];
    render(
      <LibraryLandingPage
        tools={tools}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("T-a")).toBeInTheDocument();
  });

  it("renders New this week for tools with addedAt within 7 days", () => {
    const tools = [
      tool("recent", { addedAt: "2026-04-25" }),
      tool("old", { addedAt: "2026-01-01" }),
    ];
    render(
      <LibraryLandingPage
        tools={tools}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.getByText("New this week")).toBeInTheDocument();
    expect(screen.getByText("T-recent")).toBeInTheDocument();
    // The "old" tool only appears in Popular
  });

  it("renders For developers when audience includes developer", () => {
    const tools = [tool("dev", { audience: ["developer"] })];
    render(
      <LibraryLandingPage
        tools={tools}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.getByText("For developers")).toBeInTheDocument();
  });

  it("hides empty rows", () => {
    render(
      <LibraryLandingPage
        tools={[]}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={() => {}}
      />
    );
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    expect(screen.queryByText("Popular")).not.toBeInTheDocument();
  });

  it("invokes onSeeAll when See all is clicked", async () => {
    const onSeeAll = vi.fn();
    render(
      <LibraryLandingPage
        tools={[tool("a"), tool("b"), tool("c")]}
        installedIds={new Set()}
        now={today}
        onSelectTool={() => {}}
        onSeeAll={onSeeAll}
      />
    );
    await userEvent.click(screen.getAllByRole("button", { name: /see all/i })[0]);
    expect(onSeeAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/pages/__tests__/LibraryLandingPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the page**

```tsx
import { useMemo } from "react";
import type { CatalogTool } from "../../domain/library";
import { CatalogRow } from "../organisms/CatalogRow";

interface Props {
  tools: CatalogTool[];
  installedIds: Set<string>;
  /** Injected for tests — defaults to new Date() */
  now?: Date;
  onSelectTool: (t: CatalogTool) => void;
  onSeeAll: () => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isWithinDays(addedAt: string | undefined, now: Date, days: number): boolean {
  if (!addedAt) return false;
  const t = Date.parse(addedAt);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= days * MS_PER_DAY;
}

export function LibraryLandingPage({ tools, installedIds, now, onSelectTool, onSeeAll }: Props) {
  const reference = now ?? new Date();

  const featured = useMemo(() => tools.filter((t) => t.featured), [tools]);
  const fresh = useMemo(
    () => tools.filter((t) => isWithinDays(t.addedAt, reference, 7)),
    [tools, reference],
  );
  const developer = useMemo(
    () => tools.filter((t) => t.audience?.includes("developer")),
    [tools],
  );
  const popular = useMemo(() => tools, [tools]); // catalog order placeholder

  return (
    <div className="flex flex-col gap-8 px-8 py-6">
      <header>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
          Library
        </div>
        <h1 className="font-display text-3xl leading-tight text-ink">Browse tools</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          Curated, signed tools from the <span className="font-mono">pier-tools</span> catalog.
        </p>
      </header>

      <CatalogRow
        title="Featured"
        tools={featured}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
      <CatalogRow
        title="New this week"
        tools={fresh}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
      <CatalogRow
        title="For developers"
        tools={developer}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
      <CatalogRow
        title="Popular"
        tools={popular}
        installedIds={installedIds}
        onSelectTool={onSelectTool}
        onSeeAll={onSeeAll}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/pages/__tests__/LibraryLandingPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/LibraryLandingPage.tsx src/ui/pages/__tests__/LibraryLandingPage.test.tsx
git commit -m "feat(library): curated landing page with editorial rows"
```

---

### Task 8: `LibraryAllPage`

**Files:**
- Create: `src/ui/pages/LibraryAllPage.tsx`
- Create: `src/ui/pages/__tests__/LibraryAllPage.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryAllPage } from "../LibraryAllPage";
import type { CatalogTool } from "../../../domain/library";

function tool(id: string, category: string, name = `T-${id}`): CatalogTool {
  return {
    id, name, version: "1.0.0", description: `desc ${id}`, category,
    outcome: `outcome ${id}`,
    permissions: { network: "none", files: "none", system: "none", sentences: [] },
  };
}

describe("LibraryAllPage", () => {
  const tools = [tool("a", "system"), tool("b", "system"), tool("c", "general")];

  it("renders all tools by default", () => {
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={() => {}} />);
    expect(screen.getByText("T-a")).toBeInTheDocument();
    expect(screen.getByText("T-c")).toBeInTheDocument();
  });

  it("filters by search query against name and outcome", async () => {
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), "outcome a");
    expect(screen.getByText("T-a")).toBeInTheDocument();
    expect(screen.queryByText("T-b")).not.toBeInTheDocument();
  });

  it("filters by category chip", async () => {
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "general" }));
    expect(screen.queryByText("T-a")).not.toBeInTheDocument();
    expect(screen.getByText("T-c")).toBeInTheDocument();
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    render(<LibraryAllPage tools={tools} installedIds={new Set()} onSelectTool={() => {}} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/pages/__tests__/LibraryAllPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import { useMemo, useState } from "react";
import type { CatalogTool } from "../../domain/library";
import { CatalogCard } from "../organisms/CatalogCard";
import { TextField } from "../atoms/TextField";

interface Props {
  tools: CatalogTool[];
  installedIds: Set<string>;
  onSelectTool: (t: CatalogTool) => void;
  onBack: () => void;
}

const ALL = "__all__";

export function LibraryAllPage({ tools, installedIds, onSelectTool, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tools) set.add(t.category);
    return [...set].sort();
  }, [tools]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((t) => {
      if (category !== ALL && t.category !== category) return false;
      if (q === "") return true;
      const hay = [
        t.name.toLowerCase(),
        (t.outcome ?? "").toLowerCase(),
        t.description.toLowerCase(),
        t.category.toLowerCase(),
      ];
      return hay.some((s) => s.includes(q));
    });
  }, [tools, query, category]);

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-ink-3 hover:text-ink"
        >
          ← Back
        </button>
        <h1 className="font-display text-2xl text-ink">All tools</h1>
      </header>

      <TextField
        variant="compact"
        placeholder="Search the library…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          active={category === ALL}
          onClick={() => setCategory(ALL)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c}
            label={c}
            active={category === c}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="font-display italic text-ink-3">No tools match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((t, i) => (
            <CatalogCard
              key={t.id}
              tool={t}
              installed={installedIds.has(t.id)}
              onSelect={onSelectTool}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-1 rounded-full text-[12px] font-mono border
        ${active
          ? "bg-accent text-white border-accent"
          : "bg-bg-2 text-ink-2 border-line hover:border-line-hi"}
      `}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/pages/__tests__/LibraryAllPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/LibraryAllPage.tsx src/ui/pages/__tests__/LibraryAllPage.test.tsx
git commit -m "feat(library): All tools page with search + category chips"
```

---

### Task 9: `LibraryToolDetailPage`

**Files:**
- Create: `src/ui/pages/LibraryToolDetailPage.tsx`
- Create: `src/ui/pages/__tests__/LibraryToolDetailPage.test.tsx`

The detail page is presentation-only. It receives the tool, an `installed` flag, the JSON preview text (for the Advanced disclosure), and three callbacks: `onAdd`, `onRemove`, `onBack`. The parent owns the `installAndPreview` / `commit` / `commitRemove` orchestration so the page stays free of port wiring.

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryToolDetailPage } from "../LibraryToolDetailPage";
import type { CatalogTool } from "../../../domain/library";

const tool: CatalogTool = {
  id: "kill-port",
  name: "Kill process on port",
  version: "1.0.0",
  description: "Free up a port held by a stuck process.",
  category: "system",
  outcome: "Free up a stuck port",
  audience: ["developer"],
  examples: ["pier kill-port 3000"],
  permissions: {
    network: "none",
    files: "none",
    system: "kills-processes",
    sentences: ["runs-locally", "may-terminate-processes"],
  },
};

describe("LibraryToolDetailPage", () => {
  it("renders hero, permissions, and examples", () => {
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        previewJson={"{ \"id\": \"kill-port\" }"}
        busy={false}
        onAdd={() => {}}
        onRemove={() => {}}
        onBack={() => {}}
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: tool.name })).toBeInTheDocument();
    expect(screen.getByText("Free up a stuck port")).toBeInTheDocument();
    expect(screen.getByText("Runs locally on your machine.")).toBeInTheDocument();
    expect(screen.getByText("pier kill-port 3000")).toBeInTheDocument();
  });

  it("shows Add button when not installed and calls onAdd", async () => {
    const onAdd = vi.fn();
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        previewJson="{}"
        busy={false}
        onAdd={onAdd}
        onRemove={() => {}}
        onBack={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /add to my tools/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("shows Added (disabled) and a Remove link when installed", async () => {
    const onRemove = vi.fn();
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={true}
        previewJson="{}"
        busy={false}
        onAdd={() => {}}
        onRemove={onRemove}
        onBack={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /added/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("Advanced disclosure is collapsed by default", () => {
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        previewJson={'{"id":"kill-port"}'}
        busy={false}
        onAdd={() => {}}
        onRemove={() => {}}
        onBack={() => {}}
      />
    );
    const details = screen.getByText(/advanced/i).closest("details");
    expect(details).not.toBeNull();
    expect((details as HTMLDetailsElement).open).toBe(false);
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    render(
      <LibraryToolDetailPage
        tool={tool}
        installed={false}
        previewJson="{}"
        busy={false}
        onAdd={() => {}}
        onRemove={() => {}}
        onBack={onBack}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/pages/__tests__/LibraryToolDetailPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import type { CatalogTool } from "../../domain/library";
import { Button } from "../atoms/Button";
import { PermissionPanel } from "../organisms/PermissionPanel";

interface Props {
  tool: CatalogTool;
  installed: boolean;
  previewJson: string;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onBack: () => void;
}

export function LibraryToolDetailPage({
  tool, installed, previewJson, busy, onAdd, onRemove, onBack,
}: Props) {
  const outcome = tool.outcome ?? tool.description;
  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[13px] text-ink-3 hover:text-ink"
      >
        ← Library
      </button>

      <header className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
            Library · Tool
          </div>
          <h1 className="font-display text-3xl leading-tight text-ink">{tool.name}</h1>
          <p className="text-[15px] text-ink-2">{outcome}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {installed ? (
            <>
              <Button variant="primary" disabled aria-label="Added">
                Added ✓
              </Button>
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="text-[12px] text-ink-3 hover:text-danger underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </>
          ) : (
            <Button variant="primary" onClick={onAdd} disabled={busy}>
              {busy ? "Adding…" : "Add to my tools"}
            </Button>
          )}
        </div>
      </header>

      <PermissionPanel permissions={tool.permissions} />

      {(tool.description || (tool.examples && tool.examples.length > 0)) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-ink">What it does</h2>
          {tool.description && (
            <p className="text-[14px] text-ink-2 leading-relaxed">{tool.description}</p>
          )}
          {tool.examples && tool.examples.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {tool.examples.map((ex) => (
                <pre
                  key={ex}
                  className="font-mono text-[12px] bg-bg-2 border border-line rounded-2 px-3 py-2 text-ink-2"
                >
                  {ex}
                </pre>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="flex items-center gap-2 text-[11px] text-ink-4 font-mono uppercase tracking-wider">
        <span>From pier-tools</span>
        <span aria-hidden>·</span>
        <span>Verified</span>
      </footer>

      <details className="border border-line rounded-2">
        <summary className="px-4 py-2 cursor-pointer text-[12px] text-ink-3 font-mono uppercase tracking-wider">
          Advanced — tools.json preview
        </summary>
        <pre className="px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-2 whitespace-pre overflow-auto bg-bg-2/50">
          {previewJson}
        </pre>
      </details>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/pages/__tests__/LibraryToolDetailPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/LibraryToolDetailPage.tsx src/ui/pages/__tests__/LibraryToolDetailPage.test.tsx
git commit -m "feat(library): tool detail page with hero, permissions, examples, advanced disclosure"
```

---

## Phase 4 — Backend Remove command + client wiring

### Task 10: Add `library_commit_remove` Tauri command

**Files:**
- Modify: the Rust file that contains `library_commit_add` use case (likely `src-tauri/src/application/library.rs` — discover at task time with `rg "library_commit_add" src-tauri/src`).
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Locate the existing add-commit use case**

Run: `rg -n "library_commit_add" src-tauri/src`
Expected: at least two hits — the use-case definition and the command shim. Read both files end-to-end.

- [ ] **Step 2: Write a Rust unit test that exercises the new use case**

In whichever module hosts the `library_commit_add` test (or co-located), add a test for `library_commit_remove(tool_id)`. The function should:
- read `~/.pier/tools.json`,
- parse it as the existing `ToolsConfig`,
- remove the entry whose `id` matches `tool_id`,
- write back atomically via the same path the add path uses,
- error if the id was not present.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commit_remove_strips_matching_tool() {
        let before = r#"{"schemaVersion":"1.0","tools":[
          {"id":"a","name":"A","command":"/bin/true"},
          {"id":"b","name":"B","command":"/bin/true"}
        ]}"#;
        let after = remove_tool_from_config_str(before, "a").unwrap();
        assert!(!after.contains("\"id\":\"a\""));
        assert!(after.contains("\"id\":\"b\""));
    }

    #[test]
    fn commit_remove_errors_when_id_missing() {
        let before = r#"{"schemaVersion":"1.0","tools":[]}"#;
        let err = remove_tool_from_config_str(before, "missing").unwrap_err();
        assert!(err.to_string().to_lowercase().contains("not found"));
    }
}
```

The test uses a pure helper `remove_tool_from_config_str(json: &str, id: &str) -> Result<String, ...>`; the `library_commit_remove` use case wraps it with file I/O.

- [ ] **Step 3: Run the failing tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml library_commit_remove`
Expected: FAIL — symbols don't exist.

- [ ] **Step 4: Implement the helper + use case**

In the same Rust module:

```rust
use serde_json::Value;

/// Pure: remove the tool with the given id from a tools.json string.
/// Returns the new JSON string, or an error if the id was not present.
pub fn remove_tool_from_config_str(json: &str, id: &str) -> Result<String, String> {
    let mut v: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let tools = v.get_mut("tools")
        .and_then(|t| t.as_array_mut())
        .ok_or_else(|| "tools.json is missing the `tools` array".to_string())?;
    let before_len = tools.len();
    tools.retain(|t| t.get("id").and_then(|x| x.as_str()) != Some(id));
    if tools.len() == before_len {
        return Err(format!("tool `{id}` not found"));
    }
    serde_json::to_string_pretty(&v).map_err(|e| e.to_string())
}

/// Use case: read tools.json, remove `tool_id`, write back atomically.
pub async fn library_commit_remove(tool_id: String) -> Result<(), String> {
    let path = crate::application::path_resolver::tools_json_path()
        .map_err(|e| e.to_string())?;
    let original = tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    let next = remove_tool_from_config_str(&original, &tool_id)?;
    crate::infrastructure::atomic_write(&path, next.as_bytes())
        .await
        .map_err(|e| e.to_string())
}
```

(Path-resolver and atomic-write helpers may have different names — the discovery in Step 1 told you what to call. Match the patterns of `library_commit_add`.)

- [ ] **Step 5: Add the command shim and register it**

In `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub async fn library_commit_remove(tool_id: String) -> Result<(), String> {
    crate::application::library::library_commit_remove(tool_id).await
}
```

In `src-tauri/src/lib.rs`, add `commands::library_commit_remove` to the `invoke_handler!` list next to `library_commit_add`.

- [ ] **Step 6: Run cargo tests + clippy**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri
git commit -m "feat(library): library_commit_remove Tauri command"
```

---

### Task 11: Extend `LibraryClient` port and Tauri adapter

**Files:**
- Modify: `src/application/ports.ts`
- Modify: `src/infrastructure/tauriLibraryClient.ts`

- [ ] **Step 1: Update the port interface**

In `src/application/ports.ts`, replace the `LibraryClient` interface:

```typescript
export interface LibraryClient {
  fetchCatalog(): Promise<Catalog>;
  installAndPreview(tool: CatalogTool): Promise<LibraryAddPreview>;
  commitAdd(after: string): Promise<void>;
  /** Remove the tool with the given id from tools.json. Errors if not present. */
  commitRemove(toolId: string): Promise<void>;
}
```

- [ ] **Step 2: Update the Tauri adapter**

In `src/infrastructure/tauriLibraryClient.ts`:

```typescript
export const tauriLibraryClient: LibraryClient = {
  fetchCatalog: () => invoke<Catalog>("library_fetch_catalog"),
  async installAndPreview(tool: CatalogTool): Promise<LibraryAddPreview> {
    const r = await invoke<RustPreview>("library_install_and_preview", { tool });
    return { before: r.before, after: r.after, newTool: r.new_tool };
  },
  commitAdd: (after: string) => invoke<void>("library_commit_add", { after }),
  commitRemove: (toolId: string) => invoke<void>("library_commit_remove", { toolId }),
};
```

- [ ] **Step 3: Update test fakes**

Run: `rg -n "fetchCatalog\b" src --type ts --type tsx`
Expected: hits in any test file that fakes `LibraryClient`. Add a `commitRemove: vi.fn().mockResolvedValue(undefined)` (or equivalent) to each fake so the type still satisfies the port.

- [ ] **Step 4: Run tests + typecheck**

```bash
npm run test:run
npm run build
```

Expected: pass (modulo the deleted-files inheritance from Task 1, which we resolve in the next task).

- [ ] **Step 5: Commit**

```bash
git add src/application/ports.ts src/infrastructure/tauriLibraryClient.ts
git commit -m "feat(library): commitRemove on LibraryClient port"
```

---

### Task 12: `useRemoveTool` hook

**Files:**
- Modify: `src/application/useLibrary.ts`
- Create/Modify: tests

- [ ] **Step 1: Write the hook test**

Add to `src/application/__tests__/useLibrary.test.tsx`:

```tsx
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useRemoveTool } from "../useLibrary";
import { LibraryProvider } from "../../state/LibraryContext";
import type { ReactNode } from "react";
import type { LibraryClient } from "../ports";

function wrapWith(client: LibraryClient) {
  return ({ children }: { children: ReactNode }) => (
    <LibraryProvider client={client}>{children}</LibraryProvider>
  );
}

describe("useRemoveTool", () => {
  it("calls client.commitRemove with the tool id", async () => {
    const client: LibraryClient = {
      fetchCatalog: vi.fn(),
      installAndPreview: vi.fn(),
      commitAdd: vi.fn(),
      commitRemove: vi.fn().mockResolvedValue(undefined),
    } as unknown as LibraryClient;
    const { result } = renderHook(() => useRemoveTool(), { wrapper: wrapWith(client) });
    await act(async () => { await result.current.remove("kill-port"); });
    expect(client.commitRemove).toHaveBeenCalledWith("kill-port");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/application/__tests__/useLibrary.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

In `src/application/useLibrary.ts`, append:

```typescript
export function useRemoveTool() {
  const client = useLibraryClient();
  const [busy, setBusy] = useState(false);

  const remove = useCallback(async (toolId: string) => {
    setBusy(true);
    try {
      await client.commitRemove(toolId);
    } finally {
      setBusy(false);
    }
  }, [client]);

  return { busy, remove };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/application/__tests__/useLibrary.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/useLibrary.ts src/application/__tests__/useLibrary.test.tsx
git commit -m "feat(library): useRemoveTool hook"
```

---

## Phase 5 — Wire pages into HomePage and remove the old surface

### Task 13: Wire library subviews into `HomePage`

**Files:**
- Modify: `src/ui/pages/HomePage.tsx`

- [ ] **Step 1: Read the current `HomePage` Library branch**

Run: `cat src/ui/pages/HomePage.tsx`

- [ ] **Step 2: Replace the Library branch with subview routing**

Replace the entire `} else if (selection.kind === "library") {` block. The new code:
1. Loads the catalog via `useCatalog()`.
2. Computes `installedIds` from `state.tools`.
3. Switches on `selection.view` to render landing / all / detail.
4. On detail view, calls `installAndPreview` to get the preview JSON, and provides `onAdd`, `onRemove`.

Imports at the top of the file (replace the `LibraryBrowser` import):

```typescript
import { LibraryLandingPage } from "./LibraryLandingPage";
import { LibraryAllPage } from "./LibraryAllPage";
import { LibraryToolDetailPage } from "./LibraryToolDetailPage";
import { useCatalog, useAddTool, useRemoveTool } from "../../application/useLibrary";
import type { CatalogTool } from "../../domain/library";
import { useEffect, useState } from "react";  // useState already imported — merge
```

In the component body, before the `let main;` block, add the library data hooks:

```typescript
const { catalog } = useCatalog();
const { previewAdd, commit: commitAdd, busy: addBusy } = useAddTool();
const { remove: commitRemove, busy: removeBusy } = useRemoveTool();
const installedIds = useMemo(() => new Set(state.tools.map(t => t.id)), [state.tools]);

const [detailPreview, setDetailPreview] = useState<{ toolId: string; previewJson: string } | null>(null);

useEffect(() => {
  if (selection.kind !== "library" || selection.view !== "detail") {
    setDetailPreview(null);
    return;
  }
  const id = selection.toolId;
  if (detailPreview?.toolId === id) return;
  const tool = catalog?.tools.find(t => t.id === id);
  if (!tool) return;
  let cancelled = false;
  previewAdd(tool).then(p => {
    if (!cancelled) setDetailPreview({ toolId: id, previewJson: p.after });
  }).catch(() => {
    if (!cancelled) setDetailPreview({ toolId: id, previewJson: "" });
  });
  return () => { cancelled = true; };
}, [selection, catalog, previewAdd, detailPreview]);
```

(If `useMemo` isn't already imported, add it.)

Then replace the library branch:

```typescript
} else if (selection.kind === "library") {
  const tools = catalog?.tools ?? [];
  if (selection.view === "landing") {
    main = (
      <LibraryLandingPage
        tools={tools}
        installedIds={installedIds}
        onSelectTool={(t: CatalogTool) =>
          setSelection({ kind: "library", view: "detail", toolId: t.id })
        }
        onSeeAll={() => setSelection({ kind: "library", view: "all" })}
      />
    );
  } else if (selection.view === "all") {
    main = (
      <LibraryAllPage
        tools={tools}
        installedIds={installedIds}
        onSelectTool={(t: CatalogTool) =>
          setSelection({ kind: "library", view: "detail", toolId: t.id })
        }
        onBack={() => setSelection({ kind: "library", view: "landing" })}
      />
    );
  } else {
    const tool = tools.find(t => t.id === selection.toolId);
    if (!tool) {
      main = (
        <div className="px-8 py-6 text-ink-3">
          That tool isn't in the catalog anymore.
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setSelection({ kind: "library", view: "landing" })}
          >
            Back to Library
          </button>
        </div>
      );
    } else {
      main = (
        <LibraryToolDetailPage
          tool={tool}
          installed={installedIds.has(tool.id)}
          previewJson={detailPreview?.previewJson ?? ""}
          busy={addBusy || removeBusy}
          onAdd={async () => {
            const preview = await previewAdd(tool);
            await commitAdd(preview.after);
            await reload();
          }}
          onRemove={async () => {
            await commitRemove(tool.id);
            await reload();
          }}
          onBack={() => setSelection({ kind: "library", view: "landing" })}
        />
      );
    }
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run build`
Expected: errors only in the to-be-deleted files (`LibraryBrowser`, `AddToolDialog`, `LibraryToolCard`). Tasks 14–15 remove them.

- [ ] **Step 4: Run frontend tests**

Run: `npm run test:run`
Expected: all currently-passing tests still pass; old `LibraryBrowser`/`AddToolDialog`/`LibraryToolCard` tests still pass for now (deleted in Task 14).

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/HomePage.tsx
git commit -m "feat(library): wire landing/all/detail pages into HomePage"
```

---

### Task 14: Delete the old Library surface

**Files:**
- Delete: `src/ui/molecules/AddToolDialog.tsx`
- Delete: `src/ui/molecules/__tests__/AddToolDialog.test.tsx`
- Delete: `src/ui/molecules/LibraryToolCard.tsx`
- Delete: `src/ui/molecules/__tests__/LibraryToolCard.test.tsx`
- Delete: `src/ui/organisms/LibraryBrowser.tsx`
- Delete: `src/ui/organisms/__tests__/LibraryBrowser.test.tsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `rg -n "LibraryBrowser|AddToolDialog|LibraryToolCard" src`
Expected: only the files about to be deleted (and their own tests).

- [ ] **Step 2: Delete the files**

```bash
git rm src/ui/molecules/AddToolDialog.tsx \
       src/ui/molecules/__tests__/AddToolDialog.test.tsx \
       src/ui/molecules/LibraryToolCard.tsx \
       src/ui/molecules/__tests__/LibraryToolCard.test.tsx \
       src/ui/organisms/LibraryBrowser.tsx \
       src/ui/organisms/__tests__/LibraryBrowser.test.tsx
```

- [ ] **Step 3: Typecheck and run tests**

```bash
npm run build
npm run test:run
```

Expected: clean build, all tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(library): remove old LibraryBrowser, AddToolDialog, LibraryToolCard"
```

---

### Task 15: Audit `PermissionPill` and the legacy permissions shape

**Files:**
- Audit: `src/ui/atoms/PermissionPill.tsx` and its test

- [ ] **Step 1: Search for remaining users**

Run: `rg -n "PermissionPill" src`
Expected: only the atom file and its test (the only consumer was `AddToolDialog`, now deleted).

- [ ] **Step 2: Decide and act**

If no other consumer exists, delete `PermissionPill.tsx` and its test:

```bash
git rm src/ui/atoms/PermissionPill.tsx src/ui/atoms/__tests__/PermissionPill.test.tsx
```

If other consumers exist, leave it.

- [ ] **Step 3: Typecheck and run tests**

```bash
npm run build
npm run test:run
```

Expected: clean.

- [ ] **Step 4: Commit (only if files were deleted)**

```bash
git commit -m "refactor(library): remove unused PermissionPill atom"
```

---

## Phase 6 — Manual verification

### Task 16: Smoke-test the full flow

This task is hands-on. The agent runs the dev app and walks the user-visible flow.

- [ ] **Step 1: Start the dev app**

```bash
npm run tauri:dev
```

- [ ] **Step 2: Walk the flow**

Verify in order:
1. Sidebar → click Library → lands on **`/library` landing**. If the catalog has no `featured`, no `addedAt`, no `audience` entries yet, only **Popular** shows. Confirm.
2. Click a card → detail page renders with hero, permission chips, sentence list (or just chips if catalog has no sentences), and the **Advanced** disclosure stays collapsed.
3. Click **Add to my tools** → button shows "Adding…" → returns to detail page in installed state (Added ✓ + Remove link). Sidebar's "All tools" count increases by 1.
4. Click **Remove** → reverts to "Add to my tools". Sidebar count decreases.
5. Click "See all" on a row → lands on the All page; search and category chips work; Back returns to landing.
6. Visiting an unknown tool id (manually set selection) shows the "isn't in the catalog anymore" fallback.

- [ ] **Step 3: Stop the dev app and report**

Document any drift between observed behavior and the spec. If the catalog (`pier-tools`) has not been updated yet, note which rows are empty due to missing fields — that's expected and not a bug.

- [ ] **Step 4: No commit unless an issue was fixed in this task.**

---

## Self-Review Notes

- **Spec coverage:**
  - IA (`/library`, `/library/all`, `/library/<tool-id>`): Tasks 3, 13.
  - Curated rows (Featured/New/For developers/Popular): Task 7.
  - Card shape (C1): Task 4.
  - Detail page (D1) with hero, permissions, examples, advanced disclosure: Task 9.
  - Hybrid permissions (P3): Tasks 2, 5.
  - Installed state (I1) + Remove: Tasks 4, 9, 10, 11, 12, 13.
  - Schema additions (CatalogTool): Task 1. Permission allowlist enums: Tasks 1, 2.
  - Catalog loader tolerates missing optional fields: covered by optional types in Task 1 (no runtime parsing changes needed because the existing fetch returns whatever the catalog ships).
  - Old AddToolDialog/JSON-modal removed: Task 14.
- **Placeholder scan:** No "TBD"/"add appropriate handling"/"similar to" placeholders.
- **Type consistency:** `installedIds: Set<string>` used identically across landing/all/detail. `previewJson: string` used identically. `commitRemove(toolId: string)` matches across port, hook, command shim.
- **Out of scope held:** No ratings, no telemetry, no third-party catalogs, no in-app upgrade flow. The "Popular" row uses catalog order and the spec acknowledges the data source is the open question.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-29-library-app-store-redesign.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
