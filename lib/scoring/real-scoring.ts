import type { RiotMatchSummary, TimelineDiagnostics } from "@/lib/reports";
import type { MetricScore, MetricStatus } from "@/lib/types";

type Severity = "Low" | "Medium" | "High";

export type DeathBeforeObjectiveSignal = {
  deathTimestamp: string;
  objectiveTimestamp: string;
  objectiveType: string;
  secondsBeforeObjective: number;
  killerTeam: string;
  severity: Severity;
};

export type DeathAfterObjectiveSignal = {
  objectiveTimestamp: string;
  deathTimestamp: string;
  objectiveType: string;
  secondsAfterObjective: number;
  severity: Severity;
};

export type StructureLossAfterDeathSignal = {
  deathTimestamp: string;
  buildingTimestamp: string;
  lane: string | null;
  towerType: string | null;
  secondsAfterDeath: number;
  severity: Severity;
};

export type GoldCsCheckpointSignal = {
  minute: number;
  csPerMinute: number;
  totalGoldPerMinute: number;
  level: number;
};

export type RealScoringSignals = {
  deathFrequency: {
    deathCount: number;
    deathsPerMinute: number;
    highDeathFrequency: boolean;
    severity: Severity;
  };
  deathBeforeObjective: DeathBeforeObjectiveSignal[];
  deathAfterObjective: DeathAfterObjectiveSignal[];
  structureLossAfterDeath: StructureLossAfterDeathSignal[];
  goldCsProgression: {
    checkpoints: GoldCsCheckpointSignal[];
    stableCs: boolean;
    lowGoldPerMinute: boolean;
    fallingBehind: boolean;
  };
  directContribution: {
    kdaRatio: number;
    killParticipation: number | null;
    csPerMinute: number;
    goldPerMinute: number;
    visionScore: number;
    lowContributionFlags: string[];
  };
};

export type PreliminaryRiftLabReport = {
  title: string;
  mainValueSource: string;
  mainValueLoss: string;
  mainImprovementPriority: string;
  confidence: "Medium";
  confidenceNotes: string[];
  evidence: string[];
  metrics: MetricScore[];
  signals: RealScoringSignals;
};

export function generatePreliminaryRiftLabReport(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
): PreliminaryRiftLabReport {
  const signals = detectRealScoringSignals(summary, diagnostics);
  const metrics = generateMetricScores(summary, signals);
  const strongestMetric = metrics
    .filter((metric) => metric.polarity !== "cost")
    .sort((a, b) => b.score - a.score)[0];
  const valueLost = metrics.find((metric) => metric.name === "Value Lost");
  const evidence = buildEvidence(summary, signals);

  console.info("[RiftLab scoring v0.1] detected deaths:", signals.deathFrequency.deathCount);
  console.info(
    "[RiftLab scoring v0.1] detected objective windows:",
    signals.deathBeforeObjective.length + signals.deathAfterObjective.length,
  );
  console.info(
    "[RiftLab scoring v0.1] detected structure losses after death:",
    signals.structureLossAfterDeath.length,
  );
  console.info(
    "[RiftLab scoring v0.1] generated metric scores:",
    metrics.map((metric) => `${metric.name}: ${metric.score}`).join(", "),
  );

  return {
    title: "Preliminary Riot API report v0.1",
    mainValueSource: buildMainValueSource(summary, strongestMetric),
    mainValueLoss: buildMainValueLoss(summary, signals, valueLost),
    mainImprovementPriority: buildImprovementPriority(signals),
    confidence: "Medium",
    confidenceNotes: [
      "High confidence: deaths, objectives, structures, gold, CS, level, KDA, and vision are direct Riot API fields.",
      "Medium confidence: pressure, objective contribution, and conversion are inferred from event timing windows.",
      "Low confidence: positioning intent, vision intent, wave state, and team communication are not analyzed yet.",
    ],
    evidence,
    metrics,
    signals,
  };
}

export function detectRealScoringSignals(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
): RealScoringSignals {
  const deathCount = diagnostics.playerDeaths.length;
  const deathsPerMinute = roundTwo(deathCount / Math.max(summary.durationMinutes, 1));
  const deathBeforeObjective = detectDeathsBeforeObjectives(diagnostics);
  const deathAfterObjective = detectDeathsAfterObjectives(diagnostics);
  const structureLossAfterDeath = detectStructureLossAfterDeath(summary, diagnostics);
  const goldCsProgression = detectGoldCsProgression(summary, diagnostics);
  const directContribution = detectDirectContribution(summary);

  return {
    deathFrequency: {
      deathCount,
      deathsPerMinute,
      highDeathFrequency: deathCount >= 5 || deathsPerMinute >= 0.22,
      severity: deathCount >= 6 || deathsPerMinute >= 0.28 ? "High" : deathCount >= 4 ? "Medium" : "Low",
    },
    deathBeforeObjective,
    deathAfterObjective,
    structureLossAfterDeath,
    goldCsProgression,
    directContribution,
  };
}

function detectDeathsBeforeObjectives(diagnostics: TimelineDiagnostics): DeathBeforeObjectiveSignal[] {
  return diagnostics.playerDeaths.flatMap((death) => {
    const deathSeconds = parseTimestamp(death.timestamp);

    return diagnostics.eliteMonsterEvents
      .map((objective) => {
        const objectiveSeconds = parseTimestamp(objective.timestamp);
        const secondsBeforeObjective = objectiveSeconds - deathSeconds;

        if (secondsBeforeObjective <= 0 || secondsBeforeObjective > 90) {
          return null;
        }

        const signal: DeathBeforeObjectiveSignal = {
          deathTimestamp: death.timestamp,
          objectiveTimestamp: objective.timestamp,
          objectiveType: objective.monsterType,
          secondsBeforeObjective,
          killerTeam: objective.killerTeam,
          severity: secondsBeforeObjective <= 45 ? "High" : "Medium",
        };

        return signal;
      })
      .filter((signal): signal is DeathBeforeObjectiveSignal => signal !== null);
  });
}

function detectDeathsAfterObjectives(diagnostics: TimelineDiagnostics): DeathAfterObjectiveSignal[] {
  return diagnostics.eliteMonsterEvents.flatMap((objective) => {
    const objectiveSeconds = parseTimestamp(objective.timestamp);

    return diagnostics.playerDeaths
      .map((death) => {
        const deathSeconds = parseTimestamp(death.timestamp);
        const secondsAfterObjective = deathSeconds - objectiveSeconds;

        if (secondsAfterObjective <= 0 || secondsAfterObjective > 45) {
          return null;
        }

        const signal: DeathAfterObjectiveSignal = {
          objectiveTimestamp: objective.timestamp,
          deathTimestamp: death.timestamp,
          objectiveType: objective.monsterType,
          secondsAfterObjective,
          severity: secondsAfterObjective <= 25 ? "Medium" : "Low",
        };

        return signal;
      })
      .filter((signal): signal is DeathAfterObjectiveSignal => signal !== null);
  });
}

function detectStructureLossAfterDeath(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
): StructureLossAfterDeathSignal[] {
  return diagnostics.playerDeaths.flatMap((death) => {
    const deathSeconds = parseTimestamp(death.timestamp);

    return diagnostics.buildingEvents
      .map((building) => {
        const buildingSeconds = parseTimestamp(building.timestamp);
        const secondsAfterDeath = buildingSeconds - deathSeconds;

        if (
          secondsAfterDeath <= 0 ||
          secondsAfterDeath > 75 ||
          building.teamAffected !== summary.teamSide
        ) {
          return null;
        }

        const signal: StructureLossAfterDeathSignal = {
          deathTimestamp: death.timestamp,
          buildingTimestamp: building.timestamp,
          lane: building.laneType,
          towerType: building.towerType,
          secondsAfterDeath,
          severity: secondsAfterDeath <= 40 ? "High" : "Medium",
        };

        return signal;
      })
      .filter((signal): signal is StructureLossAfterDeathSignal => signal !== null);
  });
}

function detectGoldCsProgression(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
): RealScoringSignals["goldCsProgression"] {
  const checkpoints = diagnostics.frameSnapshots.map((snapshot) => ({
    minute: snapshot.minute,
    csPerMinute: roundOne((snapshot.minionsKilled + snapshot.jungleMinionsKilled) / snapshot.minute),
    totalGoldPerMinute: Math.round(snapshot.totalGold / snapshot.minute),
    level: snapshot.level,
  }));
  const lastCheckpoint = checkpoints.at(-1);
  const stableCs = summary.position === "UTILITY" ? true : (lastCheckpoint?.csPerMinute ?? summary.csPerMinute) >= 6;
  const lowGoldPerMinute = summary.goldPerMinute < 300 || (lastCheckpoint?.totalGoldPerMinute ?? 999) < 300;
  const fallingBehind = !stableCs || lowGoldPerMinute;

  return {
    checkpoints,
    stableCs,
    lowGoldPerMinute,
    fallingBehind,
  };
}

function detectDirectContribution(summary: RiotMatchSummary): RealScoringSignals["directContribution"] {
  const kdaRatio = roundTwo((summary.kills + summary.assists) / Math.max(summary.deaths, 1));
  const lowContributionFlags: string[] = [];

  if (summary.killParticipation !== null && summary.killParticipation < 0.35) {
    lowContributionFlags.push("Low kill participation");
  }

  if (kdaRatio < 1) {
    lowContributionFlags.push("Poor KDA ratio");
  }

  if (summary.goldPerMinute < 300) {
    lowContributionFlags.push("Low gold per minute");
  }

  if (summary.visionScore < getVisionBaseline(summary.position)) {
    lowContributionFlags.push("Low vision score for role/time");
  }

  return {
    kdaRatio,
    killParticipation: summary.killParticipation,
    csPerMinute: summary.csPerMinute,
    goldPerMinute: summary.goldPerMinute,
    visionScore: summary.visionScore,
    lowContributionFlags,
  };
}

function generateMetricScores(summary: RiotMatchSummary, signals: RealScoringSignals): MetricScore[] {
  const directValue = clampScore(
    50 +
      scoreCs(summary.csPerMinute) +
      scoreGold(summary.goldPerMinute) +
      scoreKda(signals.directContribution.kdaRatio) +
      scoreKillParticipation(signals.directContribution.killParticipation) +
      scoreVision(summary.visionScore, summary.position),
  );
  const valueLost = clampScore(
    signals.deathFrequency.deathCount * 8 +
      signals.deathBeforeObjective.length * 15 +
      signals.structureLossAfterDeath.length * 12 +
      signals.deathAfterObjective.length * 6,
  );
  const objectiveContribution = clampScore(
    50 - signals.deathBeforeObjective.length * 12 - signals.deathAfterObjective.length * 5,
  );
  const pressureValue = clampScore(
    50 -
      signals.structureLossAfterDeath.length * 12 -
      (signals.deathFrequency.highDeathFrequency ? 8 : 0) +
      (signals.goldCsProgression.stableCs ? 5 : 0),
  );
  const informationValue = clampScore(
    45 + (summary.visionScore / Math.max(summary.durationMinutes, 1) - 0.45) * 35,
  );
  const conversionValue = clampScore(
    50 -
      (signals.directContribution.killParticipation === 0 ? 15 : 0) -
      signals.deathAfterObjective.length * 8 +
      (signals.directContribution.killParticipation && signals.directContribution.killParticipation >= 0.55 ? 8 : 0),
  );

  return [
    metric("Direct Value", directValue, "Basic direct contribution from KDA, CS, gold, kill participation, and vision.", [
      `KDA ratio: ${signals.directContribution.kdaRatio}.`,
      `CS/min: ${summary.csPerMinute}, gold/min: ${summary.goldPerMinute}.`,
      `Kill participation: ${
        summary.killParticipation === null ? "unavailable" : `${Math.round(summary.killParticipation * 100)}%`
      }.`,
    ]),
    metric("Pressure Value", pressureValue, "Conservative proxy based on deaths that were followed by structure loss.", [
      `${signals.structureLossAfterDeath.length} structure loss window(s) detected after player deaths.`,
      signals.goldCsProgression.stableCs ? "CS progression stayed playable." : "CS progression looked weak.",
    ]),
    metric("Information Value", informationValue, "Vision score is used as a simple proxy until ward intent is analyzed.", [
      `Vision score: ${summary.visionScore}.`,
      "RiftLab is not analyzing vision placement intent yet.",
    ]),
    metric("Objective Contribution", objectiveContribution, "Objective contribution is reduced by deaths near objective windows.", [
      `${signals.deathBeforeObjective.length} death-before-objective window(s).`,
      `${signals.deathAfterObjective.length} post-objective tempo loss window(s).`,
    ]),
    metric("Conversion Value", conversionValue, "Basic conversion proxy from kill participation and post-objective deaths.", [
      `Team kills: ${summary.teamKills}.`,
      `Kill participation: ${
        summary.killParticipation === null ? "unavailable" : `${Math.round(summary.killParticipation * 100)}%`
      }.`,
    ]),
    metric("Value Lost", valueLost, "Penalty signal from deaths, objective windows, and structure losses after death.", [
      `${signals.deathFrequency.deathCount} player death(s).`,
      `${signals.deathBeforeObjective.length} death(s) before elite objective(s).`,
      `${signals.structureLossAfterDeath.length} structure loss window(s) after death.`,
    ], { polarity: "cost", displayValue: `Risk Cost: ${getRiskLabel(valueLost)}` }),
  ];
}

function buildMainValueSource(summary: RiotMatchSummary, strongestMetric: MetricScore | undefined): string {
  if (!strongestMetric) {
    return "The strongest value source is not clear from the current Riot API-only pass.";
  }

  if (strongestMetric.name === "Direct Value") {
    return `Your clearest value came from direct fundamentals: ${summary.csPerMinute} CS/min, ${summary.goldPerMinute} gold/min, and available combat contribution.`;
  }

  return `Your clearest value source in this preliminary pass was ${strongestMetric.name}. This is based only on Riot API match and timeline fields.`;
}

function buildMainValueLoss(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
  valueLost: MetricScore | undefined,
): string {
  if (signals.deathBeforeObjective.length > 0 || signals.structureLossAfterDeath.length > 0) {
    return `The largest value loss came from ${signals.deathFrequency.deathCount} death(s), including ${signals.deathBeforeObjective.length} death-before-objective window(s) and ${signals.structureLossAfterDeath.length} structure loss window(s) after death.`;
  }

  if (signals.deathFrequency.highDeathFrequency) {
    return `The largest value loss came from high death frequency: ${signals.deathFrequency.deathCount} deaths in ${summary.duration}.`;
  }

  return valueLost
    ? `Value lost was limited in this preliminary pass (${valueLost.displayValue ?? valueLost.score}).`
    : "No major value loss signal was detected from deaths, objectives, or structures.";
}

function buildImprovementPriority(signals: RealScoringSignals): string {
  if (signals.deathBeforeObjective.length > 0) {
    return "Prioritize staying alive during the 90 seconds before neutral objectives. This version can see the timing cost, but not yet the vision or wave context.";
  }

  if (signals.structureLossAfterDeath.length > 0) {
    return "Prioritize side-lane and post-fight discipline when structures are exposed. Deaths that lead to towers are high-cost windows.";
  }

  if (signals.directContribution.lowContributionFlags.length > 0) {
    return `Improve direct contribution signals: ${signals.directContribution.lowContributionFlags.join(", ")}.`;
  }

  return "Maintain the current baseline and review objective timing once richer report generation is connected.";
}

function buildEvidence(summary: RiotMatchSummary, signals: RealScoringSignals): string[] {
  const evidence = [
    `${signals.deathFrequency.deathCount} deaths over ${summary.duration} (${signals.deathFrequency.deathsPerMinute} deaths/min).`,
    `${signals.deathBeforeObjective.length} deaths happened within 90 seconds before elite monster events.`,
    `${signals.structureLossAfterDeath.length} structures affecting your team fell within 75 seconds after your deaths.`,
    `Final direct line: ${summary.kills}/${summary.deaths}/${summary.assists}, ${summary.csPerMinute} CS/min, ${summary.goldPerMinute} gold/min.`,
  ];

  if (signals.goldCsProgression.checkpoints.length > 0) {
    evidence.push(
      `Checkpoint sample: ${signals.goldCsProgression.checkpoints
        .map((checkpoint) => `${checkpoint.minute}m ${checkpoint.csPerMinute} CS/min ${checkpoint.totalGoldPerMinute} G/min`)
        .join("; ")}.`,
    );
  }

  return evidence;
}

function metric(
  name: string,
  score: number,
  explanation: string,
  evidence: string[],
  options: Pick<MetricScore, "polarity" | "displayValue"> = {},
): MetricScore {
  return {
    name,
    score,
    status: options.polarity === "cost" ? getCostStatus(score) : getStatus(score),
    explanation,
    evidence,
    ...options,
  };
}

function scoreCs(csPerMinute: number): number {
  if (csPerMinute >= 7) return 10;
  if (csPerMinute >= 6) return 5;
  if (csPerMinute < 4) return -10;
  return 0;
}

function scoreGold(goldPerMinute: number): number {
  if (goldPerMinute >= 400) return 10;
  if (goldPerMinute >= 330) return 5;
  if (goldPerMinute < 280) return -10;
  return 0;
}

function scoreKda(kdaRatio: number): number {
  if (kdaRatio >= 3) return 10;
  if (kdaRatio >= 1.5) return 5;
  if (kdaRatio < 1) return -12;
  return 0;
}

function scoreKillParticipation(killParticipation: number | null): number {
  if (killParticipation === null) return 0;
  if (killParticipation >= 0.6) return 10;
  if (killParticipation >= 0.4) return 5;
  if (killParticipation < 0.25) return -10;
  return 0;
}

function scoreVision(visionScore: number, position: string): number {
  const baseline = getVisionBaseline(position);
  if (visionScore >= baseline) return 5;
  if (visionScore < baseline * 0.5) return -5;
  return 0;
}

function getVisionBaseline(position: string): number {
  if (position === "UTILITY") return 20;
  if (position === "JUNGLE") return 16;
  return 8;
}

function getRiskLabel(score: number): string {
  if (score >= 70) return "Critical";
  if (score >= 45) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

function getStatus(score: number): MetricStatus {
  if (score >= 78) return "Strong";
  if (score >= 58) return "Average";
  if (score >= 40) return "Weak";
  return "Critical";
}

function getCostStatus(score: number): MetricStatus {
  if (score >= 70) return "Critical";
  if (score >= 45) return "Weak";
  if (score >= 25) return "Average";
  return "Strong";
}

function parseTimestamp(timestamp: string): number {
  const [minutes, seconds] = timestamp.split(":").map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
