import type { VodEvidenceBundle } from "@/lib/vod-evidence/types";

export type ApiEvidence = {
  source: "riot-api";
  matchId: string;
  facts: unknown;
  confidence: 1;
};

export type VodEvidence = {
  source: "vod-evidence";
  bundle: VodEvidenceBundle;
  confidence: number;
};

export type EvidenceFusionInput = {
  apiEvidence: ApiEvidence;
  vodEvidence?: VodEvidence;
};

export type EvidenceFusionResult = {
  matchId: string;
  fusedMeasurements: unknown[];
  confidenceNotes: string[];
  warnings: string[];
};
