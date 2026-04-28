import type { VodEvidenceBundle } from "@/lib/vod-evidence/types";

export type ApiEvidenceConfidence = "low" | "medium" | "high";
export type FusionVodEvidenceConfidence = "low" | "medium" | "medium/high" | "high";
export type CausalConfidence = "low" | "low/medium" | "medium" | "medium/high" | "high";

export type FusionOutcome =
  | "confirm_api_chain"
  | "strengthen_api_chain"
  | "weaken_api_chain"
  | "reclassify_as_trade"
  | "reclassify_as_positive"
  | "reclassify_as_neutral"
  | "reclassify_reason_only"
  | "insufficient_vod_context"
  | "conflicting_evidence";

export type FusionRuleId =
  | "death_before_enemy_objective"
  | "death_before_allied_objective"
  | "death_followed_by_structure_loss"
  | "objective_loss_poor_contest"
  | "kill_teamfight_into_map_gain"
  | "side_pressure_trade";

export type ApiChainType =
  | "death_before_enemy_objective"
  | "death_before_allied_objective"
  | "death_followed_by_structure_loss"
  | "objective_loss_poor_contest"
  | "kill_teamfight_into_map_gain"
  | "side_pressure_trade"
  | "unknown";

export type ChainClassification = "negative" | "neutral" | "positive" | "trade" | "unknown";
export type ValueDirection = "lost" | "neutral" | "gained" | "trade" | "unknown";

export type ApiChainEvidence = {
  chainId: string;
  chainType: ApiChainType;
  matchId: string;
  participantId?: number;
  championName?: string;
  teamSide?: "Blue" | "Red" | "Unknown";
  apiFactSummary: string;
  apiEvidenceConfidence: ApiEvidenceConfidence;
  causalConfidence: CausalConfidence;
  classification: ChainClassification;
  valueDirection: ValueDirection;
  timeWindowSeconds: {
    start: number;
    end: number;
  };
  relatedObjective?: {
    objectiveType: string;
    timestampSeconds: number;
  };
  relatedStructure?: {
    lane?: string;
    structureType?: string;
    timestampSeconds: number;
  };
};

export type VodSignalEvidence = {
  signalId: string;
  signalType:
    | "isolation"
    | "objective_presence"
    | "rotation"
    | "first_move"
    | "zone_control"
    | "team_spacing"
    | "ward_context"
    | "fight_setup"
    | "wave_state"
    | "pressure";
  sourceBundleId?: string;
  participantIds: number[];
  timeWindowSeconds: {
    start: number;
    end: number;
  };
  summary: string;
  confidence: number;
  supportsApiChain?: boolean;
  conflictsWithApiChain?: boolean;
};

export type EvidenceFusionInput = {
  apiChain: ApiChainEvidence;
  vodEvidenceBundle?: VodEvidenceBundle;
  matchedVodSignals: VodSignalEvidence[];
  labMode?: boolean;
};

export type ConfidenceChange = {
  from: CausalConfidence;
  to: CausalConfidence;
  reason: string;
  cappedBy?: FusionQualityGate[];
};

export type ClassificationChange = {
  from: ChainClassification;
  to: ChainClassification;
  reason: string;
};

export type FusionQualityGate = {
  id:
    | "time_alignment"
    | "participant_identity"
    | "minimap_confidence"
    | "signal_confidence"
    | "time_window_match"
    | "signal_conflict"
    | "manual_fixture";
  passed: boolean;
  severity: "blocking" | "capping" | "warning";
  message: string;
};

export type FusionUncertainty = {
  topic:
    | "intent"
    | "communication"
    | "wave_state"
    | "vision_completeness"
    | "matchup_context"
    | "camera_or_minimap_quality"
    | "unobserved_cross_map_trade";
  explanation: string;
};

export type EvidenceFusionResult = {
  chainId: string;
  ruleId: FusionRuleId;
  outcome: FusionOutcome;
  enrichedClassification: ChainClassification;
  enrichedValueDirection: ValueDirection;
  confidenceChange: ConfidenceChange;
  classificationChange?: ClassificationChange;
  supportingVodSignals: VodSignalEvidence[];
  qualityGates: FusionQualityGate[];
  uncertainties: FusionUncertainty[];
  explanation: {
    apiConfirmed: string;
    vodSuggested?: string;
    fusionResult: string;
    stillUncertain: string[];
    futureScoringRecommendation: string;
  };
};

export type EnrichedChainPreview = {
  fixtureName?: string;
  apiOnlyChain: ApiChainEvidence;
  fusionResult: EvidenceFusionResult;
};
