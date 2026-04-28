import {
  buildStructureLossRelevanceExplanation,
  generateCausalImpactChains,
  getCausalConfidenceForStructureLoss,
  getGamePhase,
  getLaneRelevanceForStructureLoss,
  getStructureLossCostForStructure,
  getStructureLossSeverityForStructure,
  type ChainConfidence,
  type GamePhase,
  type ImpactChain,
  type LaneRelevance,
} from "@/lib/causal-impact/causal-impact-engine";
import { formatObjectiveTypeForUser, formatRoleForUser, formatStructureForUser } from "@/lib/formatters/riot-display";
import type { EliteMonsterEvent, RiotMatchSummary, TimelineDiagnostics } from "@/lib/reports";
import { generateDeepAnalysis, type DeepAnalysis } from "@/lib/scoring/deep-analysis";
import type { MetricScore, MetricStatus } from "@/lib/types";

type Severity = "Low" | "Medium" | "High";
type TeamSide = "Blue" | "Red" | "Unknown";

export type GroupedObjectiveWindow = {
  startTimestamp: string;
  endTimestamp: string;
  objectiveType: string;
  eventCount: number;
  killerTeam: TeamSide;
  label: string;
};

export type DeathBeforeObjectiveSignal = {
  deathTimestamp: string;
  objectiveTimestamp: string;
  objectiveEndTimestamp: string;
  objectiveType: string;
  objectiveWindowLabel: string;
  objectiveEventCount: number;
  secondsBeforeObjective: number;
  killerTeam: string;
  severity: Severity;
};

export type DeathAfterObjectiveSignal = {
  objectiveTimestamp: string;
  objectiveEndTimestamp: string;
  deathTimestamp: string;
  objectiveType: string;
  objectiveWindowLabel: string;
  objectiveEventCount: number;
  secondsAfterObjective: number;
  severity: Severity;
};

export type StructureLossAfterDeathSignal = {
  deathTimestamp: string;
  buildingTimestamp: string;
  lane: string | null;
  buildingType: string;
  towerType: string | null;
  teamAffected: TeamSide;
  laneRelevance: LaneRelevance;
  gamePhase: GamePhase;
  causalConfidence: ChainConfidence;
  structureLossCost: number;
  relevanceExplanation: string;
  secondsAfterDeath: number;
  severity: Severity;
};

export type GoldCsCheckpointSignal = {
  minute: number;
  csPerMinute: number;
  totalGoldPerMinute: number;
  level: number;
};

export type GoldProgressionPoint = {
  minute: number;
  totalGold: number;
};

export type CsProgressionPoint = {
  minute: number;
  totalCs: number;
  laneCs: number;
  jungleCs: number;
};

export type MetricScorePoint = {
  label: string;
  value: number;
  polarity: "positive" | "cost";
};

export type EventCountPoint = {
  label: string;
  value: number;
};

export type GoldPerMinuteCheckpointPoint = {
  minute: number;
  goldPerMinute: number;
};

export type RivalRoleDeltaPoint = {
  minute: number;
  goldDelta: number;
  csDelta: number;
  levelDelta: number;
};

export type TeamfightConversionCountPoint = {
  label: string;
  value: number;
};

export type TelemetryChartData = {
  goldProgression: GoldProgressionPoint[];
  csProgression: CsProgressionPoint[];
  rivalRoleDelta: RivalRoleDeltaPoint[];
  metricScores: MetricScorePoint[];
  eventCounts: EventCountPoint[];
  teamfightConversionCounts: TeamfightConversionCountPoint[];
  goldPerMinuteCheckpoints: GoldPerMinuteCheckpointPoint[];
};

export type RealScoringSignals = {
  deathFrequency: {
    deathCount: number;
    deathsPerMinute: number;
    highDeathFrequency: boolean;
    severity: Severity;
  };
  objectiveWindows: GroupedObjectiveWindow[];
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
  impactChains: ImpactChain[];
  deepAnalysis: DeepAnalysis;
  telemetryCharts: TelemetryChartData;
};

export function generatePreliminaryRiftLabReport(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
): PreliminaryRiftLabReport {
  const signals = detectRealScoringSignals(summary, diagnostics);
  const impactChains = generateCausalImpactChains({
    summary,
    diagnostics,
    objectiveWindows: signals.objectiveWindows,
  });
  const metrics = generateMetricScores(summary, signals, impactChains);
  const strongestMetric = metrics
    .filter((metric) => metric.polarity !== "cost")
    .sort((a, b) => b.score - a.score)[0];
  const valueLost = metrics.find((metric) => metric.name === "Value Lost");
  const evidence = buildEvidence(summary, signals);
  const mainImprovementPriority = buildImprovementPriority(signals, impactChains);
  const deepAnalysis = generateDeepAnalysis({
    summary,
    diagnostics,
    signals,
    impactChains,
    mainImprovementPriority,
  });
  const telemetryCharts = generateTelemetryChartData(diagnostics, metrics, signals, impactChains, summary, deepAnalysis);

  console.info("[RiftLab scoring v0.1] detected deaths:", signals.deathFrequency.deathCount);
  console.info("[RiftLab scoring v0.1] raw elite monster events:", diagnostics.eliteMonsterEvents.length);
  console.info("[RiftLab scoring v0.1] grouped objective windows:", signals.objectiveWindows.length);
  console.info(
    "[RiftLab scoring v0.1] grouped objective window detail:",
    signals.objectiveWindows.length > 0
      ? signals.objectiveWindows
          .map(
            (window) =>
              `${window.objectiveType} ${window.startTimestamp}-${window.endTimestamp} (${window.eventCount} event(s))`,
          )
          .join(", ")
      : "none",
  );
  console.info(
    "[RiftLab scoring v0.1] death-before-objective count after grouping:",
    signals.deathBeforeObjective.length,
  );
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
  console.info("[RiftLab charts v0.1] chart data generated:", {
    generated: true,
    goldPoints: telemetryCharts.goldProgression.length,
    csPoints: telemetryCharts.csProgression.length,
    rivalRoleDeltaPoints: telemetryCharts.rivalRoleDelta.length,
    metricScoreCount: telemetryCharts.metricScores.length,
    teamfightConversionCountPoints: telemetryCharts.teamfightConversionCounts.length,
    eventCountSummary: telemetryCharts.eventCounts
      .map((point) => `${point.label}: ${point.value}`)
      .join(", "),
  });

  return {
    title: "Preliminary Riot API report v0.1",
    mainValueSource: buildMainValueSource(summary, signals, strongestMetric, impactChains),
    mainValueLoss: buildMainValueLoss(summary, signals, valueLost, impactChains),
    mainImprovementPriority,
    confidence: "Medium",
    confidenceNotes: [
      "High confidence: deaths, objectives, structures, gold, CS, level, KDA, and vision are direct Riot API fields.",
      "Medium confidence: pressure, objective contribution, and conversion are inferred from event timing windows.",
      "Low confidence: positioning intent, vision intent, wave state, and team communication are not inferred from Riot API alone.",
    ],
    evidence,
    metrics,
    signals,
    impactChains,
    deepAnalysis,
    telemetryCharts,
  };
}

export function detectRealScoringSignals(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
): RealScoringSignals {
  const deathCount = diagnostics.playerDeaths.length;
  const deathsPerMinute = roundTwo(deathCount / Math.max(summary.durationMinutes, 1));
  const objectiveWindows = groupObjectiveWindows(diagnostics.eliteMonsterEvents);
  const deathBeforeObjective = detectDeathsBeforeObjectives(summary, diagnostics, objectiveWindows);
  const deathAfterObjective = detectDeathsAfterObjectives(diagnostics, objectiveWindows);
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
    objectiveWindows,
    deathBeforeObjective,
    deathAfterObjective,
    structureLossAfterDeath,
    goldCsProgression,
    directContribution,
  };
}

function detectDeathsBeforeObjectives(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: ObjectiveWindowInternal[],
): DeathBeforeObjectiveSignal[] {
  return diagnostics.playerDeaths.flatMap((death) => {
    const deathSeconds = parseTimestamp(death.timestamp);

    return objectiveWindows
      .filter((window) => window.killerTeam !== summary.teamSide)
      .map((window) => {
        const secondsBeforeObjective = window.startSeconds - deathSeconds;

        if (secondsBeforeObjective <= 0 || secondsBeforeObjective > 90) {
          return null;
        }

        const signal: DeathBeforeObjectiveSignal = {
          deathTimestamp: death.timestamp,
          objectiveTimestamp: window.startTimestamp,
          objectiveEndTimestamp: window.endTimestamp,
          objectiveType: window.objectiveType,
          objectiveWindowLabel: window.label,
          objectiveEventCount: window.eventCount,
          secondsBeforeObjective,
          killerTeam: window.killerTeam,
          severity: secondsBeforeObjective <= 45 ? "High" : "Medium",
        };

        return signal;
      })
      .filter((signal): signal is DeathBeforeObjectiveSignal => signal !== null);
  });
}

function detectDeathsAfterObjectives(
  diagnostics: TimelineDiagnostics,
  objectiveWindows: ObjectiveWindowInternal[],
): DeathAfterObjectiveSignal[] {
  return objectiveWindows.flatMap((window) => {
    return diagnostics.playerDeaths
      .map((death) => {
        const deathSeconds = parseTimestamp(death.timestamp);
        const secondsAfterObjective = deathSeconds - window.endSeconds;

        if (secondsAfterObjective <= 0 || secondsAfterObjective > 45) {
          return null;
        }

        const signal: DeathAfterObjectiveSignal = {
          objectiveTimestamp: window.startTimestamp,
          objectiveEndTimestamp: window.endTimestamp,
          deathTimestamp: death.timestamp,
          objectiveType: window.objectiveType,
          objectiveWindowLabel: window.label,
          objectiveEventCount: window.eventCount,
          secondsAfterObjective,
          severity: secondsAfterObjective <= 25 ? "Medium" : "Low",
        };

        return signal;
      })
      .filter((signal): signal is DeathAfterObjectiveSignal => signal !== null);
  });
}

type ObjectiveWindowInternal = GroupedObjectiveWindow & {
  typeKey: string;
  startSeconds: number;
  endSeconds: number;
};

function groupObjectiveWindows(eliteMonsterEvents: EliteMonsterEvent[]): ObjectiveWindowInternal[] {
  return [...eliteMonsterEvents]
    .sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp))
    .reduce<ObjectiveWindowInternal[]>((windows, event) => {
      const eventSeconds = parseTimestamp(event.timestamp);
      const typeKey = getObjectiveTypeKey(event.monsterType);
      const objectiveType = getObjectiveDisplayType(event.monsterType);
      const previousWindow = windows.at(-1);

      if (
        previousWindow &&
        previousWindow.typeKey === typeKey &&
        eventSeconds - previousWindow.endSeconds <= 60
      ) {
        previousWindow.endTimestamp = event.timestamp;
        previousWindow.endSeconds = eventSeconds;
        previousWindow.eventCount += 1;
        previousWindow.killerTeam =
          previousWindow.killerTeam === event.killerTeam ? previousWindow.killerTeam : "Unknown";
        previousWindow.label = formatObjectiveWindowLabel(previousWindow);
        return windows;
      }

      const window: ObjectiveWindowInternal = {
        typeKey,
        startTimestamp: event.timestamp,
        endTimestamp: event.timestamp,
        startSeconds: eventSeconds,
        endSeconds: eventSeconds,
        objectiveType,
        eventCount: 1,
        killerTeam: event.killerTeam,
        label: "",
      };
      window.label = formatObjectiveWindowLabel(window);

      windows.push(window);
      return windows;
    }, []);
}

function getObjectiveTypeKey(monsterType: string): string {
  const normalized = monsterType.toUpperCase();

  if (normalized === "HORDE" || normalized.includes("VOIDGRUB")) {
    return "HORDE";
  }

  return normalized;
}

function getObjectiveDisplayType(monsterType: string): string {
  return getObjectiveTypeKey(monsterType) === "HORDE" ? "Voidgrubs" : formatObjectiveTypeForUser(monsterType);
}

function formatObjectiveWindowLabel(window: Pick<GroupedObjectiveWindow, "startTimestamp" | "endTimestamp" | "objectiveType">): string {
  const timestampRange =
    window.startTimestamp === window.endTimestamp
      ? window.startTimestamp
      : `${window.startTimestamp}\u2013${window.endTimestamp}`;

  return `${window.objectiveType} window ${timestampRange}`;
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

        const towerOrBuildingType = building.towerType ?? building.buildingType;
        const laneRelevance = getLaneRelevanceForStructureLoss(
          summary.position,
          building.laneType,
          towerOrBuildingType,
          buildingSeconds,
        );
        const gamePhase = getGamePhase(buildingSeconds);
        const originalSeverity = secondsAfterDeath <= 40 ? "High" : "Medium";
        const adjustedSeverity = getStructureLossSeverityForStructure(
          laneRelevance,
          originalSeverity,
          towerOrBuildingType,
          gamePhase,
        );
        const structureLossCost = getStructureLossCostForStructure(laneRelevance, towerOrBuildingType, gamePhase);

        console.info("[RiftLab scoring v0.1] structure lane relevance decision:", {
          structureLane: building.laneType,
          rawTowerType: building.towerType,
          formattedStructureName: formatStructureForUser(building.laneType, towerOrBuildingType),
          playerRole: summary.position,
          gamePhase,
          laneRelevance,
          originalSeverity,
          adjustedSeverity,
          lateGameMajorStructureAdjustment:
            gamePhase !== "early" && (towerOrBuildingType?.includes("BASE") || towerOrBuildingType?.includes("NEXUS")),
          finalScoreDelta: -structureLossCost,
        });

        const signal: StructureLossAfterDeathSignal = {
          deathTimestamp: death.timestamp,
          buildingTimestamp: building.timestamp,
          lane: building.laneType,
          buildingType: building.buildingType,
          towerType: building.towerType,
          teamAffected: building.teamAffected,
          laneRelevance,
          gamePhase,
          causalConfidence: getCausalConfidenceForStructureLoss(laneRelevance, towerOrBuildingType, gamePhase),
          structureLossCost,
          relevanceExplanation: buildStructureLossRelevanceExplanation(
            summary.position,
            building.laneType,
            towerOrBuildingType,
            gamePhase,
            laneRelevance,
          ),
          secondsAfterDeath,
          severity: adjustedSeverity,
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
  const supportRole = isSupportRole(summary.position);
  const checkpoints = diagnostics.frameSnapshots.map((snapshot) => ({
    minute: snapshot.minute,
    csPerMinute: roundOne((snapshot.minionsKilled + snapshot.jungleMinionsKilled) / snapshot.minute),
    totalGoldPerMinute: Math.round(snapshot.totalGold / snapshot.minute),
    level: snapshot.level,
  }));
  const lastCheckpoint = checkpoints.at(-1);
  const stableCs = supportRole ? true : (lastCheckpoint?.csPerMinute ?? summary.csPerMinute) >= 6;
  const lowGoldPerMinute = supportRole
    ? false
    : summary.goldPerMinute < 300 || (lastCheckpoint?.totalGoldPerMinute ?? 999) < 300;
  const fallingBehind = !stableCs || lowGoldPerMinute;

  console.info("[RiftLab scoring v0.1] farm scoring role decision:", {
    playerRole: summary.position,
    formattedRole: formatRoleForUser(summary.position),
    farmPenaltySkippedDueToSupportRole: supportRole,
    stableCs,
    lowGoldPerMinute,
  });

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
  const supportRole = isSupportRole(summary.position);

  if (summary.killParticipation !== null && summary.killParticipation < 0.35) {
    lowContributionFlags.push("Low kill participation");
  }

  if (kdaRatio < 1) {
    lowContributionFlags.push("Poor KDA ratio");
  }

  if (!supportRole && summary.goldPerMinute < 300) {
    lowContributionFlags.push("Low gold per minute");
  }

  if (summary.visionScore < getVisionBaseline(summary.position)) {
    lowContributionFlags.push("Low vision score for role/time");
  }

  console.info("[RiftLab scoring v0.1] direct value role decision:", {
    playerRole: summary.position,
    formattedRole: formatRoleForUser(summary.position),
    farmPenaltySkippedDueToSupportRole: supportRole,
    lowContributionFlags,
  });

  return {
    kdaRatio,
    killParticipation: summary.killParticipation,
    csPerMinute: summary.csPerMinute,
    goldPerMinute: summary.goldPerMinute,
    visionScore: summary.visionScore,
    lowContributionFlags,
  };
}

function generateMetricScores(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
  impactChains: ImpactChain[],
): MetricScore[] {
  const supportRole = isSupportRole(summary.position);
  const rivalRoleScoreDelta = getRivalRoleScoreDelta(summary);
  const directValueExplanation = shouldUsePlayableCsDirectValueExplanation(summary, signals)
    ? "CS progression stayed playable, but Direct Value was heavily reduced by low kill participation, poor KDA, and low gold/min."
    : supportRole
      ? "Support Direct Value is based on combat participation, deaths, assists, vision score, and objective-related timing. CS/farm is retained as raw context but not penalized."
      : "Basic direct contribution from KDA, CS, gold, kill participation, and vision.";
  const structureLossCost = getTotalStructureLossCost(signals.structureLossAfterDeath);
  const directValue = clampScore(
    50 +
      scoreCs(summary.csPerMinute, summary.position) +
      scoreGold(summary.goldPerMinute, summary.position) +
      scoreKda(signals.directContribution.kdaRatio) +
      scoreKillParticipation(signals.directContribution.killParticipation) +
      scoreVision(summary.visionScore, summary.position) +
      rivalRoleScoreDelta,
  );
  const valueLost = clampScore(
    signals.deathFrequency.deathCount * 8 +
      signals.deathBeforeObjective.length * 15 +
      structureLossCost +
      signals.deathAfterObjective.length * 6 +
      getChainMetricPenalty(impactChains, "Value Lost", 10),
  );
  const rawObjectiveContribution =
    50 -
    signals.deathBeforeObjective.length * 12 -
    signals.deathAfterObjective.length * 5 +
    getChainMetricDelta(impactChains, "Objective Contribution", 8);
  const objectiveContribution = clampObjectiveContribution(rawObjectiveContribution, summary);
  const pressureValue = clampScore(
    50 -
      structureLossCost -
      (signals.deathFrequency.highDeathFrequency ? 8 : 0) +
      (signals.goldCsProgression.stableCs ? 5 : 0) +
      getChainMetricDelta(impactChains, "Pressure Value", 8),
  );
  const informationValue = clampScore(
    45 + (summary.visionScore / Math.max(summary.durationMinutes, 1) - 0.45) * 35,
  );
  const conversionValue = clampScore(
    50 -
      (signals.directContribution.killParticipation === 0 ? 15 : 0) -
      signals.deathAfterObjective.length * 8 +
      (signals.directContribution.killParticipation && signals.directContribution.killParticipation >= 0.55 ? 8 : 0) +
      getChainMetricDelta(impactChains, "Conversion Value", 10),
  );

  return [
    metric("Direct Value", directValue, directValueExplanation, [
      `KDA ratio: ${signals.directContribution.kdaRatio}.`,
      supportRole
        ? `Support role detected: CS/farm is kept as raw context and is not penalized. Gold/min: ${summary.goldPerMinute}.`
        : `CS/min: ${summary.csPerMinute}, gold/min: ${summary.goldPerMinute}.`,
      `Kill participation: ${
        summary.killParticipation === null ? "unavailable" : `${Math.round(summary.killParticipation * 100)}%`
      }.`,
      `Vision score: ${summary.visionScore}.`,
      `Direct role delta adjustment: ${rivalRoleScoreDelta}.`,
    ]),
    metric("Pressure Value", pressureValue, "Conservative proxy based on deaths that were followed by structure loss.", [
      `${signals.structureLossAfterDeath.length} structure loss window(s) detected after player deaths, weighted to ${structureLossCost} cost by lane relevance.`,
      supportRole
        ? "Support role detected: CS progression is not treated as a farm penalty."
        : signals.goldCsProgression.stableCs
          ? "CS progression stayed playable."
          : "CS progression looked weak.",
    ]),
    metric("Information Value", informationValue, "Vision score is used as a simple proxy until ward intent is analyzed.", [
      `Vision score: ${summary.visionScore}.`,
      "RiftLab is not analyzing vision placement intent yet.",
    ]),
    metric("Objective Contribution", objectiveContribution, "Objective contribution is reduced by deaths near objective windows.", [
      `${signals.deathBeforeObjective.length} death-before-objective window(s).`,
      `${signals.deathAfterObjective.length} post-objective tempo loss window(s).`,
      `${getChainsAffectingMetric(impactChains, "Objective Contribution").length} causal chain(s) affected this metric.`,
      objectiveContribution === 15 && rawObjectiveContribution < 15
        ? "A minimum floor is applied because some measurable participation was present."
        : "Score reflects grouped objective timing windows.",
    ]),
    metric("Conversion Value", conversionValue, "Basic conversion proxy from kill participation and post-objective deaths.", [
      `Team kills: ${summary.teamKills}.`,
      `Kill participation: ${
        summary.killParticipation === null ? "unavailable" : `${Math.round(summary.killParticipation * 100)}%`
      }.`,
    ]),
    metric("Value Lost", valueLost, "Penalty signal from deaths, objective windows, and structure losses after death.", [
      `${signals.deathFrequency.deathCount} player death(s).`,
      `${signals.deathBeforeObjective.length} death-before-objective window(s).`,
      `${signals.structureLossAfterDeath.length} structure loss window(s) after death, weighted by lane relevance.`,
      `${getChainsAffectingMetric(impactChains, "Value Lost").length} causal chain(s) affected this metric.`,
    ], { polarity: "cost", displayValue: `Risk Cost: ${getRiskLabel(valueLost)}` }),
  ];
}

function getTotalStructureLossCost(structureLossSignals: StructureLossAfterDeathSignal[]): number {
  return structureLossSignals.reduce((total, signal) => total + signal.structureLossCost, 0);
}

function getChainsAffectingMetric(impactChains: ImpactChain[], metricName: string): ImpactChain[] {
  return impactChains.filter((chain) => chain.affectedMetrics.includes(metricName));
}

function getChainMetricDelta(impactChains: ImpactChain[], metricName: string, cap: number): number {
  const total = getChainsAffectingMetric(impactChains, metricName).reduce(
    (sum, chain) => sum + chain.valueDelta.scoreImpact,
    0,
  );

  return Math.max(-cap, Math.min(cap, total));
}

function getChainMetricPenalty(impactChains: ImpactChain[], metricName: string, cap: number): number {
  const total = getChainsAffectingMetric(impactChains, metricName)
    .filter((chain) => chain.valueDelta.scoreImpact < 0)
    .reduce((sum, chain) => sum + Math.abs(chain.valueDelta.scoreImpact), 0);

  return Math.min(cap, total);
}

function shouldUsePlayableCsDirectValueExplanation(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
): boolean {
  const flags = signals.directContribution.lowContributionFlags;

  return (
    !isSupportRole(summary.position) &&
    summary.csPerMinute >= 6 &&
    flags.includes("Low kill participation") &&
    flags.includes("Poor KDA ratio") &&
    flags.includes("Low gold per minute")
  );
}

function clampObjectiveContribution(
  rawScore: number,
  summary: RiotMatchSummary,
): number {
  const hasMeasurableParticipation =
    summary.kills > 0 ||
    summary.assists > 0 ||
    summary.totalCs > 0 ||
    summary.visionScore > 0;

  if (!hasMeasurableParticipation) {
    return clampScore(rawScore);
  }

  return clampScore(Math.max(rawScore, 15));
}

function buildMainValueSource(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
  strongestMetric: MetricScore | undefined,
  impactChains: ImpactChain[],
): string {
  const strongestPositiveChain = impactChains.find(
    (chain) => chain.classification === "positive" && chain.valueDirection === "generated",
  );

  if (strongestPositiveChain) {
    return `Your clearest positive chain was ${strongestPositiveChain.title} ${strongestPositiveChain.userFacingSummary}`;
  }

  if (!strongestMetric) {
    return "The strongest value source is not clear from the current Riot API-only pass.";
  }

  if (strongestMetric.score < 55) {
    return signals.goldCsProgression.stableCs && !isSupportRole(summary.position)
      ? "No strong positive causal chain was detected in this preliminary pass. The most stable signal was CS progression, but it did not convert into measurable map impact."
      : "No strong positive causal chain was detected in this preliminary pass.";
  }

  if (strongestMetric.name === "Direct Value") {
    if (isSupportRole(summary.position)) {
      return "Your clearest value came from support fundamentals: combat participation, assists, vision score, and available objective timing signals.";
    }

    return `Your clearest value came from direct fundamentals: ${summary.csPerMinute} CS/min, ${summary.goldPerMinute} gold/min, and available combat contribution.`;
  }

  return `Your clearest value source in this preliminary pass was ${strongestMetric.name}. This is based only on Riot API match and timeline fields.`;
}

function buildMainValueLoss(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
  valueLost: MetricScore | undefined,
  impactChains: ImpactChain[],
): string {
  const negativeChains = impactChains.filter((chain) => chain.classification === "negative");

  if (negativeChains.length > 0) {
    const hasEnemyObjectiveChain = negativeChains.some((chain) => chain.chainType === "death_to_enemy_objective");
    const hasStructureLossChain = negativeChains.some((chain) => chain.chainType === "death_to_structure_loss");
    const chainSummary = [
      hasEnemyObjectiveChain ? "deaths before enemy objective windows" : null,
      hasStructureLossChain ? "high-relevance deaths followed by allied structure loss" : null,
    ].filter(Boolean);

    return `The largest value loss came from ${negativeChains.length} negative impact chain(s): ${
      chainSummary.length > 0 ? chainSummary.join(" and ") : negativeChains[0].title
    }. API confirms the event sequence, not the full decision context.`;
  }

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

function buildImprovementPriority(signals: RealScoringSignals, impactChains: ImpactChain[]): string {
  const enemyObjectiveChain = impactChains.find((chain) => chain.chainType === "death_to_enemy_objective");
  const highRelevanceStructureChain = impactChains.find(
    (chain) => chain.chainType === "death_to_structure_loss" && chain.laneRelevance === "high",
  );

  if (enemyObjectiveChain) {
    return "Prioritize staying alive during enemy objective timing windows. This version can see the timing cost, but not yet the vision, wave, or positioning context.";
  }

  if (highRelevanceStructureChain) {
    return "Prioritize deaths that are followed by high-relevance allied structure-loss windows. Future VOD context can refine lane assignment, wave state, and rotation context.";
  }

  if (signals.deathBeforeObjective.length > 0) {
    return "Prioritize staying alive during the 90 seconds before neutral objectives. This version can see the timing cost, but not yet the vision or wave context.";
  }

  if (signals.structureLossAfterDeath.length > 0) {
    return "Prioritize side-lane and post-fight discipline when structures are exposed. This version weights tower-loss associations by role, lane, and game phase.";
  }

  if (signals.directContribution.lowContributionFlags.length > 0) {
    return `Improve direct contribution signals: ${signals.directContribution.lowContributionFlags.join(", ")}.`;
  }

  return "Maintain the current baseline and review objective timing once richer report generation is connected.";
}

function buildEvidence(summary: RiotMatchSummary, signals: RealScoringSignals): string[] {
  const evidence = [
    `${signals.deathFrequency.deathCount} deaths over ${summary.duration} (${signals.deathFrequency.deathsPerMinute} deaths/min).`,
    `${signals.deathBeforeObjective.length} death-before-objective window(s) happened within 90 seconds before grouped elite objective windows.`,
    `${signals.structureLossAfterDeath.length} allied structure-loss association(s) were found within 75 seconds after your deaths and weighted by lane relevance.`,
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

function generateTelemetryChartData(
  diagnostics: TimelineDiagnostics,
  metrics: MetricScore[],
  signals: RealScoringSignals,
  impactChains: ImpactChain[],
  summary: RiotMatchSummary,
  deepAnalysis: DeepAnalysis,
): TelemetryChartData {
  const goldProgression = diagnostics.frameSnapshots.map((snapshot) => ({
    minute: snapshot.minute,
    totalGold: snapshot.totalGold,
  }));
  const csProgression = diagnostics.frameSnapshots.map((snapshot) => ({
    minute: snapshot.minute,
    totalCs: snapshot.minionsKilled + snapshot.jungleMinionsKilled,
    laneCs: snapshot.minionsKilled,
    jungleCs: snapshot.jungleMinionsKilled,
  }));
  const metricScores: MetricScorePoint[] = metrics.map((metric) => ({
    label: metric.name === "Value Lost" ? "Value Lost (Risk Cost)" : metric.name,
    value: metric.score,
    polarity: metric.polarity === "cost" ? "cost" : "positive",
  }));
  const enemyObjectiveWindows = signals.objectiveWindows.filter(
    (window) => window.killerTeam !== "Unknown" && window.killerTeam !== summary.teamSide,
  ).length;
  const alliedObjectiveWindows = signals.objectiveWindows.filter(
    (window) => window.killerTeam === summary.teamSide,
  ).length;
  const positiveChains = impactChains.filter((chain) => chain.classification === "positive").length;
  const negativeChains = impactChains.filter((chain) => chain.classification === "negative").length;
  const neutralTradeChains = impactChains.filter(
    (chain) => chain.classification === "neutral" || chain.classification === "trade",
  ).length;
  const eventCounts = [
    { label: "Deaths", value: signals.deathFrequency.deathCount },
    { label: "Enemy objective windows", value: enemyObjectiveWindows },
    { label: "Allied objective windows", value: alliedObjectiveWindows },
    { label: "Structure-loss windows", value: signals.structureLossAfterDeath.length },
    { label: "Positive chains", value: positiveChains },
    { label: "Negative chains", value: negativeChains },
    { label: "Neutral/trade chains", value: neutralTradeChains },
  ];
  const rivalRoleDelta = deepAnalysis.rivalRoleDelta.checkpoints.map((checkpoint) => ({
    minute: checkpoint.minute,
    goldDelta: checkpoint.totalGoldDelta,
    csDelta: checkpoint.totalCsDelta,
    levelDelta: checkpoint.levelDelta,
  }));
  const teamfightConversionCounts = [
    { label: "Allied fight conversions", value: deepAnalysis.teamfightProfile.alliedConversions },
    { label: "Enemy fight conversions", value: deepAnalysis.teamfightProfile.enemyConversions },
  ];
  const goldPerMinuteCheckpoints = diagnostics.frameSnapshots.map((snapshot) => ({
    minute: snapshot.minute,
    goldPerMinute: Math.round(snapshot.totalGold / Math.max(snapshot.minute, 1)),
  }));

  return {
    goldProgression,
    csProgression,
    rivalRoleDelta,
    metricScores,
    eventCounts,
    teamfightConversionCounts,
    goldPerMinuteCheckpoints,
  };
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

function isSupportRole(position: string | null | undefined): boolean {
  const normalized = position?.toUpperCase();

  return normalized === "UTILITY" || normalized === "SUPPORT";
}

function getRivalRoleScoreDelta(summary: RiotMatchSummary): number {
  const player = summary.participants.find((participant) => participant.participantId === summary.playerParticipantId);
  const role = summary.position.toUpperCase();

  if (!player) return 0;

  const opponent = summary.participants.find((participant) => {
    const participantRole = participant.teamPosition || participant.individualPosition;
    return participant.teamId !== player.teamId && normalizeRoleForComparison(participantRole) === normalizeRoleForComparison(summary.position);
  });

  if (!opponent) return 0;

  const supportRole = role === "UTILITY" || role === "SUPPORT";
  const goldDelta = player.goldEarned - opponent.goldEarned;
  const csDelta = player.totalCs - opponent.totalCs;
  const visionDelta = player.visionScore - opponent.visionScore;
  const damageDelta = nullableDelta(player.totalDamageDealtToChampions, opponent.totalDamageDealtToChampions) ?? 0;
  const wardsPlacedDelta = nullableDelta(player.wardsPlaced, opponent.wardsPlaced) ?? 0;
  const wardsKilledDelta = nullableDelta(player.wardsKilled, opponent.wardsKilled) ?? 0;
  const kdaDelta = (player.kills + player.assists) / Math.max(player.deaths, 1) -
    (opponent.kills + opponent.assists) / Math.max(opponent.deaths, 1);

  if (supportRole) {
    const delta = clampDelta(
      Math.round(visionDelta / 8) +
        Math.round(kdaDelta * 2) +
        Math.round((wardsPlacedDelta + wardsKilledDelta * 2) / 5),
      -6,
      6,
    );

    console.info("[RiftLab scoring v0.1] rival role direct value adjustment:", {
      supportRole,
      csPenaltySkipped: true,
      visionDelta,
      wardsPlacedDelta,
      wardsKilledDelta,
      kdaDelta,
      finalAdjustment: delta,
    });

    return delta;
  }

  const delta = clampDelta(
    Math.round(goldDelta / 600) +
      Math.round(csDelta / 20) +
      Math.round(kdaDelta * 2) +
      Math.round(damageDelta / 3000),
    -8,
    8,
  );

  console.info("[RiftLab scoring v0.1] rival role direct value adjustment:", {
    supportRole,
    csPenaltySkipped: false,
    goldDelta,
    csDelta,
    damageDelta,
    kdaDelta,
    finalAdjustment: delta,
  });

  return delta;
}

function normalizeRoleForComparison(role: string): string {
  const normalized = role.toUpperCase();

  if (normalized === "MID") return "MIDDLE";
  if (normalized === "ADC") return "BOTTOM";
  if (normalized === "SUPPORT") return "UTILITY";
  return normalized;
}

function clampDelta(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nullableDelta(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

function scoreCs(csPerMinute: number, position: string): number {
  if (isSupportRole(position)) return 0;
  if (csPerMinute >= 7) return 10;
  if (csPerMinute >= 6) return 5;
  if (csPerMinute < 4) return -10;
  return 0;
}

function scoreGold(goldPerMinute: number, position: string): number {
  if (isSupportRole(position)) return 0;
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
