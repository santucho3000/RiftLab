import { getScoreColorVariant } from "@/lib/scoring";
import { cn } from "@/lib/utils";

type ScoreCardProps = {
  label: string;
  score: number;
  detail?: string;
};

export function ScoreCard({ label, score, detail }: ScoreCardProps) {
  return (
    <section className="section-primary">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-3xl">
          <p className="label-muted">{label}</p>
          {detail ? <p className="mt-4 body-copy">{detail}</p> : null}
        </div>
        <div
          className={cn(
            "flex h-20 min-w-20 items-center justify-center rounded-md border px-4 text-3xl font-semibold shadow-panel-glow",
            getScoreColorVariant(score),
          )}
        >
          {score}
        </div>
      </div>
    </section>
  );
}
