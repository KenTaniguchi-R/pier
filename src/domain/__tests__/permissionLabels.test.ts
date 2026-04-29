import { describe, it, expect } from "vitest";
import {
  NETWORK_LABELS, FILES_LABELS, SYSTEM_LABELS, SENTENCE_TEXT,
} from "../permissionLabels";
import type {
  NetworkAccess, FilesAccess, SystemAccess, PermissionSentence,
} from "../library";

const allNetwork: NetworkAccess[] = ["none", "localhost", "internet"];
const allFiles: FilesAccess[] = ["none", "read-only", "writes"];
const allSystem: SystemAccess[] = ["none", "runs-commands", "kills-processes"];
const allSentences: PermissionSentence[] = [
  "runs-locally", "no-network", "may-terminate-processes",
  "reads-files-you-point-it-at", "writes-files-you-point-it-at",
  "reaches-out-to-the-internet",
];

describe("permissionLabels", () => {
  it("has a label for every NetworkAccess value", () => {
    for (const v of allNetwork) expect(NETWORK_LABELS[v]).toBeTruthy();
  });
  it("has a label for every FilesAccess value", () => {
    for (const v of allFiles) expect(FILES_LABELS[v]).toBeTruthy();
  });
  it("has a label for every SystemAccess value", () => {
    for (const v of allSystem) expect(SYSTEM_LABELS[v]).toBeTruthy();
  });
  it("has copy for every PermissionSentence", () => {
    for (const v of allSentences) expect(SENTENCE_TEXT[v]).toBeTruthy();
  });
});
