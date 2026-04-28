export type LabTeamSide = "Blue" | "Red" | "Unknown";

export type LabObjectiveType = "Dragon" | "Elder" | "Voidgrubs" | "Rift Herald" | "Baron" | "Unknown";

export type LabMapRegion =
  | "top_lane"
  | "mid_lane"
  | "bot_lane"
  | "top_river"
  | "bot_river"
  | "dragon_pit"
  | "baron_pit"
  | "blue_jungle"
  | "red_jungle"
  | "unknown";

export type LabObjectiveWindow = {
  id: string;
  matchId?: string;
  windowStartSeconds: number;
  windowEndSeconds: number;
  objective: {
    type: LabObjectiveType;
    spawnOrKillTimeSeconds: number;
    controllingSide?: LabTeamSide;
  };
  relatedPlayerDeath?: {
    participantId: number;
    timeSeconds: number;
    teamSide: LabTeamSide;
  };
  notes?: string;
};

export type LabChampionPositionSample = {
  participantId: number;
  championName: string;
  teamSide: LabTeamSide;
  timeSeconds: number;
  x: number;
  y: number;
  region: LabMapRegion;
  confidence: number;
};

export type LabIsolationSignal = {
  participantId: number;
  timeSeconds: number;
  nearestAllyDistance: number;
  alliesWithinObjectiveRadius: number;
  enemiesWithinObjectiveRadius: number;
  isIsolated: boolean;
  confidence: number;
  interpretation: string;
};

export type LabObjectivePresenceResult = {
  objectiveType: LabObjectiveType;
  windowStartSeconds: number;
  windowEndSeconds: number;
  bluePresentParticipantIds: number[];
  redPresentParticipantIds: number[];
  controllingSide: LabTeamSide;
  confidence: number;
};

export type LabZoneControlResult = {
  region: LabMapRegion;
  windowStartSeconds: number;
  windowEndSeconds: number;
  controllingSide: LabTeamSide;
  blueOccupancySeconds: number;
  redOccupancySeconds: number;
  confidence: number;
  interpretation: string;
};

export type LabRotationResult = {
  participantId: number;
  fromRegion: LabMapRegion;
  toRegion: LabMapRegion;
  startTimeSeconds: number;
  endTimeSeconds: number;
  arrivedBeforeOpponentSeconds?: number;
  rotationType: "first_move" | "late_rotation" | "collapse" | "retreat" | "unknown";
  confidence: number;
};

