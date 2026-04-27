import type { MetricScore } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";

type MetricBreakdownProps = {
  title: string;
  eyebrow: string;
  metrics: MetricScore[];
};

export function MetricBreakdown({ title, eyebrow, metrics }: MetricBreakdownProps) {
  return (
    <section className="section-secondary">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold text-lab-text">{title}</h2>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {metrics.map((metric) => (
          <MetricCard key={metric.name} metric={metric} />
        ))}
      </div>
    </section>
  );
}
