export const DEFAULT_DATA_DRAGON_VERSION = "15.13.1";

const DATA_DRAGON_CDN_BASE = "https://ddragon.leagueoflegends.com/cdn";

const SUMMONER_SPELL_ID_TO_KEY: Record<number, string> = {
  1: "SummonerBoost",
  3: "SummonerExhaust",
  4: "SummonerFlash",
  6: "SummonerHaste",
  7: "SummonerHeal",
  11: "SummonerSmite",
  12: "SummonerTeleport",
  13: "SummonerMana",
  14: "SummonerDot",
  21: "SummonerBarrier",
  30: "SummonerPoroRecall",
  31: "SummonerPoroThrow",
  32: "SummonerSnowball",
  39: "SummonerSnowURFSnowball_Mark",
  54: "Summoner_UltBookPlaceholder",
  55: "Summoner_UltBookSmitePlaceholder",
};

const CHAMPION_NAME_TO_DATA_DRAGON_ID: Record<string, string> = {
  FiddleSticks: "Fiddlesticks",
};

export function normalizeDataDragonVersion(gameVersion: string | null | undefined): string {
  if (!gameVersion) return DEFAULT_DATA_DRAGON_VERSION;

  const [major, minor] = gameVersion.split(".");

  if (!major || !minor) return DEFAULT_DATA_DRAGON_VERSION;

  return `${major}.${minor}.1`;
}

export function getChampionIconUrl(
  championName: string | null | undefined,
  version: string | null | undefined,
): string | null {
  if (!championName) return null;

  const dataDragonId = CHAMPION_NAME_TO_DATA_DRAGON_ID[championName] ?? sanitizeAssetName(championName);

  return `${DATA_DRAGON_CDN_BASE}/${normalizeDataDragonVersion(version)}/img/champion/${dataDragonId}.png`;
}

export function getItemIconUrl(itemId: number | null | undefined, version: string | null | undefined): string | null {
  if (!itemId || itemId <= 0) return null;

  return `${DATA_DRAGON_CDN_BASE}/${normalizeDataDragonVersion(version)}/img/item/${itemId}.png`;
}

export function getSummonerSpellIconUrl(
  spellId: number | null | undefined,
  version: string | null | undefined,
): string | null {
  if (!spellId) return null;

  const spellKey = SUMMONER_SPELL_ID_TO_KEY[spellId];
  if (!spellKey) return null;

  return `${DATA_DRAGON_CDN_BASE}/${normalizeDataDragonVersion(version)}/img/spell/${spellKey}.png`;
}

function sanitizeAssetName(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "");
}
