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
