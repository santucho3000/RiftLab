import { UsersRound } from "lucide-react";
import type { TeamReview as TeamReviewType } from "@/lib/types";

type TeamReviewProps = {
  review: TeamReviewType;
};

export function TeamReview({ review }: TeamReviewProps) {
  const items = [
    ["Team identity this match", review.identity],
    ["Best collective window", review.bestCollectiveWindow],
    ["Worst collective window", review.worstCollectiveWindow],
    ["Main team improvement priority", review.improvementPriority],
  ];

  return (
    <section className="section-secondary">
      <div className="flex items-center gap-3">
        <UsersRound className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
        <div>
          <p className="eyebrow">Team Review</p>
          <h2 className="mt-2 text-2xl font-semibold text-lab-text">
            Collective pattern behind the score
          </h2>
        </div>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {items.map(([label, value]) => (
          <article key={label} className="inner-surface p-5">
            <p className="label-muted">{label}</p>
            <p className="mt-3 body-copy">{value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
