import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flag, Gauge, Layers3 } from "lucide-react";
import {
  GoldDiffChart,
  MetricBarChart,
  PhaseImpactChart,
} from "@/components/ChartCard";
import { Header } from "@/components/Header";
import { ImpactChain } from "@/components/ImpactChain";
import { MatchDiagnosis } from "@/components/MatchDiagnosis";
import { MetricBreakdown } from "@/components/MetricBreakdown";
import { MvpNotice } from "@/components/MvpNotice";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ScoreCard } from "@/components/ScoreCard";
import { TeamReview } from "@/components/TeamReview";
import { Timeline } from "@/components/Timeline";
import { getConfidenceLabel } from "@/lib/scoring";
import { getMockMatchReport } from "@/lib/mock/provider";
import { toPercent } from "@/lib/utils";

type MatchPageProps = {
  params: Promise<{
    matchId: string;
  }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { matchId } = await params;
  const report = getMockMatchReport(matchId);

  if (!report) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/player/${encodeURIComponent(report.player.riotId)}`}
          className="inline-flex items-center gap-2 text-sm text-lab-muted transition hover:text-lab-cyan"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to player dashboard
        </Link>

        <section className="mt-7 rounded-md border border-white/[0.08] bg-lab-panel p-7 shadow-panel-glow sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-start">
            <div>
              <p className="eyebrow">Match report</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-lab-text">
                {report.champion} {report.role} telemetry
              </h1>
              <p className="mt-4 max-w-3xl body-copy text-lab-muted">
                {report.player.name}#{report.player.tag} - {report.gameMode} - {report.patch}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-2">
              {[
                ["Result", report.result],
                ["Duration", report.duration],
                ["Team side", report.teamSide],
                ["Region", report.player.region],
                ["Confidence", `${getConfidenceLabel(report.confidence)} (${toPercent(report.confidence)})`],
                ["Match ID", report.id],
              ].map(([label, value]) => (
                <div key={label} className="quiet-surface p-4">
                  <dt className="label-muted">{label}</dt>
                  <dd className="mt-1 font-medium text-lab-text">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="mt-7">
          <MvpNotice />
        </div>

        <div className="mt-12">
          <MatchDiagnosis diagnosis={report.matchDiagnosis} />
        </div>

        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <ScoreCard
            label="Individual Impact Score"
            score={report.individualImpactScore}
            detail={report.mainValueSource}
          />
          <ScoreCard
            label="Team Performance Score"
            score={report.teamPerformanceScore}
            detail={report.mainValueLoss}
          />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_0.9fr]">
          <div className="section-primary shadow-none">
            <Gauge className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-semibold">Main value source</h2>
            <p className="mt-4 body-copy">{report.mainValueSource}</p>
          </div>
          <div className="section-primary border-lab-red/20 shadow-none">
            <Flag className="h-5 w-5 text-lab-red" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-semibold">Main value loss</h2>
            <p className="mt-4 body-copy">{report.mainValueLoss}</p>
          </div>
          <div className="section-secondary shadow-none">
            <Layers3 className="h-5 w-5 text-lab-amber" aria-hidden="true" />
            <h2 className="mt-5 text-xl font-semibold">Team-level issue</h2>
            <p className="mt-4 body-copy">{report.teamLevelIssue}</p>
          </div>
        </section>

        <div className="mt-12">
          <ImpactChain chain={report.impactChain} />
        </div>

        <section className="mt-10 grid gap-5 lg:grid-cols-1">
          <div className="section-tertiary">
            <Layers3 className="h-5 w-5 text-lab-amber" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold">Confidence level</h2>
            <p className="mt-3 body-copy">
              {getConfidenceLabel(report.confidence)} confidence at {toPercent(report.confidence)}.
              This is intentionally visible because mock scoring should remain explainable and auditable.
            </p>
          </div>
        </section>

        <div className="mt-12 space-y-10">
          <MetricBreakdown
            eyebrow="Individual metrics"
            title="What you did and what it made possible"
            metrics={report.individualMetrics}
          />
          <MetricBreakdown
            eyebrow="Team metrics"
            title="How the team converted shared windows"
            metrics={report.teamMetrics}
          />
          <TeamReview review={report.teamReview} />
          <Timeline events={report.timelineEvents} />
        </div>

        <section className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="section-tertiary">
            <p className="eyebrow">Individual recommendations</p>
            <div className="mt-7 space-y-4">
              {report.individualRecommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.title} recommendation={recommendation} />
              ))}
            </div>
          </div>
          <div className="section-tertiary">
            <p className="eyebrow">Team recommendations</p>
            <div className="mt-7 space-y-4">
              {report.teamRecommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.title} recommendation={recommendation} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-5 xl:grid-cols-2">
          <GoldDiffChart data={report.charts.goldDiffOverTime} />
          <PhaseImpactChart data={report.charts.impactByPhase} />
          <MetricBarChart
            title="Individual metric scores"
            subtitle="Direct, pressure, information, objective, conversion, and value lost as a penalty signal."
            data={report.charts.individualMetricScores}
            color="#45D4FF"
          />
          <MetricBarChart
            title="Team metric scores"
            subtitle="Objective setup, vision control, tempo, conversion, fights, and throw risk."
            data={report.charts.teamMetricScores}
            color="#F6C85F"
          />
        </section>
      </div>
    </main>
  );
}
