fn main() {
    println!("cargo:rerun-if-env-changed=PIER_LIBRARY_PUBKEY");
    if std::env::var("PIER_LIBRARY_PUBKEY").is_err() {
        // Default to the production minisign pubkey (matches `tauri.conf.json`'s
        // updater pubkey — same key signs both the app bundle and the library
        // catalog). CI may override via the env var if a separate key is ever
        // introduced for the library.
        println!(
            "cargo:rustc-env=PIER_LIBRARY_PUBKEY=RWSlgE5C8ZwbEezbD+2yceWhKF2T3eUZN+aVsb2tgKSgESYfCzUadT6T"
        );
    }
    tauri_build::build()
}
