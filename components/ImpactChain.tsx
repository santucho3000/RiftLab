import { ArrowRight } from "lucide-react";
import type { ImpactChain as ImpactChainType } from "@/lib/types";

type ImpactChainProps = {
  chain: ImpactChainType;
};

export function ImpactChain({ chain }: ImpactChainProps) {
  return (
    <section className="section-secondary">
      <p className="eyebrow">Impact Chain</p>
      <h2 className="mt-3 text-2xl font-semibold text-lab-text">{chain.title}</h2>
      <div className="mt-7 grid gap-4 lg:grid-cols-5">
        {chain.steps.map((step, index) => (
          <div key={`${step.label}-${step.detail}`} className="relative">
            <article className="inner-surface h-full p-5">
              <p className="label-muted">{step.label}</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{step.detail}</p>
            </article>
            {index < chain.steps.length - 1 ? (
              <div className="hidden lg:absolute lg:-right-5 lg:top-1/2 lg:z-10 lg:block lg:-translate-y-1/2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-lab-cyan/20 bg-lab-bg">
                  <ArrowRight className="h-4 w-4 text-lab-cyan" aria-hidden="true" />
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
