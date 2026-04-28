import type { Parameter, ParamValue } from "../../domain/tool";
import { errorMessage, type ValidationError } from "../../domain/paramValidation";
import { TextField } from "../atoms/TextField";
import { SecretField } from "../atoms/SecretField";
import { Textarea } from "../atoms/Textarea";
import { Select } from "../atoms/Select";
import { Checkbox } from "../atoms/Checkbox";
import { NumberField } from "../atoms/NumberField";
import { Slider } from "../atoms/Slider";
import { DateField } from "../atoms/DateField";
import { MultiSelect } from "../atoms/MultiSelect";
import { DropZone } from "./DropZone";

interface Props {
  param: Parameter;
  index: number;
  value: ParamValue | undefined;
  error?: ValidationError;
  onChange: (v: ParamValue) => void;
}

export function ParamField({ param, index, value, error, onChange }: Props) {
  // Suppress the "required" pill until the user has interacted (i.e. the field
  // is non-empty / has been touched). Other errors surface immediately.
  const showError = error && error.kind !== "required";

  return (
    <div
      className="flex flex-col gap-2 animate-tile-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-[15px] font-medium leading-tight text-ink">
          {param.label}
        </span>
        <span className="flex-1 h-px bg-line" />
        {param.optional && !param.advanced && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
            ◦ optional
          </span>
        )}
      </div>

      <ParamWidget param={param} value={value} onChange={onChange} label={param.label} />

      {showError ? (
        <span
          role="alert"
          className="font-display text-[13px] leading-[1.45] text-danger"
        >
          {errorMessage(param, error!)}
        </span>
      ) : (
        param.help && (
          <span className="font-display text-[13px] leading-[1.45] text-ink-3">
            {param.help}
          </span>
        )
      )}
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
          value={str ? str.split("/").pop() : undefined}
        />
      );
    case "folder":
      return <DropZone directory onDrop={onChange} value={str || undefined} />;
    case "text":
      if (p.secret) {
        return (
          <SecretField
            id={p.id}
            label={label}
            value={str}
            onChange={v => onChange(v)}
          />
        );
      }
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
    case "slider":
      return (
        <Slider
          aria-label={p.id}
          min={p.min} max={p.max} step={p.step}
          value={typeof value === "number" ? value : p.min}
          onChange={e => onChange(Number(e.target.value))}
        />
      );
    case "date":
      return (
        <DateField
          aria-label={p.id}
          value={str}
          min={p.min} max={p.max}
          onChange={e => onChange(e.target.value)}
        />
      );
    case "multiselect":
      return (
        <MultiSelect
          aria-label={p.id}
          options={p.options}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
  }
}
