import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadLocalProcessorConfig } from "./config";
import { writeVodEvidencePlaceholder } from "./export-placeholder";
import {
  findDefaultReplayDirectories,
  findRoflFiles,
  getRoflFileCandidate,
  inspectReplayDirectoryCandidate,
} from "./replay-discovery";
import type {
  LocalProcessorRunSummary,
  ReplayInputManifest,
  ReplayDirectoryCandidate,
  ReplayFileCandidate,
  ApiMatchContextFile,
  ApiMatchContextManifestMetadata,
  MatchIdentity,
  MatchContextConsistency,
  ReplayFilenameHint,
  SelectedReplayFile,
} from "./types";

const defaultConfigPath = "local-processor/config/local-processor.example.json";

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const configPath = args.configPath ?? defaultConfigPath;
  const config = await loadLocalProcessorConfig(configPath);
  const warnings: string[] = [];
  const apiMatchContext = args.apiMatchContextPath
    ? await loadApiMatchContext(resolveFromCwd(args.apiMatchContextPath))
    : undefined;

  if (apiMatchContext && (args.matchId || args.gameId)) {
    warnings.push("CLI match identity args were ignored because api-match-context has priority.");
  }

  const matchIdentity = createMatchIdentity(args.matchId, args.gameId, apiMatchContext?.context);
  let replayCandidates: ReplayFileCandidate[] = [];
  let selectedReplayDirectory: string | undefined;
  let selectedReplay: SelectedReplayFile | undefined;
  let filenameHint = createUnavailableFilenameHint();

  if (config.mode !== "manual_safe") {
    warnings.push(`Mode "${config.mode}" is reserved for future use. v0.3 only performs manual-safe discovery.`);
  }

  const configuredReplayDirectory = config.replayDirectory
    ? resolveFromCwd(config.replayDirectory)
    : "";
  const discoveredReplayDirectories = args.replayPath ? [] : await discoverReplayDirectories(configuredReplayDirectory);

  if (args.replayPath) {
    const explicitReplayPath = resolveFromCwd(args.replayPath);
    const replay = await getRoflFileCandidate(explicitReplayPath);
    selectedReplayDirectory = path.dirname(replay.fullPath);
    replayCandidates = [replay];
    selectedReplay = toSelectedReplayFile(replay, "explicit");
    filenameHint = getReplayFilenameHint(replay.filename);
    console.log(`Selected replay file from --replay: ${replay.fullPath}`);
  } else {
    if (config.replayDirectory) {
      selectedReplayDirectory = configuredReplayDirectory;
    } else {
      selectedReplayDirectory = discoveredReplayDirectories.find((candidate) => candidate.exists && candidate.roflCount > 0)?.path;
    }

    printDiscoveryDiagnostics(configuredReplayDirectory, discoveredReplayDirectories, selectedReplayDirectory);

    if (selectedReplayDirectory) {
      try {
        replayCandidates = await findRoflFiles(selectedReplayDirectory);
        selectedReplay = replayCandidates[0] ? toSelectedReplayFile(replayCandidates[0], "auto-discovered") : undefined;
        filenameHint = selectedReplay ? getReplayFilenameHint(selectedReplay.replayFileName) : createUnavailableFilenameHint();
      } catch (error) {
        warnings.push(`Replay discovery failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      warnings.push(
        "No replay directory found automatically. Set replayDirectory in local-processor/config/local-processor.example.json or pass a custom config.",
      );
    }
  }

  printReplayCandidates(replayCandidates);
  printSelectedReplay(selectedReplay);
  printFilenameHint(filenameHint);
  printMatchIdentityStatus(matchIdentity);
  const matchContextConsistency = getMatchContextConsistency(apiMatchContext?.context, filenameHint);
  printMatchContextConsistency(matchContextConsistency);
  if (matchContextConsistency.status === "mismatch") {
    warnings.push("API match context does not match filename hint. Check that the selected replay belongs to the provided match context.");
  }
  printManualSafeInstructions();

  const outputDirectory = resolveFromCwd(config.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const replayInputManifestPath = selectedReplay
    ? await writeReplayInputManifest(
        outputDirectory,
        config.mode,
        config.region,
        selectedReplay,
        matchIdentity,
        filenameHint,
        apiMatchContext?.manifestMetadata,
        matchContextConsistency,
      )
    : undefined;

  if (!selectedReplay) {
    console.log("No selected replay; replay input manifest was not written.");
  }

  const summaryPath = path.join(outputDirectory, "run-summary.json");
  const placeholder = await writeVodEvidencePlaceholder(config, replayInputManifestPath);

  const summary: LocalProcessorRunSummary = {
    createdAt: new Date().toISOString(),
    configPath,
    mode: config.mode,
    region: config.region,
    configuredReplayDirectory,
    discoveredReplayDirectories,
    selectedReplayDirectory,
    selectedReplay,
    matchIdentity,
    matchIdentityResolutionStatus: matchIdentity.resolutionStatus,
    matchIdentitySourceType: matchIdentity.source.type,
    matchIdentityAuthority: matchIdentity.source.authority,
    matchIdentityProvidedBy: matchIdentity.source.providedBy,
    matchIdentityVerifiedByLocalProcessor: matchIdentity.source.verifiedByLocalProcessor,
    apiMatchContextProvided: Boolean(apiMatchContext),
    apiMatchContextPath: apiMatchContext?.path,
    apiMatchContextSchemaVersion: apiMatchContext?.context.schemaVersion,
    apiMatchContextPlayerContextAvailable: Boolean(apiMatchContext?.context.playerContext),
    matchContextConsistency,
    matchContextConsistencyStatus: matchContextConsistency.status,
    matchContextConsistencySeverity: matchContextConsistency.severity,
    filenameHint,
    filenameHintAvailable: filenameHint.available,
    filenameHintStatus: filenameHint.status,
    filenameHintPossibleMatchId: filenameHint.possibleMatchId,
    replayInputManifestPath: replayInputManifestPath ? toProjectRelative(replayInputManifestPath) : undefined,
    vodEvidencePlaceholderPath: toProjectRelative(placeholder.outputPath),
    vodEvidencePlaceholderGeneratedFromManifest: placeholder.generatedFromManifest,
    replayCount: replayCandidates.length,
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
  console.log(`Placeholder VOD evidence written to ${toProjectRelative(placeholder.outputPath)}`);
}

async function writeReplayInputManifest(
  outputDirectory: string,
  mode: "manual_safe" | "semi_auto_future" | "server_future",
  region: string,
  selectedReplay: SelectedReplayFile,
  matchIdentity: MatchIdentity,
  filenameHint: ReplayFilenameHint,
  apiMatchContext: ApiMatchContextManifestMetadata | undefined,
  matchContextConsistency: MatchContextConsistency,
) {
  const outputPath = path.join(outputDirectory, "replay-input-manifest.json");
  const manifest: ReplayInputManifest = {
    schemaVersion: "replay-input-manifest.v0.1",
    createdAt: new Date().toISOString(),
    mode,
    region,
    selectedReplay,
    matchIdentity,
    filenameHint,
    apiMatchContext,
    matchContextConsistency,
    processingPlan: {
      currentStage: "replay_selected",
      nextStage: "manual_replay_review_or_future_frame_capture",
      roflParsingEnabled: false,
      clientAutomationEnabled: false,
      liveGameAnalysisEnabled: false,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
    },
  };

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Replay input manifest written to ${toProjectRelative(outputPath)}`);
  return outputPath;
}

function getMatchContextConsistency(
  apiMatchContext: ApiMatchContextFile | undefined,
  filenameHint: ReplayFilenameHint,
): MatchContextConsistency {
  if (!apiMatchContext || !filenameHint.available) {
    return {
      checked: false,
      status: "not_applicable",
      apiMatchId: apiMatchContext?.matchIdentity.matchId ?? null,
      filenameHintPossibleMatchId: filenameHint.possibleMatchId,
      severity: "none",
      notes: ["Consistency check requires both API match context and an available filename hint."],
    };
  }

  const apiMatchId = apiMatchContext.matchIdentity.matchId;
  const filenameHintPossibleMatchId = filenameHint.possibleMatchId;
  const isMatch = apiMatchId === filenameHintPossibleMatchId;

  return {
    checked: true,
    status: isMatch ? "match" : "mismatch",
    apiMatchId,
    filenameHintPossibleMatchId,
    severity: isMatch ? "info" : "warning",
    notes: isMatch
      ? [
          "Filename hint is consistent with the provided API match context.",
          "This is not Riot API verification by the Local Processor.",
          "Riot API remains the source of truth for official match facts.",
        ]
      : [
          "Replay filename hint does not match the provided API match context.",
          "This may indicate the selected replay and API context refer to different matches.",
          "This is a local consistency check only and does not call Riot API.",
        ],
  };
}

function getReplayFilenameHint(filename: string): ReplayFilenameHint {
  const match = /^([A-Z0-9]+)-([0-9]+)\.rofl$/i.exec(filename);

  if (!match) {
    return createUnavailableFilenameHint();
  }

  const platformId = match[1].toUpperCase();
  const gameId = match[2];

  return {
    available: true,
    platformId,
    gameId,
    possibleMatchId: `${platformId}_${gameId}`,
    confidence: "low",
    status: "filename_hint_only",
    notes: [
      "This was inferred from the replay filename only.",
      "This is not verified against Riot API.",
      "This must not replace explicit match identity or official Riot API facts.",
    ],
  };
}

function createUnavailableFilenameHint(): ReplayFilenameHint {
  return {
    available: false,
    platformId: null,
    gameId: null,
    possibleMatchId: null,
    confidence: "none",
    status: "unavailable",
    notes: ["Replay filename did not match the expected <platformId>-<gameId>.rofl pattern."],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCliArgs(args: string[]) {
  let configPath: string | undefined;
  let replayPath: string | undefined;
  let matchId: string | undefined;
  let gameId: string | undefined;
  let apiMatchContextPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--replay") {
      replayPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--match-id") {
      matchId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--game-id") {
      gameId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--api-match-context") {
      apiMatchContextPath = args[index + 1];
      index += 1;
      continue;
    }

    if (!configPath) {
      configPath = arg;
    }
  }

  if (args.includes("--replay") && !replayPath) {
    throw new Error("Missing value for --replay. Usage: --replay <path-to-rofl>");
  }

  if (args.includes("--match-id") && !matchId) {
    throw new Error("Missing value for --match-id. Usage: --match-id <riot-match-id>");
  }

  if (args.includes("--game-id") && !gameId) {
    throw new Error("Missing value for --game-id. Usage: --game-id <numeric-game-id>");
  }

  if (args.includes("--api-match-context") && !apiMatchContextPath) {
    throw new Error("Missing value for --api-match-context. Usage: --api-match-context <path-to-json>");
  }

  return { configPath, replayPath, matchId, gameId, apiMatchContextPath };
}

async function loadApiMatchContext(contextPath: string): Promise<{
  path: string;
  context: ApiMatchContextFile;
  manifestMetadata: ApiMatchContextManifestMetadata;
}> {
  let fileStats;
  try {
    fileStats = await stat(contextPath);
  } catch {
    throw new Error(`API match context file does not exist: ${contextPath}`);
  }

  if (!fileStats.isFile()) {
    throw new Error(`API match context path is not a file: ${contextPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(contextPath, "utf8")) as unknown;
  } catch {
    throw new Error(`API match context file is not valid JSON: ${contextPath}`);
  }

  if (!isApiMatchContextFile(parsed)) {
    throw new Error('API match context schemaVersion must equal "api-match-context.v0.1" and required fields must exist.');
  }

  return {
    path: contextPath,
    context: parsed,
    manifestMetadata: {
      provided: true,
      path: contextPath,
      schemaVersion: parsed.schemaVersion,
      source: parsed.source,
      playerContext: parsed.playerContext,
    },
  };
}

function createMatchIdentity(
  matchId: string | undefined,
  gameId: string | undefined,
  apiMatchContext: ApiMatchContextFile | undefined,
): MatchIdentity {
  if (apiMatchContext) {
    return {
      matchId: apiMatchContext.matchIdentity.matchId,
      gameId: apiMatchContext.matchIdentity.gameId,
      resolutionStatus: "provided_explicitly",
      source: {
        type: "external_api_context",
        authority: "riot_api",
        providedBy: "api_match_context_file",
        verifiedByLocalProcessor: false,
      },
      notes: [
        "Match identity was provided by an API match context file.",
        "The Local Processor does not call Riot API or verify this identity yet.",
        "Riot API remains the source of truth for official match facts.",
      ],
    };
  }

  const hasIdentity = Boolean(matchId || gameId);

  return {
    matchId: matchId ?? null,
    gameId: gameId ?? null,
    resolutionStatus: hasIdentity ? "provided_explicitly" : "unresolved",
    source: hasIdentity
      ? {
          type: "external_api_context",
          authority: "riot_api",
          providedBy: "cli",
          verifiedByLocalProcessor: false,
        }
      : {
          type: "none",
          authority: null,
          providedBy: null,
          verifiedByLocalProcessor: false,
        },
    notes: hasIdentity
      ? [
          "Match identity was provided explicitly to the Local Processor.",
          "The Local Processor does not call Riot API or verify this identity yet.",
          "Riot API remains the source of truth for official match facts.",
        ]
      : [
          "The Local Processor does not parse .rofl metadata yet.",
          "Match identity is not guessed.",
          "Future versions may link replay metadata to Riot API match data.",
        ],
  };
}

function isApiMatchContextFile(value: unknown): value is ApiMatchContextFile {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== "api-match-context.v0.1") return false;
  if (!isRecord(value.source) || value.source.type !== "riot_api") return false;
  if (!isRecord(value.matchIdentity)) return false;
  if (typeof value.matchIdentity.matchId !== "string") return false;
  if (typeof value.matchIdentity.gameId !== "string") return false;
  if (typeof value.matchIdentity.platformId !== "string") return false;
  if (!isRecord(value.playerContext)) return false;
  if (!isRecord(value.playerContext.riotId)) return false;
  return true;
}

function toSelectedReplayFile(
  candidate: ReplayFileCandidate,
  selectionMode: "explicit" | "auto-discovered",
): SelectedReplayFile {
  return {
    replayPath: candidate.fullPath,
    replayFileName: candidate.filename,
    replaySizeBytes: candidate.sizeBytes,
    replayModifiedAt: candidate.modifiedAt,
    selectionMode,
  };
}

async function discoverReplayDirectories(configuredReplayDirectory: string): Promise<ReplayDirectoryCandidate[]> {
  const candidates = [
    ...(configuredReplayDirectory
      ? [
          {
            path: configuredReplayDirectory,
            source: "config" as const,
          },
        ]
      : []),
    ...findDefaultReplayDirectories(),
  ];

  const inspected = await Promise.all(candidates.map((candidate) => inspectReplayDirectoryCandidate(candidate)));
  const seen = new Set<string>();

  return inspected.filter((candidate) => {
    const normalized = path.normalize(candidate.path).toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function printDiscoveryDiagnostics(
  configuredReplayDirectory: string,
  discoveredReplayDirectories: ReplayDirectoryCandidate[],
  selectedReplayDirectory: string | undefined,
) {
  console.log(`Configured replayDirectory: ${configuredReplayDirectory || "(empty)"}`);
  console.log("");
  console.log("Auto-discovered replay directory candidates:");

  if (discoveredReplayDirectories.length === 0) {
    console.log("- No conservative default candidates for this OS.");
  } else {
    discoveredReplayDirectories.forEach((candidate) => {
      const newest = candidate.newestReplayModifiedAt ? `, newest ${candidate.newestReplayModifiedAt}` : "";
      console.log(
        `- ${candidate.path} [${candidate.source}] exists=${candidate.exists}, roflCount=${candidate.roflCount}${newest}`,
      );
    });
  }

  console.log("");
  if (selectedReplayDirectory) {
    console.log(`Selected replay directory for scanning: ${selectedReplayDirectory}`);
  } else {
    console.log(
      "No replay directory found automatically. Set replayDirectory in local-processor/config/local-processor.example.json or pass a custom config.",
    );
  }
  console.log("");
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

function printSelectedReplay(selectedReplay: SelectedReplayFile | undefined) {
  if (!selectedReplay) return;

  console.log("");
  console.log(`Selected replay file (${selectedReplay.selectionMode}): ${selectedReplay.replayPath}`);
  console.log(`Replay size: ${selectedReplay.replaySizeBytes} bytes`);
  console.log(`Replay modifiedAt: ${selectedReplay.replayModifiedAt}`);
}

function printFilenameHint(filenameHint: ReplayFilenameHint) {
  if (filenameHint.available && filenameHint.possibleMatchId) {
    console.log(`Filename hint found: possible matchId ${filenameHint.possibleMatchId}. This is not verified.`);
    return;
  }

  console.log("No filename hint available.");
}

function printMatchIdentityStatus(matchIdentity: MatchIdentity) {
  if (matchIdentity.resolutionStatus === "provided_explicitly") {
    console.log("Match identity provided explicitly from external Riot API context. Not verified by Local Processor.");
    return;
  }

  console.log("Match identity unresolved. No matchId/gameId was provided and .rofl metadata parsing is not implemented.");
}

function printMatchContextConsistency(consistency: MatchContextConsistency) {
  if (consistency.status === "match") {
    console.log("API match context is consistent with filename hint. This is not official verification.");
    return;
  }

  if (consistency.status === "mismatch") {
    console.log(
      "Warning: API match context does not match filename hint. Check that the selected replay belongs to the provided match context.",
    );
    return;
  }

  console.log("Match context consistency check not applicable.");
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
