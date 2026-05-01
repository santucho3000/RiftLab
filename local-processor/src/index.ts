import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import https from "node:https";
import path from "node:path";
import { promisify } from "node:util";

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
  ManualReplayOpenChecklist,
  ProcessingJobPlan,
  ReplayWindowReadiness,
  ReplayInputManifest,
  ReplayDirectoryCandidate,
  ReplayFileCandidate,
  ApiMatchContextFile,
  ApiMatchContextManifestMetadata,
  CalibrationReport,
  CalibrationStatus,
  CalibrationScreenshotExtension,
  CalibrationScreenshotContract,
  FixedCapturePreset,
  ReplayApiEndpointDiscoveryReport,
  ReplayEndpointContractsReport,
  ReplayPlaybackState,
  ReplayPlaybackWindowApplyReport,
  ReplayPlaybackWindowComputedPlan,
  ReplayPlaybackWindowPlanReport,
  ReplayPlaybackWindowRequest,
  ReplayRenderPresetKey,
  ReplayRenderPresetPlanReport,
  ReplayRenderPresetSubset,
  ReplayStateSnapshotEndpointPath,
  ReplayStateSnapshotReport,
  ReplayApiHelpDiscoveryReport,
  ReplayApiHelpKeyword,
  LocalReplayConfigInspectionReport,
  ReplayApiConfigRecommendationReport,
  MinimapCropCandidatesMetadata,
  MinimapCropCandidateSource,
  MinimapCropExportMetadata,
  MinimapFrameSequenceReport,
  MatchIdentity,
  MatchContextConsistency,
  ReplayApiStatus,
  ReplayFilenameHint,
  SelectedReplayFile,
} from "./types";

const defaultConfigPath = "local-processor/config/local-processor.example.json";
const replayApiBaseUrl = "https://127.0.0.1:2999" as const;
const expectedReplayWindowResolution = {
  width: 1920,
  height: 1080,
} as const;
const defaultMinimapCropPreset = {
  x: 1600,
  y: 780,
  width: 320,
  height: 300,
} as const;
const defaultPlaybackWindowDurationSeconds = 30;
const defaultPlaybackWindowSpeed = 1;
const defaultPlaybackWindowSampleRateFps = 1;
const defaultPlaybackRestoreAfterApply = true;
const replayRenderPresetV01 = {
  interfaceMinimap: true,
  interfaceReplay: true,
  interfaceScoreboard: false,
  interfaceChat: false,
  interfaceTimeline: true,
  interfaceScore: true,
  fogOfWar: true,
  cameraMode: "top",
} satisfies ReplayRenderPresetSubset;
const execFileAsync = promisify(execFile);

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

  const calibrationReportDraft = args.calibrationScreenshotPath
    ? await createCalibrationReportDraft(
        resolveFromCwd(args.calibrationScreenshotPath),
        config.mode,
        selectedReplay,
        matchIdentity,
      )
    : undefined;

  const outputDirectory = resolveFromCwd(config.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const replayApiProbe = args.probeReplayApi
    ? await probeReplayApiAvailability(outputDirectory)
    : undefined;
  const replayApiEndpointDiscovery = args.probeReplayApi
    ? await writeReplayApiEndpointDiscovery(outputDirectory)
    : undefined;
  const replayEndpointContracts = args.probeReplayApi
    ? await writeReplayEndpointContracts(outputDirectory, replayApiEndpointDiscovery?.report)
    : undefined;
  const replayStateSnapshot =
    args.readReplayState ||
    args.planRenderPreset ||
    args.planPlaybackWindow ||
    args.applyPlaybackWindow ||
    args.captureMinimapWindow
    ? await writeReplayStateSnapshot(outputDirectory)
    : undefined;
  const replayRenderPresetPlan = args.planRenderPreset
    ? await writeReplayRenderPresetPlan(outputDirectory, replayStateSnapshot?.report, replayStateSnapshot?.reportPath)
    : undefined;
  const playbackWindowInputs = getPlaybackWindowInputs(args, replayStateSnapshot?.report);
  const replayPlaybackWindowPlan = args.planPlaybackWindow || args.captureMinimapWindow
    ? await writeReplayPlaybackWindowPlan(outputDirectory, playbackWindowInputs)
    : undefined;
  let replayPlaybackWindowApplyReport = args.applyPlaybackWindow && !args.captureMinimapWindow
    ? await writeReplayPlaybackWindowApplyReport(
        outputDirectory,
        playbackWindowInputs,
        args.restorePlaybackAfterApply ?? defaultPlaybackRestoreAfterApply,
      )
    : undefined;
  const replayApiHelpDiscovery =
    args.probeReplayHelp && args.probeReplayApi ? await writeReplayApiHelpDiscovery(outputDirectory) : undefined;
  const localReplayConfigInspection = args.inspectLocalReplayConfig
    ? await writeLocalReplayConfigInspection(outputDirectory, configPath)
    : undefined;
  const replayApiConfigRecommendation = localReplayConfigInspection
    ? await writeReplayApiConfigRecommendation(outputDirectory, localReplayConfigInspection.reportPath, localReplayConfigInspection.report)
    : undefined;

  if (!args.probeReplayApi) {
    console.log("Replay API probe not requested.");
  } else if (replayApiProbe?.status.available) {
    console.log("Replay API availability probe succeeded.");
  } else {
    console.log("Replay API availability probe did not find an available replay API. Make sure a replay is open manually.");
  }

  if (args.probeReplayApi) {
    if (replayApiEndpointDiscovery?.report.interpretation.status === "replay_endpoints_available") {
      console.log("Replay API endpoint discovery found replay endpoints.");
    } else if (replayApiEndpointDiscovery?.report.interpretation.status === "liveclientdata_only") {
      console.log(
        "Replay API endpoint discovery found liveclientdata endpoints only; replay render/playback endpoints were not discovered.",
      );
    } else if (replayApiEndpointDiscovery?.report.interpretation.status === "swagger_unavailable") {
      console.log("Replay API endpoint discovery could not fetch swagger.");
    }
  }

  if (args.probeReplayApi) {
    if (replayEndpointContracts?.report.interpretation.status === "contracts_extracted") {
      console.log("Replay endpoint contracts extracted to local-processor/output/replay-endpoint-contracts.json");
    } else if (replayEndpointContracts?.report.interpretation.status === "no_replay_endpoints") {
      console.log("Replay endpoint contracts not extracted because replay endpoints were not discovered.");
    } else if (replayEndpointContracts?.report.interpretation.status === "swagger_unavailable") {
      console.log("Replay endpoint contracts not extracted because Swagger is unavailable.");
    }
  }

  if (
    !args.readReplayState &&
    !args.planRenderPreset &&
    !args.planPlaybackWindow &&
    !args.applyPlaybackWindow &&
    !args.captureMinimapWindow
  ) {
    console.log("Replay state snapshot not requested.");
  } else if (replayStateSnapshot?.report.interpretation.status === "snapshot_complete" || replayStateSnapshot?.report.interpretation.status === "partial") {
    console.log("Replay state snapshot written to local-processor/output/replay-state-snapshot.json");
  } else {
    console.log("Replay state snapshot failed safely.");
  }

  if (!args.planRenderPreset) {
    console.log("Replay render preset dry run not requested.");
  } else if (replayRenderPresetPlan?.report.interpretation.status === "plan_created") {
    console.log("Replay render preset dry-run plan written to local-processor/output/replay-render-preset-plan.json");
  } else {
    console.log("Replay render preset dry run failed safely.");
  }

  if ((args.planPlaybackWindow || args.captureMinimapWindow) && replayPlaybackWindowPlan) {
    console.log("Replay playback window plan written.");
  }

  if (args.applyPlaybackWindow && !args.captureMinimapWindow) {
    console.log("Replay playback window apply requested.");
    if (replayPlaybackWindowApplyReport?.report.applied) {
      console.log("Replay playback window applied.");
      if (replayPlaybackWindowApplyReport.report.interpretation.status === "applied_and_restored") {
        console.log("Previous replay playback state restored.");
      } else if (replayPlaybackWindowApplyReport.report.interpretation.status === "restore_failed") {
        console.log("Replay playback window restore failed safely.");
      }
    } else {
      console.log("Replay playback window apply failed safely.");
    }
  }

  if (!args.probeReplayHelp) {
    console.log("Replay API Help discovery not requested.");
  } else if (!args.probeReplayApi) {
    console.log("Replay API Help discovery depends on --probe-replay-api. Help discovery was not run.");
  } else if (replayApiHelpDiscovery?.report.interpretation.status === "possible_replay_functions_found") {
    console.log(
      "Replay API Help discovery found possible replay-related functions. Review replay-api-help-discovery.json before implementing control.",
    );
  } else if (replayApiHelpDiscovery?.report.interpretation.status === "no_replay_functions_found") {
    console.log("Replay API Help discovery completed; no replay control functions found.");
  } else if (replayApiHelpDiscovery?.report.interpretation.status === "help_unavailable") {
    console.log("Replay API Help discovery unavailable.");
  }

  if (!args.inspectLocalReplayConfig) {
    console.log("Local replay config inspection not requested.");
  } else if (localReplayConfigInspection?.report.interpretation.status === "config_found") {
    console.log("Local replay config inspection completed.");
  } else if (localReplayConfigInspection?.report.interpretation.status === "config_not_found") {
    console.log("Local replay config inspection completed; no known config file found.");
  } else {
    console.log("Local replay config inspection failed safely.");
  }

  if (replayApiConfigRecommendation) {
    console.log("Replay API config recommendation written to local-processor/output/replay-api-config-recommendation.json");
  } else {
    console.log("Replay API config recommendation not written because local config inspection was not requested.");
  }

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

  const processingJobPlanPath =
    selectedReplay && replayInputManifestPath
      ? await writeProcessingJobPlan(
          outputDirectory,
          toProjectRelative(replayInputManifestPath),
          config.mode,
          config.region,
          selectedReplay,
          matchIdentity,
          filenameHint,
          apiMatchContext?.manifestMetadata,
          matchContextConsistency,
        )
      : undefined;

  if (!processingJobPlanPath) {
    console.log("No processing job plan written because no replay was selected.");
  }

  const manualReplayOpenChecklistPath =
    selectedReplay && processingJobPlanPath
      ? await writeManualReplayOpenChecklist(
          outputDirectory,
          config.mode,
          selectedReplay,
          matchIdentity,
          filenameHint,
          apiMatchContext?.manifestMetadata,
          matchContextConsistency,
        )
      : undefined;

  if (!manualReplayOpenChecklistPath) {
    console.log("No manual replay open checklist written because no replay was selected.");
  }

  const replayWindowReadinessPath =
    selectedReplay && manualReplayOpenChecklistPath
      ? await writeReplayWindowReadiness(outputDirectory, config.mode, selectedReplay, matchIdentity)
      : undefined;

  if (!replayWindowReadinessPath) {
    console.log("No replay window readiness config written because no replay was selected.");
  }

  const fixedCapturePresetPath =
    selectedReplay && replayWindowReadinessPath
      ? await writeFixedCapturePreset(outputDirectory, config.mode, selectedReplay, matchIdentity)
      : undefined;

  if (!fixedCapturePresetPath) {
    console.log("No fixed capture preset written because no replay was selected.");
  }

  const minimapFrameCapture = args.captureMinimapWindow
    ? await writeMinimapFrameSequence(
        outputDirectory,
        fixedCapturePresetPath ? toProjectRelative(fixedCapturePresetPath) : undefined,
        playbackWindowInputs,
        replayPlaybackWindowPlan?.reportPath,
        args.restorePlaybackAfterApply ?? defaultPlaybackRestoreAfterApply,
      )
    : undefined;

  if (minimapFrameCapture?.applyArtifact) {
    replayPlaybackWindowApplyReport = minimapFrameCapture.applyArtifact;
  }

  if (args.captureMinimapWindow) {
    console.log("Minimap frame capture started.");
    if (minimapFrameCapture?.report?.capture.completed) {
      console.log(`Minimap frame capture completed. Frames written: ${minimapFrameCapture.report.capture.framesWritten}`);
      if (minimapFrameCapture.report.restore.status === "restored") {
        console.log("Previous replay playback state restored.");
      }
    } else {
      console.log(
        `Minimap frame capture skipped: ${minimapFrameCapture?.skippedReason ?? "capture did not complete safely."}`,
      );
    }
  }

  const calibrationScreenshotContractPath =
    selectedReplay && fixedCapturePresetPath
      ? await writeCalibrationScreenshotContract(
          outputDirectory,
          config.mode,
          selectedReplay,
          matchIdentity,
          toProjectRelative(fixedCapturePresetPath),
        )
      : undefined;

  if (!calibrationScreenshotContractPath) {
    console.log("No calibration screenshot contract written because no replay was selected.");
  }

  const calibrationReportPath = calibrationReportDraft
    ? await writeCalibrationReport(outputDirectory, calibrationReportDraft)
    : undefined;

  if (!calibrationReportDraft) {
    console.log("No manual calibration screenshot provided. Calibration report not written.");
  } else {
    printCalibrationStatus(calibrationReportDraft.presetValidation.status);
  }

  const minimapCropExport =
    calibrationReportDraft &&
    calibrationReportPath &&
    fixedCapturePresetPath &&
    (calibrationReportDraft.presetValidation.status === "pass" ||
      calibrationReportDraft.presetValidation.status === "warning")
      ? await writeMinimapCropExport(
          outputDirectory,
          calibrationReportDraft,
          toProjectRelative(calibrationReportPath),
          fixedCapturePresetPath,
        )
      : undefined;

  const minimapCropExportSkippedReason = getMinimapCropExportSkippedReason(
    Boolean(args.calibrationScreenshotPath),
    calibrationReportDraft?.presetValidation.status,
    Boolean(minimapCropExport),
  );

  if (minimapCropExportSkippedReason === "no_calibration_screenshot") {
    console.log("No manual calibration screenshot provided. Minimap crop export skipped.");
  } else if (minimapCropExportSkippedReason === "calibration_failed") {
    console.log("Calibration failed. Minimap crop export skipped.");
  }

  const minimapCropCandidates =
    calibrationReportDraft &&
    fixedCapturePresetPath &&
    (calibrationReportDraft.presetValidation.status === "pass" ||
      calibrationReportDraft.presetValidation.status === "warning")
      ? await writeMinimapCropCandidates(outputDirectory, calibrationReportDraft, fixedCapturePresetPath)
      : undefined;

  const minimapCropCandidatesSkippedReason = getMinimapCropCandidatesSkippedReason(
    Boolean(args.calibrationScreenshotPath),
    calibrationReportDraft?.presetValidation.status,
    Boolean(minimapCropCandidates),
  );

  if (minimapCropCandidatesSkippedReason === "no_calibration_screenshot") {
    console.log("No manual calibration screenshot provided. Minimap crop candidates skipped.");
  } else if (minimapCropCandidatesSkippedReason === "calibration_failed") {
    console.log("Calibration failed. Minimap crop candidates skipped.");
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
    processingJobPlanPath: processingJobPlanPath ? toProjectRelative(processingJobPlanPath) : undefined,
    processingJobPlanWritten: Boolean(processingJobPlanPath),
    manualReplayOpenChecklistPath: manualReplayOpenChecklistPath
      ? toProjectRelative(manualReplayOpenChecklistPath)
      : undefined,
    manualReplayOpenChecklistWritten: Boolean(manualReplayOpenChecklistPath),
    replayWindowReadinessPath: replayWindowReadinessPath ? toProjectRelative(replayWindowReadinessPath) : undefined,
    replayWindowReadinessWritten: Boolean(replayWindowReadinessPath),
    replayWindowDetectionEnabledNow: false,
    frameCaptureEnabledNow: false,
    fixedCapturePresetPath: fixedCapturePresetPath ? toProjectRelative(fixedCapturePresetPath) : undefined,
    fixedCapturePresetWritten: Boolean(fixedCapturePresetPath),
    fixedCapturePresetEnabledNow: false,
    minimapCropPresetEnabledNow: false,
    calibrationScreenshotContractPath: calibrationScreenshotContractPath
      ? toProjectRelative(calibrationScreenshotContractPath)
      : undefined,
    calibrationScreenshotContractWritten: Boolean(calibrationScreenshotContractPath),
    calibrationScreenshotInputEnabledNow: false,
    calibrationValidationEnabledNow: false,
    calibrationScreenshotProvided: Boolean(args.calibrationScreenshotPath),
    calibrationScreenshotPath: args.calibrationScreenshotPath
      ? toProjectRelative(resolveFromCwd(args.calibrationScreenshotPath))
      : undefined,
    calibrationReportPath: calibrationReportPath ? toProjectRelative(calibrationReportPath) : undefined,
    calibrationReportWritten: Boolean(calibrationReportPath),
    calibrationStatus: calibrationReportDraft?.presetValidation.status ?? "not_provided",
    minimapCropExportGenerated: Boolean(minimapCropExport),
    minimapCropPath: minimapCropExport?.rawCropPath,
    minimapNormalizedPath: minimapCropExport?.normalizedCropPath,
    minimapCropMetadataPath: minimapCropExport?.metadataPath,
    minimapCropExportSkippedReason,
    minimapCropCandidatesGenerated: Boolean(minimapCropCandidates),
    minimapCropCandidatesDirectory: minimapCropCandidates?.directoryPath,
    minimapCropCandidateCount: minimapCropCandidates?.candidateCount ?? 0,
    minimapCropCandidatesSkippedReason,
    replayApiProbeRequested: args.probeReplayApi,
    replayApiAvailable: args.probeReplayApi ? replayApiProbe?.status.available ?? false : null,
    replayApiStatusPath: replayApiProbe?.statusPath,
    replayApiProbeError: replayApiProbe?.probeError,
    replayApiEndpointDiscoveryWritten: Boolean(replayApiEndpointDiscovery),
    replayApiEndpointDiscoveryPath: replayApiEndpointDiscovery?.reportPath,
    replayApiSwaggerAvailable: args.probeReplayApi ? replayApiEndpointDiscovery?.report.swaggerAvailable ?? false : null,
    replayApiHasReplayEndpoints: args.probeReplayApi
      ? replayApiEndpointDiscovery?.report.endpointDiscovery.hasReplayEndpoints ?? false
      : null,
    replayApiHasLiveClientDataEndpoints: args.probeReplayApi
      ? replayApiEndpointDiscovery?.report.endpointDiscovery.hasLiveClientDataEndpoints ?? false
      : null,
    replayApiEndpointDiscoveryStatus: replayApiEndpointDiscovery?.report.interpretation.status,
    replayEndpointContractsWritten: Boolean(replayEndpointContracts),
    replayEndpointContractsPath: replayEndpointContracts?.reportPath,
    replayEndpointContractCount: replayEndpointContracts?.report.endpoints.length ?? 0,
    replayEndpointContractsStatus: replayEndpointContracts?.report.interpretation.status,
    replayStateSnapshotRequested:
      args.readReplayState || args.planRenderPreset || args.planPlaybackWindow || args.applyPlaybackWindow || args.captureMinimapWindow,
    replayStateSnapshotWritten: Boolean(replayStateSnapshot),
    replayStateSnapshotPath: replayStateSnapshot?.reportPath,
    replayStateSnapshotStatus: replayStateSnapshot?.report.interpretation.status,
    replayRenderReadable: replayStateSnapshot?.report.summary.renderReadable ?? false,
    replayPlaybackReadable: replayStateSnapshot?.report.summary.playbackReadable ?? false,
    replayGameReadable: replayStateSnapshot?.report.summary.gameReadable ?? false,
    replayRenderPresetPlanRequested: args.planRenderPreset,
    replayRenderPresetPlanWritten: Boolean(replayRenderPresetPlan),
    replayRenderPresetPlanPath: replayRenderPresetPlan?.reportPath,
    replayRenderPresetPlanStatus: replayRenderPresetPlan?.report.interpretation.status,
    replayRenderPresetChangesNeeded: replayRenderPresetPlan?.report.summary.changesNeeded ?? 0,
    replayRenderPresetReadyForApplyStep: replayRenderPresetPlan?.report.summary.readyForApplyStep ?? false,
    replayPlaybackWindowPlanRequested: args.planPlaybackWindow || args.captureMinimapWindow,
    replayPlaybackWindowPlanWritten: Boolean(replayPlaybackWindowPlan),
    replayPlaybackWindowPlanPath: replayPlaybackWindowPlan?.reportPath,
    replayPlaybackWindowEstimatedRealSeconds: replayPlaybackWindowPlan?.report.computedPlan.estimatedRealSeconds ?? null,
    replayPlaybackWindowEstimatedFrameCount: replayPlaybackWindowPlan?.report.computedPlan.estimatedFrameCount ?? null,
    replayPlaybackWindowApplyRequested: args.applyPlaybackWindow || args.captureMinimapWindow,
    replayPlaybackWindowApplyReportWritten: Boolean(replayPlaybackWindowApplyReport),
    replayPlaybackWindowApplyReportPath: replayPlaybackWindowApplyReport?.reportPath,
    replayPlaybackWindowApplyStatus: replayPlaybackWindowApplyReport?.report.interpretation.status,
    replayPlaybackWindowRestoreRequested: args.applyPlaybackWindow || args.captureMinimapWindow
      ? args.restorePlaybackAfterApply ?? defaultPlaybackRestoreAfterApply
      : false,
    replayPlaybackWindowRestoreStatus: !(args.applyPlaybackWindow || args.captureMinimapWindow)
      ? "not_requested"
      : replayPlaybackWindowApplyReport?.report.interpretation.status === "applied_and_restored"
        ? "restored"
        : replayPlaybackWindowApplyReport?.report.interpretation.status === "restore_failed"
          ? "failed"
          : "not_requested",
    minimapFrameCaptureRequested: args.captureMinimapWindow,
    minimapFrameCaptureCompleted: Boolean(minimapFrameCapture?.report?.capture.completed),
    minimapFrameCaptureDirectory: minimapFrameCapture?.frameDirectoryPath,
    minimapFrameCaptureMetadataPath: minimapFrameCapture?.metadataPath,
    minimapFrameCaptureFramesWritten: minimapFrameCapture?.report?.capture.framesWritten ?? 0,
    minimapFrameCaptureNormalized: minimapFrameCapture?.report?.capture.normalized ?? false,
    minimapFrameCaptureStatus: !args.captureMinimapWindow
      ? "skipped"
      : minimapFrameCapture?.report?.capture.completed
        ? "completed"
        : minimapFrameCapture?.skippedReason
          ? "skipped"
          : "failed",
    minimapFrameCaptureSkippedReason: minimapFrameCapture?.skippedReason,
    replayApiHelpProbeRequested: args.probeReplayHelp,
    replayApiHelpDiscoveryPath: replayApiHelpDiscovery?.reportPath,
    replayApiHelpDiscoveryStatus: replayApiHelpDiscovery?.report.interpretation.status,
    replayApiHelpCandidateFunctionCount: replayApiHelpDiscovery?.report.candidateFunctionNames.length ?? 0,
    localReplayConfigInspectionRequested: args.inspectLocalReplayConfig,
    localReplayConfigInspectionPath: localReplayConfigInspection?.reportPath,
    localReplayConfigInspectionStatus: localReplayConfigInspection?.report.interpretation.status,
    localReplayConfigEnableReplayApiFound:
      localReplayConfigInspection?.report.summary.enableReplayApiFound ?? false,
    localReplayConfigEnableReplayApiValue:
      localReplayConfigInspection?.report.summary.enableReplayApiValue ?? null,
    replayApiConfigRecommendationPath: replayApiConfigRecommendation?.reportPath,
    replayApiConfigRecommendationWritten: Boolean(replayApiConfigRecommendation),
    replayApiConfigRecommendationStatus: replayApiConfigRecommendation?.report.recommendation.status,
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

async function writeCalibrationScreenshotContract(
  outputDirectory: string,
  mode: "manual_safe" | "semi_auto_future" | "server_future",
  selectedReplay: SelectedReplayFile,
  matchIdentity: MatchIdentity,
  fixedCapturePresetPath: string,
) {
  const outputPath = path.join(outputDirectory, "calibration-screenshot-contract.json");
  const contract: CalibrationScreenshotContract = {
    schemaVersion: "calibration-screenshot-contract.v0.1",
    createdAt: new Date().toISOString(),
    mode,
    selectedReplay,
    matchIdentity,
    fixedCapturePresetPath,
    screenshotInput: {
      enabledNow: false,
      acceptedFutureFormats: ["png", "jpg", "jpeg"],
      expectedResolution: expectedReplayWindowResolution,
      expectedSource: "manual_user_provided_replay_screenshot",
      mustBeFromSelectedReplay: true,
      notes: [
        "Future versions may allow the user to provide a static screenshot manually.",
        "The Local Processor does not capture screenshots in this version.",
        "This contract exists only to prepare minimap crop validation.",
      ],
    },
    futureValidationPlan: {
      enabledNow: false,
      validatesImageDimensions: true,
      validatesMinimapCropBounds: true,
      validatesMinimapVisualPresence: false,
      runsTemplateLocator: false,
      exportsCalibrationReport: false,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotClickClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
      doesNotCaptureScreenshotsYet: true,
    },
  };

  await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  console.log(`Calibration screenshot contract written to ${toProjectRelative(outputPath)}`);
  return outputPath;
}

async function createCalibrationReportDraft(
  screenshotPath: string,
  mode: "manual_safe" | "semi_auto_future" | "server_future",
  selectedReplay: SelectedReplayFile | undefined,
  matchIdentity: MatchIdentity,
): Promise<CalibrationReport> {
  if (!selectedReplay) {
    throw new Error("Calibration screenshot validation requires a selected replay. Provide --replay or a replay directory with .rofl files.");
  }

  const extension = getCalibrationScreenshotExtension(screenshotPath);
  let screenshotStats;
  try {
    screenshotStats = await stat(screenshotPath);
  } catch {
    throw new Error(`Calibration screenshot file does not exist: ${screenshotPath}`);
  }

  if (!screenshotStats.isFile()) {
    throw new Error(`Calibration screenshot path is not a file: ${screenshotPath}`);
  }

  const imageMetadata = await readImageDimensions(screenshotPath, extension);
  const resolutionMatchesExpected =
    imageMetadata.readable &&
    imageMetadata.width === expectedReplayWindowResolution.width &&
    imageMetadata.height === expectedReplayWindowResolution.height;
  const minimapCropWithinBounds =
    imageMetadata.readable &&
    imageMetadata.width !== null &&
    imageMetadata.height !== null &&
    isCropWithinBounds(defaultMinimapCropPreset, imageMetadata.width, imageMetadata.height);
  const notes = getCalibrationNotes(imageMetadata.readable, resolutionMatchesExpected, minimapCropWithinBounds);
  const status: Exclude<CalibrationStatus, "not_provided"> = !imageMetadata.readable || !minimapCropWithinBounds
    ? "fail"
    : resolutionMatchesExpected
      ? "pass"
      : "warning";

  return {
    schemaVersion: "calibration-report.v0.1",
    createdAt: new Date().toISOString(),
    mode,
    selectedReplay,
    matchIdentity,
    inputScreenshot: {
      path: screenshotPath,
      fileName: path.basename(screenshotPath),
      extension,
      exists: true,
      providedManuallyByUser: true,
      capturedByLocalProcessor: false,
    },
    imageMetadata,
    presetValidation: {
      expectedResolution: expectedReplayWindowResolution,
      resolutionMatchesExpected,
      minimapCropWithinBounds,
      status,
      notes,
    },
    visualAnalysis: {
      performed: false,
      minimapPresenceDetected: false,
      championDetectionPerformed: false,
      templateLocatorPerformed: false,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotClickClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
      doesNotCaptureScreenshots: true,
      usesManualUserProvidedScreenshotOnly: true,
    },
  };
}

async function writeCalibrationReport(outputDirectory: string, report: CalibrationReport) {
  const outputPath = path.join(outputDirectory, "calibration-report.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Calibration report written to ${toProjectRelative(outputPath)}`);
  return outputPath;
}

function getCalibrationScreenshotExtension(screenshotPath: string): CalibrationScreenshotExtension {
  const extension = path.extname(screenshotPath).replace(".", "").toLowerCase();

  if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    return extension;
  }

  throw new Error("Calibration screenshot must be a png, jpg, or jpeg file.");
}

async function readImageDimensions(
  screenshotPath: string,
  extension: CalibrationScreenshotExtension,
): Promise<CalibrationReport["imageMetadata"]> {
  try {
    const buffer = await readFile(screenshotPath);
    const dimensions = extension === "png" ? readPngDimensions(buffer) : readJpegDimensions(buffer);

    return dimensions
      ? {
          ...dimensions,
          readable: true,
        }
      : {
          width: null,
          height: null,
          readable: false,
        };
  } catch {
    return {
      width: null,
      height: null,
      readable: false,
    };
  }
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  const pngSignature = "89504e470d0a1a0a";

  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    return undefined;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) {
      offset += 1;
    }

    if (offset + 4 >= buffer.length) {
      return undefined;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    if (!Number.isFinite(segmentLength) || segmentLength < 2) {
      return undefined;
    }

    offset += 2 + segmentLength;
  }

  return undefined;
}

function isCropWithinBounds(
  crop: typeof defaultMinimapCropPreset,
  imageWidth: number,
  imageHeight: number,
) {
  return crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0 && crop.x + crop.width <= imageWidth && crop.y + crop.height <= imageHeight;
}

function getCalibrationNotes(
  readable: boolean,
  resolutionMatchesExpected: boolean,
  minimapCropWithinBounds: boolean,
) {
  const notes: string[] = [];

  if (!readable) {
    notes.push("Image dimensions could not be read from the file header.");
  }

  if (readable && !resolutionMatchesExpected) {
    notes.push("Image resolution does not match expected 1920x1080 preset.");
  }

  if (!minimapCropWithinBounds) {
    notes.push("Minimap crop preset is outside image bounds or image dimensions were unavailable.");
  }

  if (readable && resolutionMatchesExpected && minimapCropWithinBounds) {
    notes.push("Image dimensions match expected preset and minimap crop is within bounds.");
  }

  notes.push("No visual minimap, champion, OCR, or template analysis was performed.");
  return notes;
}

function printCalibrationStatus(status: Exclude<CalibrationStatus, "not_provided">) {
  if (status === "pass") {
    console.log("Calibration validation passed.");
    return;
  }

  if (status === "warning") {
    console.log("Calibration validation completed with warnings.");
    return;
  }

  console.log("Calibration validation failed.");
}

async function writeMinimapCropExport(
  outputDirectory: string,
  calibrationReport: CalibrationReport,
  calibrationReportPath: string,
  fixedCapturePresetPath: string,
) {
  const crop = await readMinimapCropFromFixedCapturePreset(fixedCapturePresetPath);
  const rawCropPath = path.join(outputDirectory, "minimap-crop.png");
  const normalizedCropPath = path.join(outputDirectory, "minimap-normalized.png");
  const metadataPath = path.join(outputDirectory, "minimap-crop-metadata.json");
  const sharp = (await import("sharp")).default;

  await sharp(calibrationReport.inputScreenshot.path)
    .extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height,
    })
    .png()
    .toFile(rawCropPath);

  await sharp(calibrationReport.inputScreenshot.path)
    .extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height,
    })
    .resize(512, 512)
    .png()
    .toFile(normalizedCropPath);

  const calibrationStatus = calibrationReport.presetValidation.status;
  if (calibrationStatus !== "pass" && calibrationStatus !== "warning") {
    throw new Error("Minimap crop export requires calibration status pass or warning.");
  }

  const metadata: MinimapCropExportMetadata = {
    schemaVersion: "minimap-crop-export.v0.1",
    createdAt: new Date().toISOString(),
    mode: calibrationReport.mode,
    selectedReplay: calibrationReport.selectedReplay,
    matchIdentity: calibrationReport.matchIdentity,
    inputScreenshot: {
      path: calibrationReport.inputScreenshot.path,
      providedManuallyByUser: true,
      capturedByLocalProcessor: false,
    },
    calibration: {
      calibrationReportPath,
      calibrationStatus,
    },
    crop: {
      source: "fixed-capture-preset",
      coordinateSystem: "window_pixels",
      ...crop,
    },
    outputs: {
      rawCropPath: toProjectRelative(rawCropPath),
      normalizedCropPath: toProjectRelative(normalizedCropPath),
      normalizedWidth: 512,
      normalizedHeight: 512,
    },
    visualAnalysis: {
      performed: false,
      championDetectionPerformed: false,
      wardDetectionPerformed: false,
      objectiveDetectionPerformed: false,
      templateLocatorPerformed: false,
      notes: [
        "This step only crops and normalizes the manually provided screenshot.",
        "No champion, ward, objective, or spatial analysis is performed yet.",
      ],
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotClickClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
      doesNotCaptureScreenshots: true,
      usesManualUserProvidedScreenshotOnly: true,
    },
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`Minimap crop exported to ${toProjectRelative(rawCropPath)}`);
  console.log(`Normalized minimap crop exported to ${toProjectRelative(normalizedCropPath)}`);

  return {
    rawCropPath: toProjectRelative(rawCropPath),
    normalizedCropPath: toProjectRelative(normalizedCropPath),
    metadataPath: toProjectRelative(metadataPath),
  };
}

async function readMinimapCropFromFixedCapturePreset(fixedCapturePresetPath: string) {
  const parsed = JSON.parse(await readFile(fixedCapturePresetPath, "utf8")) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Fixed capture preset is not a JSON object.");
  }

  const capturePreset = parsed.capturePreset;
  if (!isRecord(capturePreset)) {
    throw new Error("Fixed capture preset is missing capturePreset.");
  }

  const minimapCropPreset = capturePreset.minimapCropPreset;
  if (!isRecord(minimapCropPreset)) {
    throw new Error("Fixed capture preset is missing minimapCropPreset.");
  }

  const crop = minimapCropPreset.crop;
  if (
    !isRecord(crop) ||
    typeof crop.x !== "number" ||
    typeof crop.y !== "number" ||
    typeof crop.width !== "number" ||
    typeof crop.height !== "number"
  ) {
    throw new Error("Fixed capture preset minimap crop is invalid.");
  }

  return {
    x: Math.trunc(crop.x),
    y: Math.trunc(crop.y),
    width: Math.trunc(crop.width),
    height: Math.trunc(crop.height),
  };
}

function getMinimapCropExportSkippedReason(
  calibrationScreenshotProvided: boolean,
  calibrationStatus: Exclude<CalibrationStatus, "not_provided"> | undefined,
  generated: boolean,
) {
  if (generated) return undefined;
  if (!calibrationScreenshotProvided) return "no_calibration_screenshot";
  if (calibrationStatus === "fail") return "calibration_failed";
  return "not_generated";
}

async function writeMinimapCropCandidates(
  outputDirectory: string,
  calibrationReport: CalibrationReport,
  fixedCapturePresetPath: string,
) {
  const imageWidth = calibrationReport.imageMetadata.width;
  const imageHeight = calibrationReport.imageMetadata.height;

  if (!imageWidth || !imageHeight) {
    throw new Error("Minimap crop candidates require readable screenshot dimensions.");
  }

  const fixedCrop = await readMinimapCropFromFixedCapturePreset(fixedCapturePresetPath);
  const candidatesDirectory = path.join(outputDirectory, "minimap-candidates");
  await mkdir(candidatesDirectory, { recursive: true });

  const candidates = getMinimapCropCandidates(fixedCrop, imageWidth, imageHeight);
  const sharp = (await import("sharp")).default;

  const metadataCandidates = [];
  for (const candidate of candidates) {
    const outputPath = path.join(candidatesDirectory, `${candidate.id}.png`);
    await sharp(calibrationReport.inputScreenshot.path)
      .extract({
        left: candidate.x,
        top: candidate.y,
        width: candidate.width,
        height: candidate.height,
      })
      .resize(512, 512)
      .png()
      .toFile(outputPath);

    metadataCandidates.push({
      ...candidate,
      path: toProjectRelative(outputPath),
      normalizedWidth: 512 as const,
      normalizedHeight: 512 as const,
    });
  }

  const metadataPath = path.join(candidatesDirectory, "candidates-metadata.json");
  const metadata: MinimapCropCandidatesMetadata = {
    schemaVersion: "minimap-crop-candidates.v0.1",
    createdAt: new Date().toISOString(),
    mode: calibrationReport.mode,
    inputScreenshot: {
      path: calibrationReport.inputScreenshot.path,
      providedManuallyByUser: true,
      capturedByLocalProcessor: false,
      width: imageWidth,
      height: imageHeight,
    },
    candidateCount: metadataCandidates.length,
    selection: {
      automaticSelectionEnabled: false,
      selectedCandidateId: null,
      notes: [
        "Candidates are generated for developer inspection.",
        "No automatic minimap detection is performed yet.",
        "Future versions should score candidates automatically.",
      ],
    },
    candidates: metadataCandidates,
    visualAnalysis: {
      performed: false,
      championDetectionPerformed: false,
      wardDetectionPerformed: false,
      templateLocatorPerformed: false,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotClickClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
      doesNotCaptureScreenshots: true,
      usesManualUserProvidedScreenshotOnly: true,
    },
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`Generated ${metadataCandidates.length} minimap crop candidates in ${toProjectRelative(candidatesDirectory)}`);

  return {
    directoryPath: toProjectRelative(candidatesDirectory),
    metadataPath: toProjectRelative(metadataPath),
    candidateCount: metadataCandidates.length,
  };
}

function getMinimapCropCandidates(
  fixedCrop: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
) {
  const minDimension = Math.min(imageWidth, imageHeight);
  const relativeLarge = Math.round(minDimension * 0.31);
  const relativeMedium = Math.round(minDimension * 0.285);
  const relativeSmall = Math.round(minDimension * 0.255);
  const probableArea = Math.round(minDimension * 0.34);
  const fixedSquareSize = Math.max(fixedCrop.width, fixedCrop.height);

  const rawCandidates: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    source: MinimapCropCandidateSource;
    notes: string[];
  }> = [
    {
      id: "candidate-01",
      x: fixedCrop.x,
      y: fixedCrop.y,
      width: fixedSquareSize,
      height: fixedSquareSize,
      source: "fixed_capture_preset",
      notes: ["Square version of the current fixed minimap crop preset."],
    },
    {
      id: "candidate-02",
      x: imageWidth - relativeLarge,
      y: imageHeight - relativeLarge,
      width: relativeLarge,
      height: relativeLarge,
      source: "relative_bottom_right_candidate",
      notes: ["Larger bottom-right candidate for HUD scale variance."],
    },
    {
      id: "candidate-03",
      x: imageWidth - relativeMedium - Math.round(imageWidth * 0.015),
      y: imageHeight - relativeMedium - Math.round(imageHeight * 0.025),
      width: relativeMedium,
      height: relativeMedium,
      source: "relative_bottom_right_candidate",
      notes: ["Shifted left/up candidate for minimaps displaced by HUD or capture settings."],
    },
    {
      id: "candidate-04",
      x: imageWidth - relativeSmall,
      y: imageHeight - relativeSmall,
      width: relativeSmall,
      height: relativeSmall,
      source: "relative_bottom_right_candidate",
      notes: ["Smaller candidate for reduced HUD scale settings."],
    },
    {
      id: "candidate-05",
      x: imageWidth - probableArea,
      y: imageHeight - probableArea,
      width: probableArea,
      height: probableArea,
      source: "relative_bottom_right_candidate",
      notes: ["Full probable bottom-right minimap bounding area."],
    },
  ];

  return rawCandidates.map((candidate) => clampCandidateToImage(candidate, imageWidth, imageHeight));
}

function clampCandidateToImage<T extends { x: number; y: number; width: number; height: number; notes: string[] }>(
  candidate: T,
  imageWidth: number,
  imageHeight: number,
) {
  const size = Math.max(1, Math.min(candidate.width, candidate.height, imageWidth, imageHeight));
  const x = Math.max(0, Math.min(candidate.x, imageWidth - size));
  const y = Math.max(0, Math.min(candidate.y, imageHeight - size));

  return {
    ...candidate,
    x,
    y,
    width: size,
    height: size,
    notes:
      x !== candidate.x || y !== candidate.y || size !== candidate.width || size !== candidate.height
        ? [...candidate.notes, "Candidate was clamped to fit within screenshot bounds."]
        : candidate.notes,
  };
}

function getMinimapCropCandidatesSkippedReason(
  calibrationScreenshotProvided: boolean,
  calibrationStatus: Exclude<CalibrationStatus, "not_provided"> | undefined,
  generated: boolean,
) {
  if (generated) return undefined;
  if (!calibrationScreenshotProvided) return "no_calibration_screenshot";
  if (calibrationStatus === "fail") return "calibration_failed";
  return "not_generated";
}

async function probeReplayApiAvailability(outputDirectory: string) {
  const checkedEndpoints = [await probeReplayApiEndpoint("/swagger/v2/swagger.json")];
  const status: ReplayApiStatus = {
    schemaVersion: "replay-api-status.v0.1",
    createdAt: new Date().toISOString(),
    mode: "replay_api_assisted_probe",
    probeRequested: true,
    available: checkedEndpoints.some((endpoint) => endpoint.ok),
    baseUrl: replayApiBaseUrl,
    checkedEndpoints,
    replayApiAssisted: {
      enabledNow: false,
      availabilityOnly: true,
      renderControlEnabled: false,
      playbackControlEnabled: false,
      frameCaptureEnabled: false,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
      doesNotAutomateKeyboardOrMouse: true,
      doesNotUseLcuAuthToken: true,
      doesNotParseRofl: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
      doesNotCaptureFrames: true,
    },
  };
  const statusPath = path.join(outputDirectory, "replay-api-status.json");
  await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");

  const probeError = status.available
    ? undefined
    : checkedEndpoints.find((endpoint) => endpoint.error)?.error ??
      "Replay API probe completed, but Swagger did not respond successfully.";

  return {
    status,
    statusPath: toProjectRelative(statusPath),
    probeError,
  };
}

async function writeReplayApiEndpointDiscovery(outputDirectory: string) {
  const swaggerResponse = await fetchReplayApiGet("/swagger/v2/swagger.json");
  const report = buildReplayApiEndpointDiscoveryReport(swaggerResponse);
  const reportPath = path.join(outputDirectory, "replay-api-endpoints.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

async function writeReplayEndpointContracts(
  outputDirectory: string,
  endpointDiscovery: ReplayApiEndpointDiscoveryReport | undefined,
) {
  const swaggerResponse = await fetchReplayApiGet("/swagger/v2/swagger.json");
  const report = buildReplayEndpointContractsReport(swaggerResponse, endpointDiscovery);
  const reportPath = path.join(outputDirectory, "replay-endpoint-contracts.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

async function writeReplayStateSnapshot(outputDirectory: string) {
  const endpointMap = {
    game: "/replay/game",
    render: "/replay/render",
    playback: "/replay/playback",
    sequence: "/replay/sequence",
    recording: "/replay/recording",
  } satisfies Record<string, ReplayStateSnapshotEndpointPath>;
  const [game, render, playback, sequence, recording] = await Promise.all([
    readReplayStateEndpoint(endpointMap.game),
    readReplayStateEndpoint(endpointMap.render),
    readReplayStateEndpoint(endpointMap.playback),
    readReplayStateEndpoint(endpointMap.sequence),
    readReplayStateEndpoint(endpointMap.recording),
  ]);
  const report = buildReplayStateSnapshotReport({
    game,
    render,
    playback,
    sequence,
    recording,
  });
  const reportPath = path.join(outputDirectory, "replay-state-snapshot.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

async function writeReplayRenderPresetPlan(
  outputDirectory: string,
  replayStateSnapshot: ReplayStateSnapshotReport | undefined,
  replayStateSnapshotPath: string | undefined,
) {
  const report = buildReplayRenderPresetPlanReport(replayStateSnapshot, replayStateSnapshotPath);
  const reportPath = path.join(outputDirectory, "replay-render-preset-plan.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

async function writeReplayPlaybackWindowPlan(
  outputDirectory: string,
  playbackWindowInputs: ReturnType<typeof getPlaybackWindowInputs>,
) {
  const report = buildReplayPlaybackWindowPlanReport(playbackWindowInputs);
  const reportPath = path.join(outputDirectory, "replay-playback-window-plan.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

async function writeReplayPlaybackWindowApplyReport(
  outputDirectory: string,
  playbackWindowInputs: ReturnType<typeof getPlaybackWindowInputs>,
  restorePlaybackAfterApply: boolean,
) {
  const report = await applyReplayPlaybackWindow(playbackWindowInputs, restorePlaybackAfterApply);
  const reportPath = path.join(outputDirectory, "replay-playback-window-apply-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

async function writeMinimapFrameSequence(
  outputDirectory: string,
  fixedCapturePresetPath: string | undefined,
  playbackWindowInputs: ReturnType<typeof getPlaybackWindowInputs>,
  playbackWindowPlanPath: string | undefined,
  restorePlaybackAfterApply: boolean,
) {
  if (!fixedCapturePresetPath) {
    return {
      skippedReason: "fixed capture preset is missing.",
    };
  }

  if (!playbackWindowPlanPath) {
    return {
      skippedReason: "playback window plan is missing.",
    };
  }

  if (!playbackWindowInputs.currentPlayback) {
    return {
      skippedReason: "playback state is not readable.",
    };
  }

  if (playbackWindowInputs.computedPlan.estimatedFrameCount <= 0) {
    return {
      skippedReason: "estimated frame count is zero for the requested playback window.",
    };
  }

  const fixedCapturePresetAbsolutePath = resolveFromCwd(fixedCapturePresetPath);
  const crop = await readMinimapCropFromFixedCapturePreset(fixedCapturePresetAbsolutePath);
  const frameSequenceDirectory = path.join(outputDirectory, "minimap-frame-sequence");
  const frameDirectory = path.join(frameSequenceDirectory, "frames");
  await mkdir(frameDirectory, { recursive: true });

  const applyReportPath = path.join(outputDirectory, "replay-playback-window-apply-report.json");
  const applyResult = await applyReplayPlaybackWindowWithCapture(
    playbackWindowInputs,
    restorePlaybackAfterApply,
    frameDirectory,
    crop,
  );
  await writeFile(applyReportPath, `${JSON.stringify(applyResult.applyReport, null, 2)}\n`, "utf8");

  const metadata: MinimapFrameSequenceReport = {
    schemaVersion: "minimap-frame-sequence.v0.1",
    createdAt: new Date().toISOString(),
    mode: "replay_api_assisted_capture",
    source: {
      replayApiAssisted: true,
      manualReplayOpenRequired: true,
      playbackWindowPlanPath,
      playbackApplyReportPath: toProjectRelative(applyReportPath),
      fixedCapturePresetPath,
    },
    window: {
      startTime: playbackWindowInputs.computedPlan.effectiveStartTime,
      endTime: playbackWindowInputs.computedPlan.effectiveEndTime,
      duration: playbackWindowInputs.computedPlan.effectiveDuration,
      speed: playbackWindowInputs.requestedWindow.requestedSpeed,
      sampleRateFps: playbackWindowInputs.requestedWindow.sampleRateFps,
      estimatedFrameCount: playbackWindowInputs.computedPlan.estimatedFrameCount,
    },
    capture: {
      requested: true,
      completed: applyResult.captureCompleted,
      frameDirectory: toProjectRelative(frameDirectory),
      framesWritten: applyResult.frames.length,
      normalized: applyResult.normalized,
      normalizedWidth: 512,
      normalizedHeight: 512,
      crop,
    },
    frames: applyResult.frames,
    restore: {
      requested: restorePlaybackAfterApply,
      status:
        applyResult.applyReport.interpretation.status === "applied_and_restored"
          ? "restored"
          : restorePlaybackAfterApply
            ? "failed"
            : "not_requested",
    },
    visualAnalysis: {
      performed: false,
      championDetectionPerformed: false,
      wardDetectionPerformed: false,
      objectiveDetectionPerformed: false,
      notes: [
        "This step only captures minimap frame images from a controlled replay playback window.",
        "No champion, ward, objective, or spatial analysis is performed yet.",
        "Capture uses the fixed window-pixel minimap crop and assumes the replay window matches the configured 1920x1080 layout.",
      ],
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
      doesNotAutomateKeyboardOrMouse: true,
      doesNotParseRofl: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
    },
  };
  const metadataPath = path.join(frameSequenceDirectory, "metadata.json");
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return {
    report: metadata,
    metadataPath: toProjectRelative(metadataPath),
    frameDirectoryPath: toProjectRelative(frameDirectory),
    applyArtifact: {
      report: applyResult.applyReport,
      reportPath: toProjectRelative(applyReportPath),
    },
    skippedReason: applyResult.captureCompleted ? undefined : applyResult.captureError ?? "capture did not complete safely.",
  };
}

async function writeReplayApiHelpDiscovery(outputDirectory: string) {
  const helpResponse = await fetchReplayApiPost("/Help");
  const report = buildReplayApiHelpDiscoveryReport(helpResponse);
  const reportPath = path.join(outputDirectory, "replay-api-help-discovery.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

function buildReplayApiHelpDiscoveryReport(
  helpResponse: Awaited<ReturnType<typeof fetchReplayApiPost>>,
): ReplayApiHelpDiscoveryReport {
  const responseText = helpResponse.body ?? "";
  const responseReadable = Boolean(helpResponse.ok && responseText.trim().length > 0);
  const keywordMatches = countHelpKeywordMatches(responseText);
  const candidateFunctionNames = responseReadable ? extractCandidateFunctionNames(responseText) : [];
  const possibleReplayKeywords = [
    "replay",
    "render",
    "playback",
    "camera",
    "seek",
    "pause",
    "speed",
    "observer",
    "minimap",
    "interface",
  ] satisfies ReplayApiHelpKeyword[];
  const possibleReplayMatchCount = possibleReplayKeywords.reduce((sum, keyword) => sum + keywordMatches[keyword], 0);
  const status: ReplayApiHelpDiscoveryReport["interpretation"]["status"] = !responseReadable
    ? "help_unavailable"
    : possibleReplayMatchCount > 0 || candidateFunctionNames.length > 0
      ? "possible_replay_functions_found"
      : "no_replay_functions_found";

  return {
    schemaVersion: "replay-api-help-discovery.v0.1",
    createdAt: new Date().toISOString(),
    baseUrl: replayApiBaseUrl,
    helpProbeRequested: true,
    helpEndpointCalled: true,
    method: "POST",
    path: "/Help",
    ok: helpResponse.ok,
    statusCode: helpResponse.statusCode,
    responseReadable,
    keywordMatches,
    candidateFunctionNames,
    interpretation: {
      status,
      notes: getHelpDiscoveryNotes(status, helpResponse.error),
    },
    safety: {
      documentationOnly: true,
      doesNotCallExit: true,
      doesNotCallCancel: true,
      doesNotSubscribe: true,
      doesNotUnsubscribe: true,
      doesNotChangeRender: true,
      doesNotChangePlayback: true,
      doesNotSeek: true,
      doesNotCaptureFrames: true,
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
      doesNotAutomateKeyboardOrMouse: true,
      doesNotUseLcuAuthToken: true,
      doesNotParseRofl: true,
    },
  };
}

function countHelpKeywordMatches(responseText: string): Record<ReplayApiHelpKeyword, number> {
  const keywords: ReplayApiHelpKeyword[] = [
    "replay",
    "render",
    "playback",
    "camera",
    "seek",
    "time",
    "pause",
    "speed",
    "observer",
    "minimap",
    "interface",
  ];
  const lowerText = responseText.toLowerCase();

  return Object.fromEntries(
    keywords.map((keyword) => [keyword, lowerText.match(new RegExp(`\\b${keyword}\\b`, "g"))?.length ?? 0]),
  ) as Record<ReplayApiHelpKeyword, number>;
}

function extractCandidateFunctionNames(responseText: string) {
  const candidatePattern = /\b(?:replay|render|playback|camera|seek|pause|speed|observer|minimap|interface)[A-Za-z0-9_./-]*\b/gi;
  const matches = responseText.match(candidatePattern) ?? [];
  return Array.from(new Set(matches)).slice(0, 100);
}

function getHelpDiscoveryNotes(
  status: ReplayApiHelpDiscoveryReport["interpretation"]["status"],
  error: string | null,
) {
  if (status === "help_unavailable") {
    return [
      "The /Help endpoint did not return readable documentation.",
      error ? `Last /Help probe error: ${error}` : "No readable /Help response body was available.",
    ];
  }

  if (status === "possible_replay_functions_found") {
    return [
      "The /Help response contains possible replay-related keywords or function names.",
      "Review this report manually before implementing any future control step.",
      "This probe did not call render, playback, seek, or state-changing endpoints.",
    ];
  }

  return [
    "The /Help response was readable, but no replay control functions were identified by simple keyword scanning.",
    "This does not prove replay controls are absent; it only means this documentation probe did not find them.",
  ];
}

async function writeLocalReplayConfigInspection(outputDirectory: string, configPath: string) {
  const report = await inspectLocalReplayConfig(configPath);
  const reportPath = path.join(outputDirectory, "local-replay-config-inspection.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

async function writeReplayApiConfigRecommendation(
  outputDirectory: string,
  inspectionPath: string,
  inspection: LocalReplayConfigInspectionReport,
) {
  const report = buildReplayApiConfigRecommendation(inspectionPath, inspection);
  const reportPath = path.join(outputDirectory, "replay-api-config-recommendation.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath: toProjectRelative(reportPath),
  };
}

function buildReplayApiConfigRecommendation(
  inspectionPath: string,
  inspection: LocalReplayConfigInspectionReport,
): ReplayApiConfigRecommendationReport {
  const gameCfg = inspection.configCandidates.find((candidate) =>
    path.normalize(candidate.path).toLowerCase().endsWith(path.normalize("League of Legends/Config/game.cfg").toLowerCase()),
  );

  return {
    schemaVersion: "replay-api-config-recommendation.v0.1",
    createdAt: new Date().toISOString(),
    basedOnInspectionPath: inspectionPath,
    readOnly: true,
    configSummary: {
      gameCfgFound: Boolean(gameCfg?.exists && gameCfg.readable),
      gameCfgPath: gameCfg?.exists && gameCfg.readable ? gameCfg.path : null,
      width: gameCfg?.detectedKeys.Width ?? null,
      height: gameCfg?.detectedKeys.Height ?? null,
      minimapScale: gameCfg?.detectedKeys.MinimapScale ?? null,
      enableReplayApiFound: inspection.summary.enableReplayApiFound,
      enableReplayApiValue: inspection.summary.enableReplayApiValue,
      globalScaleReplayFound: inspection.summary.globalScaleReplayFound,
      globalScaleReplayValue:
        inspection.configCandidates.find((candidate) => candidate.detectedKeys.GlobalScaleReplay !== null)?.detectedKeys
          .GlobalScaleReplay ?? null,
    },
    recommendation: {
      status: "manual_verification_recommended",
      notes: [
        "EnableReplayApi was not found in the inspected config files.",
        "This may explain why replay render/playback endpoints were not discovered.",
        "RiftLab should not modify League config automatically.",
        "Developer may manually inspect game.cfg and compare against pyLoL-style replay configuration.",
      ],
      manualChecks: [
        "Close League before editing config manually, if choosing to test manually.",
        "Back up game.cfg before any manual experiment.",
        "Check whether adding EnableReplayApi=1 under the appropriate config section changes endpoint discovery.",
        "After manual verification, open replay manually and rerun --probe-replay-api.",
      ],
    },
    nextProbe: {
      command: "npx tsx local-processor/src/index.ts --probe-replay-api --probe-replay-help --inspect-local-replay-config",
      expectedIfEnabled:
        "Replay endpoint discovery may change from liveclientdata_only to replay_endpoints_available if replay controls become exposed.",
      expectedIfUnchanged: "Discovery may remain liveclientdata_only.",
    },
    safety: {
      doesNotModifyConfig: true,
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
      doesNotChangeReplayState: true,
      doesNotCaptureFrames: true,
    },
  };
}

async function inspectLocalReplayConfig(configPath: string): Promise<LocalReplayConfigInspectionReport> {
  const candidates = getLocalReplayConfigCandidatePaths(configPath);
  const inspectedCandidates = await Promise.all(candidates.map((candidatePath) => inspectConfigCandidate(candidatePath)));
  const readableCandidates = inspectedCandidates.filter((candidate) => candidate.exists && candidate.readable);
  const enableReplayApiCandidate = readableCandidates.find((candidate) => candidate.detectedKeys.EnableReplayApi !== null);
  const resolutionFound = readableCandidates.some(
    (candidate) => candidate.detectedKeys.Width !== null && candidate.detectedKeys.Height !== null,
  );
  const minimapScaleFound = readableCandidates.some((candidate) => candidate.detectedKeys.MinimapScale !== null);
  const globalScaleReplayFound = readableCandidates.some(
    (candidate) => candidate.detectedKeys.GlobalScaleReplay !== null,
  );
  const unreadableExistingCount = inspectedCandidates.filter((candidate) => candidate.exists && !candidate.readable).length;
  const anyConfigFound = readableCandidates.length > 0;

  return {
    schemaVersion: "local-replay-config-inspection.v0.1",
    createdAt: new Date().toISOString(),
    inspectionRequested: true,
    readOnly: true,
    configCandidates: inspectedCandidates,
    summary: {
      anyConfigFound,
      enableReplayApiFound: Boolean(enableReplayApiCandidate),
      enableReplayApiValue: enableReplayApiCandidate?.detectedKeys.EnableReplayApi ?? null,
      resolutionFound,
      minimapScaleFound,
      globalScaleReplayFound,
    },
    interpretation: {
      status: getLocalReplayConfigInspectionStatus(anyConfigFound, unreadableExistingCount),
      notes: getLocalReplayConfigInspectionNotes(anyConfigFound, unreadableExistingCount, enableReplayApiCandidate),
    },
    safety: {
      readOnly: true,
      doesNotModifyConfig: true,
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
      doesNotChangeReplayState: true,
      doesNotCaptureFrames: true,
    },
  };
}

function getLocalReplayConfigCandidatePaths(configPath: string) {
  const env = process.env;
  const rootCandidates = [
    "C:/Riot Games/League of Legends",
    env["ProgramFiles"] ? path.join(env["ProgramFiles"], "Riot Games/League of Legends") : undefined,
    env["ProgramFiles(x86)"] ? path.join(env["ProgramFiles(x86)"], "Riot Games/League of Legends") : undefined,
    env["LOCALAPPDATA"] ? path.join(env["LOCALAPPDATA"], "Riot Games/League of Legends") : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const relativeConfigFiles = [
    "Config/game.cfg",
    "Config/PersistedSettings.json",
    "Config/LeagueClientSettings.yaml",
    "Config/LeagueClientSettings.yml",
  ];
  const candidates = [
    resolveFromCwd(configPath),
    ...rootCandidates.flatMap((root) => relativeConfigFiles.map((relativePath) => path.join(root, relativePath))),
  ];
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const normalized = path.normalize(candidate).toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

async function inspectConfigCandidate(candidatePath: string): Promise<LocalReplayConfigInspectionReport["configCandidates"][number]> {
  const detectedKeys = createEmptyDetectedConfigKeys();
  let fileStats;
  try {
    fileStats = await stat(candidatePath);
  } catch {
    return {
      path: candidatePath,
      exists: false,
      readable: false,
      detectedKeys,
      notes: ["Candidate file was not found."],
    };
  }

  if (!fileStats.isFile()) {
    return {
      path: candidatePath,
      exists: true,
      readable: false,
      detectedKeys,
      notes: ["Candidate exists but is not a file."],
    };
  }

  try {
    const contents = await readFile(candidatePath, "utf8");
    const parsedKeys = detectReplayConfigKeys(contents);
    return {
      path: candidatePath,
      exists: true,
      readable: true,
      detectedKeys: parsedKeys,
      notes: getConfigCandidateNotes(contents, parsedKeys),
    };
  } catch (error) {
    return {
      path: candidatePath,
      exists: true,
      readable: false,
      detectedKeys,
      notes: [`Candidate exists but could not be read as text: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function createEmptyDetectedConfigKeys() {
  return {
    EnableReplayApi: null,
    Width: null,
    Height: null,
    MinimapScale: null,
    GlobalScaleReplay: null,
  };
}

function detectReplayConfigKeys(contents: string): LocalReplayConfigInspectionReport["configCandidates"][number]["detectedKeys"] {
  return {
    EnableReplayApi: findConfigValue(contents, "EnableReplayApi"),
    Width: findConfigValue(contents, "Width"),
    Height: findConfigValue(contents, "Height"),
    MinimapScale: findConfigValue(contents, "MinimapScale"),
    GlobalScaleReplay: findConfigValue(contents, "GlobalScaleReplay"),
  };
}

function findConfigValue(contents: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`^\\s*${escapedKey}\\s*=\\s*([^\\r\\n#;]+)`, "im"),
    new RegExp(`^\\s*${escapedKey}\\s*:\\s*([^\\r\\n#;]+)`, "im"),
    new RegExp(`"\\s*${escapedKey}\\s*"\\s*:\\s*"?(.*?)"?\\s*(?:,|\\r?\\n|})`, "im"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(contents);
    if (match?.[1]) {
      return match[1].trim().replace(/^"|"$/g, "");
    }
  }

  return null;
}

function getConfigCandidateNotes(
  contents: string,
  detectedKeys: LocalReplayConfigInspectionReport["configCandidates"][number]["detectedKeys"],
) {
  const notes: string[] = [];
  const relatedTerms = ["hud", "interface", "window", "fullscreen", "replay", "minimap"];
  const foundTerms = relatedTerms.filter((term) => contents.toLowerCase().includes(term));

  if (Object.values(detectedKeys).some((value) => value !== null)) {
    notes.push("Known replay/HUD/minimap keys were detected.");
  }

  if (foundTerms.length > 0) {
    notes.push(`Related terms found for manual review: ${foundTerms.join(", ")}.`);
  }

  if (notes.length === 0) {
    notes.push("File was readable, but no known replay/HUD/minimap keys were detected.");
  }

  return notes;
}

function getLocalReplayConfigInspectionStatus(anyConfigFound: boolean, unreadableExistingCount: number) {
  if (anyConfigFound && unreadableExistingCount === 0) return "config_found";
  if (anyConfigFound && unreadableExistingCount > 0) return "partial";
  if (!anyConfigFound && unreadableExistingCount > 0) return "error";
  return "config_not_found";
}

function getLocalReplayConfigInspectionNotes(
  anyConfigFound: boolean,
  unreadableExistingCount: number,
  enableReplayApiCandidate: LocalReplayConfigInspectionReport["configCandidates"][number] | undefined,
) {
  if (enableReplayApiCandidate) {
    return [
      "EnableReplayApi was found in a readable config candidate.",
      "This is a local config observation only; endpoint discovery is still required to confirm available replay controls.",
    ];
  }

  if (anyConfigFound) {
    return [
      "At least one readable config candidate was found.",
      "EnableReplayApi was not found in the inspected candidates.",
      "Missing EnableReplayApi does not prove replay controls are impossible; it only means this read-only inspection did not find that key.",
    ];
  }

  if (unreadableExistingCount > 0) {
    return ["Some known config candidates existed but could not be read as text."];
  }

  return ["No known League/Riot config files were found in the inspected safe/common paths."];
}

function buildReplayApiEndpointDiscoveryReport(
  swaggerResponse: Awaited<ReturnType<typeof fetchReplayApiGet>>,
): ReplayApiEndpointDiscoveryReport {
  const emptyDiscovery = {
    pathCount: 0,
    hasReplayEndpoints: false,
    hasReplayRenderEndpoint: false,
    hasReplayPlaybackEndpoint: false,
    hasLiveClientDataEndpoints: false,
    replayPaths: [],
    liveClientDataPaths: [],
    swaggerPaths: [],
    otherPaths: [],
  };

  const safety = {
    getOnly: true as const,
    doesNotPost: true as const,
    doesNotChangeRender: true as const,
    doesNotChangePlayback: true as const,
    doesNotSeek: true as const,
    doesNotCaptureFrames: true as const,
    doesNotLaunchLeague: true as const,
    doesNotOpenReplay: true as const,
    doesNotAutomateKeyboardOrMouse: true as const,
    doesNotUseLcuAuthToken: true as const,
    doesNotParseRofl: true as const,
  };

  if (!swaggerResponse.ok || !swaggerResponse.body) {
    return {
      schemaVersion: "replay-api-endpoints.v0.1",
      createdAt: new Date().toISOString(),
      baseUrl: replayApiBaseUrl,
      swaggerAvailable: false,
      swaggerPath: "/swagger/v2/swagger.json",
      endpointDiscovery: emptyDiscovery,
      interpretation: {
        status: "swagger_unavailable",
        notes: [
          "Swagger endpoint could not be fetched from the local API host.",
          swaggerResponse.error
            ? `Last probe error: ${swaggerResponse.error}`
            : "No Swagger response body was available for endpoint discovery.",
        ],
      },
      safety,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(swaggerResponse.body) as unknown;
  } catch {
    return {
      schemaVersion: "replay-api-endpoints.v0.1",
      createdAt: new Date().toISOString(),
      baseUrl: replayApiBaseUrl,
      swaggerAvailable: false,
      swaggerPath: "/swagger/v2/swagger.json",
      endpointDiscovery: emptyDiscovery,
      interpretation: {
        status: "swagger_unavailable",
        notes: ["Swagger endpoint responded, but the body could not be parsed as JSON."],
      },
      safety,
    };
  }

  const pathsRecord = isRecord(parsed) && isRecord(parsed.paths) ? parsed.paths : undefined;
  if (!pathsRecord) {
    return {
      schemaVersion: "replay-api-endpoints.v0.1",
      createdAt: new Date().toISOString(),
      baseUrl: replayApiBaseUrl,
      swaggerAvailable: true,
      swaggerPath: "/swagger/v2/swagger.json",
      endpointDiscovery: emptyDiscovery,
      interpretation: {
        status: "unknown",
        notes: ["Swagger JSON was reachable, but no valid paths object was present."],
      },
      safety,
    };
  }

  const allPaths = Object.keys(pathsRecord).sort();
  const replayPaths = allPaths.filter((apiPath) => apiPath.startsWith("/replay"));
  const liveClientDataPaths = allPaths.filter((apiPath) => apiPath.startsWith("/liveclientdata"));
  const swaggerPaths = allPaths.filter((apiPath) => apiPath.startsWith("/swagger"));
  const otherPaths = allPaths.filter(
    (apiPath) =>
      !apiPath.startsWith("/replay") && !apiPath.startsWith("/liveclientdata") && !apiPath.startsWith("/swagger"),
  );
  const hasReplayRenderEndpoint = replayPaths.includes("/replay/render");
  const hasReplayPlaybackEndpoint = replayPaths.includes("/replay/playback");

  const interpretation =
    hasReplayRenderEndpoint || hasReplayPlaybackEndpoint
      ? {
          status: "replay_endpoints_available" as const,
          notes: ["Replay-scoped endpoints were discovered in Swagger and may support future assisted standardization."],
        }
      : liveClientDataPaths.length > 0
        ? {
            status: "liveclientdata_only" as const,
            notes: [
              "The local API host is reachable and Swagger is available.",
              "Replay render/playback endpoints were not discovered in the current client or replay state.",
            ],
          }
        : {
            status: "unknown" as const,
            notes: [
              "Swagger was reachable, but no replay endpoints and no liveclientdata endpoints were discovered.",
            ],
          };

  return {
    schemaVersion: "replay-api-endpoints.v0.1",
    createdAt: new Date().toISOString(),
    baseUrl: replayApiBaseUrl,
    swaggerAvailable: true,
    swaggerPath: "/swagger/v2/swagger.json",
    endpointDiscovery: {
      pathCount: allPaths.length,
      hasReplayEndpoints: replayPaths.length > 0,
      hasReplayRenderEndpoint,
      hasReplayPlaybackEndpoint,
      hasLiveClientDataEndpoints: liveClientDataPaths.length > 0,
      replayPaths,
      liveClientDataPaths,
      swaggerPaths,
      otherPaths,
    },
    interpretation,
    safety,
  };
}

function buildReplayEndpointContractsReport(
  swaggerResponse: Awaited<ReturnType<typeof fetchReplayApiGet>>,
  endpointDiscovery: ReplayApiEndpointDiscoveryReport | undefined,
): ReplayEndpointContractsReport {
  const safety = {
    swaggerReadOnly: true as const,
    doesNotCallReplayEndpoints: true as const,
    doesNotPost: true as const,
    doesNotChangeRender: true as const,
    doesNotChangePlayback: true as const,
    doesNotSeek: true as const,
    doesNotCaptureFrames: true as const,
    doesNotLaunchLeague: true as const,
    doesNotOpenReplay: true as const,
  };
  const emptyImportantEndpoints = {
    render: null,
    playback: null,
    game: null,
    sequence: null,
    recording: null,
  };

  if (!swaggerResponse.ok || !swaggerResponse.body) {
    return {
      schemaVersion: "replay-endpoint-contracts.v0.1",
      createdAt: new Date().toISOString(),
      baseUrl: replayApiBaseUrl,
      sourceSwaggerPath: "/swagger/v2/swagger.json",
      replayEndpointsDiscovered: false,
      endpoints: [],
      importantEndpoints: emptyImportantEndpoints,
      interpretation: {
        status: "swagger_unavailable",
        notes: [
          "Swagger endpoint could not be fetched, so replay endpoint contracts were not extracted.",
          swaggerResponse.error
            ? `Last Swagger fetch error: ${swaggerResponse.error}`
            : "No Swagger response body was available for contract extraction.",
        ],
      },
      safety,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(swaggerResponse.body) as unknown;
  } catch {
    return {
      schemaVersion: "replay-endpoint-contracts.v0.1",
      createdAt: new Date().toISOString(),
      baseUrl: replayApiBaseUrl,
      sourceSwaggerPath: "/swagger/v2/swagger.json",
      replayEndpointsDiscovered: false,
      endpoints: [],
      importantEndpoints: emptyImportantEndpoints,
      interpretation: {
        status: "swagger_unavailable",
        notes: ["Swagger endpoint responded, but the body could not be parsed as JSON."],
      },
      safety,
    };
  }

  const pathsRecord = isRecord(parsed) && isRecord(parsed.paths) ? parsed.paths : undefined;
  if (!pathsRecord) {
    return {
      schemaVersion: "replay-endpoint-contracts.v0.1",
      createdAt: new Date().toISOString(),
      baseUrl: replayApiBaseUrl,
      sourceSwaggerPath: "/swagger/v2/swagger.json",
      replayEndpointsDiscovered: false,
      endpoints: [],
      importantEndpoints: emptyImportantEndpoints,
      interpretation: {
        status: "swagger_unavailable",
        notes: ["Swagger JSON was reachable, but no valid paths object was present."],
      },
      safety,
    };
  }

  const endpoints = Object.entries(pathsRecord)
    .filter(([apiPath]) => apiPath.startsWith("/replay"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([apiPath, pathContract]) => buildReplayEndpointContract(apiPath, pathContract));
  const importantEndpoints = {
    render: endpoints.find((endpoint) => endpoint.path === "/replay/render") ?? null,
    playback: endpoints.find((endpoint) => endpoint.path === "/replay/playback") ?? null,
    game: endpoints.find((endpoint) => endpoint.path === "/replay/game") ?? null,
    sequence: endpoints.find((endpoint) => endpoint.path === "/replay/sequence") ?? null,
    recording: endpoints.find((endpoint) => endpoint.path === "/replay/recording") ?? null,
  };
  const replayEndpointsDiscovered =
    endpoints.length > 0 || Boolean(endpointDiscovery?.endpointDiscovery.hasReplayEndpoints);

  if (!replayEndpointsDiscovered) {
    return {
      schemaVersion: "replay-endpoint-contracts.v0.1",
      createdAt: new Date().toISOString(),
      baseUrl: replayApiBaseUrl,
      sourceSwaggerPath: "/swagger/v2/swagger.json",
      replayEndpointsDiscovered: false,
      endpoints: [],
      importantEndpoints,
      interpretation: {
        status: "no_replay_endpoints",
        notes: [
          "Swagger was readable, but no /replay paths were found.",
          "This report only extracts endpoint contracts from Swagger.",
          "It does not call render/playback endpoints.",
          "Future control steps must be implemented separately.",
        ],
      },
      safety,
    };
  }

  return {
    schemaVersion: "replay-endpoint-contracts.v0.1",
    createdAt: new Date().toISOString(),
    baseUrl: replayApiBaseUrl,
    sourceSwaggerPath: "/swagger/v2/swagger.json",
    replayEndpointsDiscovered: true,
    endpoints,
    importantEndpoints,
    interpretation: {
      status: "contracts_extracted",
      notes: [
        "This report only extracts endpoint contracts from Swagger.",
        "It does not call render/playback endpoints.",
        "Future control steps must be implemented separately.",
      ],
    },
    safety,
  };
}

function buildReplayEndpointContract(pathname: string, pathContract: unknown): ReplayEndpointContractsReport["endpoints"][number] {
  const pathRecord = isRecord(pathContract) ? pathContract : {};
  const methodNames = ["get", "post", "put", "delete", "patch", "options", "head"];
  const operations = methodNames
    .filter((method) => isRecord(pathRecord[method]))
    .map((method) => buildReplayEndpointOperationContract(method, pathRecord[method]));

  return {
    path: pathname,
    methods: operations.map((operation) => operation.method),
    operations,
  };
}

function buildReplayEndpointOperationContract(
  method: string,
  operationContract: unknown,
): ReplayEndpointContractsReport["endpoints"][number]["operations"][number] {
  const operationRecord = isRecord(operationContract) ? operationContract : {};
  const responses = isRecord(operationRecord.responses) ? operationRecord.responses : {};

  return {
    method: method.toUpperCase(),
    operationId: typeof operationRecord.operationId === "string" ? operationRecord.operationId : null,
    summary: typeof operationRecord.summary === "string" ? operationRecord.summary : null,
    parameters: Array.isArray(operationRecord.parameters) ? operationRecord.parameters : [],
    responseStatusCodes: Object.keys(responses).sort(),
  };
}

function buildReplayStateSnapshotReport(
  endpoints: ReplayStateSnapshotReport["endpoints"],
): ReplayStateSnapshotReport {
  const readability = {
    gameReadable: endpoints.game.ok && endpoints.game.data !== null,
    renderReadable: endpoints.render.ok && endpoints.render.data !== null,
    playbackReadable: endpoints.playback.ok && endpoints.playback.data !== null,
    sequenceReadable: endpoints.sequence.ok && endpoints.sequence.data !== null,
    recordingReadable: endpoints.recording.ok && endpoints.recording.data !== null,
  };
  const readableCount = Object.values(readability).filter(Boolean).length;
  const status: ReplayStateSnapshotReport["interpretation"]["status"] =
    readableCount === 5
      ? "snapshot_complete"
      : readableCount > 0
        ? "partial"
        : "failed";

  return {
    schemaVersion: "replay-state-snapshot.v0.1",
    createdAt: new Date().toISOString(),
    baseUrl: replayApiBaseUrl,
    readOnly: true,
    requested: true,
    endpoints,
    summary: {
      allRequestedReadsCompleted: true,
      ...readability,
    },
    interpretation: {
      status,
      notes:
        status === "snapshot_complete"
          ? ["This is a read-only snapshot.", "No replay state was changed."]
          : status === "partial"
            ? [
                "This is a read-only snapshot.",
                "Some replay endpoints were readable while others failed or returned unreadable data.",
                "No replay state was changed.",
              ]
            : [
                "This is a read-only snapshot attempt.",
                "Replay state reads failed or returned no readable JSON data.",
                "No replay state was changed.",
              ],
    },
    safety: {
      getOnly: true,
      doesNotPost: true,
      doesNotChangeRender: true,
      doesNotChangePlayback: true,
      doesNotSeek: true,
      doesNotStartRecording: true,
      doesNotCaptureFrames: true,
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
    },
  };
}

function buildReplayRenderPresetPlanReport(
  replayStateSnapshot: ReplayStateSnapshotReport | undefined,
  replayStateSnapshotPath: string | undefined,
): ReplayRenderPresetPlanReport {
  const safety = {
    dryRunOnly: true as const,
    doesNotPost: true as const,
    doesNotChangeRender: true as const,
    doesNotChangePlayback: true as const,
    doesNotSeek: true as const,
    doesNotCaptureFrames: true as const,
    doesNotLaunchLeague: true as const,
    doesNotOpenReplay: true as const,
  };
  const emptySubset = createReplayRenderSubset(null);
  const emptyDiff = buildReplayRenderPresetDiff(emptySubset, replayRenderPresetV01);

  if (!replayStateSnapshot || !replayStateSnapshotPath) {
    return {
      schemaVersion: "replay-render-preset-plan.v0.1",
      createdAt: new Date().toISOString(),
      mode: "replay_api_assisted_dry_run",
      readOnly: true,
      presetName: "riftlab_minimap_capture_v0.1",
      sourceSnapshotPath: "local-processor/output/replay-state-snapshot.json",
      currentRenderSubset: emptySubset,
      proposedPreset: replayRenderPresetV01,
      diff: emptyDiff,
      summary: {
        totalKeysChecked: emptyDiff.length,
        changesNeeded: emptyDiff.filter((entry) => entry.changeNeeded).length,
        alreadyMatches: emptyDiff.filter((entry) => !entry.changeNeeded).length,
        readyForApplyStep: false,
      },
      interpretation: {
        status: "snapshot_missing",
        notes: [
          "Render preset dry run requires a replay state snapshot.",
          "No render state was changed.",
          "Future versions may apply this preset with explicit opt-in.",
        ],
      },
      safety,
    };
  }

  if (!replayStateSnapshot.summary.renderReadable || !isRecord(replayStateSnapshot.endpoints.render.data)) {
    return {
      schemaVersion: "replay-render-preset-plan.v0.1",
      createdAt: new Date().toISOString(),
      mode: "replay_api_assisted_dry_run",
      readOnly: true,
      presetName: "riftlab_minimap_capture_v0.1",
      sourceSnapshotPath: replayStateSnapshotPath,
      currentRenderSubset: emptySubset,
      proposedPreset: replayRenderPresetV01,
      diff: emptyDiff,
      summary: {
        totalKeysChecked: emptyDiff.length,
        changesNeeded: emptyDiff.filter((entry) => entry.changeNeeded).length,
        alreadyMatches: emptyDiff.filter((entry) => !entry.changeNeeded).length,
        readyForApplyStep: false,
      },
      interpretation: {
        status: "render_unreadable",
        notes: [
          "Replay render state was not readable from the snapshot.",
          "No render state was changed.",
          "Future versions may apply this preset with explicit opt-in.",
        ],
      },
      safety,
    };
  }

  const currentRenderSubset = createReplayRenderSubset(replayStateSnapshot.endpoints.render.data);
  const diff = buildReplayRenderPresetDiff(currentRenderSubset, replayRenderPresetV01);
  const changesNeeded = diff.filter((entry) => entry.changeNeeded).length;
  const alreadyMatches = diff.length - changesNeeded;

  return {
    schemaVersion: "replay-render-preset-plan.v0.1",
    createdAt: new Date().toISOString(),
    mode: "replay_api_assisted_dry_run",
    readOnly: true,
    presetName: "riftlab_minimap_capture_v0.1",
    sourceSnapshotPath: replayStateSnapshotPath,
    currentRenderSubset,
    proposedPreset: replayRenderPresetV01,
    diff,
    summary: {
      totalKeysChecked: diff.length,
      changesNeeded,
      alreadyMatches,
      readyForApplyStep: true,
    },
    interpretation: {
      status: "plan_created",
      notes: [
        "This is a dry-run render preset plan.",
        "No render state was changed.",
        "Future versions may apply this preset with explicit opt-in.",
      ],
    },
    safety,
  };
}

function createReplayRenderSubset(renderData: Record<string, unknown> | null): ReplayRenderPresetSubset {
  const keys: ReplayRenderPresetKey[] = [
    "interfaceMinimap",
    "interfaceReplay",
    "interfaceScoreboard",
    "interfaceChat",
    "interfaceTimeline",
    "interfaceScore",
    "fogOfWar",
    "cameraMode",
  ];

  return Object.fromEntries(
    keys.map((key) => [key, renderData && key in renderData ? normalizeReplayRenderValue(renderData[key]) : null]),
  ) as ReplayRenderPresetSubset;
}

function normalizeReplayRenderValue(value: unknown) {
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  return null;
}

function buildReplayRenderPresetDiff(
  currentRenderSubset: ReplayRenderPresetSubset,
  proposedPreset: ReplayRenderPresetSubset,
): ReplayRenderPresetPlanReport["diff"] {
  const keys = Object.keys(proposedPreset) as ReplayRenderPresetKey[];
  return keys.map((key) => ({
    key,
    current: currentRenderSubset[key],
    proposed: proposedPreset[key],
    changeNeeded: currentRenderSubset[key] !== proposedPreset[key],
  }));
}

function getPlaybackWindowInputs(
  args: ReturnType<typeof parseCliArgs>,
  replayStateSnapshot: ReplayStateSnapshotReport | undefined,
) {
  const currentPlayback = getReplayPlaybackState(replayStateSnapshot);
  const replayLength = currentPlayback?.length ?? 0;
  const requestedStartTime = args.windowStart ?? currentPlayback?.time ?? 0;
  const requestedDuration = args.windowDuration ?? defaultPlaybackWindowDurationSeconds;
  const requestedSpeed = args.windowSpeed ?? defaultPlaybackWindowSpeed;
  const sampleRateFps = args.sampleRateFps ?? defaultPlaybackWindowSampleRateFps;
  const computedPlan = computePlaybackWindowPlan(
    replayLength,
    requestedStartTime,
    requestedDuration,
    requestedSpeed,
    sampleRateFps,
  );

  return {
    currentPlayback,
    requestedWindow: {
      startTime: requestedStartTime,
      duration: requestedDuration,
      endTime: requestedStartTime + requestedDuration,
      requestedSpeed,
      sampleRateFps,
    } satisfies ReplayPlaybackWindowRequest,
    computedPlan,
  };
}

function getReplayPlaybackState(replayStateSnapshot: ReplayStateSnapshotReport | undefined): ReplayPlaybackState | null {
  if (!replayStateSnapshot?.summary.playbackReadable || !isRecord(replayStateSnapshot.endpoints.playback.data)) {
    return null;
  }

  const playbackData = replayStateSnapshot.endpoints.playback.data;
  return {
    length: getNumberValue(playbackData.length, 0),
    time: getNumberValue(playbackData.time, 0),
    paused: getBooleanValue(playbackData.paused, true),
    speed: getNumberValue(playbackData.speed, 1),
    seeking: getBooleanValue(playbackData.seeking, false),
  };
}

function computePlaybackWindowPlan(
  replayLength: number,
  requestedStartTime: number,
  requestedDuration: number,
  requestedSpeed: number,
  sampleRateFps: number,
): ReplayPlaybackWindowComputedPlan {
  const safeReplayLength = Math.max(0, replayLength);
  const safeRequestedStartTime = Math.max(0, requestedStartTime);
  const safeRequestedDuration = Math.max(0, requestedDuration);
  const safeRequestedSpeed = requestedSpeed > 0 ? requestedSpeed : defaultPlaybackWindowSpeed;
  const safeSampleRateFps = sampleRateFps > 0 ? sampleRateFps : defaultPlaybackWindowSampleRateFps;
  const unclampedEndTime = safeRequestedStartTime + safeRequestedDuration;
  const effectiveStartTime =
    safeReplayLength > 0 ? Math.min(safeRequestedStartTime, safeReplayLength) : safeRequestedStartTime;
  const effectiveEndTime =
    safeReplayLength > 0 ? Math.min(unclampedEndTime, safeReplayLength) : unclampedEndTime;
  const effectiveDuration = Math.max(0, effectiveEndTime - effectiveStartTime);

  return {
    clamped: effectiveStartTime !== safeRequestedStartTime || effectiveEndTime !== unclampedEndTime,
    effectiveStartTime: roundMetric(effectiveStartTime),
    effectiveEndTime: roundMetric(effectiveEndTime),
    effectiveDuration: roundMetric(effectiveDuration),
    estimatedRealSeconds: roundMetric(effectiveDuration / safeRequestedSpeed),
    estimatedFrameCount: Math.max(0, Math.round(effectiveDuration * safeSampleRateFps)),
  };
}

function buildReplayPlaybackWindowPlanReport(
  playbackWindowInputs: ReturnType<typeof getPlaybackWindowInputs>,
): ReplayPlaybackWindowPlanReport {
  return {
    schemaVersion: "replay-playback-window-plan.v0.1",
    createdAt: new Date().toISOString(),
    mode: "replay_api_assisted",
    dryRun: true,
    currentPlayback: {
      length: playbackWindowInputs.currentPlayback?.length ?? 0,
      time: playbackWindowInputs.currentPlayback?.time ?? 0,
      paused: playbackWindowInputs.currentPlayback?.paused ?? true,
      speed: playbackWindowInputs.currentPlayback?.speed ?? 1,
    },
    requestedWindow: playbackWindowInputs.requestedWindow,
    computedPlan: playbackWindowInputs.computedPlan,
    safety: {
      doesNotCaptureFrames: true,
      doesNotTouchRender: true,
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
    },
  };
}

async function applyReplayPlaybackWindow(
  playbackWindowInputs: ReturnType<typeof getPlaybackWindowInputs>,
  restorePlaybackAfterApply: boolean,
): Promise<ReplayPlaybackWindowApplyReport> {
  const previousPlayback = playbackWindowInputs.currentPlayback;
  const applyRequest = {
    time: playbackWindowInputs.computedPlan.effectiveStartTime,
    speed: playbackWindowInputs.requestedWindow.requestedSpeed,
    paused: false,
  };
  const emptyPlaybackState = {
    time: null,
    speed: null,
    paused: null,
    seeking: null,
  };

  if (!previousPlayback) {
    return {
      schemaVersion: "replay-playback-window-apply-report.v0.1",
      createdAt: new Date().toISOString(),
      mode: "replay_api_assisted",
      applied: false,
      previousPlayback: emptyPlaybackState,
      requestedWindow: playbackWindowInputs.requestedWindow,
      applyRequest,
      afterApplyPlayback: emptyPlaybackState,
      restore: {
        requested: restorePlaybackAfterApply,
        attempted: false,
        previousStateRestoreRequest: null,
        afterRestorePlayback: null,
      },
      interpretation: {
        status: "apply_failed",
        notes: [
          "Replay playback state was not readable before apply.",
          "No frame capture or render changes were performed.",
        ],
      },
      safety: {
        doesNotCaptureFrames: true,
        doesNotTouchRender: true,
        doesNotLaunchLeague: true,
        doesNotOpenReplay: true,
        doesNotAutomateKeyboardOrMouse: true,
        doesNotParseRofl: true,
      },
    };
  }

  const postResponse = await postReplayPlayback(applyRequest);
  await waitMilliseconds(250);
  const afterApplyEndpoint = await readReplayStateEndpoint("/replay/playback");
  const afterApplyPlayback = getPlaybackStateFromEndpointResult(afterApplyEndpoint);

  if (!postResponse.ok || !afterApplyPlayback) {
    return {
      schemaVersion: "replay-playback-window-apply-report.v0.1",
      createdAt: new Date().toISOString(),
      mode: "replay_api_assisted",
      applied: false,
      previousPlayback: toPlaybackStateSummary(previousPlayback),
      requestedWindow: playbackWindowInputs.requestedWindow,
      applyRequest,
      afterApplyPlayback: toPlaybackStateSummary(afterApplyPlayback),
      restore: {
        requested: restorePlaybackAfterApply,
        attempted: false,
        previousStateRestoreRequest: restorePlaybackAfterApply
          ? {
              time: previousPlayback.time,
              speed: previousPlayback.speed,
              paused: previousPlayback.paused,
            }
          : null,
        afterRestorePlayback: null,
      },
      interpretation: {
        status: "apply_failed",
        notes: [
          postResponse.error
            ? `Playback apply POST failed: ${postResponse.error}`
            : "Playback apply verification read did not return readable state.",
          "No frame capture or render changes were performed.",
        ],
      },
      safety: {
        doesNotCaptureFrames: true,
        doesNotTouchRender: true,
        doesNotLaunchLeague: true,
        doesNotOpenReplay: true,
        doesNotAutomateKeyboardOrMouse: true,
        doesNotParseRofl: true,
      },
    };
  }

  if (!restorePlaybackAfterApply) {
    return {
      schemaVersion: "replay-playback-window-apply-report.v0.1",
      createdAt: new Date().toISOString(),
      mode: "replay_api_assisted",
      applied: true,
      previousPlayback: toPlaybackStateSummary(previousPlayback),
      requestedWindow: playbackWindowInputs.requestedWindow,
      applyRequest,
      afterApplyPlayback: toPlaybackStateSummary(afterApplyPlayback),
      restore: {
        requested: false,
        attempted: false,
        previousStateRestoreRequest: null,
        afterRestorePlayback: null,
      },
      interpretation: {
        status: "applied_no_restore",
        notes: [
          "Replay playback window was applied without restoration.",
          "No frame capture or render changes were performed.",
        ],
      },
      safety: {
        doesNotCaptureFrames: true,
        doesNotTouchRender: true,
        doesNotLaunchLeague: true,
        doesNotOpenReplay: true,
        doesNotAutomateKeyboardOrMouse: true,
        doesNotParseRofl: true,
      },
    };
  }

  const restoreRequest = {
    time: previousPlayback.time,
    speed: previousPlayback.speed,
    paused: previousPlayback.paused,
  };
  const restoreResponse = await postReplayPlayback(restoreRequest);
  await waitMilliseconds(250);
  const afterRestoreEndpoint = await readReplayStateEndpoint("/replay/playback");
  const afterRestorePlayback = getPlaybackStateFromEndpointResult(afterRestoreEndpoint);
  const restored = Boolean(
    restoreResponse.ok &&
      afterRestorePlayback &&
      afterRestorePlayback.paused === previousPlayback.paused &&
      roundMetric(afterRestorePlayback.speed) === roundMetric(previousPlayback.speed),
  );

  return {
    schemaVersion: "replay-playback-window-apply-report.v0.1",
    createdAt: new Date().toISOString(),
    mode: "replay_api_assisted",
    applied: true,
    previousPlayback: toPlaybackStateSummary(previousPlayback),
    requestedWindow: playbackWindowInputs.requestedWindow,
    applyRequest,
    afterApplyPlayback: toPlaybackStateSummary(afterApplyPlayback),
    restore: {
      requested: true,
      attempted: true,
      previousStateRestoreRequest: restoreRequest,
      afterRestorePlayback: toPlaybackStateSummary(afterRestorePlayback),
    },
    interpretation: {
      status: restored ? "applied_and_restored" : "restore_failed",
      notes: restored
        ? [
            "Replay playback window was applied and the previous playback state was restored.",
            "No frame capture or render changes were performed.",
          ]
        : [
            restoreResponse.error
              ? `Playback restore POST failed: ${restoreResponse.error}`
              : "Playback restore verification did not match the previous state closely enough.",
            "No frame capture or render changes were performed.",
          ],
    },
    safety: {
      doesNotCaptureFrames: true,
      doesNotTouchRender: true,
      doesNotLaunchLeague: true,
      doesNotOpenReplay: true,
      doesNotAutomateKeyboardOrMouse: true,
      doesNotParseRofl: true,
    },
  };
}

async function applyReplayPlaybackWindowWithCapture(
  playbackWindowInputs: ReturnType<typeof getPlaybackWindowInputs>,
  restorePlaybackAfterApply: boolean,
  frameDirectory: string,
  crop: { x: number; y: number; width: number; height: number },
) {
  const previousPlayback = playbackWindowInputs.currentPlayback;
  const applyRequest = {
    time: playbackWindowInputs.computedPlan.effectiveStartTime,
    speed: playbackWindowInputs.requestedWindow.requestedSpeed,
    paused: false,
  };
  const emptyPlaybackState = {
    time: null,
    speed: null,
    paused: null,
    seeking: null,
  };

  if (!previousPlayback) {
    return {
      applyReport: {
        schemaVersion: "replay-playback-window-apply-report.v0.1",
        createdAt: new Date().toISOString(),
        mode: "replay_api_assisted",
        applied: false,
        previousPlayback: emptyPlaybackState,
        requestedWindow: playbackWindowInputs.requestedWindow,
        applyRequest,
        afterApplyPlayback: emptyPlaybackState,
        restore: {
          requested: restorePlaybackAfterApply,
          attempted: false,
          previousStateRestoreRequest: null,
          afterRestorePlayback: null,
        },
        interpretation: {
          status: "apply_failed",
          notes: [
            "Replay playback state was not readable before apply.",
            "No frame capture or render changes were performed.",
          ],
        },
        safety: {
          doesNotCaptureFrames: true,
          doesNotTouchRender: true,
          doesNotLaunchLeague: true,
          doesNotOpenReplay: true,
          doesNotAutomateKeyboardOrMouse: true,
          doesNotParseRofl: true,
        },
      } satisfies ReplayPlaybackWindowApplyReport,
      frames: [] as MinimapFrameSequenceReport["frames"],
      normalized: false,
      captureCompleted: false,
      captureError: "playback state is not readable.",
    };
  }

  const postResponse = await postReplayPlayback(applyRequest);
  await waitMilliseconds(250);
  const afterApplyEndpoint = await readReplayStateEndpoint("/replay/playback");
  const afterApplyPlayback = getPlaybackStateFromEndpointResult(afterApplyEndpoint);

  let frames: MinimapFrameSequenceReport["frames"] = [];
  let normalized = false;
  let captureCompleted = false;
  let captureError: string | undefined;

  if (postResponse.ok && afterApplyPlayback) {
    try {
      const captureResult = await captureMinimapFramesDuringPlaybackWindow(playbackWindowInputs, frameDirectory, crop);
      frames = captureResult.frames;
      normalized = captureResult.normalized;
      captureCompleted = true;
    } catch (error) {
      captureError = error instanceof Error ? error.message : String(error);
    }
  } else {
    captureError = postResponse.error ?? "Playback apply verification read did not return readable state.";
  }

  const restoreRequest = {
    time: previousPlayback.time,
    speed: previousPlayback.speed,
    paused: previousPlayback.paused,
  };
  let restoreAttempted = false;
  let restoreResponse:
    | {
        ok: boolean;
        statusCode: number | null;
        error: string | null;
        body: string | null;
      }
    | undefined;
  let afterRestorePlayback: ReplayPlaybackState | null = null;

  if (restorePlaybackAfterApply) {
    restoreAttempted = true;
    restoreResponse = await postReplayPlayback(restoreRequest);
    await waitMilliseconds(250);
    const afterRestoreEndpoint = await readReplayStateEndpoint("/replay/playback");
    afterRestorePlayback = getPlaybackStateFromEndpointResult(afterRestoreEndpoint);
  }

  const restored = Boolean(
    restorePlaybackAfterApply &&
      restoreResponse?.ok &&
      afterRestorePlayback &&
      afterRestorePlayback.paused === previousPlayback.paused &&
      roundMetric(afterRestorePlayback.speed) === roundMetric(previousPlayback.speed),
  );

  const interpretationStatus: ReplayPlaybackWindowApplyReport["interpretation"]["status"] =
    !postResponse.ok || !afterApplyPlayback
      ? "apply_failed"
      : restorePlaybackAfterApply
        ? restored
          ? "applied_and_restored"
          : "restore_failed"
        : "applied_no_restore";

  return {
    applyReport: {
      schemaVersion: "replay-playback-window-apply-report.v0.1",
      createdAt: new Date().toISOString(),
      mode: "replay_api_assisted",
      applied: Boolean(postResponse.ok && afterApplyPlayback),
      previousPlayback: toPlaybackStateSummary(previousPlayback),
      requestedWindow: playbackWindowInputs.requestedWindow,
      applyRequest,
      afterApplyPlayback: toPlaybackStateSummary(afterApplyPlayback),
      restore: {
        requested: restorePlaybackAfterApply,
        attempted: restoreAttempted,
        previousStateRestoreRequest: restorePlaybackAfterApply ? restoreRequest : null,
        afterRestorePlayback: toPlaybackStateSummary(afterRestorePlayback),
      },
      interpretation: {
        status: interpretationStatus,
        notes:
          interpretationStatus === "apply_failed"
            ? [
                captureError ?? "Playback apply failed before frame capture could complete.",
                "No render changes were performed.",
              ]
            : interpretationStatus === "restore_failed"
              ? [
                  restoreResponse?.error ?? "Frame capture completed, but playback restore verification did not match the previous state.",
                  "No render changes were performed.",
                ]
              : interpretationStatus === "applied_and_restored"
                ? [
                    "Replay playback window was applied and the previous playback state was restored.",
                    "No render changes were performed.",
                  ]
                : [
                    "Replay playback window was applied without restoration.",
                    "No render changes were performed.",
                  ],
      },
      safety: {
        doesNotCaptureFrames: true,
        doesNotTouchRender: true,
        doesNotLaunchLeague: true,
        doesNotOpenReplay: true,
        doesNotAutomateKeyboardOrMouse: true,
        doesNotParseRofl: true,
      },
    } satisfies ReplayPlaybackWindowApplyReport,
    frames,
    normalized,
    captureCompleted,
    captureError,
  };
}

async function captureMinimapFramesDuringPlaybackWindow(
  playbackWindowInputs: ReturnType<typeof getPlaybackWindowInputs>,
  frameDirectory: string,
  crop: { x: number; y: number; width: number; height: number },
) {
  const frames: MinimapFrameSequenceReport["frames"] = [];
  const totalFrames = playbackWindowInputs.computedPlan.estimatedFrameCount;
  const replayIntervalMs =
    1000 / (playbackWindowInputs.requestedWindow.sampleRateFps * playbackWindowInputs.requestedWindow.requestedSpeed);
  let normalized = true;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const frameNumber = frameIndex + 1;
    const fileName = `frame-${String(frameNumber).padStart(6, "0")}.png`;
    const outputPath = path.join(frameDirectory, fileName);
    const captureResult = await captureMinimapFrameToFile(outputPath, crop);
    normalized = normalized && captureResult.normalized;
    frames.push({
      index: frameNumber,
      path: toProjectRelative(outputPath),
      targetReplayTime: roundMetric(
        playbackWindowInputs.computedPlan.effectiveStartTime + frameIndex / playbackWindowInputs.requestedWindow.sampleRateFps,
      ),
      capturedAt: new Date().toISOString(),
    });

    if (frameIndex < totalFrames - 1) {
      await waitMilliseconds(replayIntervalMs);
    }
  }

  return {
    frames,
    normalized,
  };
}

async function captureMinimapFrameToFile(
  outputPath: string,
  crop: { x: number; y: number; width: number; height: number },
) {
  const rawOutputPath = outputPath.replace(/\.png$/i, ".raw.png");
  await captureScreenRegionPng(rawOutputPath, crop);

  try {
    const sharp = (await import("sharp")).default;
    await sharp(rawOutputPath).resize(512, 512).png().toFile(outputPath);
    await unlink(rawOutputPath);
    return { normalized: true };
  } catch {
    if (rawOutputPath !== outputPath) {
      const rawBuffer = await readFile(rawOutputPath);
      await writeFile(outputPath, rawBuffer);
      await unlink(rawOutputPath);
    }
    return { normalized: false };
  }
}

async function captureScreenRegionPng(
  outputPath: string,
  crop: { x: number; y: number; width: number; height: number },
) {
  const script = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Drawing",
    "$bitmap = New-Object System.Drawing.Bitmap ([int]$env:RIFTLAB_CAPTURE_W), ([int]$env:RIFTLAB_CAPTURE_H)",
    "$graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
    "$graphics.CopyFromScreen([int]$env:RIFTLAB_CAPTURE_X, [int]$env:RIFTLAB_CAPTURE_Y, 0, 0, $bitmap.Size)",
    "$bitmap.Save($env:RIFTLAB_CAPTURE_OUT, [System.Drawing.Imaging.ImageFormat]::Png)",
    "$graphics.Dispose()",
    "$bitmap.Dispose()",
  ].join(";");

  await execFileAsync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      env: {
        ...process.env,
        RIFTLAB_CAPTURE_X: String(crop.x),
        RIFTLAB_CAPTURE_Y: String(crop.y),
        RIFTLAB_CAPTURE_W: String(crop.width),
        RIFTLAB_CAPTURE_H: String(crop.height),
        RIFTLAB_CAPTURE_OUT: outputPath,
      },
      windowsHide: true,
    },
  );
}

function getPlaybackStateFromEndpointResult(
  endpoint: ReplayStateSnapshotReport["endpoints"][keyof ReplayStateSnapshotReport["endpoints"]] | null,
) {
  if (!endpoint?.ok || !isRecord(endpoint.data)) {
    return null;
  }

  return {
    length: getNumberValue(endpoint.data.length, 0),
    time: getNumberValue(endpoint.data.time, 0),
    paused: getBooleanValue(endpoint.data.paused, true),
    speed: getNumberValue(endpoint.data.speed, 1),
    seeking: getBooleanValue(endpoint.data.seeking, false),
  } satisfies ReplayPlaybackState;
}

function toPlaybackStateSummary(playbackState: ReplayPlaybackState | null) {
  return {
    time: playbackState?.time ?? null,
    speed: playbackState?.speed ?? null,
    paused: playbackState?.paused ?? null,
    seeking: playbackState?.seeking ?? null,
  };
}

function getNumberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getBooleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function roundMetric(value: number) {
  return Number(value.toFixed(3));
}

function probeReplayApiEndpoint(endpointPath: ReplayApiStatus["checkedEndpoints"][number]["path"]) {
  return fetchReplayApiGet(endpointPath).then((response) => ({
    path: endpointPath,
    method: "GET" as const,
    ok: response.ok,
    statusCode: response.statusCode,
    error: response.error,
  }));
}

async function readReplayStateEndpoint(
  endpointPath: ReplayStateSnapshotEndpointPath,
): Promise<ReplayStateSnapshotReport["endpoints"][keyof ReplayStateSnapshotReport["endpoints"]]> {
  const response = await fetchReplayApiGet(endpointPath);

  return {
    path: endpointPath,
    method: "GET",
    ok: response.ok,
    statusCode: response.statusCode,
    data: parseJsonIfPossible(response.body),
    error: response.error,
  };
}

function fetchReplayApiGet(pathname: string) {
  return new Promise<{
    ok: boolean;
    statusCode: number | null;
    error: string | null;
    body: string | null;
  }>((resolve) => {
    const request = https.request(
      `${replayApiBaseUrl}${pathname}`,
      {
        method: "GET",
        timeout: 1500,
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
            statusCode: response.statusCode ?? null,
            error: null,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        statusCode: null,
        error: error.message,
        body: null,
      });
    });

    request.end();
  });
}

function parseJsonIfPossible(body: string | null) {
  if (!body) return null;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function postReplayPlayback(body: { time: number; speed: number; paused: boolean }) {
  return new Promise<{
    ok: boolean;
    statusCode: number | null;
    error: string | null;
    body: string | null;
  }>((resolve) => {
    const payload = JSON.stringify(body);
    const request = https.request(
      `${replayApiBaseUrl}/replay/playback`,
      {
        method: "POST",
        timeout: 1500,
        rejectUnauthorized: false,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload).toString(),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
            statusCode: response.statusCode ?? null,
            error: null,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        statusCode: null,
        error: error.message,
        body: null,
      });
    });

    request.write(payload);
    request.end();
  });
}

function fetchReplayApiPost(pathname: "/Help") {
  return new Promise<{
    ok: boolean;
    statusCode: number | null;
    error: string | null;
    body: string | null;
  }>((resolve) => {
    const request = https.request(
      `${replayApiBaseUrl}${pathname}`,
      {
        method: "POST",
        timeout: 1500,
        rejectUnauthorized: false,
        headers: {
          "content-length": "0",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
            statusCode: response.statusCode ?? null,
            error: null,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        statusCode: null,
        error: error.message,
        body: null,
      });
    });

    request.end();
  });
}

function waitMilliseconds(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function writeFixedCapturePreset(
  outputDirectory: string,
  mode: "manual_safe" | "semi_auto_future" | "server_future",
  selectedReplay: SelectedReplayFile,
  matchIdentity: MatchIdentity,
) {
  const outputPath = path.join(outputDirectory, "fixed-capture-preset.json");
  const preset: FixedCapturePreset = {
    schemaVersion: "fixed-capture-preset.v0.1",
    createdAt: new Date().toISOString(),
    mode,
    selectedReplay,
    matchIdentity,
    capturePreset: {
      enabledNow: false,
      presetName: "default_1920x1080_observer_replay",
      expectedWindowResolution: {
        ...expectedReplayWindowResolution,
      },
      captureRegion: {
        type: "full_window_future",
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      },
      minimapCropPreset: {
        enabledNow: false,
        coordinateSystem: "window_pixels",
        expectedResolution: {
          ...expectedReplayWindowResolution,
        },
        crop: {
          ...defaultMinimapCropPreset,
        },
        normalizedOutput: {
          width: 512,
          height: 512,
        },
        notes: [
          "Initial placeholder crop for future calibration.",
          "This must be validated against real replay screenshots before analysis.",
          "No frames are captured in this version.",
        ],
      },
    },
    futureRequirements: {
      requiresManualReplayOpen: true,
      requiresPassiveWindowDetection: true,
      requiresFrameCaptureImplementation: true,
      requiresMinimapCropValidation: true,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotClickClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
      doesNotCaptureFramesYet: true,
    },
  };

  await writeFile(outputPath, `${JSON.stringify(preset, null, 2)}\n`, "utf8");
  console.log(`Fixed capture preset written to ${toProjectRelative(outputPath)}`);
  return outputPath;
}

async function writeReplayWindowReadiness(
  outputDirectory: string,
  mode: "manual_safe" | "semi_auto_future" | "server_future",
  selectedReplay: SelectedReplayFile,
  matchIdentity: MatchIdentity,
) {
  const outputPath = path.join(outputDirectory, "replay-window-readiness.json");
  const readiness: ReplayWindowReadiness = {
    schemaVersion: "replay-window-readiness.v0.1",
    createdAt: new Date().toISOString(),
    mode,
    selectedReplay,
    matchIdentity,
    manualPrerequisites: {
      userMustOpenLeagueClient: true,
      userMustOpenReplayManually: true,
      userMustWaitUntilReplayLoaded: true,
      clientAutomationAllowed: false,
    },
    futureWindowDetectionPlan: {
      enabledNow: false,
      method: "passive_window_lookup_future",
      allowedSignals: ["window_title", "process_name", "screen_bounds"],
      disallowedSignals: [
        "memory_reading",
        "client_injection",
        "input_automation",
        "network_interception",
        "anticheat_bypass",
      ],
      expectedWindowTitleHints: ["League of Legends", "League of Legends (TM) Client"],
      expectedProcessNameHints: ["League of Legends.exe", "LeagueClientUx.exe"],
    },
    futureCaptureReadiness: {
      frameCaptureEnabledNow: false,
      requiresManualReplayOpen: true,
      requiresPassiveWindowDetection: true,
      requiresFixedCapturePreset: true,
      requiresMinimapCropPreset: true,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotClickClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
    },
  };

  await writeFile(outputPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");
  console.log(`Replay window readiness config written to ${toProjectRelative(outputPath)}`);
  return outputPath;
}

async function writeManualReplayOpenChecklist(
  outputDirectory: string,
  mode: "manual_safe" | "semi_auto_future" | "server_future",
  selectedReplay: SelectedReplayFile,
  matchIdentity: MatchIdentity,
  filenameHint: ReplayFilenameHint,
  apiMatchContext: ApiMatchContextManifestMetadata | undefined,
  matchContextConsistency: MatchContextConsistency,
) {
  const outputPath = path.join(outputDirectory, "manual-replay-open-checklist.json");
  const checklist: ManualReplayOpenChecklist = {
    schemaVersion: "manual-replay-open-checklist.v0.1",
    createdAt: new Date().toISOString(),
    mode,
    selectedReplay,
    matchIdentity,
    filenameHint,
    apiMatchContext,
    matchContextConsistency,
    manualSteps: [
      {
        id: "open_league_client",
        status: "manual_required",
        instruction: "Open the League of Legends client manually.",
      },
      {
        id: "open_match_history",
        status: "manual_required",
        instruction: "Go to match history manually.",
      },
      {
        id: "open_selected_replay",
        status: "manual_required",
        instruction: "Open the replay that corresponds to the selected .rofl file.",
      },
      {
        id: "enter_replay_timeline",
        status: "manual_required",
        instruction: "Wait until the replay is fully loaded.",
      },
      {
        id: "set_observer_view",
        status: "manual_required",
        instruction: "Use the normal replay observer view. Do not use third-party tools.",
      },
    ],
    futureReadiness: {
      replayWindowDetectionReady: false,
      frameCaptureReady: false,
      minimapExtractionReady: false,
      realVodEvidenceExportReady: false,
    },
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotClickClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
    },
  };

  await writeFile(outputPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  console.log(`Manual replay open checklist written to ${toProjectRelative(outputPath)}`);
  return outputPath;
}

async function writeProcessingJobPlan(
  outputDirectory: string,
  replayInputManifestPath: string,
  mode: "manual_safe" | "semi_auto_future" | "server_future",
  region: string,
  selectedReplay: SelectedReplayFile,
  matchIdentity: MatchIdentity,
  filenameHint: ReplayFilenameHint,
  apiMatchContext: ApiMatchContextManifestMetadata | undefined,
  matchContextConsistency: MatchContextConsistency,
) {
  const outputPath = path.join(outputDirectory, "processing-job-plan.json");
  const plan: ProcessingJobPlan = {
    schemaVersion: "processing-job-plan.v0.1",
    createdAt: new Date().toISOString(),
    mode,
    region,
    input: {
      replayInputManifestPath,
      selectedReplay,
      matchIdentity,
      filenameHint,
      apiMatchContext,
      matchContextConsistency,
    },
    stages: [
      {
        id: "replay_selected",
        status: "completed",
        description: "Replay file was selected and metadata was recorded.",
      },
      {
        id: "match_context_linked",
        status: apiMatchContext ? "completed" : "pending",
        description: "Official Riot API match context was linked if provided.",
      },
      {
        id: "manual_replay_open",
        status: "manual_required",
        description: "User must open the replay manually in the League client.",
      },
      {
        id: "replay_window_detection",
        status: "future",
        description: "Future stage for detecting the replay window without automating the client.",
      },
      {
        id: "frame_capture",
        status: "future",
        description: "Future stage for safe offline frame capture after manual replay open.",
      },
      {
        id: "minimap_extraction",
        status: "future",
        description: "Future stage for extracting minimap frames.",
      },
      {
        id: "spatial_evidence_generation",
        status: "future",
        description: "Future stage for generating spatial/minimap evidence.",
      },
      {
        id: "vod_evidence_export",
        status: "future",
        description: "Future stage for exporting real vod-evidence JSON.",
      },
    ],
    safety: {
      doesNotLaunchLeague: true,
      doesNotAutomateClient: true,
      doesNotReadMemory: true,
      doesNotInjectCode: true,
      doesNotCreateOverlay: true,
      doesNotBypassAnticheat: true,
    },
  };

  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  console.log(`Processing job plan written to ${toProjectRelative(outputPath)}`);
  return outputPath;
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
  let calibrationScreenshotPath: string | undefined;
  let probeReplayApi = false;
  let readReplayState = false;
  let planRenderPreset = false;
  let planPlaybackWindow = false;
  let applyPlaybackWindow = false;
  let captureMinimapWindow = false;
  let windowStart: number | undefined;
  let windowDuration: number | undefined;
  let windowSpeed: number | undefined;
  let sampleRateFps: number | undefined;
  let restorePlaybackAfterApply: boolean | undefined;
  let probeReplayHelp = false;
  let inspectLocalReplayConfig = false;

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

    if (arg === "--calibration-screenshot") {
      calibrationScreenshotPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--probe-replay-api") {
      probeReplayApi = true;
      continue;
    }

    if (arg === "--read-replay-state") {
      readReplayState = true;
      continue;
    }

    if (arg === "--plan-render-preset") {
      planRenderPreset = true;
      continue;
    }

    if (arg === "--plan-playback-window") {
      planPlaybackWindow = true;
      continue;
    }

    if (arg === "--apply-playback-window") {
      applyPlaybackWindow = true;
      continue;
    }

    if (arg === "--capture-minimap-window") {
      captureMinimapWindow = true;
      continue;
    }

    if (arg === "--window-start") {
      windowStart = parseCliNumber(args[index + 1], "--window-start");
      index += 1;
      continue;
    }

    if (arg === "--window-duration") {
      windowDuration = parseCliNumber(args[index + 1], "--window-duration");
      index += 1;
      continue;
    }

    if (arg === "--window-speed") {
      windowSpeed = parseCliNumber(args[index + 1], "--window-speed");
      index += 1;
      continue;
    }

    if (arg === "--sample-rate-fps") {
      sampleRateFps = parseCliNumber(args[index + 1], "--sample-rate-fps");
      index += 1;
      continue;
    }

    if (arg === "--restore-playback-after-apply") {
      restorePlaybackAfterApply = true;
      continue;
    }

    if (arg === "--probe-replay-help") {
      probeReplayHelp = true;
      continue;
    }

    if (arg === "--inspect-local-replay-config") {
      inspectLocalReplayConfig = true;
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

  if (args.includes("--calibration-screenshot") && !calibrationScreenshotPath) {
    throw new Error("Missing value for --calibration-screenshot. Usage: --calibration-screenshot <path-to-image>");
  }

  if (windowDuration !== undefined && windowDuration < 0) {
    throw new Error("--window-duration must be 0 or greater.");
  }

  if (windowSpeed !== undefined && windowSpeed <= 0) {
    throw new Error("--window-speed must be greater than 0.");
  }

  if (sampleRateFps !== undefined && sampleRateFps <= 0) {
    throw new Error("--sample-rate-fps must be greater than 0.");
  }

  return {
    configPath,
    replayPath,
    matchId,
    gameId,
    apiMatchContextPath,
    calibrationScreenshotPath,
    probeReplayApi,
    readReplayState,
    planRenderPreset,
    planPlaybackWindow,
    applyPlaybackWindow,
    captureMinimapWindow,
    windowStart,
    windowDuration,
    windowSpeed,
    sampleRateFps,
    restorePlaybackAfterApply,
    probeReplayHelp,
    inspectLocalReplayConfig,
  };
}

function parseCliNumber(rawValue: string | undefined, flagName: string) {
  if (rawValue === undefined) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flagName} must be a valid number.`);
  }

  return parsed;
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
