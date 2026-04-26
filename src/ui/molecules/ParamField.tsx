import type { Parameter, ParamValue } from "../../domain/tool";
import { TextField } from "../atoms/TextField";
import { Textarea } from "../atoms/Textarea";
import { Select } from "../atoms/Select";
import { Checkbox } from "../atoms/Checkbox";
import { NumberField } from "../atoms/NumberField";
import { DropZone } from "./DropZone";

interface Props {
  param: Parameter;
  index: number;
  value: ParamValue | undefined;
  onChange: (v: ParamValue) => void;
}

const paramLabel = (p: Parameter) => (p.label ?? p.id.replace(/[-_]+/g, " ")).toUpperCase();

export function ParamField({ param, index, value, onChange }: Props) {
  const counter = String(index + 1).padStart(2, "0");
  const label = paramLabel(param);

  return (
    <div
      className="flex gap-5 animate-tile-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <span className="flex-none w-8 pt-[2px] font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
        {counter}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
            {label}
          </span>
          <span className="flex-1 h-px bg-line" />
          {param.optional && (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
              ◦ optional
            </span>
          )}
        </div>

        <ParamWidget param={param} value={value} onChange={onChange} label={label} />

        {param.description && (
          <span className="font-display italic text-[13px] leading-[1.45] text-ink-3">
            {param.description}
          </span>
        )}
      </div>
    </div>
  );
}

interface WidgetProps {
  param: Parameter;
  value: ParamValue | undefined;
  onChange: (v: ParamValue) => void;
  label: string;
}

function ParamWidget({ param: p, value, onChange, label }: WidgetProps) {
  const str = (value ?? "") as string;

  switch (p.type) {
    case "file":
      return (
        <DropZone
          accepts={p.accepts}
          onDrop={onChange}
          label={str ? str.split("/").pop() : undefined}
        />
      );
    case "folder":
      return <DropZone directory onDrop={onChange} label={str || undefined} />;
    case "text":
      return p.multiline ? (
        <Textarea value={str} onChange={e => onChange(e.target.value)} placeholder="Paste text…" />
      ) : (
        <TextField value={str} onChange={e => onChange(e.target.value)} />
      );
    case "url":
      return (
        <TextField value={str} onChange={e => onChange(e.target.value)} placeholder="https://…" />
      );
    case "select":
      return (
        <Select
          options={p.options}
          value={str || p.options[0]}
          onChange={e => onChange(e.target.value)}
          aria-label={p.id}
        />
      );
    case "boolean":
      return (
        <Checkbox
          label={label}
          checked={value === true}
          onChange={e => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <NumberField
          aria-label={p.id}
          value={value === undefined || value === "" ? "" : (value as number)}
          min={p.min} max={p.max} step={p.step}
          onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
  }
}
