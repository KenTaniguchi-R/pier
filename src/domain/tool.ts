export type ParamType =
  | "file" | "folder" | "text" | "url"
  | "select" | "boolean" | "number"
  | "multiselect" | "slider" | "date";

export type ParamValue = string | number | boolean | string[];

interface ParameterBase {
  id: string;
  label: string;
  help?: string;
  optional?: boolean;
  advanced?: boolean;
  default?: ParamValue;
  flag?: string;
  secret?: boolean;
}

export interface FileParam        extends ParameterBase { type: "file"; accepts?: string[] }
export interface FolderParam      extends ParameterBase { type: "folder" }
export interface TextParam        extends ParameterBase { type: "text"; multiline?: boolean; pattern?: string }
export interface UrlParam         extends ParameterBase { type: "url"; pattern?: string }
export interface SelectParam      extends ParameterBase { type: "select"; options: string[] }
export interface BooleanParam     extends ParameterBase { type: "boolean" }
export interface NumberParam      extends ParameterBase { type: "number"; min?: number; max?: number; step?: number }
export interface MultiSelectParam extends ParameterBase { type: "multiselect"; options: string[] }
export interface SliderParam      extends ParameterBase { type: "slider"; min: number; max: number; step?: number }
export interface DateParam        extends ParameterBase { type: "date"; min?: string; max?: string }

export type Parameter =
  | FileParam | FolderParam | TextParam | UrlParam
  | SelectParam | BooleanParam | NumberParam
  | MultiSelectParam | SliderParam | DateParam;

export interface Tool {
  id: string;
  name: string;
  command: string;
  args?: string[];
  parameters?: Parameter[];
  description?: string;
  icon?: string;
  timeout?: number;
  confirm?: boolean;
  shell?: boolean;
  cwd?: string;
  category?: string;
  envFile?: string;
  env?: Record<string, string>;
}

export interface Defaults {
  cwd?: string;
  envFile?: string;
  env?: Record<string, string>;
}

export interface ToolsConfig {
  schemaVersion: "1.0";
  defaults?: Defaults;
  tools: Tool[];
}
