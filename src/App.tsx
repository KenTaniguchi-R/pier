import { AppProvider } from "./state/AppContext";
import { RunnerProvider } from "./state/RunnerContext";
import { HomePage } from "./ui/pages/HomePage";
import { tauriCommandRunner } from "./infrastructure/tauriCommandRunner";

export default function App() {
  return (
    <AppProvider>
      <RunnerProvider runner={tauriCommandRunner}>
        <HomePage />
      </RunnerProvider>
    </AppProvider>
  );
}
