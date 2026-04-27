import { NextResponse } from "next/server";
import {
  getAccountByRiotId,
  getRiotAccountRegion,
  isRiotApiConfigured,
  RiotApiError,
} from "@/lib/adapters";
import { parseRiotId } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ResolveAccountRequest = {
  riotId?: string;
};

export async function POST(request: Request) {
  let body: ResolveAccountRequest;

  try {
    body = (await request.json()) as ResolveAccountRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const riotId = body.riotId?.trim();
  const parsedRiotId = riotId ? parseRiotId(riotId) : null;

  if (!riotId || !parsedRiotId) {
    return NextResponse.json(
      { ok: false, error: "Use Riot ID format Name#TAG.", code: "INVALID_RIOT_ID" },
      { status: 400 },
    );
  }

  if (!isRiotApiConfigured()) {
    return NextResponse.json({
      ok: true,
      mode: "mock",
      riotId,
      routing: getRiotAccountRegion(),
      account: null,
      message: "RIOT_API_KEY is not configured. Using mock RiftLab data.",
    });
  }

  try {
    const account = await getAccountByRiotId(parsedRiotId.gameName, parsedRiotId.tagLine);

    return NextResponse.json({
      ok: true,
      mode: "riot",
      riotId: `${account.gameName}#${account.tagLine}`,
      routing: getRiotAccountRegion(),
      account,
    });
  } catch (error) {
    if (error instanceof RiotApiError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unexpected Riot account lookup error.", code: "RIOT_UNKNOWN_ERROR" },
      { status: 500 },
    );
  }
}
