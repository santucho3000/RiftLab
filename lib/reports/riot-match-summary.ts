import type { RiotMatchDto, RiotParticipantDto } from "@/lib/adapters/riot-types";

export type RiotMatchSummary = {
  matchId: string;
  championName: string;
  position: string;
  result: "Win" | "Loss";
  duration: string;
  kills: number;
  deaths: number;
  assists: number;
  totalCs: number;
  csPerMinute: number;
  goldEarned: number;
  goldPerMinute: number;
  visionScore: number;
  summonerLevel: number | null;
  teamSide: "Blue" | "Red" | "Unknown";
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

  console.info("[RiftLab Riot] participant championName:", participant.championName);
  console.info("[RiftLab Riot] participant teamPosition:", position);
  console.info("[RiftLab Riot] result:", result);

  return {
    matchId: match.metadata.matchId,
    championName: participant.championName,
    position,
    result,
    duration: formatDuration(match.info.gameDuration),
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    totalCs,
    csPerMinute: roundOne(totalCs / durationMinutes),
    goldEarned: participant.goldEarned,
    goldPerMinute: Math.round(participant.goldEarned / durationMinutes),
    visionScore: participant.visionScore,
    summonerLevel: participant.summonerLevel ?? null,
    teamSide: getTeamSide(participant.teamId),
  };
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
