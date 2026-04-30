import { useState } from "react";
import { CopyButton } from "../molecules/CopyButton";

const EXAMPLE = `Add yt-dlp to Pier as a tile that takes a URL.`;
const INSTALL_STEPS = [
  {
    label: "1. Add the marketplace",
    cmd: "/plugin marketplace add KenTaniguchi-R/pier",
  },
  {
    label: "2. Install the skill",
    cmd: "/plugin install pier@pier",
  },
];

const MORE_EXAMPLES = [
  `Make a Pier tile for ffmpeg that converts a .mov to .mp4.`,
  `Remove the screenshot tool.`,
  `Add a bitrate field to the ffmpeg tile, mark it advanced.`,
];

export function SkillGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 px-8 flex flex-col gap-6 max-w-[560px]">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] font-bold tracking-[-0.015em] leading-[1.05] text-ink">
          Don't edit JSON.<br />Just ask Claude.
        </h1>
        <p className="font-body text-[14px] leading-[1.5] text-ink-3">
          Pier ships a Claude Code skill that adds, edits, and removes tools for you.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4">
          Try saying
        </span>
        <div className="flex items-start justify-between gap-3 rounded-[12px] border border-line bg-surface p-4">
          <p className="font-body text-[15px] leading-[1.4] text-ink italic">
            "{EXAMPLE}"
          </p>
          <CopyButton getText={() => EXAMPLE} className="flex-none" />
        </div>
        <p className="font-body text-[12px] leading-[1.5] text-ink-4">
          Saves to <span className="font-mono">~/.pier/tools.json</span>. Pier picks it up in under a second.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4">
          One-time setup
        </span>
        <p className="font-body text-[12px] leading-[1.5] text-ink-4">
          Run these inside Claude Code.
        </p>
        <div className="flex flex-col gap-2">
          {INSTALL_STEPS.map(step => (
            <div key={step.cmd} className="flex flex-col gap-1">
              <span className="font-body text-[11.5px] text-ink-4">{step.label}</span>
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-4 py-3">
                <code className="font-mono text-[13px] text-ink truncate">{step.cmd}</code>
                <CopyButton getText={() => step.cmd} className="flex-none" />
              </div>
            </div>
          ))}
        </div>
        <p className="font-body text-[12px] leading-[1.5] text-ink-4">
          After this, Claude Code knows the skill. Run <span className="font-mono">/reload-plugins</span> if it doesn't appear right away.
        </p>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4 hover:text-ink-2 transition-colors cursor-pointer"
        >
          {open ? "− Fewer examples" : "+ More examples"}
        </button>
        {open && (
          <ul className="list-none mt-3 flex flex-col gap-2">
            {MORE_EXAMPLES.map(ex => (
              <li
                key={ex}
                className="flex items-start justify-between gap-3 rounded-[10px] border border-line bg-surface px-3 py-2"
              >
                <span className="font-body text-[13px] leading-[1.4] text-ink-2 italic">
                  "{ex}"
                </span>
                <CopyButton getText={() => ex} className="flex-none" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
