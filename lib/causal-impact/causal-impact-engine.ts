import { formatLaneForUser, formatStructureForUser } from "@/lib/formatters/riot-display";
import type { BuildingEvent, ChampionKillEvent, RiotMatchSummary, TimelineDiagnostics } from "@/lib/reports";

export type ImpactChainType =
  | "death_to_enemy_objective"
  | "death_to_allied_objective"
  | "death_to_structure_loss"
  | "death_to_enemy_structure_trade"
  | "post_objective_tempo_loss"
  | "kill_to_objective_conversion"
  | "teamfight_to_map_gain"
  | "objective_to_structure_conversion"
  | "unknown";

export type ValueDirection = "generated" | "lost" | "neutral" | "trade" | "unknown";
export type ChainClassification = "positive" | "negative" | "neutral" | "trade" | "unknown";
export type ChainConfidence = "low" | "low/medium" | "medium" | "high";
export type EvidenceSource = "riot_api" | "vod_future" | "manual_future";
export type LaneRelevance = "high" | "medium" | "low" | "unknown";
export type GamePhase = "early" | "mid" | "late";
type TeamSide = "Blue" | "Red" | "Unknown";

export type ValueDelta = {
  label: string;
  scoreImpact: number;
  description: string;
};

export type VodEvidencePlaceholder = {
  waveState?: string;
  visionState?: string;
  rotationContext?: string;
  positioningContext?: string;
  teamSpacing?: string;
  zoneControl?: string;
  fightContext?: string;
  confidence?: ChainConfidence;
};

export type ImpactChainStep = {
  label: string;
  timestamp?: string;
  timeRange?: string;
  eventType: string;
  teamId?: number;
  teamSide?: TeamSide;
  confidence: ChainConfidence;
  description: string;
};

export type ImpactChain = {
  id: string;
  title: string;
  chainType: ImpactChainType;
  startTime: string;
  endTime: string;
  cause: ImpactChainStep;
  window: ImpactChainStep;
  consequence: ImpactChainStep;
  mapImpact: ImpactChainStep;
  valueDelta: ValueDelta;
  affectedMetrics: string[];
  apiEvidence: ImpactChainStep[];
  vodEvidence?: VodEvidencePlaceholder;
  evidenceConfidence: ChainConfidence;
  causalConfidence: ChainConfidence;
  classification: ChainClassification;
  valueDirection: ValueDirection;
  severity: "Low" | "Medium" | "High";
  laneRelevance?: LaneRelevance;
  importanceScore?: number;
  supportingChainIds?: string[];
  supportingEvidence?: string[];
  userFacingSummary: string;
};

export type GroupedObjectiveWindowForCausalImpact = {
  startTimestamp: string;
  endTimestamp: string;
  objectiveType: string;
  eventCount: number;
  killerTeam: TeamSide;
  label: string;
};

type GenerateCausalImpactChainsInput = {
  summary: RiotMatchSummary;
  diagnostics: TimelineDiagnostics;
  objectiveWindows: GroupedObjectiveWindowForCausalImpact[];
};

type ImpactChainDraft = Omit<ImpactChain, "apiEvidence" | "evidenceConfidence" | "vodEvidence"> & {
  evidenceConfidence?: ChainConfidence;
  vodEvidence?: VodEvidencePlaceholder;
};

export function generateCausalImpactChains({
  summary,
  diagnostics,
  objectiveWindows,
}: GenerateCausalImpactChainsInput): ImpactChain[] {
  const rawChains = [
    ...detectDeathToEnemyObjectiveChains(summary, diagnostics, objectiveWindows),
    ...detectDeathToAlliedObjectiveChains(summary, diagnostics, objectiveWindows),
    ...detectDeathToStructureLossChains(summary, diagnostics),
    ...detectPostObjectiveTempoLossChains(summary, diagnostics, objectiveWindows),
    ...detectKillToObjectiveConversionChains(summary, diagnostics, objectiveWindows),
    ...detectTeamfightToMapGainChains(summary, diagnostics, objectiveWindows),
    ...detectObjectiveToStructureConversionChains(summary, diagnostics, objectiveWindows),
  ].sort((a, b) => parseTimestamp(a.startTime) - parseTimestamp(b.startTime));
  const { chains, droppedChainIds, mergedChainIds } = prioritizeCausalImpactChains(rawChains);

  logCausalImpactChains(rawChains, chains, summary, droppedChainIds, mergedChainIds);

  return chains;
}

export function calculateChainImportance(chain: ImpactChain): number {
  const severityScore = chain.severity === "High" ? 35 : chain.severity === "Medium" ? 22 : 8;
  const valueScore = Math.min(Math.abs(chain.valueDelta.scoreImpact) * 2, 30);
  const classificationScore =
    chain.classification === "negative" || chain.classification === "positive"
      ? 14
      : chain.classification === "trade"
        ? 6
        : 2;
  const directionScore =
    chain.valueDirection === "lost" || chain.valueDirection === "generated"
      ? 10
      : chain.valueDirection === "trade"
        ? 5
        : 1;
  const evidenceScore = getConfidenceScore(chain.evidenceConfidence);
  const causalScore = getConfidenceScore(chain.causalConfidence);
  const laneScore =
    chain.laneRelevance === "high"
      ? 8
      : chain.laneRelevance === "medium"
        ? 3
        : chain.laneRelevance === "low"
          ? -12
          : chain.laneRelevance === "unknown"
            ? -8
            : 0;
  const objectiveScore = getObjectiveImportance(chain);
  const structureScore = getStructureImportance(chain);
  const lowConfidencePenalty = chain.causalConfidence === "low" ? -15 : chain.causalConfidence === "low/medium" ? -5 : 0;
  const neutralPenalty = chain.classification === "neutral" ? -10 : 0;
  const tempoPenalty = chain.chainType === "post_objective_tempo_loss" ? -14 : 0;

  return Math.round(
    severityScore +
      valueScore +
      classificationScore +
      directionScore +
      evidenceScore +
      causalScore +
      laneScore +
      objectiveScore +
      structureScore +
      lowConfidencePenalty +
      neutralPenalty +
      tempoPenalty,
  );
}

export function getChainPriorityLabel(importanceScore: number): "High" | "Medium" | "Low" {
  if (importanceScore >= 85) return "High";
  if (importanceScore >= 60) return "Medium";
  return "Low";
}

export function getUserFacingChainTypeLabel(chain: ImpactChain): string {
  if (chain.chainType === "teamfight_to_map_gain") {
    return chain.classification === "negative"
      ? "Enemy kill sequence \u2192 map loss"
      : "Allied kill sequence \u2192 map gain";
  }

  if (chain.chainType === "death_to_enemy_objective") return "Death timing \u2192 objective risk";
  if (chain.chainType === "death_to_allied_objective") return "Death timing \u2192 allied objective secured";
  if (chain.chainType === "death_to_structure_loss") return "Death timing \u2192 structure loss";
  if (chain.chainType === "death_to_enemy_structure_trade") return "Death timing \u2192 map trade";
  if (chain.chainType === "post_objective_tempo_loss") return "Post-objective timing \u2192 tempo risk";
  if (chain.chainType === "kill_to_objective_conversion") return "Kill participation \u2192 map gain";
  if (chain.chainType === "objective_to_structure_conversion") return "Objective \u2192 structure outcome";

  return "Unknown timing chain";
}

function prioritizeCausalImpactChains(rawChains: ImpactChain[]): {
  chains: ImpactChain[];
  droppedChainIds: string[];
  mergedChainIds: string[];
} {
  const { chains: groupedTeamfightChains, mergedChainIds } = groupTeamfightMapGainChains(rawChains);
  const { chains: withoutCoveredTempo, droppedChainIds: tempoDroppedIds } =
    dropCoveredPostObjectiveTempoChains(groupedTeamfightChains);
  const { chains: dedupedChains, droppedChainIds: duplicateDroppedIds } =
    dedupeChainsByPrimaryTarget(withoutCoveredTempo);
  const chains = dedupedChains
    .map((chain) => ({
      ...chain,
      importanceScore: calculateChainImportance(chain),
    }))
    .sort(
      (a, b) =>
        (b.importanceScore ?? 0) - (a.importanceScore ?? 0) ||
        parseTimestamp(a.startTime) - parseTimestamp(b.startTime),
    );

  return {
    chains,
    droppedChainIds: [...tempoDroppedIds, ...duplicateDroppedIds],
    mergedChainIds,
  };
}

function groupTeamfightMapGainChains(rawChains: ImpactChain[]): {
  chains: ImpactChain[];
  mergedChainIds: string[];
} {
  const teamfightChains = rawChains
    .filter((chain) => chain.chainType === "teamfight_to_map_gain")
    .sort((a, b) => parseTimestamp(a.startTime) - parseTimestamp(b.startTime));
  const otherChains = rawChains.filter((chain) => chain.chainType !== "teamfight_to_map_gain");
  const groupedChains: ImpactChain[] = [];
  const mergedChainIds: string[] = [];
  const usedIds = new Set<string>();

  for (const seed of teamfightChains) {
    if (usedIds.has(seed.id)) continue;

    const seedStart = parseTimestamp(seed.startTime);
    const group = teamfightChains.filter((candidate) => {
      if (usedIds.has(candidate.id)) return false;

      return (
        candidate.classification === seed.classification &&
        candidate.valueDirection === seed.valueDirection &&
        candidate.cause.teamSide === seed.cause.teamSide &&
        Math.abs(parseTimestamp(candidate.startTime) - seedStart) <= 90
      );
    });

    for (const chain of group) {
      usedIds.add(chain.id);
    }

    if (group.length === 1) {
      groupedChains.push(seed);
      continue;
    }

    const startTime = group.reduce((earliest, chain) =>
      parseTimestamp(chain.startTime) < parseTimestamp(earliest) ? chain.startTime : earliest,
    seed.startTime);
    const endTime = group.reduce((latest, chain) =>
      parseTimestamp(chain.endTime) > parseTimestamp(latest) ? chain.endTime : latest,
    seed.endTime);
    const outcomes = uniqueValues(group.map((chain) => chain.consequence.description.replace(/\.$/, "")));
    const outcomeLabel = describeGroupedMapOutcome(outcomes);
    const teamLabel = seed.cause.teamSide === "Unknown" ? "A team" : seed.cause.teamSide;
    const mergedIds = group.map((chain) => chain.id);
    mergedChainIds.push(...mergedIds);

    groupedChains.push({
      ...seed,
      id: chainId("grouped-teamfight-map", startTime, endTime, outcomeLabel),
      title:
        seed.classification === "positive"
          ? `Allied kill sequence was followed by ${outcomeLabel}.`
          : `Enemy kill sequence was followed by ${outcomeLabel}.`,
      startTime,
      endTime,
      cause: {
        ...seed.cause,
        timeRange: getTimeRange(startTime, group.reduce((latest, chain) =>
          parseTimestamp(chain.cause.timeRange?.split("\u2013").at(-1) ?? chain.startTime) > parseTimestamp(latest)
            ? chain.cause.timeRange?.split("\u2013").at(-1) ?? chain.startTime
            : latest,
        startTime)),
        description: `${teamLabel} won multiple kill clusters between ${startTime} and ${endTime}.`,
      },
      window: {
        ...seed.window,
        timeRange: getTimeRange(startTime, endTime),
        description: `${outcomeLabel} followed the grouped kill sequence.`,
      },
      consequence: {
        ...seed.consequence,
        timestamp: endTime,
        description: outcomes.join("; ") + ".",
      },
      mapImpact: {
        ...seed.mapImpact,
        timestamp: endTime,
        description: `RiftLab groups these repeated kill-to-map sequences into one timing-based ${seed.classification === "positive" ? "map gain" : "possible map loss"} chain.`,
      },
      valueDelta: {
        ...seed.valueDelta,
        scoreImpact: Math.max(-12, Math.min(12, group.reduce((sum, chain) => sum + chain.valueDelta.scoreImpact, 0))),
      },
      supportingChainIds: mergedIds.filter((id) => id !== seed.id),
      supportingEvidence: outcomes,
      userFacingSummary: `${teamLabel} won multiple kill clusters between ${startTime} and ${endTime}, then ${outcomeLabel} followed. Riot API confirms the timing and map outcome. RiftLab treats this as a medium-confidence ${seed.classification === "positive" ? "map gain" : "possible map loss"} chain; VOD context is needed to confirm wave state, vision control, positioning, and intent.`,
    });
  }

  return {
    chains: [...otherChains, ...groupedChains],
    mergedChainIds,
  };
}

function dropCoveredPostObjectiveTempoChains(chains: ImpactChain[]): {
  chains: ImpactChain[];
  droppedChainIds: string[];
} {
  const droppedChainIds: string[] = [];
  const keptChains = chains.filter((chain) => {
    if (chain.chainType !== "post_objective_tempo_loss") return true;

    const chainStart = parseTimestamp(chain.startTime);
    const chainEnd = parseTimestamp(chain.endTime);
    const strongerCoveringChain = chains.find((candidate) => {
      if (candidate.id === chain.id || candidate.chainType === "post_objective_tempo_loss") return false;
      if (candidate.classification !== "negative" && candidate.classification !== "positive") return false;

      const candidateStart = parseTimestamp(candidate.startTime);
      const candidateEnd = parseTimestamp(candidate.endTime);

      return (
        Math.abs(candidateEnd - chainStart) <= 90 ||
        (candidateStart <= chainEnd && candidateEnd >= chainStart)
      );
    });

    if (strongerCoveringChain && calculateChainImportance(chain) < calculateChainImportance(strongerCoveringChain)) {
      droppedChainIds.push(chain.id);
      return false;
    }

    return true;
  });

  return { chains: keptChains, droppedChainIds };
}

function dedupeChainsByPrimaryTarget(chains: ImpactChain[]): {
  chains: ImpactChain[];
  droppedChainIds: string[];
} {
  const bestByTarget = new Map<string, ImpactChain>();
  const supportingByTarget = new Map<string, ImpactChain[]>();
  const passthrough: ImpactChain[] = [];
  const droppedChainIds: string[] = [];

  for (const chain of chains) {
    const key = getPrimaryTargetKey(chain);

    if (!key) {
      passthrough.push(chain);
      continue;
    }

    const current = bestByTarget.get(key);

    if (!current || calculateChainImportance(chain) > calculateChainImportance(current)) {
      if (current) {
        supportingByTarget.set(key, [...(supportingByTarget.get(key) ?? []), current]);
        droppedChainIds.push(current.id);
      }

      bestByTarget.set(key, chain);
    } else {
      supportingByTarget.set(key, [...(supportingByTarget.get(key) ?? []), chain]);
      droppedChainIds.push(chain.id);
    }
  }

  const deduped = [...bestByTarget.entries()].map(([key, chain]) => {
    const supporting = supportingByTarget.get(key) ?? [];

    if (supporting.length === 0) return chain;

    return {
      ...chain,
      supportingChainIds: [...(chain.supportingChainIds ?? []), ...supporting.map((support) => support.id)],
      supportingEvidence: [
        ...(chain.supportingEvidence ?? []),
        ...supporting.map((support) => `${support.title}: ${support.userFacingSummary}`),
      ],
    };
  });

  return {
    chains: [...passthrough, ...deduped],
    droppedChainIds,
  };
}

function getPrimaryTargetKey(chain: ImpactChain): string | null {
  if (
    chain.chainType === "death_to_enemy_objective" ||
    chain.chainType === "death_to_allied_objective" ||
    chain.chainType === "post_objective_tempo_loss" ||
    chain.chainType === "kill_to_objective_conversion"
  ) {
    if (chain.consequence.eventType === "ELITE_MONSTER_KILL") {
      return `objective:${chain.consequence.teamSide ?? "Unknown"}:${chain.consequence.timestamp ?? chain.endTime}:${chain.consequence.description}`;
    }
  }

  if (
    chain.chainType === "death_to_structure_loss" ||
    chain.chainType === "death_to_enemy_structure_trade" ||
    chain.chainType === "objective_to_structure_conversion"
  ) {
    if (chain.consequence.eventType === "BUILDING_KILL") {
      return `structure:${chain.consequence.teamSide ?? "Unknown"}:${chain.consequence.timestamp ?? chain.endTime}:${chain.consequence.description}`;
    }
  }

  return null;
}

function getConfidenceScore(confidence: ChainConfidence): number {
  if (confidence === "high") return 12;
  if (confidence === "medium") return 8;
  if (confidence === "low/medium") return 3;
  return -4;
}

function getObjectiveImportance(chain: ImpactChain): number {
  const text = `${chain.title} ${chain.consequence.description}`.toUpperCase();

  if (text.includes("BARON") || text.includes("ELDER")) return 12;
  if (text.includes("DRAGON")) return 9;
  if (text.includes("RIFT HERALD")) return 7;
  if (text.includes("VOIDGRUB") || text.includes("HORDE")) return 6;
  return 0;
}

function getStructureImportance(chain: ImpactChain): number {
  const text = `${chain.title} ${chain.consequence.description}`.toUpperCase();

  if (text.includes("NEXUS")) return 12;
  if (text.includes("INHIBITOR") || text.includes("BASE")) return 9;
  if (text.includes("INNER")) return 6;
  if (text.includes("OUTER")) return 4;
  return 0;
}

function describeGroupedMapOutcome(outcomes: string[]): string {
  const joined = outcomes.join(" and ");
  const upper = joined.toUpperCase();

  if (upper.includes("DRAGON") && upper.includes("BOT")) return "Dragon and bot-side map gains";
  if (upper.includes("DRAGON")) return "Dragon control";
  if (upper.includes("BARON")) return "Baron control";
  if (upper.includes("VOIDGRUB") || upper.includes("HORDE")) return "Voidgrubs control";
  if (upper.includes("TOWER") || upper.includes("TURRET")) return "structure map gain";
  return "map outcome";
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function detectDeathToEnemyObjectiveChains(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindowForCausalImpact[],
): ImpactChain[] {
  return diagnostics.playerDeaths.flatMap((death) => {
    const deathSeconds = parseTimestamp(death.timestamp);

    return objectiveWindows
      .filter((window) => window.killerTeam !== "Unknown" && window.killerTeam !== summary.teamSide)
      .map((window) => {
        const secondsBeforeObjective = parseTimestamp(window.startTimestamp) - deathSeconds;

        if (secondsBeforeObjective <= 0 || secondsBeforeObjective > 90) return null;

        return createImpactChain({
          id: chainId("death-enemy-objective", death.timestamp, window.startTimestamp, window.objectiveType),
          title: `Death before enemy ${window.objectiveType} preceded objective loss.`,
          chainType: "death_to_enemy_objective",
          startTime: death.timestamp,
          endTime: window.endTimestamp,
          classification: "negative",
          valueDirection: "lost",
          severity: secondsBeforeObjective <= 45 ? "High" : "Medium",
          causalConfidence: "medium",
          valueDelta: {
            label: "Value Lost: High",
            scoreImpact: -15,
            description: "Enemy-secured objective window after player death.",
          },
          affectedMetrics: ["Value Lost", "Objective Contribution", "Pressure Value"],
          cause: step("Player death", death.timestamp, "CHAMPION_KILL", summary.teamSide, "Player death confirmed by Riot timeline."),
          window: step(
            "Objective window",
            undefined,
            "ELITE_MONSTER_KILL",
            window.killerTeam,
            `${window.label}; player death preceded the window by ${secondsBeforeObjective}s.`,
            getTimeRange(window.startTimestamp, window.endTimestamp),
          ),
          consequence: step("Enemy objective secured", window.endTimestamp, "ELITE_MONSTER_KILL", window.killerTeam, `${window.objectiveType} was secured by the enemy team.`),
          mapImpact: step("Objective presence reduced", window.endTimestamp, "TIMING_WINDOW", summary.teamSide, "RiftLab marks this as a timing-based objective risk."),
          userFacingSummary: `Your death at ${death.timestamp} preceded an enemy ${window.objectiveType} window at ${window.startTimestamp} by ${secondsBeforeObjective} seconds. Riot API confirms the timing and objective outcome. RiftLab marks this as a timing-based objective risk window; VOD context is needed to confirm wave state, vision, positioning, and decision intent.`,
        });
      })
      .filter((chain): chain is ImpactChain => chain !== null);
  });
}

function detectDeathToAlliedObjectiveChains(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindowForCausalImpact[],
): ImpactChain[] {
  return diagnostics.playerDeaths.flatMap((death) => {
    const deathSeconds = parseTimestamp(death.timestamp);

    return objectiveWindows
      .filter((window) => window.killerTeam === summary.teamSide)
      .map((window) => {
        const secondsBeforeObjective = parseTimestamp(window.startTimestamp) - deathSeconds;

        if (secondsBeforeObjective <= 0 || secondsBeforeObjective > 90) return null;

        return createImpactChain({
          id: chainId("death-allied-objective", death.timestamp, window.startTimestamp, window.objectiveType),
          title: `Allied ${window.objectiveType} secured despite player death.`,
          chainType: "death_to_allied_objective",
          startTime: death.timestamp,
          endTime: window.endTimestamp,
          classification: "neutral",
          valueDirection: "neutral",
          severity: "Low",
          causalConfidence: "low/medium",
          valueDelta: {
            label: "Small tempo cost",
            scoreImpact: -3,
            description: "Allied objective was secured, so this is not counted as objective loss.",
          },
          affectedMetrics: ["Value Lost", "Objective Contribution"],
          cause: step("Player death", death.timestamp, "CHAMPION_KILL", summary.teamSide, "Player death confirmed by Riot timeline."),
          window: step("Allied objective window", undefined, "ELITE_MONSTER_KILL", window.killerTeam, `${window.label}; allied team secured the objective.`, getTimeRange(window.startTimestamp, window.endTimestamp)),
          consequence: step("Allied objective secured", window.endTimestamp, "ELITE_MONSTER_KILL", window.killerTeam, `${window.objectiveType} was secured by your team.`),
          mapImpact: step("Objective loss avoided", window.endTimestamp, "TIMING_WINDOW", summary.teamSide, "RiftLab does not count this as objective loss from API timing alone."),
          userFacingSummary: `Your death at ${death.timestamp} preceded a ${window.objectiveType} secured by your own team at ${window.startTimestamp}. Riot API confirms the event sequence and objective outcome. This is not counted as objective loss, but may represent a small tempo cost until VOD context is available.`,
        });
      })
      .filter((chain): chain is ImpactChain => chain !== null);
  });
}

function detectDeathToStructureLossChains(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
): ImpactChain[] {
  return diagnostics.playerDeaths.flatMap((death) => {
    const deathSeconds = parseTimestamp(death.timestamp);

    return diagnostics.buildingEvents
      .map((building) => {
        const buildingSeconds = parseTimestamp(building.timestamp);
        const secondsAfterDeath = buildingSeconds - deathSeconds;

        if (secondsAfterDeath <= 0 || secondsAfterDeath > 75) return null;

        const isAlliedStructure = building.teamAffected === summary.teamSide;
        const structureName = getStructureName(building);

        if (!isAlliedStructure) {
          return createImpactChain({
            id: chainId("death-enemy-structure-trade", death.timestamp, building.timestamp, structureName),
            title: `Death was followed by enemy ${structureName} map trade.`,
            chainType: "death_to_enemy_structure_trade",
            startTime: death.timestamp,
            endTime: building.timestamp,
            classification: "trade",
            valueDirection: "trade",
            severity: "Low",
            causalConfidence: "low/medium",
            valueDelta: {
              label: "Potential map trade",
              scoreImpact: 4,
              description: "Enemy structure fell after death, so this is not treated as negative structure loss.",
            },
            affectedMetrics: ["Pressure Value", "Conversion Value"],
            cause: step("Player death", death.timestamp, "CHAMPION_KILL", summary.teamSide, "Player death confirmed by Riot timeline."),
            window: step("Structure timing window", undefined, "BUILDING_KILL", building.teamAffected, `Enemy ${structureName} fell ${secondsAfterDeath}s after death.`, getTimeRange(death.timestamp, building.timestamp)),
            consequence: step("Enemy structure fell", building.timestamp, "BUILDING_KILL", building.teamAffected, "The affected structure belonged to the enemy team."),
            mapImpact: step("Possible map trade", building.timestamp, "STRUCTURE_TRADE", summary.teamSide, "RiftLab treats this as a trade association from API timing."),
            userFacingSummary: `Your death at ${death.timestamp} was followed by an enemy ${structureName} falling ${secondsAfterDeath} seconds later. RiftLab does not count this as negative structure loss from API timing alone.`,
          });
        }

        const laneRelevance = getLaneRelevanceForStructureLoss(
          summary.position,
          building.laneType,
          building.towerType ?? building.buildingType,
          buildingSeconds,
        );
        const causalConfidence = getCausalConfidenceForLaneRelevance(laneRelevance);
        const originalSeverity = secondsAfterDeath <= 40 ? "High" : "Medium";
        const severity = getStructureLossSeverityForLaneRelevance(laneRelevance, originalSeverity);
        const scoreImpact = -getStructureLossCost(laneRelevance);
        const phase = getGamePhase(buildingSeconds);

        console.info("[RiftLab causal v0.1] structure lane relevance decision:", {
          structureLane: building.laneType,
          playerRole: summary.position,
          gamePhase: phase,
          laneRelevance,
          originalSeverity,
          adjustedSeverity: severity,
          finalScoreDelta: scoreImpact,
        });

        return createImpactChain({
          id: chainId("death-structure-loss", death.timestamp, building.timestamp, structureName),
          title: `${laneRelevance === "high" ? "High" : laneRelevance === "medium" ? "Medium" : "Low"}-relevance death preceded allied ${structureName} loss.`,
          chainType: "death_to_structure_loss",
          startTime: death.timestamp,
          endTime: building.timestamp,
          classification: laneRelevance === "low" || laneRelevance === "unknown" ? "neutral" : "negative",
          valueDirection: laneRelevance === "low" || laneRelevance === "unknown" ? "neutral" : "lost",
          severity,
          causalConfidence,
          laneRelevance,
          valueDelta: {
            label: laneRelevance === "high" ? "Structure-loss cost: Full" : "Structure-loss cost: Reduced",
            scoreImpact,
            description: "Structure-loss cost is weighted by role, lane, structure type, and game phase.",
          },
          affectedMetrics: ["Value Lost", "Pressure Value"],
          cause: step("Player death", death.timestamp, "CHAMPION_KILL", summary.teamSide, "Player death confirmed by Riot timeline."),
          window: step("Structure timing window", undefined, "BUILDING_KILL", building.teamAffected, `Allied ${structureName} fell ${secondsAfterDeath}s after death.`, getTimeRange(death.timestamp, building.timestamp)),
          consequence: step("Allied structure fell", building.timestamp, "BUILDING_KILL", building.teamAffected, `Your team lost ${structureName}.`),
          mapImpact: step("Structure outcome changed", building.timestamp, "STRUCTURE_LOSS", summary.teamSide, "API confirms timing and structure loss; map setup requires future VOD context."),
          userFacingSummary:
            laneRelevance === "low"
              ? `Your death was followed by an allied ${structureName} falling, but because you were playing ${normalizePlayerRole(summary.position)} and this was ${getPhaseArticle(phase)} ${phase} ${formatLaneForUser(building.laneType) || "unknown lane"} structure, RiftLab applies low causal confidence and only a small structure-loss cost.`
              : `Your death at ${death.timestamp} was followed by your team's ${structureName} falling ${secondsAfterDeath} seconds later. Riot API confirms the timing and structure outcome. RiftLab treats this as a ${causalConfidence}-confidence structure-loss association; VOD context is needed to confirm wave state, lane assignment, positioning, and intent.`,
        });
      })
      .filter((chain): chain is ImpactChain => chain !== null);
  });
}

function detectPostObjectiveTempoLossChains(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindowForCausalImpact[],
): ImpactChain[] {
  return objectiveWindows.flatMap((window) => {
    const objectiveEndSeconds = parseTimestamp(window.endTimestamp);

    return diagnostics.playerDeaths
      .map((death) => {
        const deathSeconds = parseTimestamp(death.timestamp);
        const secondsAfterObjective = deathSeconds - objectiveEndSeconds;

        if (secondsAfterObjective <= 0 || secondsAfterObjective > 45) return null;

        const alliedObjective = window.killerTeam === summary.teamSide;

        return createImpactChain({
          id: chainId("post-objective-tempo-loss", window.endTimestamp, death.timestamp, window.objectiveType),
          title: alliedObjective
            ? `Death after allied ${window.objectiveType} created possible tempo loss.`
            : `Death after enemy ${window.objectiveType} suggests possible failed contest or cleanup.`,
          chainType: "post_objective_tempo_loss",
          startTime: window.startTimestamp,
          endTime: death.timestamp,
          classification: "negative",
          valueDirection: "lost",
          severity: alliedObjective ? "Medium" : "Low",
          causalConfidence: "low/medium",
          valueDelta: {
            label: alliedObjective ? "Tempo cost: Medium" : "Tempo cost: Small",
            scoreImpact: alliedObjective ? -6 : -4,
            description: "Post-objective death is treated as tempo risk from API timing.",
          },
          affectedMetrics: ["Value Lost", "Conversion Value"],
          cause: step("Objective secured", window.endTimestamp, "ELITE_MONSTER_KILL", window.killerTeam, `${window.objectiveType} was secured.`),
          window: step("Post-objective window", undefined, "TIMING_WINDOW", summary.teamSide, `Player death followed ${secondsAfterObjective}s after the objective window.`, getTimeRange(window.endTimestamp, death.timestamp)),
          consequence: step("Player death", death.timestamp, "CHAMPION_KILL", summary.teamSide, "Player death confirmed by Riot timeline."),
          mapImpact: step("Possible tempo loss", death.timestamp, "TEMPO_LOSS", summary.teamSide, "VOD is needed to know if the death was avoidable or part of a favorable trade."),
          userFacingSummary: `${window.objectiveType} was secured at ${window.endTimestamp} and your death followed ${secondsAfterObjective} seconds later. Riot API confirms the event sequence. RiftLab marks this as a possible post-objective tempo loss, but VOD context is needed to confirm wave, vision, positioning, and whether the death was part of a favorable trade.`,
        });
      })
      .filter((chain): chain is ImpactChain => chain !== null);
  });
}

function detectKillToObjectiveConversionChains(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindowForCausalImpact[],
): ImpactChain[] {
  const playerKillParticipations = diagnostics.championKillEvents.filter((event) =>
    isPlayerKillParticipation(event, diagnostics.participantId),
  );

  return playerKillParticipations.flatMap((killEvent) => {
    const killSeconds = parseTimestamp(killEvent.timestamp);
    const objectiveChains = objectiveWindows
      .filter((window) => window.killerTeam === summary.teamSide)
      .map((window) => {
        const secondsAfterKill = parseTimestamp(window.startTimestamp) - killSeconds;

        if (secondsAfterKill <= 0 || secondsAfterKill > 90) return null;

        return createConversionChain(summary, killEvent, window.startTimestamp, window.endTimestamp, window.objectiveType, "ELITE_MONSTER_KILL", window.killerTeam, "Objective Contribution");
      });
    const structureChains = diagnostics.buildingEvents
      .filter((building) => building.teamAffected !== summary.teamSide)
      .map((building) => {
        const secondsAfterKill = parseTimestamp(building.timestamp) - killSeconds;

        if (secondsAfterKill <= 0 || secondsAfterKill > 90) return null;

        return createConversionChain(summary, killEvent, building.timestamp, building.timestamp, getStructureName(building), "BUILDING_KILL", summary.teamSide, "Pressure Value");
      });

    return [...objectiveChains, ...structureChains].filter((chain): chain is ImpactChain => chain !== null);
  });
}

function detectTeamfightToMapGainChains(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindowForCausalImpact[],
): ImpactChain[] {
  const clusters = buildTeamfightClusters(diagnostics.championKillEvents);

  return clusters
    .map((cluster) => {
      const clusterEndSeconds = parseTimestamp(cluster.endTime);
      const playerTeamWon = cluster.teamSide === summary.teamSide;
      const objective = objectiveWindows.find((window) => {
        const secondsAfterCluster = parseTimestamp(window.startTimestamp) - clusterEndSeconds;
        return secondsAfterCluster > 0 && secondsAfterCluster <= 120 && (playerTeamWon ? window.killerTeam === summary.teamSide : window.killerTeam !== summary.teamSide);
      });
      const structure = diagnostics.buildingEvents.find((building) => {
        const secondsAfterCluster = parseTimestamp(building.timestamp) - clusterEndSeconds;
        return secondsAfterCluster > 0 && secondsAfterCluster <= 120 && (playerTeamWon ? building.teamAffected !== summary.teamSide : building.teamAffected === summary.teamSide);
      });
      const gainTime = objective?.startTimestamp ?? structure?.timestamp;

      if (!gainTime) return null;

      const mapGainLabel = objective?.objectiveType ?? (structure ? getStructureName(structure) : "map gain");

      return createImpactChain({
          id: chainId("teamfight-map-gain", cluster.startTime, gainTime, mapGainLabel),
          title: playerTeamWon
          ? `Allied kill cluster was followed by ${mapGainLabel}.`
          : `Enemy kill cluster was followed by ${mapGainLabel}.`,
        chainType: "teamfight_to_map_gain",
        startTime: cluster.startTime,
        endTime: gainTime,
        classification: playerTeamWon ? "positive" : "negative",
        valueDirection: playerTeamWon ? "generated" : "lost",
        severity: "Medium",
        causalConfidence: "medium",
        valueDelta: {
          label: playerTeamWon ? "Map gain: Medium" : "Map loss: Medium",
          scoreImpact: playerTeamWon ? 8 : -8,
          description: "Teamfight cluster was followed by objective or structure movement.",
        },
        affectedMetrics: playerTeamWon
          ? ["Teamfight Conversion", "Conversion Value", "Pressure Value"]
          : ["Teamfight Conversion", "Pressure Value", "Value Lost"],
        cause: step("Teamfight cluster", undefined, "CHAMPION_KILL_CLUSTER", cluster.teamSide, `${cluster.killCount} kills by ${cluster.teamSide} within 30 seconds.`, getTimeRange(cluster.startTime, cluster.endTime)),
        window: step("Map-gain window", undefined, "TIMING_WINDOW", cluster.teamSide, `Map gain followed within 120 seconds.`, getTimeRange(cluster.endTime, gainTime)),
        consequence: step("Map event", gainTime, objective ? "ELITE_MONSTER_KILL" : "BUILDING_KILL", cluster.teamSide, `${mapGainLabel} followed the kill cluster.`),
        mapImpact: step("Map state changed", gainTime, "MAP_GAIN", cluster.teamSide, "RiftLab attributes possible map value from API timing."),
        userFacingSummary: `${cluster.teamSide} won a kill cluster between ${cluster.startTime} and ${cluster.endTime}, then ${mapGainLabel} followed within 120 seconds. Riot API confirms the timing and map outcome. RiftLab treats this as a medium-confidence map ${playerTeamWon ? "gain" : "loss"} chain; VOD context is needed to confirm wave state, vision control, positioning, and intent.`,
      });
    })
    .filter((chain): chain is ImpactChain => chain !== null);
}

function detectObjectiveToStructureConversionChains(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindowForCausalImpact[],
): ImpactChain[] {
  return objectiveWindows
    .filter((window) => window.objectiveType === "Rift Herald")
    .map((window) => {
      const objectiveSeconds = parseTimestamp(window.endTimestamp);
      const structure = diagnostics.buildingEvents.find((building) => {
        const secondsAfterObjective = parseTimestamp(building.timestamp) - objectiveSeconds;
        return (
          secondsAfterObjective > 0 &&
          secondsAfterObjective <= 240 &&
          (window.killerTeam === summary.teamSide
            ? building.teamAffected !== summary.teamSide
            : building.teamAffected === summary.teamSide)
        );
      });

      if (!structure) return null;

      const playerTeamObjective = window.killerTeam === summary.teamSide;
      const structureName = getStructureName(structure);

      return createImpactChain({
        id: chainId("objective-structure-conversion", window.endTimestamp, structure.timestamp, structureName),
        title: playerTeamObjective ? `Rift Herald was followed by structure map gain.` : `Enemy Rift Herald was followed by allied structure loss.`,
        chainType: "objective_to_structure_conversion",
        startTime: window.startTimestamp,
        endTime: structure.timestamp,
        classification: playerTeamObjective ? "positive" : "negative",
        valueDirection: playerTeamObjective ? "generated" : "lost",
        severity: "Medium",
        causalConfidence: "medium",
        valueDelta: {
          label: playerTeamObjective ? "Objective conversion: Medium" : "Objective loss conversion: Medium",
          scoreImpact: playerTeamObjective ? 8 : -8,
          description: "Rift Herald was followed by tower movement within four minutes.",
        },
        affectedMetrics: ["Objective Contribution", "Pressure Value", "Conversion Value"],
        cause: step("Rift Herald secured", window.endTimestamp, "ELITE_MONSTER_KILL", window.killerTeam, `${window.label}.`),
        window: step("Herald conversion window", undefined, "TIMING_WINDOW", window.killerTeam, `${structureName} fell within four minutes.`, getTimeRange(window.endTimestamp, structure.timestamp)),
        consequence: step("Structure fell", structure.timestamp, "BUILDING_KILL", structure.teamAffected, `${structureName} fell.`),
        mapImpact: step("Objective became structure outcome", structure.timestamp, "OBJECTIVE_CONVERSION", window.killerTeam, "RiftLab marks this as objective-to-structure conversion from API timing."),
        userFacingSummary: `${window.label} was followed by ${structureName} falling at ${structure.timestamp}. RiftLab marks this as objective-to-structure conversion from Riot API timing.`,
      });
    })
    .filter((chain): chain is ImpactChain => chain !== null);
}

function createConversionChain(
  summary: RiotMatchSummary,
  killEvent: ChampionKillEvent,
  endTime: string,
  eventEndTime: string,
  convertedValue: string,
  conversionEventType: string,
  teamSide: TeamSide,
  metric: string,
): ImpactChain {
  return createImpactChain({
    id: chainId("kill-conversion", killEvent.timestamp, endTime, convertedValue),
    title: `Kill participation converted into ${convertedValue} value.`,
    chainType: "kill_to_objective_conversion",
    startTime: killEvent.timestamp,
    endTime: eventEndTime,
    classification: "positive",
    valueDirection: "generated",
    severity: "Medium",
    causalConfidence: "medium",
    valueDelta: {
      label: "Conversion value: Medium",
      scoreImpact: 8,
      description: "Kill participation was followed by objective or structure value.",
    },
    affectedMetrics: ["Conversion Value", metric, "Direct Value"],
    cause: step("Kill participation", killEvent.timestamp, "CHAMPION_KILL", summary.teamSide, "Your kill or assist participation is confirmed by Riot timeline."),
    window: step("Conversion window", undefined, "TIMING_WINDOW", summary.teamSide, `${convertedValue} followed within 90 seconds.`, getTimeRange(killEvent.timestamp, endTime)),
    consequence: step("Map value secured", eventEndTime, conversionEventType, teamSide, `${convertedValue} was secured after the kill participation.`),
    mapImpact: step("Measurable conversion value", eventEndTime, "CONVERSION", summary.teamSide, "RiftLab marks this as measurable conversion value from Riot API timing."),
    userFacingSummary: `Your participation in a kill at ${killEvent.timestamp} was followed by your team securing ${convertedValue} within 90 seconds. RiftLab marks this as measurable conversion value from Riot API timing.`,
  });
}

function createImpactChain(chain: ImpactChainDraft): ImpactChain {
  return {
    ...chain,
    apiEvidence: [chain.cause, chain.window, chain.consequence, chain.mapImpact],
    evidenceConfidence: chain.evidenceConfidence ?? "high",
    vodEvidence: chain.vodEvidence ?? {},
  };
}

function step(
  label: string,
  timestamp: string | undefined,
  eventType: string,
  teamSide: TeamSide,
  description: string,
  timeRange?: string,
): ImpactChainStep {
  return {
    label,
    timestamp,
    timeRange,
    eventType,
    teamSide,
    confidence: "high",
    description,
  };
}

type TeamfightCluster = {
  teamSide: TeamSide;
  startTime: string;
  endTime: string;
  killCount: number;
};

function buildTeamfightClusters(killEvents: ChampionKillEvent[]): TeamfightCluster[] {
  const events = [...killEvents]
    .filter((event) => event.killerTeam !== "Unknown")
    .sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  const clusters: TeamfightCluster[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const seed = events[index];
    const seedSeconds = parseTimestamp(seed.timestamp);
    const clusterEvents = events.filter((event) => {
      const secondsAfterSeed = parseTimestamp(event.timestamp) - seedSeconds;
      return event.killerTeam === seed.killerTeam && secondsAfterSeed >= 0 && secondsAfterSeed <= 30;
    });

    if (clusterEvents.length < 2) continue;

    const startTime = clusterEvents[0].timestamp;
    const endTime = clusterEvents.at(-1)?.timestamp ?? startTime;

    if (clusters.some((cluster) => cluster.teamSide === seed.killerTeam && cluster.startTime === startTime && cluster.endTime === endTime)) {
      continue;
    }

    clusters.push({
      teamSide: seed.killerTeam,
      startTime,
      endTime,
      killCount: clusterEvents.length,
    });
  }

  return clusters;
}

function isPlayerKillParticipation(event: ChampionKillEvent, participantId: number): boolean {
  return event.killerParticipantId === participantId || event.assistingParticipantIds.includes(participantId);
}

function getStructureName(building: BuildingEvent): string {
  return formatStructureForUser(building.laneType, building.towerType ?? building.buildingType);
}

export function getLaneRelevanceForStructureLoss(
  playerRole: string,
  structureLane: string | null,
  towerType: string | null,
  gameTimeSeconds: number,
): LaneRelevance {
  const role = normalizePlayerRole(playerRole);
  const lane = structureLane ?? "UNKNOWN";
  const phase = getGamePhase(gameTimeSeconds);
  const isBaseStructure = isInhibitorOrBaseStructure(towerType);

  if (lane === "UNKNOWN") {
    return isBaseStructure && phase === "late" ? "medium" : "unknown";
  }

  if (isBaseStructure && phase === "late") {
    return role === "JUNGLE" ? "medium" : "high";
  }

  if (role === "MIDDLE") {
    if (lane === "MID_LANE") return "high";
    if ((lane === "BOT_LANE" || lane === "TOP_LANE") && phase === "early") return "low";
    if ((lane === "BOT_LANE" || lane === "TOP_LANE") && phase === "mid") return "medium";
    return phase === "late" ? "medium" : "low";
  }

  if (role === "TOP") {
    if (lane === "TOP_LANE") return "high";
    if (lane === "MID_LANE" && phase !== "early") return "medium";
    if (lane === "BOT_LANE" && phase === "early") return "low";
    return phase === "late" ? "medium" : "low";
  }

  if (role === "BOTTOM") {
    if (lane === "BOT_LANE" && phase === "early") return "high";
    if (lane === "MID_LANE" && phase === "mid") return "high";
    if (lane === "MID_LANE" && phase === "late") return "medium";
    if (lane === "TOP_LANE" && phase === "early") return "low";
    return phase === "late" ? "medium" : "low";
  }

  if (role === "UTILITY") {
    if (lane === "BOT_LANE" && phase === "early") return "high";
    if (lane === "MID_LANE" && phase !== "early") return "high";
    if (phase === "late") return "medium";
    return "low";
  }

  if (role === "JUNGLE") {
    if (isBaseStructure && phase === "late") return "medium";
    return phase === "early" ? "low" : "medium";
  }

  return "unknown";
}

export function getGamePhase(gameTimeSeconds: number): GamePhase {
  if (gameTimeSeconds < 14 * 60) return "early";
  if (gameTimeSeconds < 25 * 60) return "mid";
  return "late";
}

export function getStructureLossCost(laneRelevance: LaneRelevance): number {
  if (laneRelevance === "high") return 12;
  if (laneRelevance === "medium") return 7;
  if (laneRelevance === "low") return 3;
  return 4;
}

export function getCausalConfidenceForLaneRelevance(laneRelevance: LaneRelevance): ChainConfidence {
  if (laneRelevance === "high") return "medium";
  if (laneRelevance === "medium") return "low/medium";
  return "low";
}

export function getStructureLossSeverityForLaneRelevance(
  laneRelevance: LaneRelevance,
  originalSeverity: "Low" | "Medium" | "High",
): "Low" | "Medium" | "High" {
  if (laneRelevance === "high") return originalSeverity;
  if (laneRelevance === "medium") return "Medium";
  return "Low";
}

export function buildStructureLossRelevanceExplanation(
  playerRole: string,
  structureLane: string | null,
  towerType: string | null,
  gamePhase: GamePhase,
  laneRelevance: LaneRelevance,
): string {
  const role = normalizePlayerRole(playerRole);
  const lane = formatLaneForUser(structureLane) || "unknown lane";
  const structure = formatStructureForUser(null, towerType);

  if (laneRelevance === "low") {
    return `Because you were playing ${role} and this was ${getPhaseArticle(gamePhase)} ${gamePhase} ${lane} ${structure}, RiftLab applies low causal confidence and only a small structure-loss cost.`;
  }

  if (laneRelevance === "high") {
    return `This is a high relevance structure-loss window for ${role} in ${gamePhase} game, so RiftLab applies the full structure-loss cost with medium causal confidence.`;
  }

  if (laneRelevance === "medium") {
    return `This is a medium relevance structure-loss window for ${role} in ${gamePhase} game, so RiftLab applies a reduced structure-loss cost.`;
  }

  return "RiftLab could not determine lane relevance from Riot API fields alone, so it applies low causal confidence and only a small structure-loss cost.";
}

function normalizePlayerRole(playerRole: string): string {
  const role = playerRole.toUpperCase();

  if (role === "ADC") return "BOTTOM";
  if (role === "SUPPORT") return "UTILITY";
  if (role === "MID") return "MIDDLE";

  return role;
}

function isInhibitorOrBaseStructure(towerType: string | null): boolean {
  if (!towerType) return false;

  return towerType.includes("INHIBITOR") || towerType.includes("BASE") || towerType.includes("NEXUS");
}

function getPhaseArticle(gamePhase: GamePhase): "a" | "an" {
  return gamePhase === "early" ? "an" : "a";
}

function getTimeRange(startTime: string, endTime: string): string {
  return startTime === endTime ? startTime : `${startTime}\u2013${endTime}`;
}

function chainId(prefix: string, startTime: string, endTime: string, label: string): string {
  return `${prefix}-${startTime}-${endTime}-${label}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseTimestamp(timestamp: string): number {
  const [minutes, seconds] = timestamp.split(":").map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}

function logCausalImpactChains(
  rawChains: ImpactChain[],
  chains: ImpactChain[],
  summary: RiotMatchSummary,
  droppedChainIds: string[],
  mergedChainIds: string[],
): void {
  const countsByType = chains.reduce<Record<string, number>>((counts, chain) => {
    counts[chain.chainType] = (counts[chain.chainType] ?? 0) + 1;
    return counts;
  }, {});
  const countsByClassification = chains.reduce<Record<string, number>>((counts, chain) => {
    counts[chain.classification] = (counts[chain.classification] ?? 0) + 1;
    return counts;
  }, {});
  const scoreDeltas = chains.reduce<Record<string, number>>((totals, chain) => {
    for (const metric of chain.affectedMetrics) {
      totals[metric] = (totals[metric] ?? 0) + chain.valueDelta.scoreImpact;
    }
    return totals;
  }, {});

  console.info("[RiftLab causal v0.1] raw chain count:", rawChains.length);
  console.info("[RiftLab causal v0.1] deduplicated chain count:", chains.length);
  console.info("[RiftLab causal v0.1] visible top chain count:", Math.min(5, chains.length));
  console.info("[RiftLab causal v0.1] grouped/merged chain ids:", mergedChainIds.join(", ") || "none");
  console.info("[RiftLab causal v0.1] dropped low-priority chain ids:", droppedChainIds.join(", ") || "none");
  console.info(
    "[RiftLab causal v0.1] importance scores:",
    chains.map((chain) => `${chain.id}: ${chain.importanceScore ?? calculateChainImportance(chain)}`).join(" | ") || "none",
  );
  console.info(
    "[RiftLab causal v0.1] user-facing chain labels:",
    chains
      .map((chain, index) => {
        const importance = chain.importanceScore ?? calculateChainImportance(chain);
        const displayState = index < 5 ? "top-level" : "supporting/lower-priority";
        return `${chain.id}: hiddenImportance=${importance}, priority=${getChainPriorityLabel(importance)}, label=${getUserFacingChainTypeLabel(chain)}, display=${displayState}`;
      })
      .join(" | ") || "none",
  );
  console.info(
    "[RiftLab causal v0.1] supporting evidence chain ids:",
    chains
      .filter((chain) => chain.supportingChainIds && chain.supportingChainIds.length > 0)
      .map((chain) => `${chain.id}: ${(chain.supportingChainIds ?? []).join(", ")}`)
      .join(" | ") || "none",
  );
  console.info(
    "[RiftLab causal v0.1] final top chains:",
    chains.slice(0, 5).map((chain, index) => `${index + 1}. ${chain.id}: ${chain.title}`).join(" | ") || "none",
  );
  console.info("[RiftLab causal v0.1] chains by type:", countsByType);
  console.info("[RiftLab causal v0.1] chain ids/titles:", chains.map((chain) => `${chain.id}: ${chain.title}`).join(" | ") || "none");
  console.info("[RiftLab causal v0.1] classification counts:", countsByClassification);
  console.info("[RiftLab causal v0.1] score deltas by metric:", scoreDeltas);
  console.info(
    "[RiftLab causal v0.1] objective team comparisons:",
    chains
      .filter((chain) => chain.chainType.includes("objective"))
      .map((chain) => `${chain.id}: player=${summary.teamSide}, related=${chain.consequence.teamSide ?? "Unknown"}`)
      .join(" | ") || "none",
  );
  console.info(
    "[RiftLab causal v0.1] structure team comparisons:",
    chains
      .filter((chain) => chain.chainType.includes("structure"))
      .map((chain) => `${chain.id}: player=${summary.teamSide}, affected=${chain.consequence.teamSide ?? "Unknown"}`)
      .join(" | ") || "none",
  );
  console.info(
    "[RiftLab causal v0.1] lane relevance decisions:",
    chains
      .filter((chain) => chain.laneRelevance)
      .map((chain) => `${chain.id}: ${chain.laneRelevance}, causal=${chain.causalConfidence}`)
      .join(" | ") || "none",
  );
}
