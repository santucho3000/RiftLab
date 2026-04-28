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

function titleCaseRiotValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
