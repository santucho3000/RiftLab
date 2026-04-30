import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LocalProcessorConfig, VodEvidenceExportPlaceholder } from "./types";

export async function writeVodEvidencePlaceholder(config: LocalProcessorConfig): Promise<string> {
  const outputDirectory = resolveFromCwd(config.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const outputPath = path.join(outputDirectory, "vod-evidence-placeholder.json");
  const placeholder: VodEvidenceExportPlaceholder = {
    schemaVersion: "vod-evidence.v0.1",
    source: {
      type: "manual_annotation",
      toolName: "riftlab-local-processor-placeholder",
      toolVersion: "0.1.0",
      modelVersion: "none",
      inputKind: "annotation",
      inputHash: "sha256:placeholder-no-real-evidence",
      createdAt: new Date().toISOString(),
    },
    match: {
      region: config.region,
      timeAlignment: {
        method: "unknown",
        videoStartOffsetMs: 0,
        confidence: 0,
      },
    },
    coordinateSystem: {
      type: "summoners_rift_normalized",
      xRange: [0, 1],
      yRange: [0, 1],
      origin: "blue_bottom_left",
      notes: "Placeholder only. No replay frames or minimap evidence have been processed.",
    },
    participants: [],
    championTracks: [],
    wardSamples: [],
    objectivePresenceSignals: [],
    rotationSignals: [],
    teamSpacingSignals: [],
    zoneControlSignals: [],
    fightSetupSignals: [],
    waveStateSignals: [],
    ocrSignals: [],
    quality: {
      overallConfidence: 0,
      unsupportedReasons: ["local_processor_placeholder_only"],
      warnings: [
        "This is not real VOD evidence.",
        "No replay was opened, parsed, captured, or analyzed.",
        "Do not use this file for scoring.",
      ],
    },
  };

  await writeFile(outputPath, `${JSON.stringify(placeholder, null, 2)}\n`, "utf8");
  return outputPath;
}

function resolveFromCwd(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}
