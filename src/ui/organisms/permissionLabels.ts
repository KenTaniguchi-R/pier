import type {
  NetworkAccess, FilesAccess, SystemAccess, PermissionSentence,
} from "../../domain/library";

export const NETWORK_LABELS: Record<NetworkAccess, string> = {
  "none": "No network",
  "localhost": "Localhost only",
  "internet": "Internet",
};

export const FILES_LABELS: Record<FilesAccess, string> = {
  "none": "No file access",
  "read-only": "Reads files",
  "writes": "Writes files",
};

export const SYSTEM_LABELS: Record<SystemAccess, string> = {
  "none": "No system commands",
  "runs-commands": "Runs commands",
  "kills-processes": "Kills processes",
};

export const SENTENCE_TEXT: Record<PermissionSentence, string> = {
  "runs-locally": "Runs locally on your machine.",
  "no-network": "Does not access the network.",
  "may-terminate-processes": "May terminate processes you own.",
  "reads-files-you-point-it-at": "Reads files you point it at.",
  "writes-files-you-point-it-at": "Writes files you point it at.",
  "reaches-out-to-the-internet": "Reaches out to the internet.",
};
