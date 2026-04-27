"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { RiotMatchSummary } from "@/lib/reports";

export type MatchHistoryState =
  | {
      kind: "loaded";
      routing: string;
      matchIds: string[];
    }
  | {
      kind: "error";
      routing: string;
      reason: {
        title: string;
        message: string;
        code: string;
      };
    };

type MatchDetailResponse =
  | {
      ok: true;
      summary: RiotMatchSummary;
    }
  | {
      ok: false;
      error: string;
      code: string;
    };

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; summary: RiotMatchSummary }
  | { status: "error"; error: string; code: string };

type RecentRiotMatchesProps = {
  riotId: string;
  matchHistory: MatchHistoryState;
};

export function RecentRiotMatches({ riotId, matchHistory }: RecentRiotMatchesProps) {
  const [detailsByMatchId, setDetailsByMatchId] = useState<Record<string, DetailState>>({});

  async function loadMatchDetails(matchId: string) {
    setDetailsByMatchId((current) => ({
      ...current,
      [matchId]: { status: "loading" },
    }));

    try {
      const response = await fetch("/api/riot/match-detail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ riotId, matchId }),
      });
      const result = (await response.json()) as MatchDetailResponse;

      if (!response.ok || !result.ok) {
        setDetailsByMatchId((current) => ({
          ...current,
          [matchId]: {
            status: "error",
            error: result.ok ? "Unable to load match detail." : result.error,
            code: result.ok ? "RIOT_MATCH_DETAIL_ERROR" : result.code,
          },
        }));
        return;
      }

      setDetailsByMatchId((current) => ({
        ...current,
        [matchId]: { status: "loaded", summary: result.summary },
      }));
    } catch {
      setDetailsByMatchId((current) => ({
        ...current,
        [matchId]: {
          status: "error",
          error: "Could not reach the server-side match detail resolver.",
          code: "NETWORK_ERROR",
        },
      }));
    }
  }

  if (matchHistory.kind === "error") {
    return (
      <section className="mt-12 section-secondary border-lab-amber/25">
        <p className="eyebrow text-lab-amber">Recent Riot Matches</p>
        <h2 className="mt-3 text-2xl font-semibold text-lab-text">{matchHistory.reason.title}</h2>
        <p className="mt-4 body-copy">{matchHistory.reason.message}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm text-lab-muted">
          <span className="quiet-surface px-3 py-2">Source Riot Match-V5</span>
          <span className="quiet-surface px-3 py-2">Routing {matchHistory.routing}</span>
          <span className="quiet-surface px-3 py-2">Code {matchHistory.reason.code}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 section-secondary">
      <div>
        <p className="eyebrow">Recent Riot Matches</p>
        <h2 className="mt-3 text-2xl font-semibold text-lab-text">Latest Match-V5 IDs</h2>
        <p className="mt-3 body-copy text-lab-muted">
          Load one match at a time. Timelines and RiftLab impact reports are intentionally not
          generated yet.
        </p>
      </div>
      <div className="mt-7 space-y-3">
        {matchHistory.matchIds.map((matchId) => {
          const detail = detailsByMatchId[matchId] ?? { status: "idle" };
          const isLoading = detail.status === "loading";

          return (
            <article
              key={matchId}
              className="rounded-md border border-white/[0.07] bg-lab-panel2/60 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="label-muted">Match ID</p>
                  <h3 className="mt-2 break-all text-lg font-semibold text-lab-text">{matchId}</h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-lab-muted">
                    <span className="quiet-surface px-3 py-2">Source Riot Match-V5</span>
                    <span className="quiet-surface px-3 py-2">Routing {matchHistory.routing}</span>
                    <span className="quiet-surface px-3 py-2">
                      {detail.status === "loaded" ? "Match detail loaded" : "Match detail not loaded yet"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => loadMatchDetails(matchId)}
                  disabled={isLoading}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-lab-cyan/30 px-3 text-sm font-semibold text-lab-cyan transition hover:bg-lab-cyan/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading
                    </>
                  ) : (
                    "Load match details"
                  )}
                </button>
              </div>

              {detail.status === "loaded" ? <RiotMatchSummaryCard summary={detail.summary} /> : null}
              {detail.status === "error" ? (
                <div className="mt-5 rounded-md border border-lab-red/25 bg-lab-red/[0.055] p-4">
                  <p className="font-semibold text-lab-red">{detail.error}</p>
                  <p className="mt-2 label-muted">Code: {detail.code}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RiotMatchSummaryCard({ summary }: { summary: RiotMatchSummary }) {
  const stats = [
    ["Champion", summary.championName],
    ["Position", summary.position],
    ["Result", summary.result],
    ["Duration", summary.duration],
    ["KDA", `${summary.kills} / ${summary.deaths} / ${summary.assists}`],
    ["Total CS", summary.totalCs],
    ["CS/min", summary.csPerMinute],
    ["Gold", summary.goldEarned],
    ["Gold/min", summary.goldPerMinute],
    ["Vision", summary.visionScore],
    ["Level", summary.summonerLevel ?? "Unavailable"],
    ["Team side", summary.teamSide],
  ];

  return (
    <div className="mt-6 rounded-md border border-lab-cyan/15 bg-black/20 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Real match summary</p>
          <h4 className="mt-2 text-2xl font-semibold text-lab-text">
            {summary.championName} - {summary.result}
          </h4>
          <p className="mt-2 break-all text-sm text-lab-muted">Match ID: {summary.matchId}</p>
        </div>
        <button
          disabled
          className="min-h-10 rounded-md border border-white/[0.08] px-3 text-sm font-semibold text-lab-muted opacity-70"
        >
          Generate preliminary report
        </button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="quiet-surface p-4">
            <p className="label-muted">{label}</p>
            <p className="mt-2 font-semibold text-lab-text">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 body-copy text-lab-muted">
        MVP notice: match details are loaded, but preliminary report generation, scoring, champion
        icons, and timeline analysis are not connected yet.
      </p>
    </div>
  );
}
