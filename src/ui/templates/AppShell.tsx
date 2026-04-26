import type { ReactNode } from "react";

interface Props {
  header?: ReactNode;
  sidebar?: ReactNode;
  main: ReactNode;
}

export function AppShell({ header, sidebar, main }: Props) {
  return (
    <div className="app-shell">
      {header && <header className="app-shell__head">{header}</header>}
      <div className="app-shell__body">
        {sidebar && <aside className="app-shell__side">{sidebar}</aside>}
        <main className="app-shell__main">{main}</main>
      </div>
    </div>
  );
}
