import { AppProvider } from "./state/AppContext";
import { RunnerProvider } from "./state/RunnerContext";
import { FilePickerProvider } from "./state/FilePickerContext";
import { OpenerProvider } from "./state/OpenerContext";
import { HistoryProvider } from "./state/HistoryContext";
import { HomePage } from "./ui/pages/HomePage";
import { tauriCommandRunner } from "./infrastructure/tauriCommandRunner";
import { tauriFilePicker } from "./infrastructure/tauriFilePicker";
import { defaultUrlOpener } from "./infrastructure/tauriUrlOpener";
import { tauriHistoryReader } from "./infrastructure/tauriHistoryReader";

export default function App() {
  return (
    <AppProvider>
      <RunnerProvider runner={tauriCommandRunner}>
        <HistoryProvider history={tauriHistoryReader}>
          <FilePickerProvider picker={tauriFilePicker}>
            <OpenerProvider opener={defaultUrlOpener}>
              <HomePage />
            </OpenerProvider>
          </FilePickerProvider>
        </HistoryProvider>
      </RunnerProvider>
    </AppProvider>
  );
}
