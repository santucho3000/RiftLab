import type { TimelineEvent } from "@/lib/types";
import { toPercent } from "@/lib/utils";

type TimelineProps = {
  events: TimelineEvent[];
};

export function Timeline({ events }: TimelineProps) {
  return (
    <section className="section-tertiary">
      <p className="eyebrow">Key Events</p>
      <h2 className="mt-3 text-2xl font-semibold text-lab-text">Timeline of value windows</h2>
      <div className="mt-8 space-y-1">
        {events.map((event, index) => (
          <article key={`${event.timestamp}-${event.title}`} className="relative grid gap-5 pb-7 pl-10 sm:grid-cols-[92px_1fr] sm:pl-0">
            {index < events.length - 1 ? (
              <span className="absolute left-[11px] top-8 h-full w-px bg-white/[0.08] sm:left-[113px]" />
            ) : null}
            <time className="pt-1 text-sm font-semibold text-lab-cyan">{event.timestamp}</time>
            <div className="relative rounded-md border border-white/[0.07] bg-lab-panel2/60 p-5">
              <span className="absolute -left-[34px] top-5 h-3 w-3 rounded-full border border-lab-cyan bg-lab-bg sm:-left-[24px]" />
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-lab-text">{event.title}</h3>
                <span className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1 text-xs text-lab-muted">
                  {event.type}
                </span>
                <span className="rounded-md border border-lab-amber/25 bg-lab-amber/10 px-2 py-1 text-xs text-lab-amber">
                  {event.severity}
                </span>
              </div>
              <p className="mt-3 body-copy">{event.explanation}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <TimelineFact label="Cause" value={event.cause} />
                <TimelineFact label="Consequence" value={event.consequence} />
                <TimelineFact label="Value generated/lost" value={event.valueDelta} />
                <TimelineFact label="Affected metric" value={event.affectedMetric} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-lab-muted">
                <span>Confidence: {toPercent(event.confidence)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TimelineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="quiet-surface p-3">
      <p className="label-muted">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}
