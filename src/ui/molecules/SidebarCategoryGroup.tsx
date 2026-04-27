import { ChevronRight } from "lucide-react";
import type { Tool } from "../../domain/tool";
import { SidebarItem } from "./SidebarItem";

interface Props {
  category: string;
  label: string;
  tools: Tool[];
  expanded: boolean;
  categoryActive: boolean;
  activeToolId: string | null;
  onToggle: () => void;
  onPickTool: (id: string) => void;
}

export function SidebarCategoryGroup({
  label,
  tools,
  expanded,
  categoryActive,
  activeToolId,
  onToggle,
  onPickTool,
}: Props) {
  const chevron = (
    <span
      className={`chevron flex-none w-[18px] flex items-center justify-center text-ink-3 transition-transform duration-150 ease-(--ease-smooth) origin-center group-hover:translate-x-[1px] ${
        expanded ? "rotate-90" : ""
      } ${categoryActive ? "text-accent" : ""}`}
      aria-hidden
    >
      <ChevronRight size={14} strokeWidth={2.25} />
    </span>
  );

  return (
    <li>
      <SidebarItem
        leading={chevron}
        label={label}
        active={categoryActive}
        onClick={onToggle}
      />
      <div
        className={`grid transition-[grid-template-rows] duration-[180ms] ease-(--ease-smooth) ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="list-none flex flex-col gap-[1px] pt-[2px] pb-[2px]">
            {tools.map(t => {
              const active = activeToolId === t.id;
              return (
                <li key={t.id}>
                  <SidebarItem
                    nested
                    active={active}
                    label={t.name}
                    leading={
                      <span
                        className={`flex-none w-[4px] h-[4px] rounded-full transition-colors duration-100 ease-(--ease-smooth) ${
                          active ? "bg-accent" : "bg-ink-4"
                        }`}
                        aria-hidden
                      />
                    }
                    onClick={() => onPickTool(t.id)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}
