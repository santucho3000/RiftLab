import { NextResponse } from "next/server";
import { getAccountByRiotId, getMatchById, RiotApiError } from "@/lib/adapters";
import { summarizeParticipantMatch } from "@/lib/reports";
import { parseRiotId } from "@/lib/utils";

export const dynamic = "force-dynamic";

type MatchDetailRequest = {
  riotId?: string;
  matchId?: string;
};

export async function POST(request: Request) {
  let body: MatchDetailRequest;

  try {
    body = (await request.json()) as MatchDetailRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const riotId = body.riotId?.trim();
  const matchId = body.matchId?.trim();
  const parsedRiotId = riotId ? parseRiotId(riotId) : null;

  if (!riotId || !parsedRiotId) {
    return NextResponse.json(
      { ok: false, error: "Use Riot ID format Name#TAG.", code: "INVALID_RIOT_ID" },
      { status: 400 },
    );
  }

  if (!matchId) {
    return NextResponse.json(
      { ok: false, error: "Missing matchId.", code: "INVALID_MATCH_ID" },
      { status: 400 },
    );
  }

  try {
    console.info("[RiftLab API] selected matchId:", matchId);
    const account = await getAccountByRiotId(parsedRiotId.gameName, parsedRiotId.tagLine);
    const match = await getMatchById(matchId);
    const summary = summarizeParticipantMatch(match, account.puuid);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PARTICIPANT_PUUID_NOT_FOUND") {
      return NextResponse.json(
        {
          ok: false,
          error: "The resolved PUUID was not found in this match.",
          code: "PARTICIPANT_PUUID_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    if (error instanceof RiotApiError) {
      return NextResponse.json(
        { ok: false, error: mapRiotErrorMessage(error), code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unexpected Riot match detail error.", code: "RIOT_MATCH_UNKNOWN_ERROR" },
      { status: 500 },
    );
  }
}

function mapRiotErrorMessage(error: RiotApiError): string {
  switch (error.code) {
    case "RIOT_MATCH_NOT_FOUND":
      return "Match detail not found.";
    case "RIOT_AUTH_ERROR":
      return "The Riot API key is expired, invalid, or not authorized.";
    case "RIOT_RATE_LIMITED":
      return "Riot rate limit reached while loading match details. Try again later.";
    case "RIOT_UNSUPPORTED_ROUTE":
      return "Unsupported Match-V5 regional route. LAS should use americas.";
    default:
      return error.message || "Unknown Riot API error while loading match details.";
  }
}
