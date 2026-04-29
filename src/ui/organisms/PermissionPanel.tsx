import type { CatalogPermissions } from "../../domain/library";
import {
  NETWORK_LABELS, FILES_LABELS, SYSTEM_LABELS, SENTENCE_TEXT,
} from "./permissionLabels";

interface Props {
  permissions: CatalogPermissions;
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-bg-2 border border-line text-[12px] text-ink-2 font-mono">
      {label}
    </span>
  );
}

export function PermissionPanel({ permissions }: Props) {
  const { network, files, system, sentences } = permissions;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip label={NETWORK_LABELS[network]} />
        <Chip label={FILES_LABELS[files]} />
        <Chip label={SYSTEM_LABELS[system]} />
      </div>
      {sentences.length > 0 && (
        <ul className="list-disc pl-5 text-[13px] text-ink-2 leading-relaxed">
          {sentences.map((s) => (
            <li key={s}>{SENTENCE_TEXT[s]}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
