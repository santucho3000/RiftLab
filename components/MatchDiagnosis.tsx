import { ClipboardCheck } from "lucide-react";
import type { MatchDiagnosis as MatchDiagnosisType } from "@/lib/types";

type MatchDiagnosisProps = {
  diagnosis: MatchDiagnosisType;
};

export function MatchDiagnosis({ diagnosis }: MatchDiagnosisProps) {
  return (
    <section className="section-primary">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-lab-cyan/25 bg-lab-cyan/10">
          <ClipboardCheck className="h-5 w-5 text-lab-cyan" aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Match Diagnosis</p>
          <p className="mt-4 max-w-5xl text-lg leading-9 text-lab-text">{diagnosis.summary}</p>
          <div className="mt-6 quiet-surface border-lab-cyan/10 bg-lab-cyan/[0.055] p-5">
            <p className="label-muted text-lab-cyan/80">
              Main improvement priority
            </p>
            <p className="mt-3 body-copy">
              {diagnosis.mainImprovementPriority}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
