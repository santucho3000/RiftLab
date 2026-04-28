export type VodEvidenceSchemaVersion = "vod-evidence.v0.1";
export type VodEvidenceTeamSide = "Blue" | "Red" | "Unknown";
export type VodEvidenceConfidence = number;

export type VodEvidenceBundle = {
  schemaVersion: VodEvidenceSchemaVersion;
  source: VodEvidenceSource;
  match: VodEvidenceMatch;
  coordinateSystem: VodCoordinateSystem;
  participants: VodParticipant[];
  championTracks: ChampionTrack[];
  wardSamples: WardSample[];
  objectivePresenceSignals: ObjectivePresenceSignal[];
  rotationSignals: RotationSignal[];
  teamSpacingSignals: TeamSpacingSignal[];
  zoneControlSignals: ZoneControlSignal[];
  fightSetupSignals: FightSetupSignal[];
  waveStateSignals?: WaveStateSignal[];
  ocrSignals?: OcrSignal[];
  quality: VodEvidenceQuality;
};

export type VodEvidenceSource = {
  type: "vod_file" | "replay_capture" | "manual_annotation" | "third_party";
  toolName: string;
  toolVersion: string;
  modelVersion?: string;
  inputKind: "video" | "image_sequence" | "replay" | "annotation";
  inputHash?: string;
  createdAt: string;
};

export type VodEvidenceMatch = {
  matchId?: string;
  gameVersion?: string;
  region?: string;
  durationSeconds?: number;
  timeAlignment: {
    method: "manual" | "ocr" | "api_sync" | "manual_or_ocr_or_api_sync" | "unknown";
    videoStartOffsetMs: number;
    confidence: VodEvidenceConfidence;
  };
};

export type VodCoordinateSystem = {
  type: "summoners_rift_normalized" | "screen_pixels" | "unknown";
  xRange: [number, number];
  yRange: [number, number];
  origin: "blue_bottom_left" | "top_left" | "unknown";
  notes?: string;
};

export type VodParticipant = {
  participantId: number;
  teamSide: VodEvidenceTeamSide;
  championName?: string;
  riotPuuid?: string | null;
  detectorLabel?: string;
};

export type PositionSample = {
  t: number;
  x: number;
  y: number;
  confidence: VodEvidenceConfidence;
  visibility: "visible" | "occluded" | "inferred" | "unknown";
  sourceFrame?: number;
};

export type ChampionTrack = {
  participantId: number;
  championName?: string;
  samples: PositionSample[];
  trackConfidence: VodEvidenceConfidence;
  gaps?: Array<{
    startTime: number;
    endTime: number;
    reason: string;
  }>;
};

export type WardSample = {
  t: number;
  teamSide: VodEvidenceTeamSide;
  wardType: "stealth" | "control" | "farsight" | "unknown";
  x: number;
  y: number;
  confidence: VodEvidenceConfidence;
  status: "detected" | "inferred" | "expired";
};

export type ObjectivePresenceSignal = {
  objectiveType: "Dragon" | "Elder" | "Voidgrubs" | "Rift Herald" | "Baron" | "Unknown";
  windowStart: number;
  windowEnd: number;
  bluePresentParticipantIds: number[];
  redPresentParticipantIds: number[];
  blueArrivalOrder?: number[];
  redArrivalOrder?: number[];
  controllingSide: VodEvidenceTeamSide;
  confidence: VodEvidenceConfidence;
};

export type RotationSignal = {
  id: string;
  participantId: number;
  startTime: number;
  endTime: number;
  fromRegion: string;
  toRegion: string;
  rotationType: "first_move" | "late_rotation" | "collapse" | "reset_return" | "unknown";
  arrivedBeforeOpponentSeconds?: number;
  confidence: VodEvidenceConfidence;
};

export type TeamSpacingSignal = {
  id: string;
  time: number;
  teamSide: VodEvidenceTeamSide;
  context: "pre_objective" | "teamfight" | "side_lane" | "neutral";
  averageDistance?: number;
  isolatedParticipantIds: number[];
  clusterParticipantIds: number[];
  confidence: VodEvidenceConfidence;
};

export type ZoneControlSignal = {
  id: string;
  windowStart: number;
  windowEnd: number;
  region: string;
  controllingSide: VodEvidenceTeamSide;
  blueOccupancySeconds?: number;
  redOccupancySeconds?: number;
  wardCoverage?: {
    blue: number;
    red: number;
  };
  confidence: VodEvidenceConfidence;
};

export type FightSetupSignal = {
  id: string;
  windowStart: number;
  windowEnd: number;
  fightEventIds?: string[];
  blueFormation?: string;
  redFormation?: string;
  playerContext?: {
    participantId: number;
    state: "isolated" | "frontline" | "backline" | "flank" | "late_arrival" | "unknown";
    distanceFromTeam?: number;
  };
  confidence: VodEvidenceConfidence;
};

export type WaveStateSignal = {
  id: string;
  time: number;
  lane: "Top" | "Mid" | "Bot";
  state:
    | "pushing_blue"
    | "pushing_red"
    | "slow_push_to_blue"
    | "slow_push_to_red"
    | "neutral"
    | "unknown";
  confidence: VodEvidenceConfidence;
  notes?: string;
};

export type OcrSignal = {
  time: number;
  field: "game_clock" | "kda" | "cs" | "gold" | "level" | "unknown";
  value: string;
  participantId?: number;
  confidence: VodEvidenceConfidence;
};

export type VodEvidenceQuality = {
  overallConfidence: VodEvidenceConfidence;
  minimapConfidence?: VodEvidenceConfidence;
  ocrConfidence?: VodEvidenceConfidence;
  frameSampleRate?: number;
  unsupportedReasons: string[];
  warnings: string[];
};
