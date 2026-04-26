export type ParamType = "file" | "folder" | "text" | "url" | "select" | "boolean" | "number";

export type ParamValue = string | number | boolean;

interface ParameterBase {
  id: string;
  label?: string;
  description?: string;
  optional?: boolean;
  default?: ParamValue;
  flag?: string;
}

export interface FileParam     extends ParameterBase { type: "file"; accepts?: string[] }
export interface FolderParam   extends ParameterBase { type: "folder" }
export interface TextParam     extends ParameterBase { type: "text"; multiline?: boolean }
export interface UrlParam      extends ParameterBase { type: "url" }
export interface SelectParam   extends ParameterBase { type: "select"; options: string[] }
export interface BooleanParam  extends ParameterBase { type: "boolean" }
export interface NumberParam   extends ParameterBase { type: "number"; min?: number; max?: number; step?: number }

export type Parameter =
  | FileParam | FolderParam | TextParam | UrlParam
  | SelectParam | BooleanParam | NumberParam;

export interface Tool {
  id: string;
  name: string;
  command: string;
  args?: string[];
  parameters?: Parameter[];
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
