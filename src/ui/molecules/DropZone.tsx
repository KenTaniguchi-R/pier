import { useEffect, useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { useFilePicker } from "../../state/FilePickerContext";

interface Props {
  onDrop: (path: string) => void;
  accepts?: string[];
  directory?: boolean;
  /** Currently staged path or filename. Empty/undefined means no selection. */
  value?: string;
}

const BASE =
  "relative flex flex-col items-center justify-center gap-2.5 min-h-[160px] p-8 " +
  "border-[1.5px] border-dashed rounded-[14px] cursor-pointer select-none text-center " +
  "transition-[border-color,background-color,transform,box-shadow] duration-200 ease-(--ease-smooth)";

const STATE = {
  idle: "border-line-hi bg-surface hover:border-ink-4 hover:bg-surface-2",
  active: "border-accent bg-accent-soft scale-[1.012] shadow-pop",
  staged: "border-success/60 bg-success-soft hover:border-success",
} as const;

export function DropZone({ onDrop, accepts, directory, value }: Props) {
  const picker = useFilePicker();
  const [active, setActive] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const staged = Boolean(value);

  useEffect(() => {
    return picker.onDragDrop(e => {
      if (e.kind === "leave") {
        setActive(false);
        return;
      }
      const inside = isInside(zoneRef.current, e.position);
      if (e.kind === "over") {
        setActive(inside);
      } else if (e.kind === "drop") {
        setActive(false);
        if (inside && e.paths.length > 0) onDrop(e.paths[0]);
      }
    });
  }, [picker, onDrop]);

  const onClick = async () => {
    const path = await picker.pick({ directory, accepts });
    if (path) onDrop(path);
  };

  const state: keyof typeof STATE = active ? "active" : staged ? "staged" : "idle";

  return (
    <div
      ref={zoneRef}
      data-testid="dropzone"
      className={`${BASE} ${STATE[state]}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {staged ? (
        <StagedView value={value!} />
      ) : (
        <PromptView active={active} accepts={accepts} directory={directory} />
      )}
    </div>
  );
}

function PromptView({
  active,
  accepts,
  directory,
}: { active: boolean; accepts?: string[]; directory?: boolean }) {
  const heading = active
    ? directory ? "Release to add folder" : "Release to add"
    : directory ? "Drop a folder here" : "Drop a file here, or click to choose";

  return (
    <>
      <Upload
        size={22}
        strokeWidth={1.6}
        className={`transition-[color,transform] duration-200 ease-(--ease-smooth) ${
          active ? "text-accent -translate-y-0.5" : "text-ink-4"
        }`}
        aria-hidden
      />
      <span
        className={`font-body font-medium text-[13px] leading-[1.4] ${
          active ? "text-accent" : "text-ink-2"
        }`}
      >
        {heading}
      </span>
      {!active && accepts && accepts.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {accepts.map(ext => (
            <span
              key={ext}
              className="font-mono text-[10.5px] leading-none uppercase tracking-[0.06em] text-ink-3 bg-bg-2 border border-line rounded-pill px-2 py-1"
            >
              {ext.replace(/^\./, "")}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function StagedView({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2.5 animate-file-staged">
      <Check size={16} strokeWidth={2} className="text-success shrink-0" aria-hidden />
      <span className="font-mono text-[12.5px] text-ink-2 break-all">{value}</span>
      <span className="font-body text-[11.5px] text-ink-3 ml-1">click to replace</span>
    </div>
  );
}

function isInside(el: HTMLElement | null, pos: { x: number; y: number }): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const x = pos.x / dpr;
  const y = pos.y / dpr;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
