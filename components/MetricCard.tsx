import type { MetricScore } from "@/lib/types";
import { getScoreColorVariant } from "@/lib/scoring";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  metric: MetricScore;
};

export function MetricCard({ metric }: MetricCardProps) {
  const isCost = metric.polarity === "cost";

  return (
    <article
      className={cn(
        "rounded-md border p-5",
        isCost ? "border-lab-red/25 bg-lab-red/[0.055]" : "border-white/[0.07] bg-lab-panel2/60",
      )}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <h3 className="text-lg font-semibold text-lab-text">{metric.name}</h3>
          <p className="mt-3 body-copy text-lab-muted">{metric.explanation}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm font-semibold",
              isCost
                ? "border-lab-red/40 bg-lab-red/10 text-lab-red"
                : getScoreColorVariant(metric.score),
            )}
          >
            {metric.displayValue ?? metric.score}
          </span>
          <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-300">
            {isCost ? "Penalty" : metric.status}
          </span>
        </div>
      </div>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
        {metric.evidence.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", isCost ? "bg-lab-red" : "bg-lab-cyan")} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
