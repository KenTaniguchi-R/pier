import { useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";

interface Props {
  onDrop: (path: string) => void;
  accepts?: string[];
  label?: string;
}

export function DropZone({ onDrop, accepts, label }: Props) {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (path: string | undefined) => {
    if (path) onDrop(path);
  };

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setActive(true); };
  const onDragLeave = () => setActive(false);
  const onDropEvt = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setActive(false);
    const file = e.dataTransfer.files[0] as File & { path?: string };
    handle(file?.path);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] as (File & { path?: string }) | undefined;
    handle(f?.path);
  };

  const acceptHint = accepts?.length ? accepts.join(", ") : null;
  const text = label ?? "Drop a file here";

  return (
    <div
      className={`dropzone${active ? " dropzone-active" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDropEvt}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <span className="dropzone__text">{text}</span>
      <span className="dropzone__sub">
        {active ? "Release to add" : acceptHint ? `or click to choose · ${acceptHint}` : "or click to choose"}
      </span>
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        accept={accepts?.join(",")}
        onChange={onPick}
      />
    </div>
  );
}
