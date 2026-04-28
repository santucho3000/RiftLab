export function formatTowerTypeForUser(towerType: string | null | undefined): string {
  if (towerType === "OUTER_TURRET") return "Tier 1 tower";
  if (towerType === "INNER_TURRET") return "Tier 2 tower";
  if (towerType === "BASE_TURRET") return "Tier 3 / Inhibitor tower";
  if (towerType === "NEXUS_TURRET") return "Nexus tower";
  if (!towerType) return "structure";

  return titleCaseRiotValue(towerType);
}

export function formatLaneForUser(lane: string | null | undefined): string {
  if (lane === "TOP_LANE") return "Top";
  if (lane === "MID_LANE") return "Mid";
  if (lane === "BOT_LANE") return "Bot";
  if (!lane) return "";

  return titleCaseRiotValue(lane);
}

export function formatStructureForUser(
  lane: string | null | undefined,
  towerType: string | null | undefined,
): string {
  const tower = formatTowerTypeForUser(towerType);

  if (towerType === "NEXUS_TURRET") {
    return tower;
  }

  const formattedLane = formatLaneForUser(lane);

  return formattedLane ? `${formattedLane} ${tower}` : tower;
}

export type ParticipantDisplayInfo = {
  participantId: number;
  championName?: string | null;
  riotIdGameName?: string | null;
  summonerName?: string | null;
  teamPosition?: string | null;
  individualPosition?: string | null;
  teamSide?: "Blue" | "Red" | "Unknown" | string | null;
};

export function formatRoleForUser(role: string | null | undefined): string {
  if (!role) return "Unknown role";

  const normalized = role.toUpperCase();

  if (normalized === "TOP") return "Top";
  if (normalized === "JUNGLE") return "Jungle";
  if (normalized === "MIDDLE" || normalized === "MID") return "Mid";
  if (normalized === "BOTTOM" || normalized === "ADC") return "ADC";
  if (normalized === "UTILITY" || normalized === "SUPPORT") return "Support";

  return "Unknown role";
}

export function formatObjectiveTypeForUser(
  monsterType: string | null | undefined,
  monsterSubType?: string | null,
): string {
  if (monsterSubType === "ELDER_DRAGON") return "Elder Dragon";
  if (!monsterType) return "Unknown objective";

  const normalized = monsterType.toUpperCase();

  if (normalized === "HORDE" || normalized.includes("VOIDGRUB") || normalized.includes("VOIDGRUBS")) {
    return "Voidgrubs";
  }

  if (normalized === "DRAGON") return "Dragon";
  if (normalized === "RIFTHERALD" || normalized.includes("RIFT HERALD")) return "Rift Herald";
  if (normalized === "BARON_NASHOR" || normalized.includes("BARON")) return "Baron";

  return titleCaseRiotValue(monsterType);
}

export function formatParticipantIdForUser(
  participantId: number | null | undefined,
  participants: ParticipantDisplayInfo[] = [],
): string {
  if (!participantId || participantId < 1 || participantId > 10) {
    return "Unknown participant";
  }

  const participant = participants.find((entry) => entry.participantId === participantId);
  const teamSide = participant?.teamSide ?? (participantId <= 5 ? "Blue" : "Red");
  const fallbackRoles = ["Top", "Jungle", "Mid", "ADC", "Support"];
  const roleIndex = ((participantId - 1) % 5 + 5) % 5;
  const formattedRole = participant
    ? formatRoleForUser(participant.teamPosition ?? participant.individualPosition)
    : fallbackRoles[roleIndex];
  const roleLabel = formattedRole === "Unknown role" ? fallbackRoles[roleIndex] : formattedRole;
  const baseLabel = `${teamSide} ${roleLabel}`;
  const championName = participant?.championName;

  return championName ? `${baseLabel} (${championName})` : baseLabel;
}

export function formatParticipantIdsForUser(
  participantIds: number[],
  participants: ParticipantDisplayInfo[] = [],
): string {
  if (participantIds.length === 0) return "None";

  return participantIds.map((participantId) => formatParticipantIdForUser(participantId, participants)).join(", ");
}

function titleCaseRiotValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
