use anyhow::{anyhow, Context, Result};
use std::sync::OnceLock;
use std::time::Duration;

pub struct FetchResult {
    pub status: u16,
    pub etag: Option<String>,
    pub body: String,
}

/// Shared client so connection pooling + TLS state survive across catalog/asset
/// fetches. The 60s timeout is tuned for binary downloads; catalog JSON returns
/// well inside it.
fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .user_agent(concat!("pier/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("build reqwest client")
    })
}

pub async fn get_with_etag(url: &str, prev_etag: Option<&str>) -> Result<FetchResult> {
    let mut req = client().get(url);
    if let Some(e) = prev_etag {
        req = req.header("If-None-Match", e);
    }
    let resp = req.send().await.with_context(|| format!("GET {url}"))?;
    let status = resp.status().as_u16();
    let etag = resp
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    if status >= 400 {
        return Err(anyhow!("HTTP {status} for {url}"));
    }
    let body = if status == 304 {
        String::new()
    } else {
        resp.text().await?
    };
    Ok(FetchResult { status, etag, body })
}

pub async fn download_bytes(url: &str) -> Result<Vec<u8>> {
    let resp = client()
        .get(url)
        .send()
        .await
        .with_context(|| format!("GET {url}"))?;
    let status = resp.status().as_u16();
    if status >= 400 {
        return Err(anyhow!("HTTP {status} for {url}"));
    }
    Ok(resp.bytes().await?.to_vec())
}
