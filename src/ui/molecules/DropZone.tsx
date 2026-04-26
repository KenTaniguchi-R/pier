import { useEffect, useRef, useState } from "react";
import { useFilePicker } from "../../state/FilePickerContext";

interface Props {
  onDrop: (path: string) => void;
  accepts?: string[];
  directory?: boolean;
  label?: string;
}

const BASE =
  "flex flex-col items-center justify-center gap-1 min-h-[110px] p-4 " +
  "border-[1.5px] border-dashed rounded-[10px] cursor-pointer select-none text-center " +
  "transition-[border-color,background-color] duration-200 ease-(--ease-smooth)";

const IDLE = "border-line-hi bg-bg-2 hover:border-ink-4 hover:bg-surface-2";
const ACTIVE = "border-accent bg-accent-soft";

export function DropZone({ onDrop, accepts, directory, label }: Props) {
  const picker = useFilePicker();
  const [active, setActive] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isInside = (pos: { x: number; y: number }) => {
      const el = zoneRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = pos.x / dpr;
      const y = pos.y / dpr;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    return picker.onDragDrop(e => {
      if (e.kind === "over") {
        setActive(isInside(e.position));
      } else if (e.kind === "leave") {
        setActive(false);
      } else if (e.kind === "drop") {
        setActive(false);
        if (isInside(e.position) && e.paths.length > 0) {
          onDrop(e.paths[0]);
        }
      }
    });
  }, [picker, onDrop]);

  const onClick = async () => {
    const path = await picker.pick({ directory, accepts });
    if (path) onDrop(path);
  };

  const acceptHint = accepts?.length ? accepts.join(", ") : null;
  const text = label ?? (directory ? "Drop a folder here" : "Drop a file here");

  return (
    <div
      ref={zoneRef}
      data-testid="dropzone"
      className={`${BASE} ${active ? ACTIVE : IDLE}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <span
        className={`font-body font-medium text-[13px] leading-[1.4] ${active ? "text-accent" : "text-ink-2"}`}
      >
        {text}
      </span>
      <span className="font-body font-normal text-[12px] leading-[1.4] text-ink-3">
        {active ? "Release to add" : acceptHint ? `or click to choose · ${acceptHint}` : "or click to choose"}
      </span>
    </div>
  );
}
