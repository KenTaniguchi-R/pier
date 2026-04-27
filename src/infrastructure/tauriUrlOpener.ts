import { openUrl } from "@tauri-apps/plugin-opener";
import type { UrlOpener } from "../application/ports";
import { isSafeUrl } from "../domain/logSegments";

export const tauriUrlOpener: UrlOpener = {
  async open(url) {
    const safe = isSafeUrl(url);
    if (!safe) throw new Error(`Refused to open unsafe URL: ${url}`);
    await openUrl(safe.toString());
  },
};

export const browserUrlOpener: UrlOpener = {
  async open(url) {
    const safe = isSafeUrl(url);
    if (!safe) throw new Error(`Refused to open unsafe URL: ${url}`);
    window.open(safe.toString(), "_blank", "noopener,noreferrer");
  },
};

/** Pick the right adapter — Tauri in desktop, fallback in `npm run dev` browser mode. */
export const defaultUrlOpener: UrlOpener =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? tauriUrlOpener
    : browserUrlOpener;
