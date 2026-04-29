# Pier Library Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Library" sheet behind a `+` tile that lets users one-click add curated tools (signed Go binaries + pure-shell scripts) from a remote catalog, with SHA-256-verified downloads and per-add permission consent.

**Architecture:** Catalog manifest is a flat JSON (Aqua-shaped per-tool entries) hosted on Cloudflare R2 + custom-domain Worker, signed with the existing Tauri minisign key. Binaries live in `pier-tools` GitHub Release assets. Frontend follows the existing port/adapter split (`application/ports.ts` → `infrastructure/tauri*.ts`); UI follows atomic design (atoms → molecules → organisms → templates → pages). Backend follows the same `domain → application → infrastructure → commands` layering already in `src-tauri/`. Downloads + verification + filesystem placement happen Rust-side; the React layer only consumes a `LibraryClient` port.

**Tech Stack:** Tauri 2, Rust (existing — `reqwest` for HTTP, `sha2` for hashing, `minisign-verify` for manifest signature), React 19 + TypeScript + Tailwind v4, Vitest for FE tests, `cargo test` for Rust.

**Scope guardrails (per user instruction — mid-size project, no over-engineering):**
- No new global state stores. Reuse `AppContext` + Context+`useReducer` shape.
- No Library/Catalog domain split into a separate workspace crate. New module under existing `src-tauri/src/{domain,application,infrastructure}/`.
- No "store" theater (ratings, install counts, trending). Plain list with categories + featured row.
- v0 sandbox enforcement is *not* in scope; permission *consent UI* is.
- LLM tools are not in v0.2 — no UI work for "needs API key" gates here.

---

## File Structure

### New Rust files (`src-tauri/src/`)

| Path | Responsibility |
|---|---|
| `domain/library.rs` | `CatalogTool`, `Catalog`, `Platform`, `PlatformAsset`, `Tier`, `LibraryError` types. Pure serde structs. |
| `application/library/fetch.rs` | Fetch + ETag-cache catalog from remote URL. Verify minisign signature. Returns `Catalog`. |
| `application/library/install.rs` | Resolve current platform (`darwin-arm64`/`darwin-amd64`), download asset, verify SHA-256, place at `~/.pier/tools/<id>/<v>/<bin>`, chmod +x. Return absolute path. |
| `application/library/add_to_config.rs` | Append a `Tool` entry to `tools.json` with `source: { catalog, version, sha256 }` provenance. Atomic tmp+rename. Diff preview helper. |
| `application/library/cache.rs` | `~/.pier/cache/catalog.json` ETag store (read/write last ETag + body). |
| `application/library/mod.rs` | Re-exports. |
| `infrastructure/library_http.rs` | `reqwest` client wrapping ETag headers + minisign verify. Thin. |

### New frontend files (`src/`)

| Path | Responsibility |
|---|---|
| `domain/library.ts` | TS mirror of `CatalogTool`, `Catalog`, `Tier`, `Platform`. |
| `application/ports.ts` | **Modify** — add `LibraryClient` port. |
| `application/useLibrary.ts` | Hook. Fetches catalog, exposes `{ status, tools, refresh, add(tool) }`. |
| `infrastructure/tauriLibraryClient.ts` | Adapter implementing `LibraryClient` against new `library_*` Tauri commands. |
| `state/LibraryContext.tsx` | DI for `LibraryClient` (parallel to `RunnerContext`). |
| `ui/atoms/PermissionPill.tsx` | One-line permission pill (e.g. "Internet", "Reads ~/Documents"). |
| `ui/molecules/LibraryToolCard.tsx` | Catalog tool tile (name, description, tier badge, category). |
| `ui/molecules/AddToolDialog.tsx` | Diff preview + permissions consent + Add button. Uses `useDialogA11y`. |
| `ui/organisms/LibraryBrowser.tsx` | Search + featured row + category groupings + tier toggle. |
| `ui/organisms/AddTile.tsx` | The `+` tile that lives at the end of the existing grid; opens the Library sheet. |
| `ui/templates/LibrarySheet.tsx` | Sheet shell (slide-up, ESC dismiss, focus trap). |

### Modified files

| Path | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `sha2`, `minisign-verify` (no extra reqwest features — already present). |
| `src-tauri/src/commands.rs` | Add `library_fetch_catalog`, `library_install_tool`, `library_preview_add`. |
| `src-tauri/src/lib.rs:84-101` | Register new handlers in `invoke_handler!`. |
| `src-tauri/src/domain/mod.rs` | `pub mod library;` |
| `src-tauri/src/application/mod.rs` | `pub mod library;` |
| `src-tauri/src/infrastructure/mod.rs` | `pub mod library_http;` |
| `src/domain/tool.ts` | Add optional `source?: { catalog: string; version: string; sha256: string }` to `Tool`. |
| `src/state/reducer.ts` + `actions.ts` | Add `LIBRARY_SHEET_OPEN` / `_CLOSE` action + `librarySheetOpen: boolean` state. |
| `src/ui/organisms/ToolBrowser.tsx` | Append `<AddTile />` at end of the grid. |
| `src/App.tsx` | Wrap in `<LibraryProvider>`; render `<LibrarySheet />` when `librarySheetOpen`. |

### Deferred (NOT in this plan)

- Sandbox enforcement (`sandbox-exec` profile generation) — v0.4 per ADR.
- Update-available badge / tool update flow — v0.3.
- Tier toggle persistence in settings — v0.3 alongside LLM keys.
- Sigstore/cosign — minisign is enough for v0.

---

## Manifest Shape (frozen — referenced by all tasks)

```typescript
// src/domain/library.ts
export type Tier = "beginner" | "advanced";

export interface PlatformAsset {
  url: string;
  sha256: string;
}

export interface CatalogTool {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tier: Tier;
  /** Same shape as Tool["parameters"] */
  params?: import("./tool").Parameter[];
  permissions: {
    network: boolean;
    fsRead: string[];
    fsWrite: string[];
  };
  /** Map keyed by `<os>-<arch>`, e.g. "darwin-arm64". Absent for shell tools. */
  platforms?: Record<string, PlatformAsset>;
  /** For pure-shell tools — inline script content. */
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

Mirrored exactly in Rust at `src-tauri/src/domain/library.rs`.

---

## Task 1: Domain types (Rust + TS)

**Files:**
- Create: `src-tauri/src/domain/library.rs`
- Modify: `src-tauri/src/domain/mod.rs`
- Create: `src/domain/library.ts`
- Test: `src-tauri/src/domain/library.rs` (inline `#[cfg(test)]`), `src/domain/__tests__/library.test.ts`

- [ ] **Step 1: Write the failing Rust test**

```rust
// inside src-tauri/src/domain/library.rs
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_minimal_catalog() {
        let json = r#"{
            "catalogSchemaVersion": 1,
            "publishedAt": "2026-05-15T00:00:00Z",
            "tools": [{
                "id": "kill-port", "name": "Kill port", "version": "1.0.0",
                "description": "Free a port.", "category": "dev",
                "tier": "beginner",
                "permissions": { "network": false, "fsRead": [], "fsWrite": [] },
                "script": "#!/bin/sh\nlsof -ti:$1 | xargs kill -9\n"
            }]
        }"#;
        let cat: Catalog = serde_json::from_str(json).unwrap();
        assert_eq!(cat.tools.len(), 1);
        assert_eq!(cat.tools[0].id, "kill-port");
        assert!(cat.tools[0].script.is_some());
    }

    #[test]
    fn rejects_unknown_schema_version() {
        let json = r#"{"catalogSchemaVersion": 99, "publishedAt": "x", "tools": []}"#;
        let res: Result<Catalog, _> = serde_json::from_str(json);
        assert!(res.is_err(), "must reject schema versions we don't understand");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::library`
Expected: FAIL — `Catalog` not defined.

- [ ] **Step 3: Write the domain types**

```rust
// src-tauri/src/domain/library.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Tier { Beginner, Advanced }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlatformAsset {
    pub url: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub network: bool,
    pub fs_read: Vec<String>,
    pub fs_write: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CatalogTool {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub category: String,
    pub tier: Tier,
    #[serde(default)]
    pub params: Vec<serde_json::Value>,
    pub permissions: Permissions,
    #[serde(default)]
    pub platforms: HashMap<String, PlatformAsset>,
    #[serde(default)]
    pub script: Option<String>,
    #[serde(default)]
    pub min_pier_version: Option<String>,
    #[serde(default)]
    pub deprecated: bool,
}

const SUPPORTED_SCHEMA: u32 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub catalog_schema_version: u32,
    pub published_at: String,
    pub tools: Vec<CatalogTool>,
}

impl<'de> Deserialize<'de> for Catalog {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Raw {
            catalog_schema_version: u32,
            published_at: String,
            tools: Vec<CatalogTool>,
        }
        let r = Raw::deserialize(d)?;
        if r.catalog_schema_version != SUPPORTED_SCHEMA {
            return Err(serde::de::Error::custom(format!(
                "unsupported catalogSchemaVersion: {}", r.catalog_schema_version
            )));
        }
        Ok(Catalog {
            catalog_schema_version: r.catalog_schema_version,
            published_at: r.published_at,
            tools: r.tools,
        })
    }
}
```

Then add to `src-tauri/src/domain/mod.rs`:

```rust
pub mod library;
pub use library::{Catalog, CatalogTool, PlatformAsset, Permissions, Tier};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::library`
Expected: PASS — both tests green.

- [ ] **Step 5: Write the failing TS test**

```typescript
// src/domain/__tests__/library.test.ts
import { describe, it, expect } from "vitest";
import type { Catalog } from "../library";

describe("Catalog type", () => {
  it("accepts a valid minimal catalog at compile + runtime", () => {
    const cat: Catalog = {
      catalogSchemaVersion: 1,
      publishedAt: "2026-05-15T00:00:00Z",
      tools: [{
        id: "kill-port",
        name: "Kill port",
        version: "1.0.0",
        description: "Free a port.",
        category: "dev",
        tier: "beginner",
        permissions: { network: false, fsRead: [], fsWrite: [] },
        script: "#!/bin/sh\nlsof -ti:$1 | xargs kill -9\n",
      }],
    };
    expect(cat.tools[0].id).toBe("kill-port");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/domain/__tests__/library.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write `src/domain/library.ts`** — exactly as in the "Manifest Shape" section above.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/domain/__tests__/library.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/domain/library.rs src-tauri/src/domain/mod.rs \
        src/domain/library.ts src/domain/__tests__/library.test.ts
git commit -m "feat(library): catalog domain types (Rust + TS)"
```

---

## Task 2: Catalog fetch + ETag cache

**Files:**
- Create: `src-tauri/src/application/library/mod.rs`
- Create: `src-tauri/src/application/library/cache.rs`
- Create: `src-tauri/src/application/library/fetch.rs`
- Create: `src-tauri/src/infrastructure/library_http.rs`
- Modify: `src-tauri/src/application/mod.rs`, `src-tauri/src/infrastructure/mod.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add deps**

In `src-tauri/Cargo.toml` `[dependencies]`:

```toml
sha2 = "0.10"
minisign-verify = "0.2"
```

(reqwest, serde_json, anyhow, tokio already present.)

- [ ] **Step 2: Write the failing test for ETag cache**

Create `src-tauri/src/application/library/cache.rs`:

```rust
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CachedCatalog {
    pub etag: Option<String>,
    pub body: String,
    pub fetched_at: i64,
}

pub fn cache_path() -> PathBuf {
    dirs::home_dir().expect("home").join(".pier/cache/catalog.json")
}

pub fn load(path: &std::path::Path) -> Result<Option<CachedCatalog>> {
    if !path.exists() { return Ok(None); }
    let s = std::fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&s)?))
}

pub fn save(path: &std::path::Path, c: &CachedCatalog) -> Result<()> {
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, serde_json::to_string(c)?)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    #[test]
    fn roundtrip() {
        let d = tempdir().unwrap();
        let p = d.path().join("c.json");
        assert!(load(&p).unwrap().is_none());
        save(&p, &CachedCatalog { etag: Some("W/\"abc\"".into()), body: "{}".into(), fetched_at: 1 }).unwrap();
        let c = load(&p).unwrap().unwrap();
        assert_eq!(c.etag.as_deref(), Some("W/\"abc\""));
    }
}
```

- [ ] **Step 3: Run test**

Create `src-tauri/src/application/library/mod.rs` with `pub mod cache;` and add `pub mod library;` to `src-tauri/src/application/mod.rs`.

Run: `cargo test --manifest-path src-tauri/Cargo.toml library::cache`
Expected: PASS.

- [ ] **Step 4: Write the failing fetch test (HTTP mocked via httpmock)**

Add `httpmock = "0.7"` to `[dev-dependencies]` in `src-tauri/Cargo.toml`.

Create `src-tauri/src/infrastructure/library_http.rs`:

```rust
use anyhow::{anyhow, Context, Result};
use std::time::Duration;

pub struct FetchResult {
    pub status: u16,
    pub etag: Option<String>,
    pub body: String,
}

pub async fn get_with_etag(url: &str, prev_etag: Option<&str>) -> Result<FetchResult> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("pier/", env!("CARGO_PKG_VERSION")))
        .build()?;
    let mut req = client.get(url);
    if let Some(e) = prev_etag { req = req.header("If-None-Match", e); }
    let resp = req.send().await.with_context(|| format!("GET {url}"))?;
    let status = resp.status().as_u16();
    let etag = resp.headers().get("etag").and_then(|v| v.to_str().ok()).map(str::to_owned);
    let body = if status == 304 { String::new() } else { resp.text().await? };
    if status >= 400 { return Err(anyhow!("HTTP {status} for {url}")); }
    Ok(FetchResult { status, etag, body })
}
```

Add `pub mod library_http;` to `src-tauri/src/infrastructure/mod.rs`.

Create `src-tauri/src/application/library/fetch.rs`:

```rust
use crate::application::library::cache::{self, CachedCatalog};
use crate::domain::Catalog;
use crate::infrastructure::library_http;
use anyhow::{anyhow, Context, Result};
use std::path::Path;

pub struct FetchOpts<'a> {
    pub url: &'a str,
    pub minisign_pubkey: &'a str,
    pub signature_url: &'a str,
    pub cache_path: &'a Path,
}

pub async fn fetch(opts: FetchOpts<'_>) -> Result<Catalog> {
    let cached = cache::load(opts.cache_path)?;
    let prev_etag = cached.as_ref().and_then(|c| c.etag.as_deref());
    let res = library_http::get_with_etag(opts.url, prev_etag).await?;

    let body = if res.status == 304 {
        cached.as_ref().map(|c| c.body.clone()).ok_or_else(|| anyhow!("304 but no cache"))?
    } else {
        // Verify signature on fresh body
        let sig = library_http::get_with_etag(opts.signature_url, None).await?.body;
        verify_minisign(&body_or_empty(&res.body), &sig, opts.minisign_pubkey)
            .context("manifest signature verification failed")?;
        res.body.clone()
    };

    let parsed: Catalog = serde_json::from_str(&body).context("parse catalog")?;

    if res.status != 304 {
        cache::save(opts.cache_path, &CachedCatalog {
            etag: res.etag,
            body,
            fetched_at: chrono::Utc::now().timestamp(),
        })?;
    }
    Ok(parsed)
}

fn body_or_empty(s: &str) -> &str { s }

fn verify_minisign(body: &str, sig: &str, pubkey: &str) -> Result<()> {
    let pk = minisign_verify::PublicKey::from_base64(pubkey)
        .map_err(|e| anyhow!("bad pubkey: {e}"))?;
    let signature = minisign_verify::Signature::decode(sig)
        .map_err(|e| anyhow!("bad signature: {e}"))?;
    pk.verify(body.as_bytes(), &signature, false)
        .map_err(|e| anyhow!("verify: {e}"))?;
    Ok(())
}
```

Add `pub mod fetch;` to `src-tauri/src/application/library/mod.rs`. Add `chrono` to deps if missing (`chrono = { version = "0.4", default-features = false, features = ["clock"] }`).

- [ ] **Step 5: Write integration test**

Append to `src-tauri/src/application/library/fetch.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;
    use tempfile::tempdir;

    // Pre-generated minisign keypair fixture (keep in tests/fixtures, see step 6)
    const TEST_PUBKEY: &str = include_str!("../../../tests/fixtures/library_pubkey.txt");
    const TEST_BODY: &str = include_str!("../../../tests/fixtures/catalog_sample.json");
    const TEST_SIG: &str = include_str!("../../../tests/fixtures/catalog_sample.json.minisig");

    #[tokio::test]
    async fn fetches_and_verifies_signed_catalog() {
        let server = MockServer::start();
        let _m1 = server.mock(|when, then| {
            when.method(GET).path("/catalog.json");
            then.status(200).header("etag", "\"v1\"").body(TEST_BODY);
        });
        let _m2 = server.mock(|when, then| {
            when.method(GET).path("/catalog.json.minisig");
            then.status(200).body(TEST_SIG);
        });
        let d = tempdir().unwrap();
        let cat = fetch(FetchOpts {
            url: &server.url("/catalog.json"),
            minisign_pubkey: TEST_PUBKEY.trim(),
            signature_url: &server.url("/catalog.json.minisig"),
            cache_path: &d.path().join("c.json"),
        }).await.unwrap();
        assert_eq!(cat.catalog_schema_version, 1);
    }
}
```

- [ ] **Step 6: Generate test fixtures**

```bash
cd src-tauri && mkdir -p tests/fixtures
# Generate a throwaway minisign key for tests:
brew install minisign  # if not already
minisign -G -p tests/fixtures/library_pubkey.full -s tests/fixtures/library_seckey -W
# Extract just the base64 line from the .pub for the fixture:
tail -1 tests/fixtures/library_pubkey.full > tests/fixtures/library_pubkey.txt
rm tests/fixtures/library_pubkey.full
# Write a sample catalog:
cat > tests/fixtures/catalog_sample.json <<'EOF'
{"catalogSchemaVersion":1,"publishedAt":"2026-05-15T00:00:00Z","tools":[{"id":"kill-port","name":"Kill port","version":"1.0.0","description":"Free a port.","category":"dev","tier":"beginner","permissions":{"network":false,"fsRead":[],"fsWrite":[]},"script":"#!/bin/sh\nlsof -ti:$1 | xargs kill -9\n"}]}
EOF
minisign -S -s tests/fixtures/library_seckey -m tests/fixtures/catalog_sample.json -W
# This produces tests/fixtures/catalog_sample.json.minisig
echo "tests/fixtures/library_seckey" >> .gitignore
```

- [ ] **Step 7: Run the integration test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml library::fetch -- --nocapture`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/application/library/ \
        src-tauri/src/infrastructure/library_http.rs \
        src-tauri/src/application/mod.rs src-tauri/src/infrastructure/mod.rs \
        src-tauri/tests/fixtures/library_pubkey.txt \
        src-tauri/tests/fixtures/catalog_sample.json \
        src-tauri/tests/fixtures/catalog_sample.json.minisig \
        src-tauri/.gitignore
git commit -m "feat(library): fetch + verify catalog with ETag cache"
```

---

## Task 3: Install (download → verify SHA-256 → place)

**Files:**
- Create: `src-tauri/src/application/library/install.rs`
- Modify: `src-tauri/src/application/library/mod.rs`

- [ ] **Step 1: Write failing test**

Create `src-tauri/src/application/library/install.rs`:

```rust
use crate::domain::CatalogTool;
use anyhow::{anyhow, bail, Context, Result};
use sha2::{Digest, Sha256};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

pub fn current_platform() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))] { "darwin-arm64" }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))] { "darwin-amd64" }
    #[cfg(not(target_os = "macos"))] { "unsupported" }
}

pub fn install_root() -> PathBuf {
    dirs::home_dir().expect("home").join(".pier/tools")
}

pub struct Installed {
    pub command: String,
    pub sha256: String,
    pub version: String,
}

pub async fn install(tool: &CatalogTool, root: &Path) -> Result<Installed> {
    let dest_dir = root.join(&tool.id).join(&tool.version);
    std::fs::create_dir_all(&dest_dir)?;

    if let Some(script) = &tool.script {
        let path = dest_dir.join(format!("{}.sh", tool.id));
        std::fs::write(&path, script)?;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))?;
        return Ok(Installed {
            command: path.to_string_lossy().into_owned(),
            sha256: sha256_of(&path)?,
            version: tool.version.clone(),
        });
    }

    let plat = current_platform();
    let asset = tool.platforms.get(plat)
        .ok_or_else(|| anyhow!("no asset for platform {plat}"))?;
    let bytes = reqwest::get(&asset.url).await
        .with_context(|| format!("GET {}", asset.url))?
        .error_for_status()?
        .bytes().await?;
    let actual = format!("{:x}", Sha256::digest(&bytes));
    if actual != asset.sha256.to_lowercase() {
        bail!("sha256 mismatch: expected {}, got {}", asset.sha256, actual);
    }
    let path = dest_dir.join(&tool.id);
    std::fs::write(&path, &bytes)?;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))?;
    Ok(Installed {
        command: path.to_string_lossy().into_owned(),
        sha256: actual,
        version: tool.version.clone(),
    })
}

fn sha256_of(p: &Path) -> Result<String> {
    let bytes = std::fs::read(p)?;
    Ok(format!("{:x}", Sha256::digest(&bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Permissions, Tier};
    use tempfile::tempdir;

    fn shell_tool() -> CatalogTool {
        CatalogTool {
            id: "kill-port".into(),
            name: "Kill port".into(),
            version: "1.0.0".into(),
            description: "x".into(),
            category: "dev".into(),
            tier: Tier::Beginner,
            params: vec![],
            permissions: Permissions { network: false, fs_read: vec![], fs_write: vec![] },
            platforms: Default::default(),
            script: Some("#!/bin/sh\necho hi\n".into()),
            min_pier_version: None,
            deprecated: false,
        }
    }

    #[tokio::test]
    async fn installs_shell_tool_executable() {
        let d = tempdir().unwrap();
        let i = install(&shell_tool(), d.path()).await.unwrap();
        let meta = std::fs::metadata(&i.command).unwrap();
        assert!(meta.permissions().mode() & 0o111 != 0, "must be executable");
    }

    #[tokio::test]
    async fn rejects_sha_mismatch() {
        let server = httpmock::MockServer::start();
        let _m = server.mock(|w, t| { w.method(httpmock::Method::GET).path("/bin"); t.status(200).body("hello"); });
        let mut t = shell_tool();
        t.script = None;
        t.platforms.insert(current_platform().into(), crate::domain::PlatformAsset {
            url: server.url("/bin"),
            sha256: "0000000000000000000000000000000000000000000000000000000000000000".into(),
        });
        let d = tempdir().unwrap();
        let err = install(&t, d.path()).await.unwrap_err();
        assert!(err.to_string().contains("sha256 mismatch"));
    }
}
```

Add `pub mod install;` to `src-tauri/src/application/library/mod.rs`.

- [ ] **Step 2: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml library::install`
Expected: PASS (both tests).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/application/library/install.rs src-tauri/src/application/library/mod.rs
git commit -m "feat(library): install — download, sha256-verify, place executable"
```

---

## Task 4: Add to tools.json (diff preview + atomic append)

**Files:**
- Create: `src-tauri/src/application/library/add_to_config.rs`
- Modify: `src-tauri/src/application/library/mod.rs`
- Modify: `src-tauri/src/domain/tool.rs` — add `source` field
- Modify: `src/domain/tool.ts` — add `source` field

- [ ] **Step 1: Add `source` to Rust Tool**

In `src-tauri/src/domain/tool.rs`, add to the `Tool` struct (preserve existing `serde(default)` style):

```rust
#[serde(default)]
pub source: Option<ToolSource>,
```

And below:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolSource {
    pub catalog: String,
    pub version: String,
    pub sha256: String,
}
```

- [ ] **Step 2: Add `source` to TS Tool**

In `src/domain/tool.ts`, add to `Tool`:

```typescript
source?: { catalog: string; version: string; sha256: string };
```

- [ ] **Step 3: Write failing test**

Create `src-tauri/src/application/library/add_to_config.rs`:

```rust
use crate::domain::{CatalogTool, Tool, ToolSource, ToolsConfig};
use anyhow::{anyhow, bail, Context, Result};
use std::path::Path;

pub struct AddPreview {
    pub before: String,
    pub after: String,
    pub new_tool: Tool,
}

pub fn build_tool_entry(catalog: &str, src: &CatalogTool, command: String, sha256: String) -> Tool {
    Tool {
        id: src.id.clone(),
        name: src.name.clone(),
        command,
        args: None,
        parameters: None, // params from catalog are JSON; left as None for v0 — see open question below
        description: Some(src.description.clone()),
        icon: None,
        timeout: None,
        confirm: None,
        shell: None,
        cwd: None,
        category: Some(src.category.clone()),
        env_file: None,
        env: None,
        source: Some(ToolSource {
            catalog: catalog.into(),
            version: src.version.clone(),
            sha256,
        }),
    }
}

pub fn preview(config_path: &Path, new_tool: Tool) -> Result<AddPreview> {
    let before = std::fs::read_to_string(config_path).context("read tools.json")?;
    let mut cfg: ToolsConfig = serde_json::from_str(&before).context("parse tools.json")?;
    if cfg.tools.iter().any(|t| t.id == new_tool.id) {
        bail!("tool id '{}' already exists in tools.json", new_tool.id);
    }
    cfg.tools.push(new_tool.clone());
    let after = serde_json::to_string_pretty(&cfg)? + "\n";
    Ok(AddPreview { before, after, new_tool })
}

pub fn commit(config_path: &Path, after: &str) -> Result<()> {
    let tmp = config_path.with_extension("tmp");
    std::fs::write(&tmp, after)?;
    std::fs::rename(&tmp, config_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Permissions, Tier};
    use tempfile::NamedTempFile;
    use std::io::Write;

    fn cat_tool() -> CatalogTool {
        CatalogTool {
            id: "x".into(), name: "X".into(), version: "1.0.0".into(),
            description: "d".into(), category: "dev".into(), tier: Tier::Beginner,
            params: vec![], permissions: Permissions { network: false, fs_read: vec![], fs_write: vec![] },
            platforms: Default::default(), script: None, min_pier_version: None, deprecated: false,
        }
    }

    #[test]
    fn preview_then_commit_appends_tool() {
        let mut f = NamedTempFile::new().unwrap();
        write!(f, r#"{{"schemaVersion":"1.0","tools":[]}}"#).unwrap();
        let t = build_tool_entry("pier-tools", &cat_tool(), "/bin/x".into(), "abc".into());
        let p = preview(f.path(), t).unwrap();
        commit(f.path(), &p.after).unwrap();
        let after = std::fs::read_to_string(f.path()).unwrap();
        assert!(after.contains("\"id\": \"x\""));
        assert!(after.contains("\"sha256\": \"abc\""));
    }

    #[test]
    fn rejects_duplicate_id() {
        let mut f = NamedTempFile::new().unwrap();
        write!(f, r#"{{"schemaVersion":"1.0","tools":[{{"id":"x","name":"X","command":"/bin/x"}}]}}"#).unwrap();
        let t = build_tool_entry("pier-tools", &cat_tool(), "/bin/x".into(), "abc".into());
        let err = preview(f.path(), t).unwrap_err();
        assert!(err.to_string().contains("already exists"));
    }
}
```

Add `pub mod add_to_config;` to `src-tauri/src/application/library/mod.rs`.

- [ ] **Step 4: Run all touched tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml library::add_to_config && npm run test:run -- src/domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/application/library/add_to_config.rs \
        src-tauri/src/application/library/mod.rs \
        src-tauri/src/domain/tool.rs \
        src/domain/tool.ts
git commit -m "feat(library): add-to-config preview + atomic commit"
```

---

## Task 5: Tauri commands + invoke_handler wiring

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs:84-101`

- [ ] **Step 1: Add commands**

Append to `src-tauri/src/commands.rs`:

```rust
use crate::application::library::{add_to_config, fetch as lib_fetch, install as lib_install};
use crate::domain::{Catalog, CatalogTool, Tool};

const CATALOG_URL: &str = "https://library.pier.app/catalog.json";
const CATALOG_SIG_URL: &str = "https://library.pier.app/catalog.json.minisig";
const CATALOG_PUBKEY: &str = env!("PIER_LIBRARY_PUBKEY"); // baked at build time; fall back to a const for dev — see step 4

#[tauri::command]
pub async fn library_fetch_catalog() -> Result<Catalog, String> {
    let cache = crate::application::library::cache::cache_path();
    lib_fetch::fetch(lib_fetch::FetchOpts {
        url: CATALOG_URL,
        minisign_pubkey: CATALOG_PUBKEY,
        signature_url: CATALOG_SIG_URL,
        cache_path: &cache,
    })
    .await
    .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct LibraryAddPreview {
    pub before: String,
    pub after: String,
    pub new_tool: Tool,
}

#[tauri::command]
pub async fn library_install_and_preview(
    app: tauri::AppHandle,
    tool: CatalogTool,
) -> Result<LibraryAddPreview, String> {
    let installed = lib_install::install(&tool, &lib_install::install_root())
        .await
        .map_err(|e| e.to_string())?;
    let entry = add_to_config::build_tool_entry(
        "pier-tools",
        &tool,
        installed.command,
        installed.sha256,
    );
    let cfg_path = std::path::PathBuf::from(crate::commands::config_path());
    let p = add_to_config::preview(&cfg_path, entry).map_err(|e| e.to_string())?;
    Ok(LibraryAddPreview { before: p.before, after: p.after, new_tool: p.new_tool })
}

#[tauri::command]
pub fn library_commit_add(after: String) -> Result<(), String> {
    let cfg_path = std::path::PathBuf::from(crate::commands::config_path());
    add_to_config::commit(&cfg_path, &after).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Set the build-time pubkey env var**

Add to `src-tauri/build.rs` (create if not present):

```rust
fn main() {
    println!("cargo:rerun-if-env-changed=PIER_LIBRARY_PUBKEY");
    if std::env::var("PIER_LIBRARY_PUBKEY").is_err() {
        // Dev fallback — replace with the real pubkey before v0.2 release.
        println!("cargo:rustc-env=PIER_LIBRARY_PUBKEY=DEV_PLACEHOLDER_PUBKEY_REPLACE_BEFORE_RELEASE");
    }
    tauri_build::build()
}
```

If `build.rs` already exists, merge the snippet above with existing logic.

- [ ] **Step 3: Register handlers in `lib.rs`**

In `src-tauri/src/lib.rs:84-101`, append three lines inside `generate_handler!`:

```rust
            commands::library_fetch_catalog,
            commands::library_install_and_preview,
            commands::library_commit_add,
```

- [ ] **Step 4: Verify build**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/build.rs
git commit -m "feat(library): tauri commands — fetch, install+preview, commit"
```

---

## Task 6: Frontend port + adapter

**Files:**
- Modify: `src/application/ports.ts`
- Create: `src/infrastructure/tauriLibraryClient.ts`
- Create: `src/state/LibraryContext.tsx`

- [ ] **Step 1: Add port**

Append to `src/application/ports.ts`:

```typescript
import type { Catalog, CatalogTool } from "../domain/library";
import type { Tool } from "../domain/tool";

export interface LibraryAddPreview {
  before: string;
  after: string;
  newTool: Tool;
}

export interface LibraryClient {
  fetchCatalog(): Promise<Catalog>;
  installAndPreview(tool: CatalogTool): Promise<LibraryAddPreview>;
  commitAdd(after: string): Promise<void>;
}
```

- [ ] **Step 2: Write the adapter**

```typescript
// src/infrastructure/tauriLibraryClient.ts
import { invoke } from "@tauri-apps/api/core";
import type { Catalog, CatalogTool } from "../domain/library";
import type { LibraryAddPreview, LibraryClient } from "../application/ports";

interface RustPreview { before: string; after: string; new_tool: import("../domain/tool").Tool }

export const tauriLibraryClient: LibraryClient = {
  fetchCatalog: () => invoke<Catalog>("library_fetch_catalog"),
  async installAndPreview(tool: CatalogTool): Promise<LibraryAddPreview> {
    const r = await invoke<RustPreview>("library_install_and_preview", { tool });
    return { before: r.before, after: r.after, newTool: r.new_tool };
  },
  commitAdd: (after: string) => invoke<void>("library_commit_add", { after }),
};
```

- [ ] **Step 3: Write the context**

```tsx
// src/state/LibraryContext.tsx
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { LibraryClient } from "../application/ports";

const Ctx = createContext<LibraryClient | null>(null);

export function LibraryProvider({ client, children }: { client: LibraryClient; children: ReactNode }) {
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const c = useContext(Ctx);
  if (!c) throw new Error("LibraryProvider missing");
  return c;
}
```

- [ ] **Step 4: Wire provider into `App.tsx`**

In `src/App.tsx` (find the existing nested provider tree), wrap with:

```tsx
import { LibraryProvider } from "./state/LibraryContext";
import { tauriLibraryClient } from "./infrastructure/tauriLibraryClient";

// ...inside the existing provider tree, alongside <RunnerContext />:
<LibraryProvider client={tauriLibraryClient}>
  {/* existing children */}
</LibraryProvider>
```

- [ ] **Step 5: Verify**

Run: `npm run build` (typechecks).
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/application/ports.ts src/infrastructure/tauriLibraryClient.ts \
        src/state/LibraryContext.tsx src/App.tsx
git commit -m "feat(library): port + tauri adapter + DI context"
```

---

## Task 7: `useLibrary` hook + reducer state for sheet

**Files:**
- Create: `src/application/useLibrary.ts`
- Modify: `src/state/actions.ts`, `src/state/reducer.ts`

- [ ] **Step 1: Add reducer state for the sheet**

In `src/state/actions.ts`, add to the union:

```typescript
| { type: "LIBRARY_SHEET_OPEN" }
| { type: "LIBRARY_SHEET_CLOSE" }
```

In `src/state/reducer.ts`, add to `initialState`:

```typescript
librarySheetOpen: false,
```

And to the reducer:

```typescript
case "LIBRARY_SHEET_OPEN": return { ...state, librarySheetOpen: true };
case "LIBRARY_SHEET_CLOSE": return { ...state, librarySheetOpen: false };
```

Make sure `AppState` type includes `librarySheetOpen: boolean`.

- [ ] **Step 2: Write the hook**

```typescript
// src/application/useLibrary.ts
import { useCallback, useEffect, useState } from "react";
import { useLibrary as useLibraryClient } from "../state/LibraryContext";
import type { Catalog, CatalogTool } from "../domain/library";
import type { LibraryAddPreview } from "./ports";

type Status = "idle" | "loading" | "ready" | "error";

export function useCatalog() {
  const client = useLibraryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading"); setError(null);
    try {
      const c = await client.fetchCatalog();
      setCatalog(c); setStatus("ready");
    } catch (e) {
      setError(String(e)); setStatus("error");
    }
  }, [client]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { status, catalog, error, refresh };
}

export function useAddTool() {
  const client = useLibraryClient();
  const [busy, setBusy] = useState(false);

  const previewAdd = useCallback(
    (tool: CatalogTool): Promise<LibraryAddPreview> => client.installAndPreview(tool),
    [client],
  );
  const commit = useCallback(
    async (after: string) => {
      setBusy(true);
      try { await client.commitAdd(after); } finally { setBusy(false); }
    },
    [client],
  );
  return { busy, previewAdd, commit };
}
```

- [ ] **Step 3: Write a smoke test with a fake client**

```typescript
// src/application/__tests__/useLibrary.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { LibraryProvider } from "../../state/LibraryContext";
import { useCatalog } from "../useLibrary";
import type { LibraryClient } from "../ports";

const fake: LibraryClient = {
  fetchCatalog: async () => ({
    catalogSchemaVersion: 1,
    publishedAt: "2026-05-15T00:00:00Z",
    tools: [{
      id: "k", name: "K", version: "1.0.0", description: "d",
      category: "dev", tier: "beginner",
      permissions: { network: false, fsRead: [], fsWrite: [] },
      script: "echo",
    }],
  }),
  installAndPreview: async () => ({ before: "", after: "", newTool: {} as any }),
  commitAdd: async () => {},
};

describe("useCatalog", () => {
  it("loads the catalog into state", async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      <LibraryProvider client={fake}>{children}</LibraryProvider>;
    const { result } = renderHook(() => useCatalog(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.catalog?.tools[0].id).toBe("k");
  });
});
```

- [ ] **Step 4: Run hook test**

Run: `npx vitest run src/application/__tests__/useLibrary.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/useLibrary.ts src/application/__tests__/useLibrary.test.tsx \
        src/state/actions.ts src/state/reducer.ts
git commit -m "feat(library): useCatalog + useAddTool hooks; sheet open/close action"
```

---

## Task 8: Atoms — `PermissionPill`

**Files:**
- Create: `src/ui/atoms/PermissionPill.tsx`
- Test: `src/ui/atoms/__tests__/PermissionPill.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PermissionPill } from "../PermissionPill";

describe("PermissionPill", () => {
  it("renders the label", () => {
    render(<PermissionPill kind="network" />);
    expect(screen.getByText(/internet/i)).toBeInTheDocument();
  });
  it("renders fs labels with paths", () => {
    render(<PermissionPill kind="fsRead" path="~/Documents" />);
    expect(screen.getByText(/reads ~\/Documents/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — should fail (module missing)**

Run: `npx vitest run src/ui/atoms/__tests__/PermissionPill.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/ui/atoms/PermissionPill.tsx
type Kind = "network" | "fsRead" | "fsWrite";
const LABEL: Record<Kind, (p?: string) => string> = {
  network: () => "Internet access",
  fsRead: (p) => `Reads ${p ?? "files"}`,
  fsWrite: (p) => `Writes ${p ?? "files"}`,
};

export function PermissionPill({ kind, path }: { kind: Kind; path?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs bg-surface-2 text-fg-2">
      {LABEL[kind](path)}
    </span>
  );
}
```

- [ ] **Step 4: Run — pass**

Run: `npx vitest run src/ui/atoms/__tests__/PermissionPill.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/atoms/PermissionPill.tsx src/ui/atoms/__tests__/PermissionPill.test.tsx
git commit -m "feat(ui): PermissionPill atom"
```

---

## Task 9: Molecules — `LibraryToolCard`, `AddToolDialog`

**Files:**
- Create: `src/ui/molecules/LibraryToolCard.tsx`
- Create: `src/ui/molecules/AddToolDialog.tsx`
- Test: `src/ui/molecules/__tests__/LibraryToolCard.test.tsx`, `src/ui/molecules/__tests__/AddToolDialog.test.tsx`

- [ ] **Step 1: LibraryToolCard test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LibraryToolCard } from "../LibraryToolCard";
import type { CatalogTool } from "../../../domain/library";

const tool: CatalogTool = {
  id: "kill-port", name: "Kill port", version: "1.0.0",
  description: "Free a port held by a stuck process.",
  category: "dev", tier: "beginner",
  permissions: { network: false, fsRead: [], fsWrite: [] },
  script: "echo",
};

describe("LibraryToolCard", () => {
  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<LibraryToolCard tool={tool} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /kill port/i }));
    expect(onSelect).toHaveBeenCalledWith(tool);
  });
});
```

- [ ] **Step 2: Implement LibraryToolCard**

```tsx
// src/ui/molecules/LibraryToolCard.tsx
import type { CatalogTool } from "../../domain/library";

export function LibraryToolCard({ tool, onSelect }: { tool: CatalogTool; onSelect: (t: CatalogTool) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      className="text-left p-3 rounded-2 bg-surface-1 hover:bg-surface-2 border border-border-1 flex flex-col gap-1 animate-tile-in"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-fg-1">{tool.name}</span>
        {tool.tier === "advanced" && (
          <span className="text-2xs px-1.5 py-0.5 rounded-1 bg-warn/10 text-warn">advanced</span>
        )}
      </div>
      <p className="text-sm text-fg-2 line-clamp-2">{tool.description}</p>
    </button>
  );
}
```

- [ ] **Step 3: Test AddToolDialog (consent + diff + confirm)**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AddToolDialog } from "../AddToolDialog";
import type { CatalogTool } from "../../../domain/library";

const tool: CatalogTool = {
  id: "kp", name: "Kill port", version: "1.0.0",
  description: "x", category: "dev", tier: "beginner",
  permissions: { network: true, fsRead: ["~/Documents"], fsWrite: [] },
  script: "echo",
};

describe("AddToolDialog", () => {
  it("renders permissions consent line", async () => {
    render(<AddToolDialog tool={tool} preview={{ before: "", after: "{}", newTool: {} as any }} onClose={() => {}} onConfirm={() => {}} busy={false} />);
    expect(screen.getByText(/internet access/i)).toBeInTheDocument();
    expect(screen.getByText(/reads ~\/Documents/i)).toBeInTheDocument();
  });
  it("calls onConfirm with after-text when Add clicked", () => {
    const onConfirm = vi.fn();
    render(<AddToolDialog tool={tool} preview={{ before: "{}", after: "{\"x\":1}", newTool: {} as any }} onClose={() => {}} onConfirm={onConfirm} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: /add to my tools/i }));
    expect(onConfirm).toHaveBeenCalledWith("{\"x\":1}");
  });
});
```

- [ ] **Step 4: Implement AddToolDialog**

```tsx
// src/ui/molecules/AddToolDialog.tsx
import { useDialogA11y } from "./useDialogA11y";
import { PermissionPill } from "../atoms/PermissionPill";
import { Button } from "../atoms/Button";
import type { CatalogTool } from "../../domain/library";
import type { LibraryAddPreview } from "../../application/ports";

export function AddToolDialog({
  tool, preview, onClose, onConfirm, busy,
}: {
  tool: CatalogTool;
  preview: LibraryAddPreview;
  onClose: () => void;
  onConfirm: (after: string) => void;
  busy: boolean;
}) {
  const { dialogRef } = useDialogA11y({ onClose });
  return (
    <div role="dialog" aria-modal="true" ref={dialogRef}
      className="fixed inset-0 z-50 grid place-items-center bg-overlay">
      <div className="bg-surface-0 rounded-3 shadow-pop w-[640px] max-h-[80vh] flex flex-col">
        <header className="px-4 py-3 border-b border-border-1">
          <h2 className="text-lg font-medium text-fg-1">Add {tool.name}</h2>
          <p className="text-sm text-fg-2">{tool.description}</p>
        </header>
        <section className="px-4 py-3 border-b border-border-1 flex flex-wrap gap-1.5">
          {tool.permissions.network && <PermissionPill kind="network" />}
          {tool.permissions.fsRead.map((p) => <PermissionPill key={p} kind="fsRead" path={p} />)}
          {tool.permissions.fsWrite.map((p) => <PermissionPill key={p} kind="fsWrite" path={p} />)}
          {!tool.permissions.network && tool.permissions.fsRead.length === 0 && tool.permissions.fsWrite.length === 0 && (
            <span className="text-sm text-fg-2">No special permissions.</span>
          )}
        </section>
        <pre className="px-4 py-3 overflow-auto text-2xs font-mono text-fg-2 flex-1">{preview.after}</pre>
        <footer className="px-4 py-3 border-t border-border-1 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(preview.after)} disabled={busy}>
            {busy ? "Adding…" : "Add to my tools"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run all molecule tests**

Run: `npx vitest run src/ui/molecules/__tests__/LibraryToolCard.test.tsx src/ui/molecules/__tests__/AddToolDialog.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/molecules/LibraryToolCard.tsx src/ui/molecules/AddToolDialog.tsx \
        src/ui/molecules/__tests__/LibraryToolCard.test.tsx \
        src/ui/molecules/__tests__/AddToolDialog.test.tsx
git commit -m "feat(ui): LibraryToolCard + AddToolDialog molecules"
```

---

## Task 10: Organisms — `LibraryBrowser` + `AddTile`

**Files:**
- Create: `src/ui/organisms/LibraryBrowser.tsx`
- Create: `src/ui/organisms/AddTile.tsx`
- Test: `src/ui/organisms/__tests__/LibraryBrowser.test.tsx`

- [ ] **Step 1: AddTile (no test — pure presentational)**

```tsx
// src/ui/organisms/AddTile.tsx
import { useApp } from "../../state/AppContext";

export function AddTile() {
  const { dispatch } = useApp();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "LIBRARY_SHEET_OPEN" })}
      aria-label="Open library"
      className="aspect-square rounded-2 border border-dashed border-border-2 text-fg-3 hover:text-fg-1 hover:border-fg-2 grid place-items-center text-3xl animate-tile-in"
    >
      +
    </button>
  );
}
```

- [ ] **Step 2: LibraryBrowser test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LibraryBrowser } from "../LibraryBrowser";
import { LibraryProvider } from "../../../state/LibraryContext";
import { AppProvider } from "../../../state/AppContext";
import type { LibraryClient } from "../../../application/ports";

const client: LibraryClient = {
  fetchCatalog: async () => ({
    catalogSchemaVersion: 1, publishedAt: "x",
    tools: [
      { id: "a", name: "Kill port", version: "1.0.0", description: "d", category: "dev", tier: "beginner",
        permissions: { network: false, fsRead: [], fsWrite: [] }, script: "echo" },
      { id: "b", name: "yt-dlp", version: "1.0.0", description: "d", category: "media", tier: "advanced",
        permissions: { network: true, fsRead: [], fsWrite: [] }, script: "echo" },
    ],
  }),
  installAndPreview: vi.fn(), commitAdd: vi.fn(),
};

describe("LibraryBrowser", () => {
  it("hides advanced tools by default", async () => {
    render(
      <AppProvider>
        <LibraryProvider client={client}><LibraryBrowser /></LibraryProvider>
      </AppProvider>
    );
    expect(await screen.findByText(/kill port/i)).toBeInTheDocument();
    expect(screen.queryByText(/yt-dlp/i)).toBeNull();
  });
});
```

- [ ] **Step 3: Implement LibraryBrowser**

```tsx
// src/ui/organisms/LibraryBrowser.tsx
import { useMemo, useState } from "react";
import { useCatalog, useAddTool } from "../../application/useLibrary";
import { LibraryToolCard } from "../molecules/LibraryToolCard";
import { AddToolDialog } from "../molecules/AddToolDialog";
import { TextField } from "../atoms/TextField";
import type { CatalogTool } from "../../domain/library";
import type { LibraryAddPreview } from "../../application/ports";

export function LibraryBrowser() {
  const { status, catalog, error } = useCatalog();
  const { previewAdd, commit, busy } = useAddTool();
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pending, setPending] = useState<{ tool: CatalogTool; preview: LibraryAddPreview } | null>(null);

  const visible = useMemo(() => {
    if (!catalog) return [];
    return catalog.tools
      .filter((t) => showAdvanced || t.tier === "beginner")
      .filter((t) => t.name.toLowerCase().includes(query.toLowerCase())
                  || t.description.toLowerCase().includes(query.toLowerCase()));
  }, [catalog, query, showAdvanced]);

  const onSelect = async (tool: CatalogTool) => {
    const p = await previewAdd(tool);
    setPending({ tool, preview: p });
  };

  if (status === "loading") return <p className="p-4 text-fg-2">Loading library…</p>;
  if (status === "error") return <p className="p-4 text-err">Failed to load: {error}</p>;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
        <label className="flex items-center gap-1 text-sm text-fg-2">
          <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
          Show advanced
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {visible.map((t) => <LibraryToolCard key={t.id} tool={t} onSelect={onSelect} />)}
      </div>
      {pending && (
        <AddToolDialog
          tool={pending.tool}
          preview={pending.preview}
          busy={busy}
          onClose={() => setPending(null)}
          onConfirm={async (after) => { await commit(after); setPending(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run organism test**

Run: `npx vitest run src/ui/organisms/__tests__/LibraryBrowser.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/organisms/LibraryBrowser.tsx src/ui/organisms/AddTile.tsx \
        src/ui/organisms/__tests__/LibraryBrowser.test.tsx
git commit -m "feat(ui): LibraryBrowser + AddTile organisms"
```

---

## Task 11: Template — `LibrarySheet` + integration into `App.tsx`/`ToolBrowser`

**Files:**
- Create: `src/ui/templates/LibrarySheet.tsx`
- Modify: `src/ui/organisms/ToolBrowser.tsx` — append `<AddTile />`
- Modify: `src/App.tsx` — render `<LibrarySheet />` when open

- [ ] **Step 1: Implement LibrarySheet**

```tsx
// src/ui/templates/LibrarySheet.tsx
import { useApp } from "../../state/AppContext";
import { LibraryBrowser } from "../organisms/LibraryBrowser";
import { useDialogA11y } from "../molecules/useDialogA11y";

export function LibrarySheet() {
  const { state, dispatch } = useApp();
  const close = () => dispatch({ type: "LIBRARY_SHEET_CLOSE" });
  const { dialogRef } = useDialogA11y({ onClose: close, enabled: state.librarySheetOpen });

  if (!state.librarySheetOpen) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Library" ref={dialogRef}
      className="fixed inset-0 z-40 bg-overlay">
      <div className="absolute inset-x-0 bottom-0 top-12 bg-surface-0 rounded-t-3 shadow-pop flex flex-col">
        <header className="px-4 py-3 border-b border-border-1 flex items-center justify-between">
          <h1 className="text-lg font-medium text-fg-1">Library</h1>
          <button onClick={close} className="text-fg-2 hover:text-fg-1" aria-label="Close library">✕</button>
        </header>
        <div className="overflow-auto flex-1"><LibraryBrowser /></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append AddTile in ToolBrowser**

In `src/ui/organisms/ToolBrowser.tsx`, after the existing `tools.map(...)` grid, render `<AddTile />` as the last grid child.

- [ ] **Step 3: Render LibrarySheet at app root**

In `src/App.tsx`, inside the existing template, add `<LibrarySheet />` near the bottom of the rendered tree.

- [ ] **Step 4: Manual verification (UI)**

Run: `npm run tauri:dev`
Verify: `+` tile appears at the end of the grid, clicking it opens a slide-up sheet, ESC closes it, focus is trapped, search filters tools, "Show advanced" toggles yt-dlp visibility (with a hand-crafted catalog fixture — see Task 13), clicking a tool opens AddToolDialog with the diff preview, "Add to my tools" appends to `tools.json` and the new tile fades into the grid.

If you can't reach the live catalog yet, point `CATALOG_URL` at `http://localhost:8080/catalog.json` for local testing and serve the fixture with `python3 -m http.server 8080` from `tests/fixtures/`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/templates/LibrarySheet.tsx src/ui/organisms/ToolBrowser.tsx src/App.tsx
git commit -m "feat(ui): LibrarySheet template + AddTile in ToolBrowser"
```

---

## Task 12: Tooling repo — `pier-tools` skeleton

**Files (in a NEW repo, not in `pier`):**

- [ ] **Step 1: Create repo**

```bash
gh repo create KenTaniguchi-R/pier-tools --public --description "Curated tool catalog for Pier"
git clone git@github.com:KenTaniguchi-R/pier-tools.git ~/coding/pier-tools
cd ~/coding/pier-tools
mkdir -p tools/kill-port tools/jwt-decode .github/workflows
```

- [ ] **Step 2: Author the kill-port shell tool**

```bash
# tools/kill-port/tool.sh
cat > tools/kill-port/tool.sh <<'EOF'
#!/bin/sh
set -eu
PORT="${1:-}"
if [ -z "$PORT" ]; then
  echo "usage: kill-port <port>" >&2
  exit 2
fi
PIDS="$(lsof -ti:"$PORT" || true)"
if [ -z "$PIDS" ]; then
  echo "no process on port $PORT"
  exit 0
fi
echo "$PIDS" | xargs kill -9
echo "killed: $PIDS"
EOF
chmod +x tools/kill-port/tool.sh

# tools/kill-port/pier-tool.yaml
cat > tools/kill-port/pier-tool.yaml <<'EOF'
id: kill-port
name: Kill process on port
version: 1.0.0
description: Free up a port held by a stuck process.
category: dev
tier: beginner
permissions:
  network: false
  fsRead: []
  fsWrite: []
params:
  - id: port
    label: Port
    type: number
EOF
```

- [ ] **Step 3: Author the jwt-decode Go tool**

```bash
mkdir -p tools/jwt-decode
cat > tools/jwt-decode/go.mod <<'EOF'
module pier-tools/jwt-decode

go 1.22
EOF

cat > tools/jwt-decode/main.go <<'EOF'
package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: jwt-decode <token>")
		os.Exit(2)
	}
	parts := strings.Split(os.Args[1], ".")
	if len(parts) < 2 {
		fmt.Fprintln(os.Stderr, "not a JWT")
		os.Exit(2)
	}
	for i, name := range []string{"header", "payload"} {
		raw, err := base64.RawURLEncoding.DecodeString(parts[i])
		if err != nil { fmt.Fprintln(os.Stderr, name, ":", err); os.Exit(1) }
		var v any
		if err := json.Unmarshal(raw, &v); err != nil { fmt.Fprintln(os.Stderr, name, ":", err); os.Exit(1) }
		out, _ := json.MarshalIndent(v, "", "  ")
		fmt.Println("---", name, "---")
		fmt.Println(string(out))
	}
}
EOF

cat > tools/jwt-decode/.goreleaser.yaml <<'EOF'
version: 2
builds:
  - main: ./
    binary: jwt-decode
    env: [CGO_ENABLED=0]
    goos: [darwin]
    goarch: [arm64, amd64]
    flags: [-trimpath]
    ldflags: [-s, -w]
universal_binaries:
  - replace: true
archives:
  - format: binary
EOF

cat > tools/jwt-decode/pier-tool.yaml <<'EOF'
id: jwt-decode
name: JWT decode
version: 1.0.0
description: Paste a JWT — see the header and payload pretty-printed.
category: dev
tier: beginner
permissions:
  network: false
  fsRead: []
  fsWrite: []
params:
  - id: token
    label: Token
    type: text
EOF
```

- [ ] **Step 4: Catalog generator + signer**

```bash
cat > scripts/build-catalog.sh <<'EOF'
#!/bin/sh
set -eu
# Walk tools/, read each pier-tool.yaml, attach release URL + sha256 per platform,
# emit catalog.json. Sign with minisign.
# (Implementation: ~50 lines of shell + yq + jq. Out of scope for this plan stub —
#  fill in during Task 12 execution.)
EOF
chmod +x scripts/build-catalog.sh
```

(Full catalog generator is implementation, not specification — keep it shell + `yq` + `jq` so it's auditable.)

- [ ] **Step 5: Release workflow**

```yaml
# .github/workflows/release.yml
name: release
on: { push: { tags: ["v*"] } }
jobs:
  build:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "1.22" }
      - name: Import Apple cert
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          # Same import flow as the main pier release.yml — copy verbatim.
      - name: Build + sign + notarize all tools
        run: ./scripts/build-all.sh
      - name: Generate signed catalog
        env:
          MINISIGN_KEY: ${{ secrets.MINISIGN_KEY }}
          MINISIGN_PASSWORD: ${{ secrets.MINISIGN_PASSWORD }}
        run: ./scripts/build-catalog.sh
      - name: Upload to R2
        run: aws s3 cp catalog.json s3://library/catalog.json --endpoint-url $R2_ENDPOINT
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_KEY }}
          R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
```

- [ ] **Step 6: Commit pier-tools repo**

```bash
git add . && git commit -m "feat: kill-port + jwt-decode + release scaffolding"
git push origin main
```

---

## Task 13: End-to-end Gatekeeper proof point

**Goal:** Prove the foundational research claim — a binary downloaded by Pier into `~/.pier/tools/...` and exec'd via `posix_spawn` does NOT trigger Gatekeeper prompts on a fresh Mac.

- [ ] **Step 1: Build + sign jwt-decode**

In `~/coding/pier-tools`, tag and push `v0.0.1` to trigger CI. Wait for the GitHub Release to publish.

- [ ] **Step 2: Hand-author a real catalog.json**

Pull the release URLs + SHA-256 into a `catalog.json`, sign with minisign, upload to R2 (or temporarily host on `raw.githubusercontent.com` for the test).

- [ ] **Step 3: Point Pier at the real catalog**

Set `PIER_LIBRARY_PUBKEY` to the real pubkey when building Pier, and update `CATALOG_URL` in `commands.rs` if temporarily hosting on a different domain.

- [ ] **Step 4: Test on a clean Mac (or VM)**

Run a fresh `pier` build. Open Library sheet. Click jwt-decode → Add. Verify:
- No Gatekeeper prompt during install.
- The new tile appears in the grid.
- Clicking the tile and providing a token runs the tool and streams output.
- No Gatekeeper prompt during execution.

- [ ] **Step 5: Document the result**

Write a one-paragraph confirmation in `~/Obsidian/projects/pier/architecture-decisions.md` under ADR-010 — confirm or refute the Gatekeeper claim with evidence (date, macOS version, binary path).

- [ ] **Step 6: Commit Pier-side fixes (if any)**

If the test surfaced bugs, fix them and commit. Otherwise just close the task.

---

## Self-Review

**Spec coverage:** Library sheet ✓ (Tasks 10-11), add-to-tools flow ✓ (Tasks 4-9), catalog fetcher ✓ (Task 2), binary downloader ✓ (Task 3), permissions consent UI ✓ (Tasks 8-9), `~/.pier/tools/<id>/<v>/<bin>` placement ✓ (Task 3), animate-tile-in reuse ✓ (Task 9 LibraryToolCard className), minisign on manifest ✓ (Task 2), SHA-256 on binaries ✓ (Task 3), R2 hosting via custom domain ✓ (Task 5 CATALOG_URL), Aqua-shaped manifest ✓ (Task 1 + Task 12 pier-tool.yaml), atomic-design adherence ✓ (atom→molecule→organism→template across Tasks 8-11), clean-architecture adherence ✓ (port in Task 6, adapter in Task 6, application hooks in Task 7, UI consuming via context).

**Placeholder scan:** `scripts/build-catalog.sh` body in Task 12 is a stub — flagged inline as implementation-not-specification. The Apple cert import in Task 12 step 5 says "copy verbatim" rather than reproducing — acceptable since it's verbatim from existing `release.yml`.

**Type consistency:** `LibraryAddPreview.newTool` (camelCase in TS) vs `new_tool` (Rust) — adapter in Task 6 explicitly translates; consistent. `CATALOG_PUBKEY` baked at build time in Task 5; build.rs added in step 2 of same task. `Tool.source` added in Task 4 (both Rust and TS) before Task 6 uses it.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-28-library-feature.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
