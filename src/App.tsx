import { Button } from "./ui/atoms/Button";
import { TextField } from "./ui/atoms/TextField";
import { Textarea } from "./ui/atoms/Textarea";
import { Badge } from "./ui/atoms/Badge";
import { IconLabel } from "./ui/atoms/IconLabel";

export default function App() {
  return (
    <div style={{ padding: 24, display: "grid", gap: 24 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--text-4)", textTransform: "uppercase" }}>
          // Launcher · 0.1.0
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, marginTop: 4, letterSpacing: "0.08em" }}>
          PIER
        </h1>
        <div style={{ height: 1, background: "var(--rule)", marginTop: 4 }} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button>Default</Button>
        <Button variant="primary">Run</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Kill</Button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <TextField placeholder="Enter URL" />
        <Textarea placeholder="Paste text…" rows={3} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Badge variant="neutral">Idle</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Failed</Badge>
        <Badge variant="info">Running</Badge>
      </div>

      <IconLabel icon="▸" label="Trim Silence" />
    </div>
  );
}
