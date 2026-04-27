import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import type { MatchSummary } from "@/lib/types";
import { getScoreColorVariant } from "@/lib/scoring";
import { cn } from "@/lib/utils";

type MatchCardProps = {
  match: MatchSummary;
};

export function MatchCard({ match }: MatchCardProps) {
  return (
    <article className="rounded-md border border-white/[0.07] bg-lab-panel/80 p-5 transition hover:border-lab-cyan/25 hover:bg-lab-panel2/80">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-black/24">
            <Swords className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{match.champion}</h3>
              <span className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-xs text-lab-muted">
                {match.role}
              </span>
              <span
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-semibold",
                  match.result === "Win"
                    ? "border-lab-green/35 bg-lab-green/10 text-lab-green"
                    : "border-lab-red/35 bg-lab-red/10 text-lab-red",
                )}
              >
                {match.result}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-lab-muted sm:grid-cols-5">
              <div>
                <dt className="label-muted">Duration</dt>
                <dd className="text-lab-text">{match.duration}</dd>
              </div>
              <div>
                <dt className="label-muted">KDA</dt>
                <dd className="text-lab-text">{match.kda}</dd>
              </div>
              <div>
                <dt className="label-muted">CS/min</dt>
                <dd className="text-lab-text">{match.csPerMinute}</dd>
              </div>
              <div>
                <dt className="label-muted">Gold/min</dt>
                <dd className="text-lab-text">{match.goldPerMinute}</dd>
              </div>
              <div>
                <dt className="label-muted">Vision</dt>
                <dd className="text-lab-text">{match.visionScore}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("rounded-md border px-3 py-2 text-sm font-semibold", getScoreColorVariant(match.impactScore))}>
            Impact {match.impactScore}
          </span>
          <span className={cn("rounded-md border px-3 py-2 text-sm font-semibold", getScoreColorVariant(match.teamScore))}>
            Team {match.teamScore}
          </span>
          <Link
            href={`/match/${match.id}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-lab-cyan/30 px-3 text-sm font-semibold text-lab-cyan transition hover:bg-lab-cyan/10"
          >
            Open report
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
