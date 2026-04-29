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
    let body = if status == 304 {
        String::new()
    } else {
        resp.text().await?
    };
    if status >= 400 {
        return Err(anyhow!("HTTP {status} for {url}"));
    }
    Ok(FetchResult { status, etag, body })
}
