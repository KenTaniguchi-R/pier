export type InputType = "file" | "text" | "folder" | "url" | "none";

export interface Tool {
  id: string;
  name: string;
  command: string;
  args?: string[];
  inputType: InputType;
  accepts?: string[];
  description?: string;
  icon?: string;
  timeout?: number;
  outputPath?: string;
  confirm?: boolean;
  shell?: boolean;
  cwd?: string;
  category?: string;
}

export interface ToolsConfig {
  schemaVersion: "1.0";
  tools: Tool[];
}
