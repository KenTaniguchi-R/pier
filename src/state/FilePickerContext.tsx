import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { FilePicker } from "../application/ports";

const noopPicker: FilePicker = {
  onDragDrop: () => () => {},
  pick: async () => null,
};

const Ctx = createContext<FilePicker>(noopPicker);

export function FilePickerProvider({ picker, children }: { picker: FilePicker; children: ReactNode }) {
  return <Ctx.Provider value={picker}>{children}</Ctx.Provider>;
}

export function useFilePicker(): FilePicker {
  return useContext(Ctx);
}
