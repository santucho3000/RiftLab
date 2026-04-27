import type { ConfidenceLevel, MatchReport, MetricScore, MetricStatus, RiskStatus } from "@/lib/types";

export * from "@/lib/scoring/real-scoring";

export function getMetricStatus(score: number): MetricStatus {
  if (score >= 78) return "Strong";
  if (score >= 58) return "Average";
  if (score >= 40) return "Weak";
  return "Critical";
}

export function calculateOverallImpact(metrics: MetricScore[]): number {
  if (metrics.length === 0) return 0;
  const negativeImpact = metrics.find(
    (metric) => metric.polarity === "cost" || metric.name === "Value Lost",
  );
  const positiveMetrics = metrics.filter((metric) => metric !== negativeImpact);
  const positiveAverage =
    positiveMetrics.reduce((total, metric) => total + metric.score, 0) / positiveMetrics.length;
  const negativePenalty = negativeImpact ? Math.max(0, 50 - negativeImpact.score) * 0.28 : 0;

  return Math.round(Math.max(0, Math.min(100, positiveAverage - negativePenalty)));
}

export function calculateIndividualImpactScore(report: MatchReport): number {
  return calculateOverallImpact(report.individualMetrics);
}

export function calculateTeamScore(metrics: MetricScore[]): number {
  if (metrics.length === 0) return 0;
  const weightedTotal = metrics.reduce((total, metric) => {
    const weight = metric.name === "Tempo Sync" || metric.name === "Objective Setup" ? 1.15 : 1;
    return total + metric.score * weight;
  }, 0);
  const weightTotal = metrics.reduce((total, metric) => {
    return total + (metric.name === "Tempo Sync" || metric.name === "Objective Setup" ? 1.15 : 1);
  }, 0);

  return Math.round(weightedTotal / weightTotal);
}

export function calculateTeamPerformanceScore(report: MatchReport): number {
  return calculateTeamScore(report.teamMetrics);
}

export function getRiskStatus(valueLost: number): RiskStatus {
  if (valueLost >= 70) return "Critical";
  if (valueLost >= 45) return "High";
  if (valueLost >= 25) return "Medium";
  return "Low";
}

export function getScoreColorVariant(score: number): string {
  if (score >= 78) return "text-lab-green border-lab-green/40 bg-lab-green/10";
  if (score >= 58) return "text-lab-amber border-lab-amber/40 bg-lab-amber/10";
  if (score >= 40) return "text-orange-300 border-orange-300/40 bg-orange-300/10";
  return "text-lab-red border-lab-red/40 bg-lab-red/10";
}

export function getConfidenceLabel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.82) return "High";
  if (confidence >= 0.62) return "Medium";
  return "Low";
}
