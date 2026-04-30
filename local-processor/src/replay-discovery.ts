import { access, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ReplayDirectoryCandidate, ReplayFileCandidate } from "./types";

export async function findRoflFiles(replayDirectory: string): Promise<ReplayFileCandidate[]> {
  if (!replayDirectory) return [];

  const entries = await readdir(replayDirectory, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".rofl"))
      .map(async (entry) => {
        const fullPath = path.join(replayDirectory, entry.name);
        const fileStats = await stat(fullPath);

        return {
          filename: entry.name,
          fullPath,
          sizeBytes: fileStats.size,
          modifiedAt: fileStats.mtime.toISOString(),
        };
      }),
  );

  return candidates.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function getRoflFileCandidate(filePath: string): Promise<ReplayFileCandidate> {
  if (!filePath.toLowerCase().endsWith(".rofl")) {
    throw new Error(`Explicit replay file must have a .rofl extension: ${filePath}`);
  }

  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    throw new Error(`Explicit replay file does not exist: ${filePath}`);
  }

  if (!fileStats.isFile()) {
    throw new Error(`Explicit replay path is not a file: ${filePath}`);
  }

  return {
    filename: path.basename(filePath),
    fullPath: filePath,
    sizeBytes: fileStats.size,
    modifiedAt: fileStats.mtime.toISOString(),
  };
}

export function findDefaultReplayDirectories(): Array<Omit<ReplayDirectoryCandidate, "exists" | "roflCount" | "newestReplayModifiedAt">> {
  if (process.platform !== "win32") return [];

  const home = process.env.USERPROFILE || os.homedir();
  if (!home) return [];

  return uniqueCandidatePaths([
    {
      path: path.join(home, "Documents", "League of Legends", "Replays"),
      source: "windows_documents",
    },
    {
      path: path.join(home, "OneDrive", "Documents", "League of Legends", "Replays"),
      source: "windows_onedrive_documents",
    },
    {
      path: path.join(home, "OneDrive", "Documentos", "League of Legends", "Replays"),
      source: "windows_onedrive_documentos",
    },
    {
      path: path.join(home, "Documents", "League of Legends", "Highlights"),
      source: "windows_documents_highlights",
    },
    {
      path: path.join(home, "Videos", "League of Legends"),
      source: "windows_videos",
    },
  ]);
}

export async function inspectReplayDirectoryCandidate(
  candidate: Omit<ReplayDirectoryCandidate, "exists" | "roflCount" | "newestReplayModifiedAt">,
): Promise<ReplayDirectoryCandidate> {
  const exists = await directoryExists(candidate.path);
  if (!exists) {
    return {
      ...candidate,
      exists: false,
      roflCount: 0,
    };
  }

  const roflFiles = await findRoflFiles(candidate.path);

  return {
    ...candidate,
    exists: true,
    roflCount: roflFiles.length,
    newestReplayModifiedAt: roflFiles[0]?.modifiedAt,
  };
}

async function directoryExists(directoryPath: string) {
  try {
    await access(directoryPath);
    const directoryStats = await stat(directoryPath);
    return directoryStats.isDirectory();
  } catch {
    return false;
  }
}

function uniqueCandidatePaths(
  candidates: Array<Omit<ReplayDirectoryCandidate, "exists" | "roflCount" | "newestReplayModifiedAt">>,
) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const normalized = path.normalize(candidate.path).toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
