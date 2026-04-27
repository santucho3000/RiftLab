import { Info } from "lucide-react";

export function MvpNotice() {
  return (
    <aside className="rounded-md border border-lab-amber/20 bg-lab-amber/[0.075] p-4 text-sm text-amber-100/90">
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-lab-amber" aria-hidden="true" />
        <p>
          <span className="font-semibold">MVP Notice:</span> This MVP uses mock data and a
          rules-based scoring model. Future versions will integrate Riot API match data and
          optional post-match VOD analysis.
        </p>
      </div>
    </aside>
  );
}
