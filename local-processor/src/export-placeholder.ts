import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LocalProcessorConfig, ReplayInputManifest, VodEvidenceExportPlaceholder } from "./types";

export type VodEvidencePlaceholderWriteResult = {
  outputPath: string;
  generatedFromManifest: boolean;
};

export async function writeVodEvidencePlaceholder(
  config: LocalProcessorConfig,
  replayInputManifestPath?: string,
): Promise<VodEvidencePlaceholderWriteResult> {
  const outputDirectory = resolveFromCwd(config.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const outputPath = path.join(outputDirectory, "vod-evidence-placeholder.json");

  const manifest = replayInputManifestPath ? await readReplayInputManifest(replayInputManifestPath) : undefined;
  const placeholder = manifest
    ? createReplayLinkedStub(manifest)
    : createNoReplaySelectedStub(config);

  await writeFile(outputPath, `${JSON.stringify(placeholder, null, 2)}\n`, "utf8");

  if (manifest) {
    console.log("VOD evidence stub generated from replay input manifest.");
  } else {
    console.log("No replay input manifest found; wrote a safe VOD evidence stub with no replay selected.");
  }

  return {
    outputPath,
    generatedFromManifest: Boolean(manifest),
  };
}

async function readReplayInputManifest(manifestPath: string): Promise<ReplayInputManifest | undefined> {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    return isReplayInputManifest(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function createReplayLinkedStub(manifest: ReplayInputManifest): VodEvidenceExportPlaceholder {
  return {
    schemaVersion: "vod-evidence.stub.v0.1",
    createdAt: new Date().toISOString(),
    source: {
      type: "rofl",
      mode: manifest.mode,
      region: manifest.region,
      replay: manifest.selectedReplay,
      matchIdentity: manifest.matchIdentity,
      filenameHint: manifest.filenameHint,
      apiMatchContext: manifest.apiMatchContext,
      matchContextConsistency: manifest.matchContextConsistency,
    },
    analysisStatus: {
      stage: "replay_selected_no_visual_analysis",
      roflParsingEnabled: false,
      frameCaptureEnabled: false,
      minimapAnalysisEnabled: false,
      officialApiReplacement: false,
    },
    evidence: {
      objectiveWindows: [],
      minimapObservations: [],
      spatialContext: [],
      confidenceNotes: [
        "Replay selected only. No ROFL parsing, frame capture, minimap analysis, or spatial evidence has been produced.",
        "This stub must not replace Riot API facts or affect scoring.",
      ],
    },
    safety: createSafetyBlock(),
  };
}

function createNoReplaySelectedStub(config: LocalProcessorConfig): VodEvidenceExportPlaceholder {
  return {
    schemaVersion: "vod-evidence.stub.v0.1",
    createdAt: new Date().toISOString(),
    source: {
      type: "none",
      mode: config.mode,
      region: config.region,
      matchIdentity: {
        matchId: null,
        gameId: null,
        resolutionStatus: "unresolved",
        source: {
          type: "none",
          authority: null,
          providedBy: null,
          verifiedByLocalProcessor: false,
        },
        notes: [
          "The Local Processor does not parse .rofl metadata yet.",
          "Match identity is not guessed.",
          "Future versions may link replay metadata to Riot API match data.",
        ],
      },
    },
    analysisStatus: {
      stage: "no_replay_selected",
      roflParsingEnabled: false,
      frameCaptureEnabled: false,
      minimapAnalysisEnabled: false,
      officialApiReplacement: false,
    },
    evidence: {
      objectiveWindows: [],
      minimapObservations: [],
      spatialContext: [],
      confidenceNotes: [
        "No replay input manifest was available.",
        "No replay was selected, opened, parsed, captured, or analyzed.",
      ],
    },
    safety: createSafetyBlock(),
  };
}

function createSafetyBlock() {
  return {
    doesNotLaunchLeague: true,
    doesNotAutomateClient: true,
    doesNotReadMemory: true,
    doesNotInjectCode: true,
    doesNotCreateOverlay: true,
    doesNotBypassAnticheat: true,
  } as const;
}

function isReplayInputManifest(value: unknown): value is ReplayInputManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "schemaVersion" in value &&
    value.schemaVersion === "replay-input-manifest.v0.1" &&
    "selectedReplay" in value
  );
}

function resolveFromCwd(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}
