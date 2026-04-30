import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { ReplayFileCandidate } from "./types";

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
