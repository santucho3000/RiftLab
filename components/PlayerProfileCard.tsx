import { UserRoundSearch } from "lucide-react";
import type { PlayerProfile } from "@/lib/types";

type PlayerProfileCardProps = {
  profile: PlayerProfile;
};

export function PlayerProfileCard({ profile }: PlayerProfileCardProps) {
  return (
    <section className="section-primary">
      <div className="flex items-center gap-3">
        <UserRoundSearch className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
        <div>
          <p className="eyebrow">Player Profile</p>
          <h2 className="mt-2 text-2xl font-semibold text-lab-text">{profile.archetype}</h2>
        </div>
      </div>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <ProfileList title="Top strengths" items={profile.strengths} accent="cyan" />
        <ProfileList title="Top weaknesses" items={profile.weaknesses} accent="amber" />
      </div>
      <div className="mt-5 rounded-md border border-lab-cyan/20 bg-lab-cyan/[0.075] p-5">
        <p className="label-muted text-lab-cyan/80">
          Most common improvement priority
        </p>
        <p className="mt-3 body-copy text-slate-200">{profile.improvementPriority}</p>
      </div>
    </section>
  );
}

function ProfileList({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "cyan" | "amber";
}) {
  const dotClass = accent === "cyan" ? "bg-lab-cyan" : "bg-lab-amber";

  return (
    <div className="inner-surface p-5">
      <p className="label-muted">{title}</p>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
