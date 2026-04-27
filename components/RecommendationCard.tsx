import type { Recommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

type RecommendationCardProps = {
  recommendation: Recommendation;
};

const priorityStyles: Record<Recommendation["priority"], string> = {
  High: "border-lab-red/35 bg-lab-red/10 text-lab-red",
  Medium: "border-lab-amber/35 bg-lab-amber/10 text-lab-amber",
  Low: "border-lab-green/35 bg-lab-green/10 text-lab-green",
};

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  return (
    <article className="rounded-md border border-white/[0.07] bg-lab-panel2/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-lab-text">{recommendation.title}</h3>
        <span className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", priorityStyles[recommendation.priority])}>
          {recommendation.priority}
        </span>
      </div>
      <p className="mt-3 body-copy">{recommendation.explanation}</p>
      <p className="mt-5 label-muted">
        Related metric: {recommendation.relatedMetric}
      </p>
    </article>
  );
}
