import type { ConfigLoader } from "./ports";
import { parseToolsConfig, type ParseResult } from "../domain/validation";
import type { ToolsConfig } from "../domain/tool";

export async function loadConfig(loader: ConfigLoader): Promise<ParseResult<ToolsConfig>> {
  const { raw } = await loader.load();
  return parseToolsConfig(raw);
}
