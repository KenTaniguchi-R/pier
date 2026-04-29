import { useApp } from "../../state/AppContext";

export function AddTile() {
  const { dispatch } = useApp();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "LIBRARY_SHEET_OPEN" })}
      aria-label="Open library"
      className="
        aspect-square rounded-2 grid place-items-center
        border border-dashed border-line-hi
        text-ink-4 text-3xl font-light
        transition-[border-color,color,background-color] duration-150 ease-(--ease-smooth)
        hover:border-solid hover:border-ink-4 hover:text-ink-2 hover:bg-surface
        focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]
        animate-tile-in
      "
    >
      +
    </button>
  );
}
