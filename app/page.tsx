import { BarChart3, Clock3, Crosshair, LineChart, Radar, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { MvpNotice } from "@/components/MvpNotice";
import { SearchPlayer } from "@/components/SearchPlayer";

const features = [
  {
    title: "Individual Impact Score",
    copy: "Explains direct value, pressure, information, objective contribution, conversion, and value lost.",
    icon: Crosshair,
  },
  {
    title: "Team Performance Score",
    copy: "Separates individual output from team setup, tempo sync, pressure conversion, and throw risk.",
    icon: Users,
  },
  {
    title: "Objective & Vision Analysis",
    copy: "Frames neutral objectives around the conditions that made them possible, not only who last-hit them.",
    icon: Radar,
  },
  {
    title: "Timeline of Key Events",
    copy: "Turns match moments into readable cause-and-effect windows with severity and confidence.",
    icon: Clock3,
  },
  {
    title: "Recommendations",
    copy: "Ends each report with concrete individual and team adjustments tied to the weakest metrics.",
    icon: LineChart,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="lab-grid border-b border-white/[0.07]">
        <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl content-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-md border border-lab-cyan/20 bg-lab-cyan/[0.08] px-3 py-2 eyebrow">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Competitive performance lab
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-lab-text sm:text-6xl">
              RiftLab
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-300">
              Post-match telemetry for League of Legends players and teams. We do not only
              measure what you did. We measure what you made possible.
            </p>
            <div className="mt-8 max-w-2xl">
              <SearchPlayer />
            </div>
            <div className="mt-6 max-w-2xl">
              <MvpNotice />
            </div>
          </div>

          <div className="section-primary">
            <div className="rounded-md border border-lab-cyan/16 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="label-muted text-lab-cyan/80">Sample report</p>
                  <h2 className="mt-3 text-2xl font-semibold">Azir mid impact chain</h2>
                </div>
                <span className="rounded-md border border-lab-green/30 bg-lab-green/10 px-4 py-3 text-2xl font-semibold text-lab-green">
                  84
                </span>
              </div>
              <div className="mt-7 space-y-3">
                {[
                  ["09:40", "Mid push created Herald access"],
                  ["10:15", "Herald converted into mid tower"],
                  ["18:20", "Teamfight win became map control"],
                  ["27:45", "Shutdown death raised throw risk"],
                ].map(([time, text]) => (
                  <div key={time} className="grid grid-cols-[62px_1fr] gap-4 rounded-md border border-white/[0.07] bg-lab-panel2/60 p-4">
                    <span className="text-sm font-semibold text-lab-cyan">{time}</span>
                    <span className="text-sm leading-6 text-slate-300">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="eyebrow">MVP modules</p>
          <h2 className="mt-3 text-3xl font-semibold text-lab-text">From scoreboard stats to causal telemetry</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-md border border-white/[0.07] bg-lab-panel/90 p-5">
                <Icon className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-lab-text">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-lab-muted">{feature.copy}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
