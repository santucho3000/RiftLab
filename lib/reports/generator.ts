import { getMockMatchReport } from "@/lib/mock/provider";
import type {
  ImpactChain,
  MatchDiagnosis,
  MatchReport,
  NormalizedMatchData,
  Recommendation,
  ReportGenerationInput,
} from "@/lib/types";

// Future data flow:
// Riot API match data
// -> normalize raw match
// -> detect events
// -> apply scoring rules
// -> generate report
// -> render UI

export function generateMatchReportFromMatchData(
  matchDataOrInput: NormalizedMatchData | ReportGenerationInput,
): MatchReport {
  const matchData = "matchData" in matchDataOrInput ? matchDataOrInput.matchData : matchDataOrInput;
  const mockReport = getMockMatchReport(matchData.id) ?? getMockMatchReport("RL-2026-001");

  if (!mockReport) {
    throw new Error("Mock report seed data is missing.");
  }

  return mockReport;
}

export function generateMatchDiagnosis(report: MatchReport): MatchDiagnosis {
  return report.matchDiagnosis;
}

export function generateImpactChains(report: MatchReport): ImpactChain[] {
  return [report.impactChain];
}

export function generateRecommendations(report: MatchReport): Recommendation[] {
  return [...report.individualRecommendations, ...report.teamRecommendations];
}
