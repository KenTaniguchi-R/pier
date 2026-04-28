import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FAVORITES_CAP, togglePin } from "../domain/favorites";
import { useSettingsAdapter } from "./SettingsContext";

interface FavoritesController {
  favorites: string[];
  isPinned: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
  atCap: boolean;
  cap: number;
}

const Ctx = createContext<FavoritesController | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const adapter = useSettingsAdapter();
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    adapter
      .load()
      .then((s) => {
        if (!cancelled) setFavorites(s.favorites ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const toggle = useCallback(
    async (id: string) => {
      const prev = favorites;
      const next = togglePin(prev, id);
      if (next === prev) return; // blocked at cap — togglePin returns same ref
      const nextArr = [...next];
      setFavorites(nextArr);
      try {
        const merged = await adapter.patch({ favorites: nextArr });
        setFavorites(merged.favorites ?? nextArr);
      } catch {
        setFavorites(prev);
      }
    },
    [adapter, favorites],
  );

  const value = useMemo<FavoritesController>(
    () => ({
      favorites,
      isPinned: (id: string) => favorites.indexOf(id) !== -1,
      toggle,
      atCap: favorites.length >= FAVORITES_CAP,
      cap: FAVORITES_CAP,
    }),
    [favorites, toggle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites(): FavoritesController {
  const v = useContext(Ctx);
  if (!v) throw new Error("FavoritesProvider missing");
  return v;
}
