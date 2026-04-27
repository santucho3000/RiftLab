import Link from "next/link";
import { ArrowLeft, Shield, TrendingUp } from "lucide-react";
import { Header } from "@/components/Header";
import { MatchCard } from "@/components/MatchCard";
import { MvpNotice } from "@/components/MvpNotice";
import { PlayerProfileCard } from "@/components/PlayerProfileCard";
import { RecentRiotMatches, type MatchHistoryState } from "@/components/RecentRiotMatches";
import { ScoreCard } from "@/components/ScoreCard";
import {
  getAccountByRiotId,
  getMatchIdsByPuuid,
  getRiotAccountRegion,
  getRiotMatchRegion,
  isRiotApiConfigured,
  RiotApiError,
} from "@/lib/adapters";
import { getMockPlayerByRiotId, getMockRecentMatches } from "@/lib/mock/provider";
import type { RiotAccountDto } from "@/lib/adapters/riot-types";
import { decodeRiotIdParam, parseRiotId } from "@/lib/utils";

type PlayerPageProps = {
  params: Promise<{
    riotId: string;
  }>;
};

type PlayerResolveState =
  | {
      kind: "riot";
      decodedRiotId: string;
      account: RiotAccountDto;
      routing: string;
      matchHistory: MatchHistoryState;
    }
  | {
      kind: "mock-fallback";
      decodedRiotId: string;
      reason: PlayerErrorState;
      routing: string;
    }
  | {
      kind: "invalid";
      decodedRiotId: string | null;
      reason: PlayerErrorState;
    };

type PlayerErrorState = {
  title: string;
  message: string;
  code: string;
};

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { riotId: rawRiotIdParam } = await params;
  const state = await resolvePlayerRoute(rawRiotIdParam);

  if (state.kind === "riot") {
    return <ResolvedRiotPlayerPage state={state} />;
  }

  if (state.kind === "invalid") {
    return <InvalidPlayerPage state={state} />;
  }

  return <MockFallbackPlayerPage state={state} />;
}

async function resolvePlayerRoute(rawRiotIdParam: string): Promise<PlayerResolveState> {
  const decodedRiotId = decodeRiotIdParam(rawRiotIdParam);
  const parsedRiotId = decodedRiotId ? parseRiotId(decodedRiotId) : null;

  console.info("[RiftLab/player] raw route param:", rawRiotIdParam);
  console.info("[RiftLab/player] decoded Riot ID:", decodedRiotId);
  console.info("[RiftLab/player] parsed gameName:", parsedRiotId?.gameName ?? null);
  console.info("[RiftLab/player] parsed tagLine:", parsedRiotId?.tagLine ?? null);

  if (!decodedRiotId || !parsedRiotId) {
    return {
      kind: "invalid",
      decodedRiotId,
      reason: {
        title: "Invalid Riot ID format",
        message: "Use Riot ID format Name#TAG. Spaces inside the name are allowed.",
        code: "INVALID_RIOT_ID",
      },
    };
  }

  if (!isRiotApiConfigured()) {
    return {
      kind: "mock-fallback",
      decodedRiotId,
      routing: getRiotAccountRegion(),
      reason: {
        title: "Using mock fallback",
        message: "RIOT_API_KEY is not configured, so RiftLab is showing the mock MVP player.",
        code: "RIOT_API_KEY_MISSING",
      },
    };
  }

  try {
    const account = await getAccountByRiotId(parsedRiotId.gameName, parsedRiotId.tagLine);
    console.info("[RiftLab/player] PUUID resolved:", Boolean(account.puuid));
    const matchHistory = await resolveMatchHistory(account.puuid);

    return {
      kind: "riot",
      decodedRiotId,
      account,
      routing: getRiotAccountRegion(),
      matchHistory,
    };
  } catch (error) {
    return {
      kind: "mock-fallback",
      decodedRiotId,
      routing: getRiotAccountRegion(),
      reason: mapPlayerError(error),
    };
  }
}

async function resolveMatchHistory(puuid: string): Promise<MatchHistoryState> {
  let routing = "americas";

  try {
    routing = getRiotMatchRegion();
    console.info("[RiftLab/player] Match-V5 regional route used:", routing);
    const matchIds = await getMatchIdsByPuuid(puuid, 5);

    return {
      kind: "loaded",
      routing,
      matchIds,
    };
  } catch (error) {
    return {
      kind: "error",
      routing,
      reason: mapMatchHistoryError(error),
    };
  }
}

function mapPlayerError(error: unknown): PlayerErrorState {
  if (error instanceof RiotApiError) {
    switch (error.code) {
      case "RIOT_ACCOUNT_NOT_FOUND":
        return {
          title: "Riot account not found",
          message: "Riot Account-V1 did not find that Riot ID. Check the game name and tag line.",
          code: error.code,
        };
      case "RIOT_AUTH_ERROR":
        return {
          title: "Riot API key rejected",
          message: "The configured Riot API key is expired, invalid, or not authorized.",
          code: error.code,
        };
      case "RIOT_RATE_LIMITED":
        return {
          title: "Riot API rate limited",
          message: "Riot rate limit was reached. Wait a bit and try again.",
          code: error.code,
        };
      case "RIOT_BAD_REQUEST":
        return {
          title: "Riot rejected the request",
          message: "Riot rejected the Riot ID lookup request. Confirm the Riot ID format.",
          code: error.code,
        };
      default:
        return {
          title: "Unknown Riot API error",
          message: error.message || "Riot Account-V1 failed unexpectedly.",
          code: error.code,
        };
    }
  }

  return {
    title: "Unknown Riot API error",
    message: "RiftLab could not resolve this Riot ID due to an unexpected server error.",
    code: "RIOT_UNKNOWN_ERROR",
  };
}

function mapMatchHistoryError(error: unknown): PlayerErrorState {
  if (error instanceof RiotApiError) {
    switch (error.code) {
      case "RIOT_AUTH_ERROR":
        return {
          title: "Riot API key rejected",
          message: "The configured Riot API key is expired, invalid, or not authorized for Match-V5.",
          code: error.code,
        };
      case "RIOT_RATE_LIMITED":
        return {
          title: "Riot API rate limited",
          message: "Riot rate limit was reached while fetching recent match IDs. Try again later.",
          code: error.code,
        };
      case "RIOT_NO_MATCHES_FOUND":
        return {
          title: "No matches found",
          message: "Riot Match-V5 returned no recent League of Legends match IDs for this PUUID.",
          code: error.code,
        };
      case "RIOT_UNSUPPORTED_ROUTE":
        return {
          title: "Unsupported route",
          message: "The configured Match-V5 regional route is unsupported. LAS should use americas.",
          code: error.code,
        };
      default:
        return {
          title: "Unknown Riot API error",
          message: error.message || "Riot Match-V5 failed while fetching match IDs.",
          code: error.code,
        };
    }
  }

  return {
    title: "Unknown Riot API error",
    message: "RiftLab could not fetch Match-V5 match IDs due to an unexpected server error.",
    code: "RIOT_MATCH_UNKNOWN_ERROR",
  };
}

function ResolvedRiotPlayerPage({ state }: { state: Extract<PlayerResolveState, { kind: "riot" }> }) {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <BackLink />

        <section className="mt-7 section-primary">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Player dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-lab-text">
                {state.account.gameName}#{state.account.tagLine}
              </h1>
              <p className="mt-4 max-w-2xl body-copy text-lab-muted">
                Account resolved through Riot Account-V1. Match history integration is not
                implemented yet.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-sm text-lab-muted">
                <span className="quiet-surface px-3 py-2">Routing {state.routing}</span>
                <span className="quiet-surface px-3 py-2">Source Riot Account-V1</span>
                <span className="quiet-surface px-3 py-2 text-lab-green">PUUID resolved</span>
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-lab-cyan/25 bg-lab-cyan/10">
              <Shield className="h-7 w-7 text-lab-cyan" aria-hidden="true" />
            </div>
          </div>
        </section>

        <div className="mt-7">
          <MvpNotice />
        </div>

        <section className="mt-12 section-secondary">
          <p className="eyebrow">Next integration step</p>
          <h2 className="mt-3 text-2xl font-semibold text-lab-text">Account resolved</h2>
          <p className="mt-4 body-copy">
            Account resolved. Match detail and timeline integration are not implemented yet.
          </p>
        </section>

        <RecentRiotMatches riotId={state.decodedRiotId} matchHistory={state.matchHistory} />
      </div>
    </main>
  );
}

function InvalidPlayerPage({ state }: { state: Extract<PlayerResolveState, { kind: "invalid" }> }) {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <BackLink />
        <section className="mt-7 section-primary border-lab-red/25">
          <p className="eyebrow text-lab-red">Player lookup error</p>
          <h1 className="mt-3 text-3xl font-semibold text-lab-text">{state.reason.title}</h1>
          <p className="mt-4 body-copy">{state.reason.message}</p>
          <p className="mt-5 label-muted">Code: {state.reason.code}</p>
        </section>
      </div>
    </main>
  );
}

function MockFallbackPlayerPage({
  state,
}: {
  state: Extract<PlayerResolveState, { kind: "mock-fallback" }>;
}) {
  const player = getMockPlayerByRiotId(state.decodedRiotId);
  const recentMatches = getMockRecentMatches(player.id);
  const championRows = recentMatches.map((match) => ({
    champion: match.champion,
    role: match.role,
    result: match.result,
    impact: match.impactScore,
    team: match.teamScore,
  }));

  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <BackLink />

        <section className="mt-7 section-tertiary border-lab-amber/30 bg-lab-amber/[0.055]">
          <p className="eyebrow text-lab-amber">Mock fallback active</p>
          <h1 className="mt-3 text-2xl font-semibold text-lab-text">{state.reason.title}</h1>
          <p className="mt-3 body-copy">{state.reason.message}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-lab-muted">
            <span className="quiet-surface px-3 py-2">Requested {state.decodedRiotId}</span>
            <span className="quiet-surface px-3 py-2">Routing {state.routing}</span>
            <span className="quiet-surface px-3 py-2">Code {state.reason.code}</span>
          </div>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="section-primary">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">Player dashboard</p>
                <h2 className="mt-3 text-4xl font-semibold leading-tight text-lab-text">
                  {player.name}#{player.tag}
                </h2>
                <p className="mt-4 max-w-2xl body-copy text-lab-muted">
                  Showing mock MVP data because Riot Account-V1 did not produce a usable account
                  result for this request.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 text-sm text-lab-muted">
                  <span className="quiet-surface px-3 py-2">Region {player.region}</span>
                  <span className="quiet-surface px-3 py-2">
                    Main roles {player.mainRoles.join(" / ")}
                  </span>
                  <span className="quiet-surface px-3 py-2">
                    Mock route for {state.decodedRiotId}
                  </span>
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-md border border-lab-cyan/25 bg-lab-cyan/10">
                <Shield className="h-7 w-7 text-lab-cyan" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <ScoreCard label="Recent average Impact Score" score={player.averageImpactScore} />
            <ScoreCard label="Recent average Team Score" score={player.averageTeamScore} />
          </div>
        </section>

        <div className="mt-7">
          <MvpNotice />
        </div>

        <div className="mt-12">
          <PlayerProfileCard profile={player.profile} />
        </div>

        <section className="mt-12 section-secondary">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
            <div>
              <p className="eyebrow">Champion overview</p>
              <h2 className="mt-2 text-2xl font-semibold text-lab-text">
                Recent performance signals
              </h2>
            </div>
          </div>
          <div className="mt-7 overflow-x-auto rounded-md border border-white/[0.07]">
            <div className="grid min-w-[620px] grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr] bg-lab-panel3/60 px-5 py-4 label-muted">
              <span>Champion</span>
              <span>Role</span>
              <span>Result</span>
              <span>Impact</span>
              <span>Team</span>
            </div>
            {championRows.map((row) => (
              <div
                key={`${row.champion}-${row.impact}`}
                className="grid min-w-[620px] grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr] border-t border-white/[0.07] px-5 py-4 text-sm text-slate-300"
              >
                <span className="font-medium text-lab-text">{row.champion}</span>
                <span>{row.role}</span>
                <span>{row.result}</span>
                <span>{row.impact}</span>
                <span>{row.team}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6">
            <p className="eyebrow">Recent matches</p>
            <h2 className="mt-3 text-2xl font-semibold text-lab-text">
              Open a mock match report
            </h2>
            <p className="mt-2 body-copy text-lab-muted">
              Match cards are supporting evidence for the mock fallback profile.
            </p>
          </div>
          <div className="space-y-4">
            {recentMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-lab-muted transition hover:text-lab-cyan">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to search
    </Link>
  );
}
