import { AppProvider } from "./state/AppContext";
import { RunnerProvider } from "./state/RunnerContext";
import { FilePickerProvider } from "./state/FilePickerContext";
import { OpenerProvider } from "./state/OpenerContext";
import { HistoryProvider } from "./state/HistoryContext";
import { SettingsProvider } from "./state/SettingsContext";
import { FavoritesProvider } from "./state/FavoritesContext";
import { UpdaterProvider } from "./state/UpdaterContext";
import { UpdaterControllerHost } from "./state/UpdaterControllerHost";
import { HomePage } from "./ui/pages/HomePage";
import { UpdateToast } from "./ui/molecules/UpdateToast";
import { tauriCommandRunner } from "./infrastructure/tauriCommandRunner";
import { tauriFilePicker } from "./infrastructure/tauriFilePicker";
import { defaultUrlOpener } from "./infrastructure/tauriUrlOpener";
import { tauriHistoryReader } from "./infrastructure/tauriHistoryReader";
import { defaultSettingsAdapter } from "./infrastructure/tauriSettings";
import { defaultUpdateChecker } from "./infrastructure/tauriUpdateChecker";

export default function App() {
  return (
    <AppProvider>
      <RunnerProvider runner={tauriCommandRunner}>
        <HistoryProvider history={tauriHistoryReader}>
          <FilePickerProvider picker={tauriFilePicker}>
            <OpenerProvider opener={defaultUrlOpener}>
              <SettingsProvider adapter={defaultSettingsAdapter}>
                <FavoritesProvider>
                  <UpdaterProvider checker={defaultUpdateChecker}>
                    <UpdaterControllerHost>
                      <HomePage />
                      <UpdateToast />
                    </UpdaterControllerHost>
                  </UpdaterProvider>
                </FavoritesProvider>
              </SettingsProvider>
            </OpenerProvider>
          </FilePickerProvider>
        </HistoryProvider>
      </RunnerProvider>
    </AppProvider>
  );
}
