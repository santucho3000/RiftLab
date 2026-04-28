import type { RiotTimelineDto, RiotTimelineEventDto } from "@/lib/adapters/riot-types";

export type TimelineDiagnostics = {
  matchId: string;
  participantId: number;
  playerDeaths: PlayerDeathEvent[];
  championKillEvents: ChampionKillEvent[];
  eliteMonsterEvents: EliteMonsterEvent[];
  buildingEvents: BuildingEvent[];
  frameSnapshots: PlayerFrameSnapshot[];
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

export type PlayerFrameSnapshot = {
  minute: number;
  currentGold: number;
  totalGold: number;
  level: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  position: { x: number; y: number } | null;
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
        level: participantFrame.level,
        minionsKilled: participantFrame.minionsKilled,
        jungleMinionsKilled: participantFrame.jungleMinionsKilled,
        position: participantFrame.position ?? null,
      };
    })
    .filter((snapshot): snapshot is PlayerFrameSnapshot => snapshot !== null);

  console.info("[RiftLab Riot] timeline frames:", timeline.info.frames.length);
  console.info("[RiftLab Riot] timeline events parsed:", events.length);
  console.info("[RiftLab Riot] timeline participantId:", participantId);

  return {
    matchId: timeline.metadata.matchId,
    participantId,
    playerDeaths,
    championKillEvents,
    eliteMonsterEvents,
    buildingEvents,
    frameSnapshots,
    frameCount: timeline.info.frames.length,
    parsedEventCount: events.length,
  };
}

function normalizeMonsterType(event: RiotTimelineEventDto): string {
  if (event.monsterSubType === "ELDER_DRAGON") return "Elder Dragon";
  if (event.monsterType === "HORDE") return "Voidgrubs/Horde";
  if (event.monsterType === "DRAGON") return "Dragon";
  if (event.monsterType === "RIFTHERALD") return "Rift Herald";
  if (event.monsterType === "BARON_NASHOR") return "Baron";
  return event.monsterType ?? "Unknown monster";
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

function formatTimestamp(timestampMs: number): string {
  const totalSeconds = Math.floor(timestampMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
