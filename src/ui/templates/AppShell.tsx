import type { ReactNode } from "react";

interface Props {
  header?: ReactNode;
  sidebar?: ReactNode;
  main: ReactNode;
}

export function AppShell({ header, sidebar, main }: Props) {
  return (
    <div className="flex flex-col h-full w-full bg-bg">
      {header && (
        <header className="flex-none flex items-center px-6 py-4 border-b border-line bg-bg">
          {header}
        </header>
      )}
      <div className="flex-1 flex min-h-0">
        {sidebar && (
          <aside className="flex-none w-[260px] border-r border-line overflow-hidden bg-bg-2 flex">
            {sidebar}
          </aside>
        )}
        <main className="flex-1 overflow-y-auto bg-bg min-w-0">{main}</main>
      </div>
    </div>
  );
}
