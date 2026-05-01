export type ReplayProcessingMode = "manual_safe" | "semi_auto_future" | "server_future";

export type LocalProcessorConfig = {
  replayDirectory: string;
  outputDirectory: string;
  region: string;
  mode: ReplayProcessingMode;
  capture: {
    targetFps: number;
    resolution: {
      width: number;
      height: number;
    };
    minimapBoundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
};

export type ReplayFileCandidate = {
  filename: string;
  fullPath: string;
  sizeBytes: number;
  modifiedAt: string;
};

export type ReplaySelectionMode = "explicit" | "auto-discovered";

export type SelectedReplayFile = {
  replayPath: string;
  replayFileName: string;
  replaySizeBytes: number;
  replayModifiedAt: string;
  selectionMode: ReplaySelectionMode;
};

export type MatchIdentityResolutionStatus = "provided_explicitly" | "unresolved";

export type MatchIdentitySource = {
  type: "external_api_context" | "none";
  authority: "riot_api" | null;
  providedBy: "cli" | "api_match_context_file" | null;
  verifiedByLocalProcessor: false;
};

export type MatchIdentity = {
  matchId: string | null;
  gameId: string | null;
  resolutionStatus: MatchIdentityResolutionStatus;
  source: MatchIdentitySource;
  notes: string[];
};

export type ReplayFilenameHint = {
  available: boolean;
  platformId: string | null;
  gameId: string | null;
  possibleMatchId: string | null;
  confidence: "low" | "none";
  status: "filename_hint_only" | "unavailable";
  notes: string[];
};

export type ApiMatchContextFile = {
  schemaVersion: "api-match-context.v0.1";
  createdAt: string;
  source: {
    type: "riot_api";
    generatedBy: "riftlab_web_app";
    verifiedByLocalProcessor: false;
  };
  region: string;
  matchIdentity: {
    matchId: string;
    gameId: string;
    platformId: string;
  };
  playerContext: {
    puuid: string | null;
    riotId: {
      gameName: string | null;
      tagLine: string | null;
    };
    participantId: number | null;
    championName: string | null;
  };
};

export type ApiMatchContextManifestMetadata = {
  provided: boolean;
  path?: string;
  schemaVersion?: "api-match-context.v0.1";
  source?: ApiMatchContextFile["source"];
  playerContext?: ApiMatchContextFile["playerContext"];
};

export type MatchContextConsistency = {
  checked: boolean;
  status: "match" | "mismatch" | "not_applicable";
  apiMatchId: string | null;
  filenameHintPossibleMatchId: string | null;
  severity: "info" | "warning" | "none";
  notes: string[];
};

export type ReplayDirectoryCandidate = {
  path: string;
  exists: boolean;
  roflCount: number;
  newestReplayModifiedAt?: string;
  source:
    | "config"
    | "windows_documents"
    | "windows_onedrive_documents"
    | "windows_onedrive_documentos"
    | "windows_documents_highlights"
    | "windows_videos"
    | "non_windows_conservative";
};

export type LocalProcessorRunSummary = {
  createdAt: string;
  configPath: string;
  mode: ReplayProcessingMode;
  region: string;
  configuredReplayDirectory: string;
  discoveredReplayDirectories: ReplayDirectoryCandidate[];
  selectedReplayDirectory?: string;
  selectedReplay?: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  matchIdentityResolutionStatus: MatchIdentityResolutionStatus;
  matchIdentitySourceType: MatchIdentitySource["type"];
  matchIdentityAuthority: MatchIdentitySource["authority"];
  matchIdentityProvidedBy: MatchIdentitySource["providedBy"];
  matchIdentityVerifiedByLocalProcessor: false;
  apiMatchContextProvided: boolean;
  apiMatchContextPath?: string;
  apiMatchContextSchemaVersion?: "api-match-context.v0.1";
  apiMatchContextPlayerContextAvailable: boolean;
  matchContextConsistency: MatchContextConsistency;
  matchContextConsistencyStatus: MatchContextConsistency["status"];
  matchContextConsistencySeverity: MatchContextConsistency["severity"];
  filenameHint?: ReplayFilenameHint;
  filenameHintAvailable: boolean;
  filenameHintStatus: ReplayFilenameHint["status"];
  filenameHintPossibleMatchId: string | null;
  replayInputManifestPath?: string;
  processingJobPlanPath?: string;
  processingJobPlanWritten: boolean;
  manualReplayOpenChecklistPath?: string;
  manualReplayOpenChecklistWritten: boolean;
  replayWindowReadinessPath?: string;
  replayWindowReadinessWritten: boolean;
  replayWindowDetectionEnabledNow: false;
  frameCaptureEnabledNow: false;
  fixedCapturePresetPath?: string;
  fixedCapturePresetWritten: boolean;
  fixedCapturePresetEnabledNow: false;
  minimapCropPresetEnabledNow: false;
  calibrationScreenshotContractPath?: string;
  calibrationScreenshotContractWritten: boolean;
  calibrationScreenshotInputEnabledNow: false;
  calibrationValidationEnabledNow: false;
  calibrationScreenshotProvided: boolean;
  calibrationScreenshotPath?: string;
  calibrationReportPath?: string;
  calibrationReportWritten: boolean;
  calibrationStatus: CalibrationStatus;
  minimapCropExportGenerated: boolean;
  minimapCropPath?: string;
  minimapNormalizedPath?: string;
  minimapCropMetadataPath?: string;
  minimapCropExportSkippedReason?: string;
  minimapCropCandidatesGenerated: boolean;
  minimapCropCandidatesDirectory?: string;
  minimapCropCandidateCount: number;
  minimapCropCandidatesSkippedReason?: string;
  replayApiProbeRequested: boolean;
  replayApiAvailable: boolean | null;
  replayApiStatusPath?: string;
  replayApiProbeError?: string;
  replayApiEndpointDiscoveryWritten: boolean;
  replayApiEndpointDiscoveryPath?: string;
  replayApiSwaggerAvailable: boolean | null;
  replayApiHasReplayEndpoints: boolean | null;
  replayApiHasLiveClientDataEndpoints: boolean | null;
  replayApiEndpointDiscoveryStatus?: ReplayApiEndpointDiscoveryReport["interpretation"]["status"];
  replayEndpointContractsWritten: boolean;
  replayEndpointContractsPath?: string;
  replayEndpointContractCount: number;
  replayEndpointContractsStatus?: ReplayEndpointContractsReport["interpretation"]["status"];
  replayStateSnapshotRequested: boolean;
  replayStateSnapshotWritten: boolean;
  replayStateSnapshotPath?: string;
  replayStateSnapshotStatus?: ReplayStateSnapshotReport["interpretation"]["status"];
  replayRenderReadable: boolean;
  replayPlaybackReadable: boolean;
  replayGameReadable: boolean;
  replayRenderPresetPlanRequested: boolean;
  replayRenderPresetPlanWritten: boolean;
  replayRenderPresetPlanPath?: string;
  replayRenderPresetPlanStatus?: ReplayRenderPresetPlanReport["interpretation"]["status"];
  replayRenderPresetChangesNeeded: number;
  replayRenderPresetReadyForApplyStep: boolean;
  replayPlaybackWindowPlanRequested: boolean;
  replayPlaybackWindowPlanWritten: boolean;
  replayPlaybackWindowPlanPath?: string;
  replayPlaybackWindowEstimatedRealSeconds: number | null;
  replayPlaybackWindowEstimatedFrameCount: number | null;
  replayPlaybackWindowApplyRequested: boolean;
  replayPlaybackWindowApplyReportWritten: boolean;
  replayPlaybackWindowApplyReportPath?: string;
  replayPlaybackWindowApplyStatus?: ReplayPlaybackWindowApplyReport["interpretation"]["status"];
  replayPlaybackWindowRestoreRequested: boolean;
  replayPlaybackWindowRestoreStatus?: "restored" | "not_requested" | "failed";
  minimapFrameCaptureRequested: boolean;
  minimapFrameCaptureCompleted: boolean;
  minimapFrameCaptureDirectory?: string;
  minimapFrameCaptureMetadataPath?: string;
  minimapFrameCaptureFramesWritten: number;
  minimapFrameCaptureNormalized: boolean;
  minimapFrameCaptureStatus?: "completed" | "failed" | "skipped";
  minimapFrameCaptureSkippedReason?: string;
  replayApiHelpProbeRequested: boolean;
  replayApiHelpDiscoveryPath?: string;
  replayApiHelpDiscoveryStatus?: ReplayApiHelpDiscoveryReport["interpretation"]["status"];
  replayApiHelpCandidateFunctionCount: number;
  localReplayConfigInspectionRequested: boolean;
  localReplayConfigInspectionPath?: string;
  localReplayConfigInspectionStatus?: LocalReplayConfigInspectionReport["interpretation"]["status"];
  localReplayConfigEnableReplayApiFound: boolean;
  localReplayConfigEnableReplayApiValue: string | null;
  replayApiConfigRecommendationPath?: string;
  replayApiConfigRecommendationWritten: boolean;
  replayApiConfigRecommendationStatus?: ReplayApiConfigRecommendationReport["recommendation"]["status"];
  vodEvidencePlaceholderPath?: string;
  vodEvidencePlaceholderGeneratedFromManifest: boolean;
  replayCount: number;
  outputDirectory: string;
  replayCandidates: ReplayFileCandidate[];
  manualSafeInstructions: string[];
  warnings: string[];
};

export type ReplayInputManifest = {
  schemaVersion: "replay-input-manifest.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  region: string;
  selectedReplay: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  filenameHint: ReplayFilenameHint;
  apiMatchContext?: ApiMatchContextManifestMetadata;
  matchContextConsistency: MatchContextConsistency;
  processingPlan: {
    currentStage: "replay_selected";
    nextStage: "manual_replay_review_or_future_frame_capture";
    roflParsingEnabled: false;
    clientAutomationEnabled: false;
    liveGameAnalysisEnabled: false;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
  };
};

export type ProcessingJobStageStatus = "completed" | "pending" | "manual_required" | "future";

export type ProcessingJobPlan = {
  schemaVersion: "processing-job-plan.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  region: string;
  input: {
    replayInputManifestPath: string;
    selectedReplay: SelectedReplayFile;
    matchIdentity: MatchIdentity;
    filenameHint: ReplayFilenameHint;
    apiMatchContext?: ApiMatchContextManifestMetadata;
    matchContextConsistency: MatchContextConsistency;
  };
  stages: Array<{
    id:
      | "replay_selected"
      | "match_context_linked"
      | "manual_replay_open"
      | "replay_window_detection"
      | "frame_capture"
      | "minimap_extraction"
      | "spatial_evidence_generation"
      | "vod_evidence_export";
    status: ProcessingJobStageStatus;
    description: string;
  }>;
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
  };
};

export type ManualReplayOpenChecklist = {
  schemaVersion: "manual-replay-open-checklist.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  selectedReplay: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  filenameHint: ReplayFilenameHint;
  apiMatchContext?: ApiMatchContextManifestMetadata;
  matchContextConsistency: MatchContextConsistency;
  manualSteps: Array<{
    id:
      | "open_league_client"
      | "open_match_history"
      | "open_selected_replay"
      | "enter_replay_timeline"
      | "set_observer_view";
    status: "manual_required";
    instruction: string;
  }>;
  futureReadiness: {
    replayWindowDetectionReady: false;
    frameCaptureReady: false;
    minimapExtractionReady: false;
    realVodEvidenceExportReady: false;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotClickClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
  };
};

export type ReplayWindowReadiness = {
  schemaVersion: "replay-window-readiness.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  selectedReplay: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  manualPrerequisites: {
    userMustOpenLeagueClient: true;
    userMustOpenReplayManually: true;
    userMustWaitUntilReplayLoaded: true;
    clientAutomationAllowed: false;
  };
  futureWindowDetectionPlan: {
    enabledNow: false;
    method: "passive_window_lookup_future";
    allowedSignals: ["window_title", "process_name", "screen_bounds"];
    disallowedSignals: [
      "memory_reading",
      "client_injection",
      "input_automation",
      "network_interception",
      "anticheat_bypass",
    ];
    expectedWindowTitleHints: ["League of Legends", "League of Legends (TM) Client"];
    expectedProcessNameHints: ["League of Legends.exe", "LeagueClientUx.exe"];
  };
  futureCaptureReadiness: {
    frameCaptureEnabledNow: false;
    requiresManualReplayOpen: true;
    requiresPassiveWindowDetection: true;
    requiresFixedCapturePreset: true;
    requiresMinimapCropPreset: true;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotClickClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
  };
};

export type FixedCapturePreset = {
  schemaVersion: "fixed-capture-preset.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  selectedReplay: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  capturePreset: {
    enabledNow: false;
    presetName: "default_1920x1080_observer_replay";
    expectedWindowResolution: {
      width: 1920;
      height: 1080;
    };
    captureRegion: {
      type: "full_window_future";
      x: 0;
      y: 0;
      width: 1920;
      height: 1080;
    };
    minimapCropPreset: {
      enabledNow: false;
      coordinateSystem: "window_pixels";
      expectedResolution: {
        width: 1920;
        height: 1080;
      };
      crop: {
        x: 1600;
        y: 780;
        width: 320;
        height: 300;
      };
      normalizedOutput: {
        width: 512;
        height: 512;
      };
      notes: string[];
    };
  };
  futureRequirements: {
    requiresManualReplayOpen: true;
    requiresPassiveWindowDetection: true;
    requiresFrameCaptureImplementation: true;
    requiresMinimapCropValidation: true;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotClickClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
    doesNotCaptureFramesYet: true;
  };
};

export type CalibrationScreenshotContract = {
  schemaVersion: "calibration-screenshot-contract.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  selectedReplay: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  fixedCapturePresetPath: string;
  screenshotInput: {
    enabledNow: false;
    acceptedFutureFormats: ["png", "jpg", "jpeg"];
    expectedResolution: {
      width: 1920;
      height: 1080;
    };
    expectedSource: "manual_user_provided_replay_screenshot";
    mustBeFromSelectedReplay: true;
    notes: string[];
  };
  futureValidationPlan: {
    enabledNow: false;
    validatesImageDimensions: true;
    validatesMinimapCropBounds: true;
    validatesMinimapVisualPresence: false;
    runsTemplateLocator: false;
    exportsCalibrationReport: false;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotClickClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
    doesNotCaptureScreenshotsYet: true;
  };
};

export type CalibrationScreenshotExtension = "png" | "jpg" | "jpeg";

export type CalibrationStatus = "pass" | "warning" | "fail" | "not_provided";

export type CalibrationReport = {
  schemaVersion: "calibration-report.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  selectedReplay: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  inputScreenshot: {
    path: string;
    fileName: string;
    extension: CalibrationScreenshotExtension;
    exists: true;
    providedManuallyByUser: true;
    capturedByLocalProcessor: false;
  };
  imageMetadata: {
    width: number | null;
    height: number | null;
    readable: boolean;
  };
  presetValidation: {
    expectedResolution: {
      width: 1920;
      height: 1080;
    };
    resolutionMatchesExpected: boolean;
    minimapCropWithinBounds: boolean;
    status: Exclude<CalibrationStatus, "not_provided">;
    notes: string[];
  };
  visualAnalysis: {
    performed: false;
    minimapPresenceDetected: false;
    championDetectionPerformed: false;
    templateLocatorPerformed: false;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotClickClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
    doesNotCaptureScreenshots: true;
    usesManualUserProvidedScreenshotOnly: true;
  };
};

export type MinimapCropExportMetadata = {
  schemaVersion: "minimap-crop-export.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  selectedReplay: SelectedReplayFile;
  matchIdentity: MatchIdentity;
  inputScreenshot: {
    path: string;
    providedManuallyByUser: true;
    capturedByLocalProcessor: false;
  };
  calibration: {
    calibrationReportPath: string;
    calibrationStatus: "pass" | "warning";
  };
  crop: {
    source: "fixed-capture-preset";
    coordinateSystem: "window_pixels";
    x: number;
    y: number;
    width: number;
    height: number;
  };
  outputs: {
    rawCropPath: string;
    normalizedCropPath: string;
    normalizedWidth: 512;
    normalizedHeight: 512;
  };
  visualAnalysis: {
    performed: false;
    championDetectionPerformed: false;
    wardDetectionPerformed: false;
    objectiveDetectionPerformed: false;
    templateLocatorPerformed: false;
    notes: string[];
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotClickClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
    doesNotCaptureScreenshots: true;
    usesManualUserProvidedScreenshotOnly: true;
  };
};

export type MinimapCropCandidateSource = "fixed_capture_preset" | "relative_bottom_right_candidate";

export type MinimapCropCandidatesMetadata = {
  schemaVersion: "minimap-crop-candidates.v0.1";
  createdAt: string;
  mode: ReplayProcessingMode;
  inputScreenshot: {
    path: string;
    providedManuallyByUser: true;
    capturedByLocalProcessor: false;
    width: number;
    height: number;
  };
  candidateCount: number;
  selection: {
    automaticSelectionEnabled: false;
    selectedCandidateId: null;
    notes: string[];
  };
  candidates: Array<{
    id: string;
    path: string;
    x: number;
    y: number;
    width: number;
    height: number;
    normalizedWidth: 512;
    normalizedHeight: 512;
    source: MinimapCropCandidateSource;
    notes: string[];
  }>;
  visualAnalysis: {
    performed: false;
    championDetectionPerformed: false;
    wardDetectionPerformed: false;
    templateLocatorPerformed: false;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotClickClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
    doesNotCaptureScreenshots: true;
    usesManualUserProvidedScreenshotOnly: true;
  };
};

export type ReplayApiStatus = {
  schemaVersion: "replay-api-status.v0.1";
  createdAt: string;
  mode: "replay_api_assisted_probe";
  probeRequested: true;
  available: boolean;
  baseUrl: "https://127.0.0.1:2999";
  checkedEndpoints: Array<{
    path: "/swagger/v2/swagger.json";
    method: "GET";
    ok: boolean;
    statusCode: number | null;
    error: string | null;
  }>;
  replayApiAssisted: {
    enabledNow: false;
    availabilityOnly: true;
    renderControlEnabled: false;
    playbackControlEnabled: false;
    frameCaptureEnabled: false;
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
    doesNotAutomateKeyboardOrMouse: true;
    doesNotUseLcuAuthToken: true;
    doesNotParseRofl: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
    doesNotCaptureFrames: true;
  };
};

export type ReplayApiEndpointDiscoveryReport = {
  schemaVersion: "replay-api-endpoints.v0.1";
  createdAt: string;
  baseUrl: "https://127.0.0.1:2999";
  swaggerAvailable: boolean;
  swaggerPath: "/swagger/v2/swagger.json";
  endpointDiscovery: {
    pathCount: number;
    hasReplayEndpoints: boolean;
    hasReplayRenderEndpoint: boolean;
    hasReplayPlaybackEndpoint: boolean;
    hasLiveClientDataEndpoints: boolean;
    replayPaths: string[];
    liveClientDataPaths: string[];
    swaggerPaths: string[];
    otherPaths: string[];
  };
  interpretation: {
    status: "replay_endpoints_available" | "liveclientdata_only" | "swagger_unavailable" | "unknown";
    notes: string[];
  };
  safety: {
    getOnly: true;
    doesNotPost: true;
    doesNotChangeRender: true;
    doesNotChangePlayback: true;
    doesNotSeek: true;
    doesNotCaptureFrames: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
    doesNotAutomateKeyboardOrMouse: true;
    doesNotUseLcuAuthToken: true;
    doesNotParseRofl: true;
  };
};

export type ReplayEndpointOperationContract = {
  method: string;
  operationId: string | null;
  summary: string | null;
  parameters: unknown[];
  responseStatusCodes: string[];
};

export type ReplayEndpointContract = {
  path: string;
  methods: string[];
  operations: ReplayEndpointOperationContract[];
};

export type ReplayEndpointContractsReport = {
  schemaVersion: "replay-endpoint-contracts.v0.1";
  createdAt: string;
  baseUrl: "https://127.0.0.1:2999";
  sourceSwaggerPath: "/swagger/v2/swagger.json";
  replayEndpointsDiscovered: boolean;
  endpoints: ReplayEndpointContract[];
  importantEndpoints: {
    render: ReplayEndpointContract | null;
    playback: ReplayEndpointContract | null;
    game: ReplayEndpointContract | null;
    sequence: ReplayEndpointContract | null;
    recording: ReplayEndpointContract | null;
  };
  interpretation: {
    status: "contracts_extracted" | "no_replay_endpoints" | "swagger_unavailable";
    notes: string[];
  };
  safety: {
    swaggerReadOnly: true;
    doesNotCallReplayEndpoints: true;
    doesNotPost: true;
    doesNotChangeRender: true;
    doesNotChangePlayback: true;
    doesNotSeek: true;
    doesNotCaptureFrames: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
  };
};

export type ReplayStateSnapshotEndpointPath =
  | "/replay/game"
  | "/replay/render"
  | "/replay/playback"
  | "/replay/sequence"
  | "/replay/recording";

export type ReplayStateSnapshotEndpointResult = {
  path: ReplayStateSnapshotEndpointPath;
  method: "GET";
  ok: boolean;
  statusCode: number | null;
  data: unknown | null;
  error: string | null;
};

export type ReplayStateSnapshotReport = {
  schemaVersion: "replay-state-snapshot.v0.1";
  createdAt: string;
  baseUrl: "https://127.0.0.1:2999";
  readOnly: true;
  requested: true;
  endpoints: {
    game: ReplayStateSnapshotEndpointResult;
    render: ReplayStateSnapshotEndpointResult;
    playback: ReplayStateSnapshotEndpointResult;
    sequence: ReplayStateSnapshotEndpointResult;
    recording: ReplayStateSnapshotEndpointResult;
  };
  summary: {
    allRequestedReadsCompleted: boolean;
    gameReadable: boolean;
    renderReadable: boolean;
    playbackReadable: boolean;
    sequenceReadable: boolean;
    recordingReadable: boolean;
  };
  interpretation: {
    status: "snapshot_complete" | "partial" | "failed" | "not_requested";
    notes: string[];
  };
  safety: {
    getOnly: true;
    doesNotPost: true;
    doesNotChangeRender: true;
    doesNotChangePlayback: true;
    doesNotSeek: true;
    doesNotStartRecording: true;
    doesNotCaptureFrames: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
  };
};

export type ReplayRenderPresetKey =
  | "interfaceMinimap"
  | "interfaceReplay"
  | "interfaceScoreboard"
  | "interfaceChat"
  | "interfaceTimeline"
  | "interfaceScore"
  | "fogOfWar"
  | "cameraMode";

export type ReplayRenderPresetSubset = Record<ReplayRenderPresetKey, boolean | string | null>;

export type ReplayRenderPresetPlanReport = {
  schemaVersion: "replay-render-preset-plan.v0.1";
  createdAt: string;
  mode: "replay_api_assisted_dry_run";
  readOnly: true;
  presetName: "riftlab_minimap_capture_v0.1";
  sourceSnapshotPath: string;
  currentRenderSubset: ReplayRenderPresetSubset;
  proposedPreset: ReplayRenderPresetSubset;
  diff: Array<{
    key: ReplayRenderPresetKey;
    current: boolean | string | null;
    proposed: boolean | string | null;
    changeNeeded: boolean;
  }>;
  summary: {
    totalKeysChecked: number;
    changesNeeded: number;
    alreadyMatches: number;
    readyForApplyStep: boolean;
  };
  interpretation: {
    status: "plan_created" | "snapshot_missing" | "render_unreadable" | "failed";
    notes: string[];
  };
  safety: {
    dryRunOnly: true;
    doesNotPost: true;
    doesNotChangeRender: true;
    doesNotChangePlayback: true;
    doesNotSeek: true;
    doesNotCaptureFrames: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
  };
};

export type ReplayPlaybackState = {
  length: number;
  time: number;
  paused: boolean;
  speed: number;
  seeking: boolean;
};

export type ReplayPlaybackWindowRequest = {
  startTime: number;
  duration: number;
  endTime: number;
  requestedSpeed: number;
  sampleRateFps: number;
};

export type ReplayPlaybackWindowComputedPlan = {
  clamped: boolean;
  effectiveStartTime: number;
  effectiveEndTime: number;
  effectiveDuration: number;
  estimatedRealSeconds: number;
  estimatedFrameCount: number;
};

export type ReplayPlaybackWindowPlanReport = {
  schemaVersion: "replay-playback-window-plan.v0.1";
  createdAt: string;
  mode: "replay_api_assisted";
  dryRun: true;
  currentPlayback: {
    length: number;
    time: number;
    paused: boolean;
    speed: number;
  };
  requestedWindow: ReplayPlaybackWindowRequest;
  computedPlan: ReplayPlaybackWindowComputedPlan;
  safety: {
    doesNotCaptureFrames: true;
    doesNotTouchRender: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
  };
};

export type ReplayPlaybackWindowApplyReport = {
  schemaVersion: "replay-playback-window-apply-report.v0.1";
  createdAt: string;
  mode: "replay_api_assisted";
  applied: boolean;
  previousPlayback: {
    time: number | null;
    speed: number | null;
    paused: boolean | null;
    seeking: boolean | null;
  };
  requestedWindow: ReplayPlaybackWindowRequest;
  applyRequest: {
    time: number;
    speed: number;
    paused: boolean;
  };
  afterApplyPlayback: {
    time: number | null;
    speed: number | null;
    paused: boolean | null;
    seeking: boolean | null;
  };
  restore: {
    requested: boolean;
    attempted: boolean;
    previousStateRestoreRequest: {
      time: number | null;
      speed: number | null;
      paused: boolean | null;
    } | null;
    afterRestorePlayback: {
      time: number | null;
      speed: number | null;
      paused: boolean | null;
      seeking: boolean | null;
    } | null;
  };
  interpretation: {
    status: "applied_and_restored" | "applied_no_restore" | "apply_failed" | "restore_failed" | "not_requested";
    notes: string[];
  };
  safety: {
    doesNotCaptureFrames: true;
    doesNotTouchRender: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
    doesNotAutomateKeyboardOrMouse: true;
    doesNotParseRofl: true;
  };
};

export type MinimapFrameSequenceReport = {
  schemaVersion: "minimap-frame-sequence.v0.1";
  createdAt: string;
  mode: "replay_api_assisted_capture";
  source: {
    replayApiAssisted: true;
    manualReplayOpenRequired: true;
    playbackWindowPlanPath: string;
    playbackApplyReportPath: string;
    fixedCapturePresetPath: string;
  };
  window: {
    startTime: number;
    endTime: number;
    duration: number;
    speed: number;
    sampleRateFps: number;
    estimatedFrameCount: number;
  };
  capture: {
    requested: true;
    completed: boolean;
    frameDirectory: string;
    framesWritten: number;
    normalized: boolean;
    normalizedWidth: 512;
    normalizedHeight: 512;
    crop: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  frames: Array<{
    index: number;
    path: string;
    targetReplayTime: number;
    capturedAt: string;
  }>;
  restore: {
    requested: boolean;
    status: "restored" | "not_requested" | "failed";
  };
  visualAnalysis: {
    performed: false;
    championDetectionPerformed: false;
    wardDetectionPerformed: false;
    objectiveDetectionPerformed: false;
    notes: string[];
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
    doesNotAutomateKeyboardOrMouse: true;
    doesNotParseRofl: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
  };
};

export type ReplayApiHelpKeyword =
  | "replay"
  | "render"
  | "playback"
  | "camera"
  | "seek"
  | "time"
  | "pause"
  | "speed"
  | "observer"
  | "minimap"
  | "interface";

export type ReplayApiHelpDiscoveryReport = {
  schemaVersion: "replay-api-help-discovery.v0.1";
  createdAt: string;
  baseUrl: "https://127.0.0.1:2999";
  helpProbeRequested: true;
  helpEndpointCalled: boolean;
  method: "POST";
  path: "/Help";
  ok: boolean;
  statusCode: number | null;
  responseReadable: boolean;
  keywordMatches: Record<ReplayApiHelpKeyword, number>;
  candidateFunctionNames: string[];
  interpretation: {
    status: "possible_replay_functions_found" | "no_replay_functions_found" | "help_unavailable" | "not_requested";
    notes: string[];
  };
  safety: {
    documentationOnly: true;
    doesNotCallExit: true;
    doesNotCallCancel: true;
    doesNotSubscribe: true;
    doesNotUnsubscribe: true;
    doesNotChangeRender: true;
    doesNotChangePlayback: true;
    doesNotSeek: true;
    doesNotCaptureFrames: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
    doesNotAutomateKeyboardOrMouse: true;
    doesNotUseLcuAuthToken: true;
    doesNotParseRofl: true;
  };
};

export type LocalReplayConfigInspectionReport = {
  schemaVersion: "local-replay-config-inspection.v0.1";
  createdAt: string;
  inspectionRequested: true;
  readOnly: true;
  configCandidates: Array<{
    path: string;
    exists: boolean;
    readable: boolean;
    detectedKeys: {
      EnableReplayApi: string | null;
      Width: string | null;
      Height: string | null;
      MinimapScale: string | null;
      GlobalScaleReplay: string | null;
    };
    notes: string[];
  }>;
  summary: {
    anyConfigFound: boolean;
    enableReplayApiFound: boolean;
    enableReplayApiValue: string | null;
    resolutionFound: boolean;
    minimapScaleFound: boolean;
    globalScaleReplayFound: boolean;
  };
  interpretation: {
    status: "config_found" | "config_not_found" | "partial" | "error";
    notes: string[];
  };
  safety: {
    readOnly: true;
    doesNotModifyConfig: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
    doesNotChangeReplayState: true;
    doesNotCaptureFrames: true;
  };
};

export type ReplayApiConfigRecommendationReport = {
  schemaVersion: "replay-api-config-recommendation.v0.1";
  createdAt: string;
  basedOnInspectionPath: string;
  readOnly: true;
  configSummary: {
    gameCfgFound: boolean;
    gameCfgPath: string | null;
    width: string | null;
    height: string | null;
    minimapScale: string | null;
    enableReplayApiFound: boolean;
    enableReplayApiValue: string | null;
    globalScaleReplayFound: boolean;
    globalScaleReplayValue: string | null;
  };
  recommendation: {
    status: "manual_verification_recommended";
    notes: string[];
    manualChecks: string[];
  };
  nextProbe: {
    command: string;
    expectedIfEnabled: string;
    expectedIfUnchanged: string;
  };
  safety: {
    doesNotModifyConfig: true;
    doesNotLaunchLeague: true;
    doesNotOpenReplay: true;
    doesNotChangeReplayState: true;
    doesNotCaptureFrames: true;
  };
};

export type VodEvidenceExportPlaceholder = {
  schemaVersion: "vod-evidence.stub.v0.1";
  createdAt: string;
  source: {
    type: "rofl" | "none";
    mode: ReplayProcessingMode;
    region: string;
    replay?: SelectedReplayFile;
    matchIdentity: MatchIdentity;
    filenameHint?: ReplayFilenameHint;
    apiMatchContext?: ApiMatchContextManifestMetadata;
    matchContextConsistency?: MatchContextConsistency;
  };
  analysisStatus: {
    stage: "replay_selected_no_visual_analysis" | "no_replay_selected";
    roflParsingEnabled: false;
    frameCaptureEnabled: false;
    minimapAnalysisEnabled: false;
    officialApiReplacement: false;
  };
  evidence: {
    objectiveWindows: [];
    minimapObservations: [];
    spatialContext: [];
    confidenceNotes: string[];
  };
  safety: {
    doesNotLaunchLeague: true;
    doesNotAutomateClient: true;
    doesNotReadMemory: true;
    doesNotInjectCode: true;
    doesNotCreateOverlay: true;
    doesNotBypassAnticheat: true;
  };
};
