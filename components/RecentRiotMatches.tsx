"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getChainPriorityLabel,
  getUserFacingChainTypeLabel,
} from "@/lib/causal-impact/causal-impact-engine";
import {
  formatLaneForUser,
  formatStructureForUser,
} from "@/lib/formatters/riot-display";
import type { RiotMatchSummary, TimelineDiagnostics } from "@/lib/reports";
import { generatePreliminaryRiftLabReport } from "@/lib/scoring";
import type { PreliminaryRiftLabReport } from "@/lib/scoring";

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

type TimelineResponse =
  | {
      ok: true;
      diagnostics: TimelineDiagnostics;
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

type TimelineState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; diagnostics: TimelineDiagnostics }
  | { status: "error"; error: string; code: string };

type RecentRiotMatchesProps = {
  riotId: string;
  matchHistory: MatchHistoryState;
};

export function RecentRiotMatches({ riotId, matchHistory }: RecentRiotMatchesProps) {
  const [detailsByMatchId, setDetailsByMatchId] = useState<Record<string, DetailState>>({});
  const [timelinesByMatchId, setTimelinesByMatchId] = useState<Record<string, TimelineState>>({});

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

  async function loadTimeline(matchId: string) {
    setTimelinesByMatchId((current) => ({
      ...current,
      [matchId]: { status: "loading" },
    }));

    try {
      const response = await fetch("/api/riot/match-timeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ riotId, matchId }),
      });
      const result = (await response.json()) as TimelineResponse;

      if (!response.ok || !result.ok) {
        setTimelinesByMatchId((current) => ({
          ...current,
          [matchId]: {
            status: "error",
            error: result.ok ? "Unable to load timeline." : result.error,
            code: result.ok ? "RIOT_TIMELINE_ERROR" : result.code,
          },
        }));
        return;
      }

      setTimelinesByMatchId((current) => ({
        ...current,
        [matchId]: { status: "loaded", diagnostics: result.diagnostics },
      }));
    } catch {
      setTimelinesByMatchId((current) => ({
        ...current,
        [matchId]: {
          status: "error",
          error: "Could not reach the server-side timeline resolver.",
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
          Load one match at a time. Preliminary RiftLab reports are generated only after the match
          detail and timeline are available.
        </p>
      </div>
      <div className="mt-7 space-y-3">
        {matchHistory.matchIds.map((matchId) => {
          const detail = detailsByMatchId[matchId] ?? { status: "idle" };
          const timeline = timelinesByMatchId[matchId] ?? { status: "idle" };
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

              {detail.status === "loaded" ? (
                <RiotMatchSummaryCard
                  summary={detail.summary}
                  timeline={timeline}
                  onLoadTimeline={() => loadTimeline(matchId)}
                />
              ) : null}
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

function RiotMatchSummaryCard({
  summary,
  timeline,
  onLoadTimeline,
}: {
  summary: RiotMatchSummary;
  timeline: TimelineState;
  onLoadTimeline: () => void;
}) {
  const [preliminaryReport, setPreliminaryReport] = useState<PreliminaryRiftLabReport | null>(null);
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
  const canGenerateReport = timeline.status === "loaded";

  function handleGeneratePreliminaryReport() {
    if (timeline.status !== "loaded") {
      return;
    }

    setPreliminaryReport(generatePreliminaryRiftLabReport(summary, timeline.diagnostics));
  }

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
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            onClick={onLoadTimeline}
            disabled={timeline.status === "loading"}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-lab-cyan/30 px-3 text-sm font-semibold text-lab-cyan transition hover:bg-lab-cyan/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {timeline.status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading timeline
              </>
            ) : (
              "Load timeline"
            )}
          </button>
          <button
            onClick={handleGeneratePreliminaryReport}
            disabled={!canGenerateReport}
            className="min-h-10 rounded-md border border-lab-cyan/30 px-3 text-sm font-semibold text-lab-cyan transition hover:bg-lab-cyan/10 disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:text-lab-muted disabled:opacity-70"
          >
            Generate preliminary report
          </button>
        </div>
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
        MVP notice: match details and timelines are real Riot API data when loaded. The preliminary
        report uses a simple rules-based v0.1 scorer and does not analyze VOD, wave intent, or comms.
      </p>
      {timeline.status === "loaded" ? (
        <TimelineDiagnosticsPanel diagnostics={timeline.diagnostics} />
      ) : null}
      {preliminaryReport ? <PreliminaryReportPanel report={preliminaryReport} /> : null}
      {timeline.status === "error" ? (
        <div className="mt-5 rounded-md border border-lab-red/25 bg-lab-red/[0.055] p-4">
          <p className="font-semibold text-lab-red">{timeline.error}</p>
          <p className="mt-2 label-muted">Code: {timeline.code}</p>
        </div>
      ) : null}
    </div>
  );
}

function PreliminaryReportPanel({ report }: { report: PreliminaryRiftLabReport }) {
  const valueLost = report.metrics.find((metric) => metric.name === "Value Lost");
  const positiveMetrics = report.metrics.filter((metric) => metric.name !== "Value Lost");

  return (
    <section className="mt-7 rounded-md border border-lab-cyan/15 bg-lab-panel/90 p-5">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="eyebrow">{report.title}</p>
          <h5 className="mt-2 text-2xl font-semibold text-lab-text">Real data, conservative scoring</h5>
          <div className="mt-5 space-y-4">
            <InsightBlock label="Main value source" value={report.mainValueSource} tone="brand" />
            <InsightBlock label="Main value loss" value={report.mainValueLoss} tone="risk" />
            <InsightBlock
              label="Main improvement priority"
              value={report.mainImprovementPriority}
              tone="warning"
            />
          </div>
        </div>

        <div className="rounded-md border border-white/[0.07] bg-black/20 p-4">
          <p className="label-muted">Confidence</p>
          <p className="mt-2 text-xl font-semibold text-lab-text">{report.confidence}</p>
          <div className="mt-4 space-y-3">
            {report.confidenceNotes.map((note) => (
              <p key={note} className="text-sm leading-6 text-slate-300">
                {note}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-md border border-white/[0.07] bg-black/20 p-4">
          <p className="label-muted">Evidence</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            {report.evidence.map((item) => (
              <li key={item} className="border-l border-lab-cyan/30 pl-3">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {positiveMetrics.map((metric) => (
            <PreliminaryMetricCard key={metric.name} metric={metric} />
          ))}
          {valueLost ? <PreliminaryMetricCard metric={valueLost} /> : null}
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <SignalSummary
          label="Death frequency"
          value={`${report.signals.deathFrequency.deathCount} deaths`}
          detail={`${report.signals.deathFrequency.deathsPerMinute} deaths/min - ${report.signals.deathFrequency.severity} severity`}
        />
        <SignalSummary
          label="Objective windows"
          value={`${report.signals.deathBeforeObjective.length} before / ${report.signals.deathAfterObjective.length} after`}
          detail="Neutral objective timing windows detected from Match-V5 events."
        />
        <SignalSummary
          label="Structure cost"
          value={`${report.signals.structureLossAfterDeath.length} window(s)`}
          detail="Structures affecting your team within 75 seconds after death."
        />
      </div>

      <CausalImpactChainsSection report={report} />
      <TelemetryChartsSection report={report} />
      <DetectedWindowList report={report} />
    </section>
  );
}

function InsightBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "risk" | "warning";
}) {
  const toneClass =
    tone === "risk"
      ? "border-lab-red/25 bg-lab-red/[0.055]"
      : tone === "warning"
        ? "border-lab-amber/25 bg-lab-amber/[0.055]"
        : "border-lab-cyan/20 bg-lab-cyan/[0.055]";

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <p className="label-muted">{label}</p>
      <p className="mt-2 text-sm leading-7 text-slate-200">{value}</p>
    </div>
  );
}

function PreliminaryMetricCard({ metric }: { metric: PreliminaryRiftLabReport["metrics"][number] }) {
  const isCost = metric.polarity === "cost";
  const tone =
    isCost || metric.status === "Critical"
      ? "border-lab-red/25 bg-lab-red/[0.045]"
      : metric.status === "Weak"
        ? "border-lab-amber/25 bg-lab-amber/[0.045]"
        : metric.status === "Strong"
          ? "border-lab-green/25 bg-lab-green/[0.045]"
          : "border-white/[0.07] bg-black/20";

  return (
    <article className={`rounded-md border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-muted">{metric.name}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{metric.explanation}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={isCost ? "text-xl font-semibold text-lab-red" : "text-xl font-semibold text-lab-text"}>
            {metric.displayValue ?? metric.score}
          </p>
          <p className="mt-1 text-xs font-semibold text-lab-muted">{metric.status}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
        {metric.evidence.slice(0, 2).map((item) => (
          <li key={item} className="border-l border-white/10 pl-3">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function SignalSummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-black/20 p-4">
      <p className="label-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-lab-text">{value}</p>
      <p className="mt-2 text-sm leading-6 text-lab-muted">{detail}</p>
    </div>
  );
}

function CausalImpactChainsSection({ report }: { report: PreliminaryRiftLabReport }) {
  if (report.impactChains.length === 0) {
    return (
      <div className="mt-7 rounded-md border border-white/[0.07] bg-black/20 p-4">
        <p className="label-muted">Causal Impact Chains</p>
        <p className="mt-3 text-sm leading-6 text-lab-muted">
          No causal impact chains were detected in this preliminary Riot API-only pass.
        </p>
      </div>
    );
  }

  const visibleChains = report.impactChains.slice(0, 5);
  const hiddenChainCount = Math.max(report.impactChains.length - visibleChains.length, 0);

  return (
    <div className="mt-7 rounded-md border border-white/[0.07] bg-black/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-muted">Top Causal Impact Chains</p>
          <h6 className="mt-2 text-lg font-semibold text-lab-text">Timing-based impact paths</h6>
        </div>
        <p className="text-sm text-lab-muted">{visibleChains.length} shown / {report.impactChains.length} detected</p>
      </div>
      {hiddenChainCount > 0 ? (
        <p className="mt-3 text-sm leading-6 text-lab-muted">
          {hiddenChainCount} additional low-priority chain(s) detected.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {visibleChains.map((chain) => (
          <article key={chain.id} className="rounded-md border border-white/[0.06] bg-lab-panel2/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-lab-text">{chain.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{chain.userFacingSummary}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                <ChainBadge value={chain.classification} />
                <ChainBadge value={chain.severity} />
                {chain.causalConfidence === "low" ? <ChainBadge value="low-confidence" /> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-lab-muted sm:grid-cols-2">
              <ChainFact label="Type" value={getUserFacingChainTypeLabel(chain)} />
              <ChainFact label="Time" value={`${chain.startTime} to ${chain.endTime}`} />
              <ChainFact label="Classification" value={chain.classification} />
              <ChainFact label="Value" value={chain.valueDirection} />
              <ChainFact label="Evidence" value={chain.evidenceConfidence} />
              <ChainFact label="Causality" value={chain.causalConfidence} />
              {chain.laneRelevance ? <ChainFact label="Lane relevance" value={chain.laneRelevance} /> : null}
              {chain.importanceScore !== undefined ? (
                <ChainFact label="Priority" value={getChainPriorityLabel(chain.importanceScore)} />
              ) : null}
              <ChainFact label="Delta" value={`${chain.valueDelta.label} (${chain.valueDelta.scoreImpact})`} />
            </div>

            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
              <ChainStep label="Cause" value={chain.cause.description} />
              <ChainStep label="Window" value={chain.window.description} />
              <ChainStep label="Consequence" value={chain.consequence.description} />
              <ChainStep label="Map impact" value={chain.mapImpact.description} />
            </div>

            <p className="mt-4 text-xs leading-5 text-lab-muted">
              Affected metrics: {chain.affectedMetrics.join(", ")}.
            </p>
            {chain.supportingChainIds && chain.supportingChainIds.length > 0 ? (
              <p className="mt-2 text-xs leading-5 text-lab-muted">
                Supporting lower-priority chain(s): {chain.supportingChainIds.length}.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function ChainBadge({ value }: { value: string }) {
  const tone =
    value === "positive" || value === "High"
      ? "border-lab-green/25 bg-lab-green/[0.06] text-lab-green"
      : value === "negative" || value === "low-confidence"
        ? "border-lab-red/25 bg-lab-red/[0.06] text-lab-red"
        : value === "trade" || value === "neutral" || value === "Low"
          ? "border-lab-amber/25 bg-lab-amber/[0.06] text-lab-amber"
          : "border-lab-cyan/25 bg-lab-cyan/[0.06] text-lab-cyan";

  return (
    <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {value}
    </span>
  );
}

function ChainFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
      <span className="font-semibold text-slate-400">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function ChainStep({ label, value }: { label: string; value: string }) {
  return (
    <p className="border-l border-lab-cyan/20 pl-3">
      <span className="font-semibold text-slate-200">{label}: </span>
      {value}
    </p>
  );
}

function TelemetryChartsSection({ report }: { report: PreliminaryRiftLabReport }) {
  return (
    <section className="mt-7 rounded-md border border-white/[0.07] bg-black/20 p-4">
      <div>
        <p className="label-muted">Telemetry Charts</p>
        <h6 className="mt-2 text-lg font-semibold text-lab-text">Real API progression signals</h6>
        <p className="mt-2 text-sm leading-6 text-lab-muted">
          These charts use Match-V5 detail and timeline fields only. They do not infer wave state,
          positioning, rotation quality, or vision intent.
        </p>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <TelemetryLineChart
          title="Gold progression"
          subtitle="Player total gold from timeline frame snapshots."
          data={report.telemetryCharts.goldProgression}
          dataKey="totalGold"
          emptyText="Not enough timeline data to render this chart."
        />
        <TelemetryLineChart
          title="CS progression"
          subtitle="Total CS with lane and jungle CS retained in chart data."
          data={report.telemetryCharts.csProgression}
          dataKey="totalCs"
          emptyText="Not enough timeline data to render this chart."
        />
        <TelemetryBarChart
          title="Metric scores"
          subtitle="Value Lost is a cost/risk signal, not a positive contribution score."
          data={report.telemetryCharts.metricScores}
          dataKey="value"
          emptyText="No metric score data available."
          color="#45D4FF"
        />
        <TelemetryBarChart
          title="Event counts"
          subtitle="Counts from detected API windows and causal chains."
          data={report.telemetryCharts.eventCounts}
          dataKey="value"
          emptyText="No event count data available."
          color="#F6C85F"
        />
        <TelemetryLineChart
          title="Gold/min checkpoints"
          subtitle="Gold per minute at available timeline snapshot checkpoints."
          data={report.telemetryCharts.goldPerMinuteCheckpoints}
          dataKey="goldPerMinute"
          emptyText="Not enough timeline data to render this chart."
        />
      </div>
    </section>
  );
}

const chartAxisStyle = {
  tick: { fill: "#92A0B4", fontSize: 12 },
  axisLine: { stroke: "#202A38" },
  tickLine: { stroke: "#202A38" },
};

const chartTooltipStyle = {
  backgroundColor: "#0D121B",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 6,
  color: "#E7EEF8",
};

function TelemetryChartFrame({
  title,
  subtitle,
  isEmpty,
  emptyText,
  children,
}: {
  title: string;
  subtitle: string;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-md border border-white/[0.06] bg-lab-panel2/50 p-4">
      <p className="font-semibold text-lab-text">{title}</p>
      <p className="mt-2 text-sm leading-6 text-lab-muted">{subtitle}</p>
      <div className="mt-4 h-56">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center rounded-md border border-white/[0.06] bg-black/20 px-4 text-center text-sm text-lab-muted">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </article>
  );
}

function TelemetryLineChart({
  title,
  subtitle,
  data,
  dataKey,
  emptyText,
}: {
  title: string;
  subtitle: string;
  data: Array<Record<string, number>>;
  dataKey: string;
  emptyText: string;
}) {
  return (
    <TelemetryChartFrame title={title} subtitle={subtitle} isEmpty={data.length === 0} emptyText={emptyText}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#202A38" strokeDasharray="3 3" />
          <XAxis dataKey="minute" {...chartAxisStyle} tickFormatter={(value: number) => `${value}m`} />
          <YAxis {...chartAxisStyle} />
          <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(value) => `${value} minutes`} />
          <Line type="monotone" dataKey={dataKey} stroke="#45D4FF" strokeWidth={3} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </TelemetryChartFrame>
  );
}

function TelemetryBarChart({
  title,
  subtitle,
  data,
  dataKey,
  emptyText,
  color,
}: {
  title: string;
  subtitle: string;
  data: Array<{ label: string; [key: string]: string | number }>;
  dataKey: string;
  emptyText: string;
  color: string;
}) {
  return (
    <TelemetryChartFrame title={title} subtitle={subtitle} isEmpty={data.length === 0} emptyText={emptyText}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 20, bottom: 0 }}>
          <CartesianGrid stroke="#202A38" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" {...chartAxisStyle} />
          <YAxis type="category" dataKey="label" width={120} {...chartAxisStyle} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Bar dataKey={dataKey} fill={color} radius={[0, 5, 5, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </TelemetryChartFrame>
  );
}

function DetectedWindowList({ report }: { report: PreliminaryRiftLabReport }) {
  const windows = [
    ...report.signals.deathBeforeObjective.map((signal) => ({
      title: "Death before objective",
      detail: `${signal.deathTimestamp} death preceded ${signal.objectiveWindowLabel} by ${signal.secondsBeforeObjective}s. Killer team: ${signal.killerTeam}.`,
      severity: signal.severity,
    })),
    ...report.signals.deathAfterObjective.map((signal) => ({
      title: "Post-objective tempo loss",
      detail: `${signal.objectiveWindowLabel}, death ${signal.secondsAfterObjective}s later at ${signal.deathTimestamp}.`,
      severity: signal.severity,
    })),
    ...report.signals.structureLossAfterDeath.map((signal) => ({
      title: "Structure loss after death",
      detail: getStructureLossWindowDetail(signal),
      severity: signal.severity,
    })),
  ];

  if (windows.length === 0) {
    return (
      <div className="mt-7 rounded-md border border-white/[0.07] bg-black/20 p-4">
        <p className="label-muted">Detected value-loss windows</p>
        <p className="mt-3 text-sm leading-6 text-lab-muted">
          No objective or structure value-loss windows were detected in this preliminary pass.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-md border border-white/[0.07] bg-black/20 p-4">
      <p className="label-muted">Detected value-loss windows</p>
      <div className="mt-4 space-y-3">
        {windows.slice(0, 6).map((window, index) => (
          <div
            key={`${window.title}-${index}`}
            className="rounded-md border border-white/[0.06] bg-lab-panel2/50 p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-lab-text">{window.title}</p>
              <span className="w-fit rounded-md border border-lab-amber/25 bg-lab-amber/[0.06] px-2 py-1 text-xs font-semibold text-lab-amber">
                {window.severity}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{window.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStructureLossWindowDetail(
  signal: PreliminaryRiftLabReport["signals"]["structureLossAfterDeath"][number],
): string {
  const structure = formatStructureForUser(signal.lane, signal.towerType ?? signal.buildingType);
  const baseDetail = `Your death at ${signal.deathTimestamp} was followed by an allied ${structure} falling ${signal.secondsAfterDeath}s later.`;

  if (signal.laneRelevance === "low") {
    return `${baseDetail} ${signal.relevanceExplanation}`;
  }

  if (signal.laneRelevance === "high") {
    return `${baseDetail} High relevance structure-loss window; causal confidence ${signal.causalConfidence}.`;
  }

  if (signal.laneRelevance === "medium") {
    return `${baseDetail} May have contributed to a medium relevance structure-loss association; causal confidence ${signal.causalConfidence}.`;
  }

  return `${baseDetail} Low-confidence structure-loss association; causal confidence ${signal.causalConfidence}.`;
}

function TimelineDiagnosticsPanel({ diagnostics }: { diagnostics: TimelineDiagnostics }) {
  return (
    <section className="mt-7 rounded-md border border-white/[0.07] bg-lab-panel/80 p-5">
      <div>
        <p className="eyebrow">Timeline Diagnostics</p>
        <h5 className="mt-2 text-xl font-semibold text-lab-text">Raw Match-V5 timeline signals</h5>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-lab-muted">
          <span className="quiet-surface px-3 py-2">Participant ID {diagnostics.participantId}</span>
          <span className="quiet-surface px-3 py-2">Frames {diagnostics.frameCount}</span>
          <span className="quiet-surface px-3 py-2">Events parsed {diagnostics.parsedEventCount}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <DiagnosticList title="Player death events" emptyText="No player deaths found in timeline.">
          {diagnostics.playerDeaths.map((event, index) => (
            <DiagnosticRow key={`${event.timestamp}-${index}`}>
              <span>{event.timestamp}</span>
              <span>Killer: {event.killerParticipantId ?? "Unknown"}</span>
              <span>
                Assists:{" "}
                {event.assistingParticipantIds.length > 0
                  ? event.assistingParticipantIds.join(", ")
                  : "None"}
              </span>
            </DiagnosticRow>
          ))}
        </DiagnosticList>

        <DiagnosticList title="Elite monster events" emptyText="No elite monster events found.">
          {diagnostics.eliteMonsterEvents.map((event, index) => (
            <DiagnosticRow key={`${event.timestamp}-${event.monsterType}-${index}`}>
              <span>{event.timestamp}</span>
              <span>
                {event.monsterType}
                {event.monsterSubType ? ` (${event.monsterSubType})` : ""}
              </span>
              <span>Killer team: {event.killerTeam}</span>
            </DiagnosticRow>
          ))}
        </DiagnosticList>

        <DiagnosticList title="Building events" emptyText="No building events found.">
          {diagnostics.buildingEvents.map((event, index) => (
            <DiagnosticRow key={`${event.timestamp}-${event.buildingType}-${index}`}>
              <span>{event.timestamp}</span>
              <span>{formatStructureForUser(event.laneType, event.towerType ?? event.buildingType)}</span>
              <span>
                Team affected: {event.teamAffected}
                {event.laneType ? ` - ${formatLaneForUser(event.laneType)}` : ""}
              </span>
            </DiagnosticRow>
          ))}
        </DiagnosticList>

        <DiagnosticList title="Player frame snapshots" emptyText="No 5-minute snapshots found.">
          {diagnostics.frameSnapshots.map((snapshot) => (
            <DiagnosticRow key={snapshot.minute}>
              <span>{snapshot.minute}m</span>
              <span>
                Gold {snapshot.currentGold} current / {snapshot.totalGold} total
              </span>
              <span>
                Lv {snapshot.level} - CS {snapshot.minionsKilled} lane /{" "}
                {snapshot.jungleMinionsKilled} jungle
              </span>
              <span>
                Position:{" "}
                {snapshot.position
                  ? `${snapshot.position.x}, ${snapshot.position.y}`
                  : "Unavailable"}
              </span>
            </DiagnosticRow>
          ))}
        </DiagnosticList>
      </div>
    </section>
  );
}

function DiagnosticList({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="rounded-md border border-white/[0.07] bg-black/20 p-4">
      <p className="label-muted">{title}</p>
      <div className="mt-4 space-y-3">
        {hasChildren ? children : <p className="text-sm text-lab-muted">{emptyText}</p>}
      </div>
    </div>
  );
}

function DiagnosticRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-lab-panel2/50 p-3 text-sm leading-6 text-slate-300">
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
