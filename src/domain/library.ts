import type { Parameter } from "./tool";

export interface PlatformAsset {
  url: string;
  sha256: string;
}

export type NetworkAccess = "none" | "localhost" | "internet";
export type FilesAccess = "none" | "read-only" | "writes";
export type SystemAccess = "none" | "runs-commands" | "kills-processes";

export type PermissionSentence =
  | "runs-locally"
  | "no-network"
  | "may-terminate-processes"
  | "reads-files-you-point-it-at"
  | "writes-files-you-point-it-at"
  | "reaches-out-to-the-internet";

export type Audience = "developer";

export interface CatalogPermissions {
  network: NetworkAccess;
  files: FilesAccess;
  system: SystemAccess;
  sentences: PermissionSentence[];
}

export interface CatalogTool {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  /** Same shape as Tool["parameters"] */
  params?: Parameter[];
  permissions: CatalogPermissions;
  /** One-line outcome ("Free up a stuck port"). Optional during migration. */
  outcome?: string;
  /** Audience tags. `[]` or absent means "everyone". */
  audience?: Audience[];
  /** Optional example invocations rendered as code snippets on the detail page. */
  examples?: string[];
  /** Curation flag for the Featured row. */
  featured?: boolean;
  /** ISO date (YYYY-MM-DD). Drives "New this week" eligibility. */
  addedAt?: string;
  /** "darwin-arm64" etc. Absent for shell tools. */
  platforms?: Record<string, PlatformAsset>;
  script?: string;
  minPierVersion?: string;
  deprecated?: boolean;
}

export interface Catalog {
  catalogSchemaVersion: 1;
  publishedAt: string;
  tools: CatalogTool[];
}
