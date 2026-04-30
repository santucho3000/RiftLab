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

export type LocalProcessorRunSummary = {
  createdAt: string;
  configPath: string;
  mode: ReplayProcessingMode;
  region: string;
  replayDirectory: string;
  outputDirectory: string;
  replayCandidates: ReplayFileCandidate[];
  manualSafeInstructions: string[];
  warnings: string[];
};

export type VodEvidenceExportPlaceholder = {
  schemaVersion: "vod-evidence.v0.1";
  source: {
    type: "manual_annotation";
    toolName: "riftlab-local-processor-placeholder";
    toolVersion: string;
    modelVersion: "none";
    inputKind: "annotation";
    inputHash: string;
    createdAt: string;
  };
  match: {
    region: string;
    timeAlignment: {
      method: "unknown";
      videoStartOffsetMs: number;
      confidence: number;
    };
  };
  coordinateSystem: {
    type: "summoners_rift_normalized";
    xRange: [number, number];
    yRange: [number, number];
    origin: "blue_bottom_left";
    notes: string;
  };
  participants: [];
  championTracks: [];
  wardSamples: [];
  objectivePresenceSignals: [];
  rotationSignals: [];
  teamSpacingSignals: [];
  zoneControlSignals: [];
  fightSetupSignals: [];
  waveStateSignals: [];
  ocrSignals: [];
  quality: {
    overallConfidence: number;
    unsupportedReasons: string[];
    warnings: string[];
  };
};
