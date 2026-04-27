import { useState } from "react";
import { TextField } from "./TextField";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SecretField({ id, label, value, onChange, placeholder }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <TextField
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={revealed ? "text" : "password"}
        className="pr-14"
      />
      <button
        type="button"
        onClick={() => setRevealed(r => !r)}
        aria-label={revealed ? "Hide" : "Show"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-3 hover:text-ink-2 transition-colors"
      >
        {revealed ? "Hide" : "Show"}
      </button>
    </div>
  );
}
