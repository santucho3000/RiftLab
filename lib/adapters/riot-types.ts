import type { Role } from "@/lib/types";

export type RiotRegionRouting = "americas" | "asia" | "europe" | "sea";

export type RiotMatchId = string;

export type RiotAccountDto = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type RiotMatchDto = {
  metadata: RiotMatchMetadataDto;
  info: RiotMatchInfoDto;
};

export type RiotMatchMetadataDto = {
  dataVersion: string;
  matchId: string;
  participants: string[];
};

export type RiotMatchInfoDto = {
  gameCreation: number;
  gameDuration: number;
  gameMode: string;
  gameVersion: string;
  participants: RiotParticipantDto[];
  teams: RiotTeamDto[];
};

export type RiotParticipantDto = {
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  championName: string;
  teamId: number;
  teamPosition: Role | "";
  individualPosition?: Role | "";
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  visionScore: number;
  summonerLevel?: number;
  win: boolean;
};

export type RiotTeamDto = {
  teamId: number;
  win: boolean;
  objectives: RiotObjectivesDto;
};

export type RiotObjectivesDto = {
  baron: RiotObjectiveDto;
  champion: RiotObjectiveDto;
  dragon: RiotObjectiveDto;
  horde?: RiotObjectiveDto;
  inhibitor: RiotObjectiveDto;
  riftHerald: RiotObjectiveDto;
  tower: RiotObjectiveDto;
};

export type RiotObjectiveDto = {
  first: boolean;
  kills: number;
};
