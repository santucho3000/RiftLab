import { formatObjectiveTypeForUser, formatParticipantIdForUser } from "@/lib/formatters/riot-display";
import type { RiotTimelineDto, RiotTimelineEventDto } from "@/lib/adapters/riot-types";

export type TimelineDiagnostics = {
  matchId: string;
  participantId: number;
  playerDeaths: PlayerDeathEvent[];
  championKillEvents: ChampionKillEvent[];
  eliteMonsterEvents: EliteMonsterEvent[];
  buildingEvents: BuildingEvent[];
  itemEvents: ItemEvent[];
  frameSnapshots: PlayerFrameSnapshot[];
  participantFrameSnapshots: ParticipantFrameSnapshot[];
  frameCount: number;
  parsedEventCount: number;
};

export type PlayerDeathEvent = {
  timestamp: string;
  killerParticipantId: number | null;
  assistingParticipantIds: number[];
};

export type ChampionKillEvent = {
  timestamp: string;
  killerParticipantId: number | null;
  victimParticipantId: number | null;
  assistingParticipantIds: number[];
  killerTeam: "Blue" | "Red" | "Unknown";
  victimTeam: "Blue" | "Red" | "Unknown";
};

export type EliteMonsterEvent = {
  timestamp: string;
  monsterType: string;
  rawMonsterType: string | null;
  monsterSubType: string | null;
  killerTeam: "Blue" | "Red" | "Unknown";
};

export type BuildingEvent = {
  timestamp: string;
  buildingType: string;
  towerType: string | null;
  laneType: string | null;
  teamAffected: "Blue" | "Red" | "Unknown";
};

export type ItemEvent = {
  timestamp: string;
  participantId: number;
  eventType: string;
  itemId: number | null;
  rawItemId: number | null;
};

export type PlayerFrameSnapshot = {
  minute: number;
  currentGold: number;
  totalGold: number;
  xp: number | null;
  level: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  position: { x: number; y: number } | null;
};

export type ParticipantFrameSnapshot = PlayerFrameSnapshot & {
  participantId: number;
};

export function buildTimelineDiagnostics(
  timeline: RiotTimelineDto,
  puuid: string,
): TimelineDiagnostics {
  const participant = timeline.info.participants.find((entry) => entry.puuid === puuid);

  if (!participant) {
    throw new Error("TIMELINE_PARTICIPANT_PUUID_NOT_FOUND");
  }

  const participantId = participant.participantId;
  const events = timeline.info.frames.flatMap((frame) => frame.events);
  const playerDeaths = events
    .filter((event) => event.type === "CHAMPION_KILL" && event.victimId === participantId)
    .map((event) => ({
      timestamp: formatTimestamp(event.timestamp),
      killerParticipantId: event.killerId ?? null,
      assistingParticipantIds: event.assistingParticipantIds ?? [],
    }));
  const championKillEvents = events
    .filter((event) => event.type === "CHAMPION_KILL")
    .map((event) => ({
      timestamp: formatTimestamp(event.timestamp),
      killerParticipantId: event.killerId ?? null,
      victimParticipantId: event.victimId ?? null,
      assistingParticipantIds: event.assistingParticipantIds ?? [],
      killerTeam: getParticipantTeamSide(event.killerId),
      victimTeam: getParticipantTeamSide(event.victimId),
    }));
  const eliteMonsterEvents = events
    .filter((event) => event.type === "ELITE_MONSTER_KILL")
    .map((event) => ({
      timestamp: formatTimestamp(event.timestamp),
      monsterType: normalizeMonsterType(event),
      rawMonsterType: event.monsterType ?? null,
      monsterSubType: event.monsterSubType ?? null,
      killerTeam: getTeamSide(event.killerTeamId),
    }));
  const buildingEvents = events
    .filter((event) => event.type === "BUILDING_KILL")
    .map((event) => ({
      timestamp: formatTimestamp(event.timestamp),
      buildingType: event.buildingType ?? "Unknown building",
      towerType: event.towerType ?? null,
      laneType: event.laneType ?? null,
      teamAffected: getTeamSide(event.teamId),
    }));
  const itemEvents = events
    .filter((event) => event.type === "ITEM_PURCHASED" || event.type === "ITEM_DESTROYED" || event.type === "ITEM_UNDO")
    .map((event) => ({
      timestamp: formatTimestamp(event.timestamp),
      participantId: event.participantId ?? 0,
      eventType: event.type,
      itemId: event.itemId ?? event.afterId ?? null,
      rawItemId: event.itemId ?? event.afterId ?? null,
    }));
  const frameSnapshots = timeline.info.frames
    .filter((frame) => {
      const minute = Math.round(frame.timestamp / 60000);
      return minute > 0 && minute % 5 === 0;
    })
    .map((frame) => {
      const participantFrame = frame.participantFrames[String(participantId)];

      if (!participantFrame) {
        return null;
      }

      return {
        minute: Math.round(frame.timestamp / 60000),
        currentGold: participantFrame.currentGold,
        totalGold: participantFrame.totalGold,
        xp: participantFrame.xp ?? null,
        level: participantFrame.level,
        minionsKilled: participantFrame.minionsKilled,
        jungleMinionsKilled: participantFrame.jungleMinionsKilled,
        position: participantFrame.position ?? null,
      };
    })
    .filter((snapshot): snapshot is PlayerFrameSnapshot => snapshot !== null);
  const participantFrameSnapshots = timeline.info.frames
    .filter((frame) => {
      const minute = Math.round(frame.timestamp / 60000);
      return minute > 0 && minute % 5 === 0;
    })
    .flatMap((frame) => {
      const minute = Math.round(frame.timestamp / 60000);

      return Object.values(frame.participantFrames).map((participantFrame) => ({
        participantId: participantFrame.participantId,
        minute,
        currentGold: participantFrame.currentGold,
        totalGold: participantFrame.totalGold,
        xp: participantFrame.xp ?? null,
        level: participantFrame.level,
        minionsKilled: participantFrame.minionsKilled,
        jungleMinionsKilled: participantFrame.jungleMinionsKilled,
        position: participantFrame.position ?? null,
      }));
    });

  console.info("[RiftLab Riot] timeline frames:", timeline.info.frames.length);
  console.info("[RiftLab Riot] timeline events parsed:", events.length);
  console.info("[RiftLab Riot] timeline participantId:", participantId);
  console.info(
    "[RiftLab Riot] participant display labels:",
    collectParticipantIdsForLogs(playerDeaths, championKillEvents)
      .map((id) => ({ rawParticipantId: id, formattedParticipantLabel: formatParticipantIdForUser(id) }))
      .slice(0, 20),
  );
  console.info(
    "[RiftLab Riot] elite objective display labels:",
    eliteMonsterEvents.map((event) => ({
      rawMonsterType: event.rawMonsterType,
      formattedObjectiveName: event.monsterType,
      timestamp: event.timestamp,
    })),
  );
  console.info("[RiftLab Riot] item timing events:", itemEvents.length);

  return {
    matchId: timeline.metadata.matchId,
    participantId,
    playerDeaths,
    championKillEvents,
    eliteMonsterEvents,
    buildingEvents,
    itemEvents,
    frameSnapshots,
    participantFrameSnapshots,
    frameCount: timeline.info.frames.length,
    parsedEventCount: events.length,
  };
}

function normalizeMonsterType(event: RiotTimelineEventDto): string {
  return formatObjectiveTypeForUser(event.monsterType, event.monsterSubType);
}

function getTeamSide(teamId: number | undefined): "Blue" | "Red" | "Unknown" {
  if (teamId === 100) return "Blue";
  if (teamId === 200) return "Red";
  return "Unknown";
}

function getParticipantTeamSide(participantId: number | undefined): "Blue" | "Red" | "Unknown" {
  if (participantId === undefined || participantId <= 0) return "Unknown";
  if (participantId <= 5) return "Blue";
  if (participantId <= 10) return "Red";
  return "Unknown";
}

function collectParticipantIdsForLogs(
  playerDeaths: PlayerDeathEvent[],
  championKillEvents: ChampionKillEvent[],
): number[] {
  const ids = new Set<number>();

  for (const death of playerDeaths) {
    if (death.killerParticipantId) ids.add(death.killerParticipantId);
    for (const assistId of death.assistingParticipantIds) ids.add(assistId);
  }

  for (const event of championKillEvents) {
    if (event.killerParticipantId) ids.add(event.killerParticipantId);
    if (event.victimParticipantId) ids.add(event.victimParticipantId);
    for (const assistId of event.assistingParticipantIds) ids.add(assistId);
  }

  return [...ids].sort((a, b) => a - b);
}

function formatTimestamp(timestampMs: number): string {
  const totalSeconds = Math.floor(timestampMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
