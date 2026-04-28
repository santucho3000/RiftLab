import type { ImpactChain } from "@/lib/causal-impact/causal-impact-engine";
import {
  formatObjectiveTypeForUser,
  formatParticipantIdForUser,
  formatRoleForUser,
  formatStructureForUser,
} from "@/lib/formatters/riot-display";
import type { RiotMatchSummary, RiotReportParticipant, TimelineDiagnostics } from "@/lib/reports";
import type { GroupedObjectiveWindow, RealScoringSignals } from "@/lib/scoring/real-scoring";

type TeamSide = "Blue" | "Red" | "Unknown";
type Confidence = "low" | "low/medium" | "medium" | "high";

export type RivalRoleDeltaCheckpoint = {
  minute: number;
  totalGoldDelta: number;
  totalCsDelta: number;
  levelDelta: number;
  currentGoldDelta: number;
  xpDelta: number | null;
};

export type RivalRoleParticipantSummary = {
  participantId: number;
  label: string;
  championName: string;
  role: string;
  teamSide: TeamSide;
};

export type RivalRoleDelta = {
  opponentAvailable: boolean;
  player: RivalRoleParticipantSummary | null;
  opponent: RivalRoleParticipantSummary | null;
  opponentLabel: string;
  roleLabel: string;
  finalResult: "Ahead" | "Even" | "Behind" | "Mixed" | "Unavailable";
  profileSummary: string;
  classificationReason: string;
  evidenceConfidence: "high";
  causalConfidence: "low/medium";
  supportCsPenaltySkipped: boolean;
  timelineAvailable: boolean;
  explanation: string;
  finalDeltas: {
    kills: number;
    deaths: number;
    assists: number;
    kdaRatio: number | null;
    goldEarned: number;
    totalCs: number;
    csPerMinute: number;
    visionScore: number;
    damageToChampions: number | null;
    damageToObjectives: number | null;
    damageToTurrets: number | null;
    totalDamageTaken: number | null;
    wardsPlaced: number | null;
    wardsKilled: number | null;
    killParticipation: number | null;
  };
  checkpoints: RivalRoleDeltaCheckpoint[];
};

export type DeathCostProfile = {
  totalDeaths: number;
  highCostDeaths: number;
  neutralOrTradeDeaths: number;
  lowConfidenceDeaths: number;
  categories: Array<{ label: string; count: number }>;
  strongestDeathChainTitle: string;
  recommendation: string;
};

export type ObjectiveConversion = {
  objectivesByTeam: Array<{ teamSide: TeamSide; objective: string; count: number }>;
  conversionSignals: Array<{
    title: string;
    teamSide: TeamSide;
    outcome: "positive" | "negative" | "neutral";
    confidence: Confidence;
    summary: string;
  }>;
  bestConversion: string;
  worstConversion: string;
  explanation: string;
};

export type PowerSpikeTiming = {
  itemEvents: Array<{ timestamp: string; participantLabel: string; itemId: number | null; rawItemId: number | null }>;
  purchaseWindows: Array<{ title: string; confidence: Confidence; summary: string }>;
  explanation: string;
};

export type TeamfightProfileEntry = {
  startTime: string;
  endTime: string;
  blueKills: number;
  redKills: number;
  winningSide: TeamSide;
  playerParticipated: boolean;
  playerDied: boolean;
  playerDeathTiming: "first" | "early" | "late" | "none";
  conversionResult: string;
  confidence: Confidence;
  summary: string;
};

export type TeamfightProfile = {
  keyFights: TeamfightProfileEntry[];
  alliedConversions: number;
  enemyConversions: number;
  explanation: string;
};

export type MapImpactSummary = {
  mainMapGain: string;
  mainMapLoss: string;
  mainObjectiveSwing: string;
  mainStructureSwing: string;
  mainPositiveChain: string;
  mainNegativeChain: string;
  mainNeutralOrTradeChain: string;
};

export type RiftLabVerdict = {
  title:
    | "High Impact Win"
    | "High Conversion Game"
    | "Low Impact Game"
    | "High Value Lost Game"
    | "Stable Economy, Low Map Impact"
    | "Team Conversion Loss"
    | "Objective Risk Game"
    | "Mixed Impact Game";
  explanation: string;
  strongestPositiveEvidence: string;
  strongestNegativeEvidence: string;
  mainImprovementPriority: string;
};

export type DeepAnalysis = {
  rivalRoleDelta: RivalRoleDelta;
  deathCostProfile: DeathCostProfile;
  objectiveConversion: ObjectiveConversion;
  powerSpikeTiming: PowerSpikeTiming;
  teamfightProfile: TeamfightProfile;
  mapImpactSummary: MapImpactSummary;
  verdict: RiftLabVerdict;
};

export function generateDeepAnalysis(input: {
  summary: RiotMatchSummary;
  diagnostics: TimelineDiagnostics;
  signals: RealScoringSignals;
  impactChains: ImpactChain[];
  mainImprovementPriority: string;
}): DeepAnalysis {
  const rivalRoleDelta = buildRivalRoleDelta(input.summary, input.diagnostics);
  const teamfightProfile = buildTeamfightProfile(input.summary, input.diagnostics);
  const deathCostProfile = buildDeathCostProfile(input.summary, input.signals, input.impactChains, teamfightProfile);
  const objectiveConversion = buildObjectiveConversion(input.summary, input.diagnostics, input.signals.objectiveWindows, input.impactChains);
  const powerSpikeTiming = buildPowerSpikeTiming(input.summary, input.diagnostics, input.signals.objectiveWindows);
  const mapImpactSummary = buildMapImpactSummary(input.summary, input.signals, input.impactChains, objectiveConversion);
  const verdict = buildRiftLabVerdict(input.summary, input.signals, input.impactChains, rivalRoleDelta, mapImpactSummary, input.mainImprovementPriority);

  console.info("[RiftLab deep analysis v0.1] rival role opponent:", {
    found: rivalRoleDelta.opponentAvailable,
    opponent: rivalRoleDelta.opponentLabel,
  });
  console.info("[RiftLab deep analysis v0.1] death cost profile counts:", deathCostProfile);
  console.info("[RiftLab deep analysis v0.1] objective conversion signals:", objectiveConversion.conversionSignals);
  console.info("[RiftLab deep analysis v0.1] item timing events:", powerSpikeTiming.itemEvents.length);
  console.info("[RiftLab deep analysis v0.1] teamfight clusters:", teamfightProfile.keyFights.length);
  console.info("[RiftLab deep analysis v0.1] generated verdict:", verdict);

  return {
    rivalRoleDelta,
    deathCostProfile,
    objectiveConversion,
    powerSpikeTiming,
    teamfightProfile,
    mapImpactSummary,
    verdict,
  };
}

export function findDirectRoleOpponent(
  playerParticipant: RiotReportParticipant,
  allParticipants: RiotReportParticipant[],
): RiotReportParticipant | null {
  const playerRole = normalizeRole(playerParticipant.teamPosition || playerParticipant.individualPosition);
  if (!playerRole) return null;

  return (
    allParticipants.find(
      (participant) =>
        participant.teamId !== playerParticipant.teamId &&
        normalizeRole(participant.teamPosition || participant.individualPosition) === playerRole,
    ) ?? null
  );
}

function buildRivalRoleDelta(summary: RiotMatchSummary, diagnostics: TimelineDiagnostics): RivalRoleDelta {
  const player = summary.participants.find((participant) => participant.participantId === summary.playerParticipantId);
  const opponent = player ? findDirectRoleOpponent(player, summary.participants) : null;
  const playerLabel = formatParticipantIdForUser(summary.playerParticipantId, summary.participants);

  if (!player || !opponent) {
    const roleLabel = formatRoleForUser(summary.position);
    console.info("[RiftLab rival role delta v0.1] direct role opponent unavailable:", {
      searchedParticipantId: player?.participantId ?? summary.playerParticipantId,
      searchedRole: summary.position,
      searchedChampion: player?.championName ?? summary.championName,
      timelineDataAvailable: diagnostics.participantFrameSnapshots.length > 0,
    });

    return {
      opponentAvailable: false,
      player: player ? buildRivalParticipantSummary(player, summary.participants) : null,
      opponent: null,
      opponentLabel: "Direct role opponent not available.",
      roleLabel,
      finalResult: "Unavailable",
      profileSummary: "Direct role opponent not available.",
      classificationReason: "No exact role opponent was found from Riot role fields.",
      evidenceConfidence: "high",
      causalConfidence: "low/medium",
      supportCsPenaltySkipped: isSupportRole(summary.position),
      timelineAvailable: diagnostics.participantFrameSnapshots.length > 0,
      explanation: "Direct role opponent not available.",
      finalDeltas: emptyFinalDeltas(),
      checkpoints: [],
    };
  }

  const checkpoints = [5, 10, 15, 20, 25, 30].flatMap((minute) => {
    const playerFrame = findParticipantFrame(diagnostics, player.participantId, minute);
    const opponentFrame = findParticipantFrame(diagnostics, opponent.participantId, minute);

    if (!playerFrame || !opponentFrame) return [];

    return [{
      minute,
      totalGoldDelta: playerFrame.totalGold - opponentFrame.totalGold,
      totalCsDelta: totalCsFromFrame(playerFrame) - totalCsFromFrame(opponentFrame),
      levelDelta: playerFrame.level - opponentFrame.level,
      currentGoldDelta: playerFrame.currentGold - opponentFrame.currentGold,
      xpDelta: playerFrame.xp === null || opponentFrame.xp === null ? null : playerFrame.xp - opponentFrame.xp,
    }];
  });
  const supportRole = isSupportRole(summary.position);
  const focusCheckpoint = checkpoints.find((checkpoint) => checkpoint.minute === 15) ?? checkpoints.at(-1);
  const opponentLabel = formatParticipantIdForUser(opponent.participantId, summary.participants);
  const roleLabel = formatRoleForUser(player.teamPosition || player.individualPosition || summary.position);
  const finalDeltas = {
    kills: player.kills - opponent.kills,
    deaths: player.deaths - opponent.deaths,
    assists: player.assists - opponent.assists,
    kdaRatio: safeKda(player) === null || safeKda(opponent) === null ? null : roundTwo((safeKda(player) ?? 0) - (safeKda(opponent) ?? 0)),
    goldEarned: player.goldEarned - opponent.goldEarned,
    totalCs: player.totalCs - opponent.totalCs,
    csPerMinute: roundOne(player.csPerMinute - opponent.csPerMinute),
    visionScore: player.visionScore - opponent.visionScore,
    damageToChampions: nullableDelta(player.totalDamageDealtToChampions, opponent.totalDamageDealtToChampions),
    damageToObjectives: nullableDelta(player.damageDealtToObjectives, opponent.damageDealtToObjectives),
    damageToTurrets: nullableDelta(player.damageDealtToTurrets, opponent.damageDealtToTurrets),
    totalDamageTaken: nullableDelta(player.totalDamageTaken, opponent.totalDamageTaken),
    wardsPlaced: nullableDelta(player.wardsPlaced, opponent.wardsPlaced),
    wardsKilled: nullableDelta(player.wardsKilled, opponent.wardsKilled),
    killParticipation: nullableDelta(player.killParticipation, opponent.killParticipation),
  };
  const roleKey = normalizeRole(player.teamPosition || player.individualPosition || summary.position) ?? "UNKNOWN";
  const interpretationProfile = buildRivalRoleInterpretationProfile(
    playerLabel,
    opponentLabel,
    roleKey,
    finalDeltas,
    checkpoints,
    supportRole,
  );
  const finalResult = interpretationProfile.finalResult;
  const csText = supportRole
    ? "For supports, RiftLab emphasizes assists, deaths, kill participation, vision score, and wards over CS. CS is displayed as neutral data and is not used as negative evidence."
    : focusCheckpoint
      ? `At ${focusCheckpoint.minute} minutes, role delta was ${signed(focusCheckpoint.totalGoldDelta)} gold, ${signed(focusCheckpoint.totalCsDelta)} CS, and ${signed(focusCheckpoint.levelDelta)} level.`
      : "Checkpoint role deltas were not available from timeline frames.";

  console.info("[RiftLab rival role delta v0.1] searched player:", {
    participantId: player.participantId,
    role: player.teamPosition || player.individualPosition || summary.position,
    champion: player.championName,
    teamSide: player.teamSide,
  });
  console.info("[RiftLab rival role delta v0.1] direct role opponent:", {
    participantId: opponent.participantId,
    role: opponent.teamPosition || opponent.individualPosition,
    champion: opponent.championName,
    teamSide: opponent.teamSide,
  });
  console.info("[RiftLab rival role delta v0.1] final stat deltas:", finalDeltas);
  console.info("[RiftLab rival role delta v0.1] checkpoint deltas:", checkpoints);
  console.info("[RiftLab rival role delta v0.1] early checkpoint profile:", interpretationProfile.earlyCheckpointProfile);
  console.info("[RiftLab rival role delta v0.1] final economy profile:", interpretationProfile.finalEconomyProfile);
  console.info("[RiftLab rival role delta v0.1] fight involvement profile:", interpretationProfile.fightInvolvementProfile);
  console.info("[RiftLab rival role delta v0.1] map conversion profile:", interpretationProfile.mapConversionProfile);
  console.info("[RiftLab rival role delta v0.1] final classification reason:", interpretationProfile.classificationReason);
  console.info("[RiftLab rival role delta v0.1] timeline data available:", checkpoints.length > 0);
  console.info("[RiftLab rival role delta v0.1] support CS penalty skipped:", supportRole);

  return {
    opponentAvailable: true,
    player: buildRivalParticipantSummary(player, summary.participants),
    opponent: buildRivalParticipantSummary(opponent, summary.participants),
    opponentLabel,
    roleLabel,
    finalResult,
    profileSummary: interpretationProfile.profileSummary,
    classificationReason: interpretationProfile.classificationReason,
    evidenceConfidence: "high",
    causalConfidence: "low/medium",
    supportCsPenaltySkipped: supportRole,
    timelineAvailable: checkpoints.length > 0,
    explanation: `${interpretationProfile.explanation} ${csText} Riot API confirms the stat difference, but VOD context is needed to evaluate wave state, matchup, pressure, rotations, and decision quality.`,
    finalDeltas,
    checkpoints,
  };
}

function buildDeathCostProfile(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
  impactChains: ImpactChain[],
  teamfightProfile: TeamfightProfile,
): DeathCostProfile {
  const categoryCounts = new Map<string, number>();
  const add = (label: string, count = 1) => categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + count);

  add("death_before_enemy_objective", signals.deathBeforeObjective.filter((signal) => signal.killerTeam !== summary.teamSide).length);
  add("death_before_allied_objective", signals.deathBeforeObjective.filter((signal) => signal.killerTeam === summary.teamSide).length);
  add("death_after_objective", signals.deathAfterObjective.length);
  add("death_followed_by_allied_structure_loss", signals.structureLossAfterDeath.length);
  add("death_followed_by_enemy_structure_loss_trade", impactChains.filter((chain) => chain.chainType === "death_to_enemy_structure_trade").length);
  add("death_in_teamfight_cluster", teamfightProfile.keyFights.filter((fight) => fight.playerDied).length);
  add("repeated_death_window", countRepeatedDeathWindows(signals));

  if (summary.position === "JUNGLE") {
    add("jungler_death_before_objective", signals.deathBeforeObjective.filter((signal) => signal.killerTeam !== summary.teamSide).length);
  }

  if (summary.position === "MIDDLE" || summary.position === "BOTTOM") {
    add("carry_death_before_major_objective", signals.deathBeforeObjective.filter((signal) => isMajorObjective(signal.objectiveType)).length);
  }

  const highCostDeaths = Math.min(
    summary.deaths,
    signals.deathBeforeObjective.filter((signal) => signal.killerTeam !== summary.teamSide).length +
      signals.structureLossAfterDeath.filter((signal) => signal.severity === "High").length +
      teamfightProfile.keyFights.filter((fight) => fight.playerDied && fight.winningSide !== summary.teamSide).length,
  );
  const neutralOrTradeDeaths = impactChains.filter(
    (chain) => chain.chainType.includes("death") && (chain.classification === "neutral" || chain.classification === "trade"),
  ).length;
  const lowConfidenceDeaths = impactChains.filter(
    (chain) => chain.chainType.includes("death") && chain.causalConfidence === "low",
  ).length;
  const strongestDeathChain = impactChains.find((chain) => chain.chainType.includes("death"));

  if (summary.deaths > 0 && categoryCounts.size === 0) {
    add("isolated_death", summary.deaths);
  } else if (summary.deaths > 0) {
    const categorizedDeaths = [...categoryCounts.values()].reduce((total, count) => total + count, 0);
    add("isolated_death", Math.max(summary.deaths - categorizedDeaths, 0));
  }

  return {
    totalDeaths: summary.deaths,
    highCostDeaths,
    neutralOrTradeDeaths,
    lowConfidenceDeaths,
    categories: [...categoryCounts.entries()].filter(([, count]) => count > 0).map(([label, count]) => ({ label, count })),
    strongestDeathChainTitle: strongestDeathChain?.title ?? "No strong death-related chain detected.",
    recommendation:
      highCostDeaths > 0
        ? `${highCostDeaths} high-cost death(s) were associated with objective, structure, or fight-conversion windows. API confirms timing; VOD context is needed to evaluate positioning, wave state, and intent.`
        : "Deaths were not strongly tied to objective or structure losses in this preliminary API-only pass.",
  };
}

function buildObjectiveConversion(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindow[],
  impactChains: ImpactChain[],
): ObjectiveConversion {
  const objectivesByTeam = buildObjectiveCounts(objectiveWindows);
  const conversionSignals = objectiveWindows.flatMap((window) => {
    const windowEnd = parseTimestamp(window.endTimestamp);
    const structures = diagnostics.buildingEvents.filter((building) => {
      const secondsAfter = parseTimestamp(building.timestamp) - windowEnd;
      if (secondsAfter <= 0) return false;
      if (window.objectiveType.includes("Rift Herald")) return secondsAfter <= 240;
      if (window.objectiveType.includes("Baron")) return secondsAfter <= 180;
      if (window.objectiveType.includes("Voidgrubs")) return secondsAfter <= 240;
      return false;
    });

    return structures.map((structure) => {
      const playerTeamConversion = window.killerTeam === summary.teamSide && structure.teamAffected !== summary.teamSide;
      const enemyConversion = window.killerTeam !== summary.teamSide && structure.teamAffected === summary.teamSide;
      const formattedStructure = formatStructureForUser(structure.laneType, structure.towerType ?? structure.buildingType);

      return {
        title: `${window.objectiveType} was followed by ${formattedStructure}`,
        teamSide: window.killerTeam,
        outcome: (playerTeamConversion ? "positive" : enemyConversion ? "negative" : "neutral") as "positive" | "negative" | "neutral",
        confidence: (window.objectiveType.includes("Voidgrubs") ? "low/medium" : "medium") as Confidence,
        summary: `${window.objectiveType} secured by ${window.killerTeam} was followed by ${formattedStructure}. API confirms timing and outcome; VOD context is needed to confirm wave, vision, and setup.`,
      };
    });
  });
  const bestConversionChain = impactChains.find(
    (chain) => chain.classification === "positive" && chain.affectedMetrics.includes("Conversion Value"),
  );
  const worstConversionChain = impactChains.find(
    (chain) => chain.classification === "negative" && chain.affectedMetrics.includes("Conversion Value"),
  );

  return {
    objectivesByTeam,
    conversionSignals,
    bestConversion: bestConversionChain?.title ?? conversionSignals.find((signal) => signal.outcome === "positive")?.title ?? "No strong positive objective conversion detected.",
    worstConversion: worstConversionChain?.title ?? conversionSignals.find((signal) => signal.outcome === "negative")?.title ?? "No strong negative objective conversion detected.",
    explanation: "Objective Conversion v0.2 measures whether Riot API objective windows were followed by structures or additional map outcomes. It does not infer pressure, wave state, or vision control without future VOD context.",
  };
}

function buildPowerSpikeTiming(
  summary: RiotMatchSummary,
  diagnostics: TimelineDiagnostics,
  objectiveWindows: GroupedObjectiveWindow[],
): PowerSpikeTiming {
  const playerItemEvents = diagnostics.itemEvents
    .filter((event) => event.participantId === summary.playerParticipantId && event.eventType === "ITEM_PURCHASED")
    .map((event) => ({
      timestamp: event.timestamp,
      participantLabel: formatParticipantIdForUser(event.participantId, summary.participants),
      itemId: event.itemId,
      rawItemId: event.rawItemId,
    }));
  const purchaseWindows = objectiveWindows.flatMap((window) => {
    const windowStart = parseTimestamp(window.startTimestamp);
    const windowEnd = parseTimestamp(window.endTimestamp);
    const nearbyPurchases = playerItemEvents.filter((event) => {
      const eventSeconds = parseTimestamp(event.timestamp);
      return Math.abs(eventSeconds - windowStart) <= 90 || Math.abs(eventSeconds - windowEnd) <= 90;
    });
    const highGoldFrame = diagnostics.frameSnapshots.find((frame) => {
      const frameSeconds = frame.minute * 60;
      return frameSeconds <= windowStart && windowStart - frameSeconds <= 300 && frame.currentGold >= 1200;
    });

    return [
      ...nearbyPurchases.map((event) => ({
        title: `Purchase near ${window.objectiveType}`,
        confidence: "low/medium" as Confidence,
        summary: `${event.participantLabel} purchased item ID ${event.itemId ?? "unknown"} near ${window.objectiveType}. API shows purchase timing only; VOD is needed to confirm reset quality.`,
      })),
      ...(highGoldFrame
        ? [{
            title: `High current gold before ${window.objectiveType}`,
            confidence: "low" as Confidence,
            summary: `API frame data showed ${highGoldFrame.currentGold} current gold before ${window.objectiveType}. RiftLab marks this as a possible spending-window signal, not a confirmed reset error.`,
          }]
        : []),
    ];
  }).slice(0, 6);

  return {
    itemEvents: playerItemEvents.slice(0, 12),
    purchaseWindows,
    explanation: "Power Spike Timing uses raw item purchase IDs and currentGold frames only. Future Data Dragon and VOD context can add item names, icons, reset paths, and objective setup context.",
  };
}

function buildTeamfightProfile(summary: RiotMatchSummary, diagnostics: TimelineDiagnostics): TeamfightProfile {
  const keyFights = buildMergedKillClusters(diagnostics).map((cluster) => {
    const winner: TeamSide = cluster.blueKills === cluster.redKills ? "Unknown" : cluster.blueKills > cluster.redKills ? "Blue" : "Red";
    const playerEvents = cluster.events.filter(
      (event) =>
        event.killerParticipantId === summary.playerParticipantId ||
        event.victimParticipantId === summary.playerParticipantId ||
        event.assistingParticipantIds.includes(summary.playerParticipantId),
    );
    const playerDeathIndex = cluster.events.findIndex((event) => event.victimParticipantId === summary.playerParticipantId);
    const playerDied = playerDeathIndex >= 0;
    const conversionStructure = diagnostics.buildingEvents.find((building) => {
      const secondsAfter = parseTimestamp(building.timestamp) - parseTimestamp(cluster.endTime);
      return secondsAfter > 0 && secondsAfter <= 120;
    });
    const conversionObjective = diagnostics.eliteMonsterEvents.find((objective) => {
      const secondsAfter = parseTimestamp(objective.timestamp) - parseTimestamp(cluster.endTime);
      return secondsAfter > 0 && secondsAfter <= 120;
    });
    const conversionResult = conversionStructure
      ? `${formatStructureForUser(conversionStructure.laneType, conversionStructure.towerType ?? conversionStructure.buildingType)} followed`
      : conversionObjective
        ? `${formatObjectiveTypeForUser(conversionObjective.monsterType)} followed`
        : "No immediate objective or structure conversion";

    return {
      startTime: cluster.startTime,
      endTime: cluster.endTime,
      blueKills: cluster.blueKills,
      redKills: cluster.redKills,
      winningSide: winner,
      playerParticipated: playerEvents.length > 0,
      playerDied,
      playerDeathTiming: getPlayerDeathTiming(playerDeathIndex, cluster.events.length),
      conversionResult,
      confidence: "medium" as Confidence,
      summary: `${winner} ${winner === "Unknown" ? "split" : "won"} a ${cluster.blueKills}-${cluster.redKills} kill cluster between ${cluster.startTime} and ${cluster.endTime}. ${conversionResult}. API confirms kills and map events; VOD is needed to assess positioning, target focus, and setup.`,
    };
  });

  return {
    keyFights: keyFights.slice(0, 5),
    alliedConversions: keyFights.filter((fight) => fight.winningSide === summary.teamSide && !fight.conversionResult.startsWith("No immediate")).length,
    enemyConversions: keyFights.filter((fight) => fight.winningSide !== summary.teamSide && fight.winningSide !== "Unknown" && !fight.conversionResult.startsWith("No immediate")).length,
    explanation: "Teamfight Profile groups 2+ champion kills within nearby timing windows. It does not infer positioning, target focus, or communication without VOD.",
  };
}

function buildMapImpactSummary(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
  impactChains: ImpactChain[],
  objectiveConversion: ObjectiveConversion,
): MapImpactSummary {
  const positiveChain = impactChains.find((chain) => chain.classification === "positive");
  const negativeChain = impactChains.find((chain) => chain.classification === "negative");
  const neutralChain = impactChains.find((chain) => chain.classification === "neutral" || chain.classification === "trade");
  const structureLoss = signals.structureLossAfterDeath[0];
  const enemyObjective = signals.deathBeforeObjective.find((signal) => signal.killerTeam !== summary.teamSide);

  return {
    mainMapGain: positiveChain?.title ?? objectiveConversion.bestConversion,
    mainMapLoss: negativeChain?.title ?? objectiveConversion.worstConversion,
    mainObjectiveSwing: enemyObjective
      ? `Enemy ${enemyObjective.objectiveWindowLabel} followed a death-before-objective window.`
      : "No major enemy objective swing detected from grouped objective windows.",
    mainStructureSwing: structureLoss
      ? `${formatStructureForUser(structureLoss.lane, structureLoss.towerType ?? structureLoss.buildingType)} fell after a ${structureLoss.laneRelevance}-relevance death window.`
      : "No allied structure-loss window detected after player deaths.",
    mainPositiveChain: positiveChain?.title ?? "No strong positive causal chain detected.",
    mainNegativeChain: negativeChain?.title ?? "No strong negative causal chain detected.",
    mainNeutralOrTradeChain: neutralChain?.title ?? "No major neutral/trade chain detected.",
  };
}

function buildRiftLabVerdict(
  summary: RiotMatchSummary,
  signals: RealScoringSignals,
  impactChains: ImpactChain[],
  rivalRoleDelta: RivalRoleDelta,
  mapImpactSummary: MapImpactSummary,
  mainImprovementPriority: string,
): RiftLabVerdict {
  const positiveChains = impactChains.filter((chain) => chain.classification === "positive");
  const negativeChains = impactChains.filter((chain) => chain.classification === "negative");
  const objectiveRisk = signals.deathBeforeObjective.some((signal) => signal.killerTeam !== summary.teamSide);
  const stableEconomy = signals.goldCsProgression.stableCs && !signals.goldCsProgression.lowGoldPerMinute;
  const title =
    summary.result === "Win" && positiveChains.length >= 2
      ? "High Impact Win"
      : positiveChains.length >= 2
        ? "High Conversion Game"
        : negativeChains.length >= 3
          ? "High Value Lost Game"
          : objectiveRisk
            ? "Objective Risk Game"
            : stableEconomy && positiveChains.length === 0
              ? "Stable Economy, Low Map Impact"
              : negativeChains.some((chain) => chain.chainType === "teamfight_to_map_gain")
                ? "Team Conversion Loss"
                : positiveChains.length === 0 && negativeChains.length === 0
                  ? "Low Impact Game"
                  : "Mixed Impact Game";

  return {
    title,
    explanation: `${title}. ${rivalRoleDelta.explanation} ${mapImpactSummary.mainObjectiveSwing} API confirms timing and outcomes; VOD context is needed to confirm wave, vision, positioning, rotations, and intent.`,
    strongestPositiveEvidence: positiveChains[0]?.title ?? "No strong positive causal chain was detected in this preliminary pass.",
    strongestNegativeEvidence: negativeChains[0]?.title ?? "No strong negative causal chain was detected in this preliminary pass.",
    mainImprovementPriority,
  };
}

function buildObjectiveCounts(objectiveWindows: GroupedObjectiveWindow[]): ObjectiveConversion["objectivesByTeam"] {
  const counts = new Map<string, { teamSide: TeamSide; objective: string; count: number }>();

  for (const window of objectiveWindows) {
    const key = `${window.killerTeam}:${window.objectiveType}`;
    const current = counts.get(key) ?? { teamSide: window.killerTeam, objective: window.objectiveType, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }

  return [...counts.values()];
}

function buildMergedKillClusters(diagnostics: TimelineDiagnostics) {
  const events = [...diagnostics.championKillEvents].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  const clusters: Array<{ startTime: string; endTime: string; blueKills: number; redKills: number; events: typeof events }> = [];
  let current: typeof events = [];

  for (const event of events) {
    const previous = current.at(-1);
    if (!previous || parseTimestamp(event.timestamp) - parseTimestamp(previous.timestamp) <= 30) {
      current.push(event);
    } else {
      if (current.length >= 2) clusters.push(toKillCluster(current));
      current = [event];
    }
  }

  if (current.length >= 2) clusters.push(toKillCluster(current));
  return clusters;
}

function toKillCluster(events: TimelineDiagnostics["championKillEvents"]) {
  return {
    startTime: events[0].timestamp,
    endTime: events.at(-1)?.timestamp ?? events[0].timestamp,
    blueKills: events.filter((event) => event.killerTeam === "Blue").length,
    redKills: events.filter((event) => event.killerTeam === "Red").length,
    events,
  };
}

function findParticipantFrame(diagnostics: TimelineDiagnostics, participantId: number, minute: number) {
  return diagnostics.participantFrameSnapshots.find(
    (snapshot) => snapshot.participantId === participantId && snapshot.minute === minute,
  );
}

function totalCsFromFrame(frame: { minionsKilled: number; jungleMinionsKilled: number }): number {
  return frame.minionsKilled + frame.jungleMinionsKilled;
}

function buildRivalParticipantSummary(
  participant: RiotReportParticipant,
  allParticipants: RiotReportParticipant[],
): RivalRoleParticipantSummary {
  return {
    participantId: participant.participantId,
    label: formatParticipantIdForUser(participant.participantId, allParticipants),
    championName: participant.championName,
    role: formatRoleForUser(participant.teamPosition || participant.individualPosition),
    teamSide: participant.teamSide,
  };
}

type RivalRoleInterpretationProfile = {
  finalResult: RivalRoleDelta["finalResult"];
  profileSummary: string;
  classificationReason: string;
  explanation: string;
  earlyCheckpointProfile: string;
  finalEconomyProfile: string;
  fightInvolvementProfile: string;
  mapConversionProfile: string;
};

function buildRivalRoleInterpretationProfile(
  playerLabel: string,
  opponentLabel: string,
  roleKey: string,
  finalDeltas: RivalRoleDelta["finalDeltas"],
  checkpoints: RivalRoleDeltaCheckpoint[],
  supportRole: boolean,
): RivalRoleInterpretationProfile {
  const finalResult = classifyRivalRoleResult(finalDeltas, checkpoints, supportRole);
  const earlyCheckpoint = checkpoints.find((checkpoint) => checkpoint.minute === 15) ??
    checkpoints.find((checkpoint) => checkpoint.minute === 10) ??
    checkpoints.find((checkpoint) => checkpoint.minute === 20);
  const earlyBehind = Boolean(
    earlyCheckpoint &&
      (earlyCheckpoint.totalGoldDelta <= -500 ||
        earlyCheckpoint.totalCsDelta <= -15 ||
        earlyCheckpoint.levelDelta <= -1),
  );
  const earlyAhead = Boolean(
    earlyCheckpoint &&
      (earlyCheckpoint.totalGoldDelta >= 500 ||
        earlyCheckpoint.totalCsDelta >= 15 ||
        earlyCheckpoint.levelDelta >= 1),
  );
  const finalEconomyAhead = finalDeltas.goldEarned >= 300;
  const finalEconomyBehind = finalDeltas.goldEarned <= -300;
  const mapConversionAhead =
    (finalDeltas.damageToObjectives ?? 0) >= 800 || (finalDeltas.damageToTurrets ?? 0) >= 800;
  const mapConversionBehind =
    (finalDeltas.damageToObjectives ?? 0) <= -800 || (finalDeltas.damageToTurrets ?? 0) <= -800;
  const lowFightInvolvement = (finalDeltas.killParticipation ?? 0) <= -0.12;
  const highFightInvolvement =
    (finalDeltas.killParticipation ?? 0) >= 0.12 ||
    finalDeltas.assists >= 3 ||
    (finalDeltas.damageToChampions ?? 0) >= 2500;
  const earlyCheckpointProfile = earlyCheckpoint
    ? `${earlyCheckpoint.minute}m checkpoint: ${signed(earlyCheckpoint.totalGoldDelta)} gold, ${signed(earlyCheckpoint.totalCsDelta)} CS, ${signed(earlyCheckpoint.levelDelta)} level.`
    : "No 10/15/20 minute checkpoint was available.";
  const finalEconomyProfile = finalEconomyAhead
    ? `Final economy recovered or finished ahead by ${signed(finalDeltas.goldEarned)} gold.`
    : finalEconomyBehind
      ? `Final economy stayed behind by ${signed(finalDeltas.goldEarned)} gold.`
      : `Final economy was close at ${signed(finalDeltas.goldEarned)} gold.`;
  const fightInvolvementProfile = lowFightInvolvement
    ? `Kill participation was lower by ${formatDeltaPercent(finalDeltas.killParticipation)}, suggesting lower fight involvement without claiming poor teamfighting.`
    : highFightInvolvement
      ? `Fight involvement was competitive through KP, assists, or champion damage.`
      : `Fight involvement was close or unavailable from API deltas.`;
  const mapConversionProfile = mapConversionAhead
    ? `Objective/turret damage finished ahead, which RiftLab treats as map conversion or structure pressure rather than lane dominance.`
    : mapConversionBehind
      ? `Objective/turret damage finished behind, suggesting lower map conversion from API data.`
      : `Objective/turret damage was close or unavailable.`;
  const profileSummary = buildProfileSummary({
    finalResult,
    roleKey,
    earlyBehind,
    earlyAhead,
    finalEconomyAhead,
    finalEconomyBehind,
    mapConversionAhead,
    mapConversionBehind,
    lowFightInvolvement,
    highFightInvolvement,
    supportRole,
  });
  const classificationReason = buildClassificationReason({
    finalResult,
    earlyBehind,
    earlyAhead,
    finalEconomyAhead,
    finalEconomyBehind,
    mapConversionAhead,
    mapConversionBehind,
    lowFightInvolvement,
    supportRole,
  });
  const explanation = buildRivalRoleExplanation({
    playerLabel,
    opponentLabel,
    roleKey,
    finalResult,
    profileSummary,
    earlyCheckpoint,
    finalDeltas,
    earlyBehind,
    earlyAhead,
    finalEconomyAhead,
    mapConversionAhead,
    lowFightInvolvement,
    supportRole,
  });

  return {
    finalResult,
    profileSummary,
    classificationReason,
    explanation,
    earlyCheckpointProfile,
    finalEconomyProfile,
    fightInvolvementProfile,
    mapConversionProfile,
  };
}

function classifyRivalRoleResult(
  finalDeltas: RivalRoleDelta["finalDeltas"],
  checkpoints: RivalRoleDeltaCheckpoint[],
  supportRole: boolean,
): RivalRoleDelta["finalResult"] {
  const focusCheckpoint = checkpoints.find((checkpoint) => checkpoint.minute === 15) ?? checkpoints.at(-1);
  const earlyBehind = Boolean(
    focusCheckpoint &&
      (focusCheckpoint.totalGoldDelta <= -500 ||
        focusCheckpoint.totalCsDelta <= -15 ||
        focusCheckpoint.levelDelta <= -1),
  );
  const earlyAhead = Boolean(
    focusCheckpoint &&
      (focusCheckpoint.totalGoldDelta >= 500 ||
        focusCheckpoint.totalCsDelta >= 15 ||
        focusCheckpoint.levelDelta >= 1),
  );
  const finalEconomyAhead = finalDeltas.goldEarned >= 300;
  const finalEconomyBehind = finalDeltas.goldEarned <= -300;
  const mapConversionAhead =
    (finalDeltas.damageToObjectives ?? 0) >= 800 || (finalDeltas.damageToTurrets ?? 0) >= 800;
  const mapConversionBehind =
    (finalDeltas.damageToObjectives ?? 0) <= -800 || (finalDeltas.damageToTurrets ?? 0) <= -800;
  const lowFightInvolvement = (finalDeltas.killParticipation ?? 0) <= -0.12;

  if ((earlyBehind && (finalEconomyAhead || mapConversionAhead)) || (earlyAhead && (finalEconomyBehind || mapConversionBehind))) {
    return "Mixed";
  }

  if (lowFightInvolvement && mapConversionAhead) {
    return "Mixed";
  }

  const economyScore = focusCheckpoint
    ? Math.round(focusCheckpoint.totalGoldDelta / 500) + Math.round(focusCheckpoint.levelDelta)
    : Math.round(finalDeltas.goldEarned / 900);
  const combatScore =
    Math.round((finalDeltas.kdaRatio ?? 0) * 1.5) +
    Math.round((finalDeltas.damageToChampions ?? 0) / 2500);
  const supportScore =
    Math.round(finalDeltas.assists / 3) -
    Math.round(finalDeltas.deaths / 2) +
    Math.round(finalDeltas.visionScore / 8) +
    Math.round((finalDeltas.wardsPlaced ?? 0) / 4) +
    Math.round((finalDeltas.wardsKilled ?? 0) / 2);
  const nonSupportScore =
    economyScore +
    combatScore +
    Math.round(finalDeltas.totalCs / 25) +
    Math.round(finalDeltas.visionScore / 12);
  const score = supportRole ? supportScore : nonSupportScore;
  const signals = [
    finalDeltas.goldEarned,
    finalDeltas.kdaRatio ?? 0,
    finalDeltas.visionScore,
    supportRole ? finalDeltas.assists - finalDeltas.deaths : finalDeltas.totalCs,
  ];
  const hasPositive = signals.some((value) => value > 0);
  const hasNegative = signals.some((value) => value < 0);

  if (score >= 2) return hasNegative ? "Mixed" : "Ahead";
  if (score <= -2) return hasPositive ? "Mixed" : "Behind";
  if (hasPositive && hasNegative) return "Mixed";
  return "Even";
}

function buildProfileSummary(input: {
  finalResult: RivalRoleDelta["finalResult"];
  roleKey: string;
  earlyBehind: boolean;
  earlyAhead: boolean;
  finalEconomyAhead: boolean;
  finalEconomyBehind: boolean;
  mapConversionAhead: boolean;
  mapConversionBehind: boolean;
  lowFightInvolvement: boolean;
  highFightInvolvement: boolean;
  supportRole: boolean;
}): string {
  if (input.supportRole) {
    if (input.highFightInvolvement && !input.mapConversionBehind) return "Support utility edge.";
    if (input.lowFightInvolvement) return "Lower fight involvement, support context required.";
    return "Support comparison profile.";
  }

  if (input.earlyBehind && input.mapConversionAhead) return "Lane deficit, strong map conversion.";
  if (input.earlyBehind && input.finalEconomyAhead) return "Behind early, recovered final economy.";
  if (input.earlyAhead && input.mapConversionBehind) return "Ahead early, lost map impact later.";
  if ((input.finalEconomyAhead || input.earlyAhead) && input.mapConversionBehind) return "Stat lead, low objective conversion.";
  if (!input.finalEconomyAhead && !input.finalEconomyBehind && input.lowFightInvolvement) return "Even economy, lower fight involvement.";
  if (input.finalResult === "Ahead") return "Direct role advantage.";
  if (input.finalResult === "Behind") return "Direct role deficit.";
  if (input.finalResult === "Even") return "Even role profile.";
  return "Mixed lane-to-map profile.";
}

function buildClassificationReason(input: {
  finalResult: RivalRoleDelta["finalResult"];
  earlyBehind: boolean;
  earlyAhead: boolean;
  finalEconomyAhead: boolean;
  finalEconomyBehind: boolean;
  mapConversionAhead: boolean;
  mapConversionBehind: boolean;
  lowFightInvolvement: boolean;
  supportRole: boolean;
}): string {
  if (input.earlyBehind && input.mapConversionAhead) {
    return "Mixed because early checkpoint economy/level indicators were behind while final objective or turret damage was ahead.";
  }

  if (input.earlyBehind && input.finalEconomyAhead) {
    return "Mixed because early checkpoint indicators were behind but final gold recovered.";
  }

  if (input.earlyAhead && (input.finalEconomyBehind || input.mapConversionBehind)) {
    return "Mixed because early role indicators were ahead but final economy or map conversion finished behind.";
  }

  if (input.lowFightInvolvement && input.mapConversionAhead) {
    return "Mixed because fight involvement was lower while structure/objective value was higher.";
  }

  if (input.supportRole) {
    return "Support classification emphasizes assists, deaths, KP, vision, and warding; CS is not used as negative evidence.";
  }

  return `${input.finalResult} from combined API deltas across checkpoint economy, final economy, fight involvement, vision, and map conversion.`;
}

function buildRivalRoleExplanation(input: {
  playerLabel: string;
  opponentLabel: string;
  roleKey: string;
  finalResult: RivalRoleDelta["finalResult"];
  profileSummary: string;
  earlyCheckpoint: RivalRoleDeltaCheckpoint | undefined;
  finalDeltas: RivalRoleDelta["finalDeltas"];
  earlyBehind: boolean;
  earlyAhead: boolean;
  finalEconomyAhead: boolean;
  mapConversionAhead: boolean;
  lowFightInvolvement: boolean;
  supportRole: boolean;
}): string {
  const checkpointText = input.earlyCheckpoint
    ? `at ${input.earlyCheckpoint.minute} minutes by ${signed(input.earlyCheckpoint.totalGoldDelta)} gold, ${signed(input.earlyCheckpoint.totalCsDelta)} CS, and ${signed(input.earlyCheckpoint.levelDelta)} level`
    : "without a usable 10/15/20 minute checkpoint";
  const mapText = buildMapConversionText(input.finalDeltas);
  const fightText = input.lowFightInvolvement
    ? `Kill participation was lower by ${formatDeltaPercent(input.finalDeltas.killParticipation)}, so RiftLab marks lower fight involvement without claiming bad teamfighting.`
    : "";

  if (input.supportRole) {
    return `${input.playerLabel} is compared against ${input.opponentLabel}. ${input.profileSummary} Support comparison emphasizes assists (${signed(input.finalDeltas.assists)}), deaths (${signed(input.finalDeltas.deaths)}), KP (${formatDeltaPercent(input.finalDeltas.killParticipation)}), vision (${signed(input.finalDeltas.visionScore)}), and warding. CS is not used as negative evidence.`;
  }

  if (input.finalResult === "Mixed" && input.earlyBehind && (input.finalEconomyAhead || input.mapConversionAhead)) {
    return `${input.playerLabel} was behind ${input.opponentLabel} ${checkpointText}, but recovered final economy or produced higher map conversion. ${mapText} RiftLab marks this as a ${input.profileSummary.toLowerCase()}`;
  }

  if (input.finalResult === "Mixed" && input.earlyAhead) {
    return `${input.playerLabel} showed early role advantages ${checkpointText}, but later final economy or map conversion did not hold. ${mapText} RiftLab marks this as ${input.profileSummary.toLowerCase()}`;
  }

  if (input.roleKey === "BOTTOM") {
    return `${input.playerLabel} is compared against ${input.opponentLabel}. ${input.profileSummary} ADC comparison weighs gold, CS, level, KP, champion damage, turret damage, and objective damage. ${mapText} Damage taken is contextual and requires VOD/fight context to evaluate. ${fightText}`;
  }

  if (input.roleKey === "JUNGLE") {
    return `${input.playerLabel} is compared against ${input.opponentLabel}. ${input.profileSummary} Jungle comparison emphasizes objective damage, KP, deaths around objectives, level, and gold. ${mapText}`;
  }

  return `${input.playerLabel} is compared against ${input.opponentLabel}. ${input.profileSummary} ${mapText} Damage taken is contextual and requires VOD/fight context to evaluate. ${fightText}`;
}

function buildMapConversionText(finalDeltas: RivalRoleDelta["finalDeltas"]): string {
  const objectiveDamage = finalDeltas.damageToObjectives;
  const turretDamage = finalDeltas.damageToTurrets;

  if ((objectiveDamage ?? 0) > 0 || (turretDamage ?? 0) > 0) {
    return `Final map conversion was higher (${formatNullableDelta(objectiveDamage)} objective damage, ${formatNullableDelta(turretDamage)} turret damage), which indicates structure/objective value rather than confirmed lane dominance.`;
  }

  if ((objectiveDamage ?? 0) < 0 || (turretDamage ?? 0) < 0) {
    return `Final map conversion was lower (${formatNullableDelta(objectiveDamage)} objective damage, ${formatNullableDelta(turretDamage)} turret damage).`;
  }

  return "Final objective and turret damage were close or unavailable.";
}

function countRepeatedDeathWindows(signals: RealScoringSignals): number {
  const deathTimes = [
    ...signals.deathBeforeObjective.map((signal) => signal.deathTimestamp),
    ...signals.structureLossAfterDeath.map((signal) => signal.deathTimestamp),
  ].map(parseTimestamp).sort((a, b) => a - b);

  return deathTimes.filter((time, index) => index > 0 && time - deathTimes[index - 1] <= 120).length;
}

function getPlayerDeathTiming(deathIndex: number, eventCount: number): TeamfightProfileEntry["playerDeathTiming"] {
  if (deathIndex < 0) return "none";
  if (deathIndex === 0) return "first";
  if (deathIndex <= Math.floor(eventCount / 2)) return "early";
  return "late";
}

function normalizeRole(role: string): string | null {
  const normalized = role.toUpperCase();
  if (normalized === "MID") return "MIDDLE";
  if (normalized === "ADC") return "BOTTOM";
  if (normalized === "SUPPORT") return "UTILITY";
  if (["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].includes(normalized)) return normalized;
  return null;
}

function isSupportRole(position: string): boolean {
  return normalizeRole(position) === "UTILITY";
}

function isMajorObjective(objectiveType: string): boolean {
  const normalized = objectiveType.toUpperCase();
  return normalized.includes("DRAGON") || normalized.includes("BARON") || normalized.includes("ELDER");
}

function safeKda(participant: RiotReportParticipant): number | null {
  return roundTwo((participant.kills + participant.assists) / Math.max(participant.deaths, 1));
}

function nullableDelta(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

function emptyFinalDeltas(): RivalRoleDelta["finalDeltas"] {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    kdaRatio: null,
    goldEarned: 0,
    totalCs: 0,
    csPerMinute: 0,
    visionScore: 0,
    damageToChampions: null,
    damageToObjectives: null,
    damageToTurrets: null,
    totalDamageTaken: null,
    wardsPlaced: null,
    wardsKilled: null,
    killParticipation: null,
  };
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatNullableDelta(value: number | null): string {
  return value === null ? "unavailable" : signed(value);
}

function formatDeltaPercent(value: number | null): string {
  return value === null ? "unavailable" : `${signed(Math.round(value * 100))} pts`;
}

function parseTimestamp(timestamp: string): number {
  const [minutes = "0", seconds = "0"] = timestamp.split(":");
  return Number(minutes) * 60 + Number(seconds);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
