fn main() {
    println!("cargo:rerun-if-env-changed=PIER_LIBRARY_PUBKEY");
    if std::env::var("PIER_LIBRARY_PUBKEY").is_err() {
        // Dev fallback — replace with the real pubkey before v0.2 release.
        println!(
            "cargo:rustc-env=PIER_LIBRARY_PUBKEY=DEV_PLACEHOLDER_PUBKEY_REPLACE_BEFORE_RELEASE"
        );
    }
    tauri_build::build()
}
