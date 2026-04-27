import { useEffect, useRef, useState } from "react";
import type { Tool } from "../../domain/tool";
import { ToolRunner } from "./ToolRunner";
import { LogPanel } from "./LogPanel";

interface Props {
  tool: Tool;
  onBack: () => void;
}

const COLLAPSE_AT = 24;

export function ToolDetail({ tool, onBack }: Props) {
  const params = tool.parameters ?? [];
  const inputSummary =
    params.length === 0 ? "no input"
    : params.length === 1 ? `accepts ${params[0].type}`
    : `${params.length} parameters`;
  const eyebrow = tool.category ?? inputSummary;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > COLLAPSE_AT);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [tool.id]);

  // Reset on tool switch.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setCollapsed(false);
  }, [tool.id]);

  return (
    <div className="flex flex-col h-full">
      <header
        className={`flex-none px-10 border-b border-line transition-[padding,box-shadow] duration-200 ease-(--ease-smooth) ${
          collapsed ? "pt-3 pb-3 shadow-1" : "pt-5 pb-6"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to tools"
            className="bg-transparent border-none p-0 font-body font-medium text-[12px] leading-none text-ink-3 cursor-pointer hover:text-ink whitespace-nowrap"
          >
            ← All tools
          </button>

          {/* Inline title appears when collapsed */}
          <div
            className={`flex items-center gap-2 min-w-0 transition-all duration-200 ease-(--ease-smooth) ${
              collapsed ? "opacity-100 translate-x-0 max-w-full" : "opacity-0 -translate-x-1 max-w-0 pointer-events-none"
            }`}
            aria-hidden={!collapsed}
          >
            <span className="text-ink-4 select-none">/</span>
            {tool.icon && (
              <span className="text-[14px] leading-none">{tool.icon}</span>
            )}
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink truncate">
              {tool.name}
            </span>
          </div>
        </div>

        {/* Expanded title block — collapses with grid-rows trick */}
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-(--ease-smooth) ${
            collapsed ? "grid-rows-[0fr] opacity-0 mt-0" : "grid-rows-[1fr] opacity-100 mt-4"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex items-baseline gap-3 mb-2">
              {tool.icon && (
                <span className="text-[22px] leading-none translate-y-[2px]">{tool.icon}</span>
              )}
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
                {eyebrow}
              </span>
            </div>
            <h1 className="font-display text-[34px] font-semibold tracking-[-0.02em] leading-[1.05] text-ink">
              {tool.name}
            </h1>
            {tool.description && (
              <p className="mt-3 font-display italic text-[16px] leading-[1.45] text-ink-2 max-w-[58ch]">
                {tool.description}
              </p>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 flex flex-col min-h-0 px-10 py-6 gap-6 overflow-y-auto">
        <section className="flex-none">
          <ToolRunner tool={tool} />
        </section>

        <div className="flex items-center gap-3 flex-none">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
            Output
          </span>
          <span className="flex-1 h-px bg-line" />
        </div>

        <section className="flex-1 min-h-[260px] flex [&>*]:w-full">
          <LogPanel toolId={tool.id} />
        </section>
      </div>
    </div>
  );
}
