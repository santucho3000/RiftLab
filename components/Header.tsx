import Link from "next/link";
import { Activity, FlaskConical } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-lab-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-lab-cyan/25 bg-lab-cyan/10">
            <FlaskConical className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-lab-cyan">
              RiftLab
            </span>
            <span className="block text-xs text-lab-muted">Post-match telemetry</span>
          </span>
        </Link>
        <div className="hidden items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-lab-muted sm:flex">
          <Activity className="h-4 w-4 text-lab-green" aria-hidden="true" />
          Mock scoring model v0.1
        </div>
      </div>
    </header>
  );
}
