import type {
  RiotAccountDto,
  RiotMatchDto,
  RiotMatchId,
  RiotRegionRouting,
  RiotTimelineDto,
} from "@/lib/adapters/riot-types";

const DEFAULT_ACCOUNT_REGION: RiotRegionRouting = "americas";
const DEFAULT_MATCH_REGION: RiotRegionRouting = "americas";
const VALID_ACCOUNT_REGIONS = new Set<RiotRegionRouting>(["americas", "asia", "europe", "sea"]);

export class RiotApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "RiotApiError";
  }
}

export function isRiotApiConfigured(): boolean {
  return Boolean(process.env.RIOT_API_KEY?.trim());
}

export async function getAccountByRiotId(
  gameName: string,
  tagLine: string,
): Promise<RiotAccountDto> {
  const apiKey = process.env.RIOT_API_KEY?.trim();

  if (!apiKey) {
    throw new RiotApiError("RIOT_API_KEY is not configured.", 503, "RIOT_API_KEY_MISSING");
  }

  const region = getRiotAccountRegion();
  const endpoint = new URL(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    `https://${region}.api.riotgames.com`,
  );

  const response = await fetch(endpoint, {
    headers: {
      "X-Riot-Token": apiKey,
    },
    cache: "no-store",
  });

  console.info("[RiftLab Riot] Account-V1 response status:", response.status);

  if (!response.ok) {
    throw await createRiotApiError(response, "RIOT_ACCOUNT_NOT_FOUND");
  }

  return (await response.json()) as RiotAccountDto;
}

export async function getMatchIdsByPuuid(
  puuid: string,
  count = 5,
  start = 0,
): Promise<RiotMatchId[]> {
  const apiKey = process.env.RIOT_API_KEY?.trim();

  if (!apiKey) {
    throw new RiotApiError("RIOT_API_KEY is not configured.", 503, "RIOT_API_KEY_MISSING");
  }

  const region = getRiotMatchRegion();
  const safeCount = Math.max(0, Math.min(count, 5));
  const endpoint = new URL(
    `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
    `https://${region}.api.riotgames.com`,
  );
  endpoint.searchParams.set("start", String(start));
  endpoint.searchParams.set("count", String(safeCount));

  const response = await fetch(endpoint, {
    headers: {
      "X-Riot-Token": apiKey,
    },
    cache: "no-store",
  });

  console.info("[RiftLab Riot] Match-V5 regional route used:", region);
  console.info("[RiftLab Riot] Match-V5 match IDs response status:", response.status);

  if (!response.ok) {
    throw await createRiotApiError(response, "RIOT_MATCH_IDS_NOT_FOUND");
  }

  const matchIds = (await response.json()) as RiotMatchId[];
  console.info("[RiftLab Riot] Match-V5 match IDs fetched:", matchIds.length);

  if (matchIds.length === 0) {
    throw new RiotApiError("No recent League of Legends matches found for this account.", 404, "RIOT_NO_MATCHES_FOUND");
  }

  return matchIds;
}

export async function getMatchById(matchId: string): Promise<RiotMatchDto> {
  const apiKey = process.env.RIOT_API_KEY?.trim();

  if (!apiKey) {
    throw new RiotApiError("RIOT_API_KEY is not configured.", 503, "RIOT_API_KEY_MISSING");
  }

  const region = getRiotMatchRegion();
  const endpoint = new URL(
    `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
    `https://${region}.api.riotgames.com`,
  );

  console.info("[RiftLab Riot] selected matchId:", matchId);

  const response = await fetch(endpoint, {
    headers: {
      "X-Riot-Token": apiKey,
    },
    cache: "no-store",
  });

  console.info("[RiftLab Riot] Match-V5 match detail response status:", response.status);

  if (!response.ok) {
    throw await createRiotApiError(response, "RIOT_MATCH_NOT_FOUND");
  }

  return (await response.json()) as RiotMatchDto;
}

export async function getMatchTimelineById(matchId: string): Promise<RiotTimelineDto> {
  const apiKey = process.env.RIOT_API_KEY?.trim();

  if (!apiKey) {
    throw new RiotApiError("RIOT_API_KEY is not configured.", 503, "RIOT_API_KEY_MISSING");
  }

  const region = getRiotMatchRegion();
  const endpoint = new URL(
    `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
    `https://${region}.api.riotgames.com`,
  );

  console.info("[RiftLab Riot] selected matchId:", matchId);

  const response = await fetch(endpoint, {
    headers: {
      "X-Riot-Token": apiKey,
    },
    cache: "no-store",
  });

  console.info("[RiftLab Riot] Match-V5 timeline response status:", response.status);

  if (!response.ok) {
    throw await createRiotApiError(response, "RIOT_TIMELINE_NOT_FOUND");
  }

  return (await response.json()) as RiotTimelineDto;
}

export function getRiotAccountRegion(): RiotRegionRouting {
  const configuredRegion = process.env.RIOT_ACCOUNT_REGION?.trim().toLowerCase();

  if (configuredRegion && VALID_ACCOUNT_REGIONS.has(configuredRegion as RiotRegionRouting)) {
    return configuredRegion as RiotRegionRouting;
  }

  return DEFAULT_ACCOUNT_REGION;
}

export function getRiotMatchRegion(): RiotRegionRouting {
  const configuredRegion = process.env.RIOT_MATCH_REGION?.trim().toLowerCase();

  if (configuredRegion && VALID_ACCOUNT_REGIONS.has(configuredRegion as RiotRegionRouting)) {
    return configuredRegion as RiotRegionRouting;
  }

  if (configuredRegion) {
    throw new RiotApiError(
      `Unsupported Riot Match-V5 regional route: ${configuredRegion}.`,
      500,
      "RIOT_UNSUPPORTED_ROUTE",
    );
  }

  return DEFAULT_MATCH_REGION;
}

async function createRiotApiError(
  response: Response,
  notFoundCode:
    | "RIOT_ACCOUNT_NOT_FOUND"
    | "RIOT_MATCH_IDS_NOT_FOUND"
    | "RIOT_MATCH_NOT_FOUND"
    | "RIOT_TIMELINE_NOT_FOUND",
): Promise<RiotApiError> {
  const fallbackMessage = getDefaultErrorMessage(response.status);
  let message = fallbackMessage;

  try {
    const body = (await response.json()) as { status?: { message?: string } };
    message = body.status?.message || fallbackMessage;
  } catch {
    // Riot errors are usually JSON, but keep a readable fallback if the body is empty.
  }

  return new RiotApiError(message, response.status, getErrorCode(response.status, notFoundCode));
}

function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "The Riot ID format was rejected by Riot.";
    case 401:
    case 403:
      return "The Riot API key was rejected.";
    case 404:
      return "Riot could not find that Riot ID.";
    case 429:
      return "Riot rate limit reached. Try again later.";
    default:
      return "Riot API request failed.";
  }
}

function getErrorCode(status: number, notFoundCode: string): string {
  switch (status) {
    case 400:
      return "RIOT_BAD_REQUEST";
    case 401:
    case 403:
      return "RIOT_AUTH_ERROR";
    case 404:
      return notFoundCode;
    case 429:
      return "RIOT_RATE_LIMITED";
    default:
      return "RIOT_API_ERROR";
  }
}
