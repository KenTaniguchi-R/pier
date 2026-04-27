interface Props {
  visible: boolean;
  onClick: () => void;
}

const BASE =
  "absolute right-3 bottom-3 z-10 inline-flex items-center gap-1.5 " +
  "font-body font-semibold text-[11.5px] leading-none px-3 py-2 " +
  "bg-surface text-ink-2 border border-line-hi rounded-pill shadow-pop " +
  "cursor-pointer select-none " +
  "transition-[opacity,transform] duration-150 ease-(--ease-smooth) " +
  "hover:text-ink hover:bg-bg-2";

export function JumpToBottomPill({ visible, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Jump to latest output"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`${BASE} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
      }`}
    >
      <span aria-hidden className="text-[13px] leading-none translate-y-px">↓</span>
      <span>Jump to latest</span>
    </button>
  );
}
