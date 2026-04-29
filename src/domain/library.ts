export interface PlatformAsset {
  url: string;
  sha256: string;
}

export interface CatalogTool {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  /** Same shape as Tool["parameters"] */
  params?: import("./tool").Parameter[];
  permissions: {
    network: boolean;
    fsRead: string[];
    fsWrite: string[];
  };
  /** Map keyed by `<os>-<arch>`, e.g. "darwin-arm64". Absent for shell tools. */
  platforms?: Record<string, PlatformAsset>;
  /** For pure-shell tools — inline script content. */
  script?: string;
  minPierVersion?: string;
  deprecated?: boolean;
}

export interface Catalog {
  catalogSchemaVersion: 1;
  publishedAt: string;
  tools: CatalogTool[];
}
