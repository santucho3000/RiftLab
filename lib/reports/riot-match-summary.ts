import type { RiotMatchDto, RiotParticipantDto } from "@/lib/adapters/riot-types";

export type RiotReportParticipant = {
  participantId: number;
  puuid: string;
  riotIdGameName: string | null;
  championName: string;
  teamId: number;
  teamSide: "Blue" | "Red" | "Unknown";
  teamPosition: string;
  individualPosition: string;
  kills: number;
  deaths: number;
  assists: number;
  totalCs: number;
  csPerMinute: number;
  goldEarned: number;
  goldPerMinute: number;
  visionScore: number;
  killParticipation: number | null;
  totalDamageDealtToChampions: number | null;
  damageDealtToObjectives: number | null;
  damageDealtToTurrets: number | null;
};

export type RiotMatchSummary = {
  matchId: string;
  playerParticipantId: number;
  playerTeamId: number;
  championName: string;
  position: string;
  result: "Win" | "Loss";
  duration: string;
  durationMinutes: number;
  kills: number;
  deaths: number;
  assists: number;
  totalCs: number;
  csPerMinute: number;
  goldEarned: number;
  goldPerMinute: number;
  visionScore: number;
  teamKills: number;
  killParticipation: number | null;
  summonerLevel: number | null;
  teamSide: "Blue" | "Red" | "Unknown";
  participants: RiotReportParticipant[];
};

export function summarizeParticipantMatch(match: RiotMatchDto, puuid: string): RiotMatchSummary {
  const participant = match.info.participants.find((entry) => entry.puuid === puuid);

  if (!participant) {
    throw new Error("PARTICIPANT_PUUID_NOT_FOUND");
  }

  const durationMinutes = Math.max(match.info.gameDuration / 60, 1);
  const totalCs = getTotalCs(participant);
  const position = participant.teamPosition || participant.individualPosition || "Unknown";
  const result = participant.win ? "Win" : "Loss";
  const teamKills = getTeamKills(match, participant.teamId);
  const killParticipation = teamKills > 0 ? roundTwo((participant.kills + participant.assists) / teamKills) : null;
  const participants = match.info.participants.map((entry, index) =>
    normalizeReportParticipant(entry, entry.participantId ?? index + 1, match, durationMinutes),
  );

  console.info("[RiftLab Riot] participant championName:", participant.championName);
  console.info("[RiftLab Riot] participant teamPosition:", position);
  console.info("[RiftLab Riot] result:", result);

  return {
    matchId: match.metadata.matchId,
    playerParticipantId: participants.find((entry) => entry.puuid === puuid)?.participantId ?? 0,
    playerTeamId: participant.teamId,
    championName: participant.championName,
    position,
    result,
    duration: formatDuration(match.info.gameDuration),
    durationMinutes: roundTwo(durationMinutes),
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    totalCs,
    csPerMinute: roundOne(totalCs / durationMinutes),
    goldEarned: participant.goldEarned,
    goldPerMinute: Math.round(participant.goldEarned / durationMinutes),
    visionScore: participant.visionScore,
    teamKills,
    killParticipation,
    summonerLevel: participant.summonerLevel ?? null,
    teamSide: getTeamSide(participant.teamId),
    participants,
  };
}

function normalizeReportParticipant(
  participant: RiotParticipantDto,
  participantId: number,
  match: RiotMatchDto,
  durationMinutes: number,
): RiotReportParticipant {
  const totalCs = getTotalCs(participant);
  const teamKills = getTeamKills(match, participant.teamId);

  return {
    participantId,
    puuid: participant.puuid,
    riotIdGameName: participant.riotIdGameName ?? null,
    championName: participant.championName,
    teamId: participant.teamId,
    teamSide: getTeamSide(participant.teamId),
    teamPosition: participant.teamPosition || "",
    individualPosition: participant.individualPosition || "",
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    totalCs,
    csPerMinute: roundOne(totalCs / durationMinutes),
    goldEarned: participant.goldEarned,
    goldPerMinute: Math.round(participant.goldEarned / durationMinutes),
    visionScore: participant.visionScore,
    killParticipation: teamKills > 0 ? roundTwo((participant.kills + participant.assists) / teamKills) : null,
    totalDamageDealtToChampions: participant.totalDamageDealtToChampions ?? null,
    damageDealtToObjectives: participant.damageDealtToObjectives ?? null,
    damageDealtToTurrets: participant.damageDealtToTurrets ?? null,
  };
}

function getTeamKills(match: RiotMatchDto, teamId: number): number {
  return match.info.participants
    .filter((participant) => participant.teamId === teamId)
    .reduce((total, participant) => total + participant.kills, 0);
}

function getTotalCs(participant: RiotParticipantDto): number {
  return participant.totalMinionsKilled + participant.neutralMinionsKilled;
}

function getTeamSide(teamId: number): "Blue" | "Red" | "Unknown" {
  if (teamId === 100) return "Blue";
  if (teamId === 200) return "Red";
  return "Unknown";
}

function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
