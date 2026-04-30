import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadLocalProcessorConfig } from "./config";
import { writeVodEvidencePlaceholder } from "./export-placeholder";
import { findRoflFiles } from "./replay-discovery";
import type { LocalProcessorRunSummary, ReplayFileCandidate } from "./types";

const defaultConfigPath = "local-processor/config/local-processor.example.json";

async function main() {
  const configPath = process.argv[2] ?? defaultConfigPath;
  const config = await loadLocalProcessorConfig(configPath);
  const warnings: string[] = [];
  let replayCandidates: ReplayFileCandidate[] = [];

  if (config.mode !== "manual_safe") {
    warnings.push(`Mode "${config.mode}" is reserved for future use. v0.1 only performs manual-safe discovery.`);
  }

  if (config.replayDirectory) {
    try {
      replayCandidates = await findRoflFiles(resolveFromCwd(config.replayDirectory));
    } catch (error) {
      warnings.push(`Replay discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warnings.push("No replayDirectory configured; skipping .rofl discovery.");
  }

  printReplayCandidates(replayCandidates);
  printManualSafeInstructions();

  const outputDirectory = resolveFromCwd(config.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const summaryPath = path.join(outputDirectory, "run-summary.json");
  const placeholderPath = await writeVodEvidencePlaceholder(config);

  const summary: LocalProcessorRunSummary = {
    createdAt: new Date().toISOString(),
    configPath,
    mode: config.mode,
    region: config.region,
    replayDirectory: config.replayDirectory,
    outputDirectory: config.outputDirectory,
    replayCandidates,
    manualSafeInstructions: [
      "Open the replay manually in the League client.",
      "Future versions will capture frames from the replay window.",
      "This scaffold does not automate the client, parse .rofl files, read memory, inject code, or create overlays.",
    ],
    warnings,
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Run summary written to ${toProjectRelative(summaryPath)}`);
  console.log(`Placeholder VOD evidence written to ${toProjectRelative(placeholderPath)}`);
}

function printReplayCandidates(candidates: ReplayFileCandidate[]) {
  if (candidates.length === 0) {
    console.log("No .rofl files found.");
    return;
  }

  console.log(`Found ${candidates.length} .rofl file(s):`);
  candidates.forEach((candidate) => {
    console.log(`- ${candidate.filename} (${candidate.sizeBytes} bytes, modified ${candidate.modifiedAt})`);
  });
}

function printManualSafeInstructions() {
  console.log("");
  console.log("Manual-safe next step:");
  console.log("Open the replay manually in the League client. Future versions will capture frames from the replay window.");
  console.log("No League Client automation is performed by this scaffold.");
  console.log("");
}

function resolveFromCwd(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function toProjectRelative(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
