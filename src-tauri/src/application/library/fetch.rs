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
        cached
            .as_ref()
            .map(|c| c.body.clone())
            .ok_or_else(|| anyhow!("304 but no cache"))?
    } else {
        let sig = library_http::get_with_etag(opts.signature_url, None)
            .await?
            .body;
        verify_minisign(&res.body, &sig, opts.minisign_pubkey)
            .context("manifest signature verification failed")?;
        res.body.clone()
    };

    let parsed: Catalog = serde_json::from_str(&body).context("parse catalog")?;

    if res.status != 304 {
        cache::save(
            opts.cache_path,
            &CachedCatalog {
                etag: res.etag,
                body,
                fetched_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0),
            },
        )?;
    }
    Ok(parsed)
}

fn verify_minisign(body: &str, sig: &str, pubkey: &str) -> Result<()> {
    let pk = minisign_verify::PublicKey::from_base64(pubkey)
        .map_err(|e| anyhow!("bad pubkey: {e}"))?;
    let signature =
        minisign_verify::Signature::decode(sig).map_err(|e| anyhow!("bad signature: {e}"))?;
    pk.verify(body.as_bytes(), &signature, false)
        .map_err(|e| anyhow!("verify: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;
    use tempfile::tempdir;

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
        })
        .await
        .unwrap();
        assert_eq!(cat.catalog_schema_version, 1);
    }

    #[tokio::test]
    async fn rejects_tampered_body() {
        let server = MockServer::start();
        let _m1 = server.mock(|when, then| {
            when.method(GET).path("/catalog.json");
            then.status(200).body(r#"{"catalogSchemaVersion":1,"publishedAt":"x","tools":[]}"#);
        });
        let _m2 = server.mock(|when, then| {
            when.method(GET).path("/catalog.json.minisig");
            then.status(200).body(TEST_SIG);
        });
        let d = tempdir().unwrap();
        let err = fetch(FetchOpts {
            url: &server.url("/catalog.json"),
            minisign_pubkey: TEST_PUBKEY.trim(),
            signature_url: &server.url("/catalog.json.minisig"),
            cache_path: &d.path().join("c.json"),
        }).await.unwrap_err();
        assert!(
            err.to_string().to_lowercase().contains("signature")
                || err.chain().any(|c| c.to_string().to_lowercase().contains("verify")),
            "expected signature/verify error, got: {err:?}"
        );
    }
}
