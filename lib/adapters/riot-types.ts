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

export type RiotTimelineDto = {
  metadata: RiotMatchMetadataDto;
  info: RiotTimelineInfoDto;
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

export type RiotTimelineInfoDto = {
  frameInterval: number;
  frames: RiotTimelineFrameDto[];
  participants: RiotTimelineParticipantDto[];
};

export type RiotTimelineParticipantDto = {
  participantId: number;
  puuid: string;
};

export type RiotTimelineFrameDto = {
  timestamp: number;
  events: RiotTimelineEventDto[];
  participantFrames: Record<string, RiotParticipantFrameDto>;
};

export type RiotParticipantFrameDto = {
  participantId: number;
  currentGold: number;
  totalGold: number;
  xp?: number;
  level: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  position?: RiotPositionDto;
};

export type RiotPositionDto = {
  x: number;
  y: number;
};

export type RiotTimelineEventDto = {
  type: string;
  timestamp: number;
  participantId?: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  monsterType?: string;
  monsterSubType?: string;
  killerTeamId?: number;
  teamId?: number;
  buildingType?: string;
  towerType?: string;
  laneType?: string;
  itemId?: number;
  beforeId?: number;
  afterId?: number;
};

export type RiotParticipantDto = {
  participantId?: number;
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
  totalDamageDealtToChampions?: number;
  damageDealtToObjectives?: number;
  damageDealtToTurrets?: number;
  totalDamageTaken?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  summoner1Id?: number;
  summoner2Id?: number;
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
