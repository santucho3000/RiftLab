import fs from "node:fs/promises";
import path from "node:path";

export const metadata = {
  title: "RiftLab | VOD Replay Lab",
};

type ConfidenceLabel = "low" | "low/medium" | "medium" | "medium/high" | "high";

type ChainPreview = {
  fixtureName: string;
  apiOnlyChain: Chain;
  vodEnhancedChain: Chain & {
    supportingSignals: string[];
  };
  confidenceChange: string;
  classificationChange: string;
  scoringImpactRecommendation: string;
};

type Chain = {
  title: string;
  classification: string;
  valueDirection: string;
  evidenceConfidence: ConfidenceLabel;
  causalConfidence: ConfidenceLabel;
  explanation: string;
};

const previewFile = path.join(
  process.cwd(),
  "labs",
  "vod-replay-lab",
  "output",
  "enriched-chain-preview.json",
);

export default async function VodReplayLabPage() {
  const previews = await loadPreviews();

  return (
    <main className="min-h-screen lab-grid px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="section-primary">
          <p className="eyebrow">Developer Preview</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-lab-text">VOD Replay Lab</h1>
              <p className="mt-4 max-w-3xl body-copy-lg text-slate-300">
                Developer Preview — research only, not used in scoring. This page compares API-only
                Causal Impact Chains with VOD/spatially enriched interpretations from manually
                authored lab fixtures.
              </p>
            </div>
            <span className="w-fit rounded-md border border-lab-amber/30 bg-lab-amber/[0.08] px-4 py-3 text-sm font-semibold text-lab-amber">
              Internal only
            </span>
          </div>
        </section>

        {previews.length > 0 ? (
          <section className="mt-8 space-y-8">
            {previews.map((preview) => (
              <PreviewCard key={preview.fixtureName} preview={preview} />
            ))}
          </section>
        ) : (
          <MissingOutputNotice />
        )}
      </div>
    </main>
  );
}

async function loadPreviews(): Promise<ChainPreview[]> {
  try {
    const raw = await fs.readFile(previewFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isPreviewArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function PreviewCard({ preview }: { preview: ChainPreview }) {
  return (
    <article className="section-secondary">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Fixture</p>
          <h2 className="mt-3 text-2xl font-semibold text-lab-text">{preview.fixtureName}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChangeBadge label="Confidence" value={preview.confidenceChange} />
          <ChangeBadge label="Classification" value={preview.classificationChange} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <ChainPanel title="API-only interpretation" chain={preview.apiOnlyChain} tone="api" />
        <ChainPanel
          title="VOD-enriched interpretation"
          chain={preview.vodEnhancedChain}
          tone="vod"
          supportingSignals={preview.vodEnhancedChain.supportingSignals}
        />
      </div>

      <section className="mt-6 rounded-md border border-lab-cyan/20 bg-lab-cyan/[0.05] p-5">
        <p className="label-muted text-lab-cyan">Future scoring recommendation</p>
        <p className="mt-3 text-sm leading-6 text-slate-200">{preview.scoringImpactRecommendation}</p>
      </section>
    </article>
  );
}

function ChainPanel({
  title,
  chain,
  tone,
  supportingSignals,
}: {
  title: string;
  chain: Chain;
  tone: "api" | "vod";
  supportingSignals?: string[];
}) {
  const toneClass =
    tone === "api"
      ? "border-white/[0.07] bg-lab-panel2/70"
      : "border-lab-cyan/20 bg-lab-cyan/[0.04]";

  return (
    <section className={`rounded-md border p-5 ${toneClass}`}>
      <p className="label-muted">{title}</p>
      <h3 className="mt-3 text-xl font-semibold text-lab-text">{chain.title}</h3>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Fact label="Classification" value={chain.classification} variant={classificationVariant(chain.classification)} />
        <Fact label="Value direction" value={chain.valueDirection} variant={valueVariant(chain.valueDirection)} />
        <Fact label="Evidence confidence" value={chain.evidenceConfidence} />
        <Fact label="Causal confidence" value={chain.causalConfidence} />
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-300">{chain.explanation}</p>

      {supportingSignals && supportingSignals.length > 0 ? (
        <div className="mt-5">
          <p className="label-muted">Supporting spatial signals</p>
          <ul className="mt-3 space-y-2">
            {supportingSignals.map((signal) => (
              <li key={signal} className="rounded-md border border-white/[0.06] bg-black/15 px-3 py-2 text-sm text-slate-300">
                {signal}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ChangeBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="quiet-surface min-w-[220px] p-4">
      <p className="label-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-lab-text">{value}</p>
    </div>
  );
}

function Fact({
  label,
  value,
  variant = "neutral",
}: {
  label: string;
  value: string;
  variant?: "neutral" | "positive" | "warning" | "risk";
}) {
  const variantClass = {
    neutral: "border-white/[0.07] bg-black/10 text-lab-text",
    positive: "border-lab-green/25 bg-lab-green/[0.06] text-lab-green",
    warning: "border-lab-amber/25 bg-lab-amber/[0.06] text-lab-amber",
    risk: "border-lab-red/25 bg-lab-red/[0.06] text-lab-red",
  }[variant];

  return (
    <div className={`rounded-md border p-3 ${variantClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function MissingOutputNotice() {
  return (
    <section className="section-secondary mt-8 border-lab-amber/25 bg-lab-amber/[0.04]">
      <h2 className="text-2xl font-semibold text-lab-text">Preview output not found</h2>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
        Run{" "}
        <code className="rounded bg-black/30 px-2 py-1 text-lab-amber">
          npx tsx labs/vod-replay-lab/measure-objective-window.ts
        </code>{" "}
        and then{" "}
        <code className="rounded bg-black/30 px-2 py-1 text-lab-amber">
          npx tsx labs/vod-replay-lab/enriched-chain-preview.ts
        </code>{" "}
        first.
      </p>
    </section>
  );
}

function classificationVariant(value: string) {
  if (value.includes("positive")) return "positive";
  if (value.includes("neutral")) return "warning";
  if (value.includes("negative")) return "risk";
  return "neutral";
}

function valueVariant(value: string) {
  if (value.includes("gain")) return "positive";
  if (value.includes("neutral") || value.includes("trade")) return "warning";
  if (value.includes("lost")) return "risk";
  return "neutral";
}

function isPreviewArray(value: unknown): value is ChainPreview[] {
  return Array.isArray(value) && value.every(isPreview);
}

function isPreview(value: unknown): value is ChainPreview {
  if (!isRecord(value)) return false;
  return (
    typeof value.fixtureName === "string" &&
    isChain(value.apiOnlyChain) &&
    isVodEnhancedChain(value.vodEnhancedChain) &&
    typeof value.confidenceChange === "string" &&
    typeof value.classificationChange === "string" &&
    typeof value.scoringImpactRecommendation === "string"
  );
}

function isVodEnhancedChain(value: unknown): value is Chain & { supportingSignals: string[] } {
  if (!isRecord(value)) return false;

  return (
    typeof value.title === "string" &&
    typeof value.classification === "string" &&
    typeof value.valueDirection === "string" &&
    typeof value.evidenceConfidence === "string" &&
    typeof value.causalConfidence === "string" &&
    typeof value.explanation === "string" &&
    Array.isArray(value.supportingSignals) &&
    value.supportingSignals.every((signal: unknown) => typeof signal === "string")
  );
}

function isChain(value: unknown): value is Chain {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === "string" &&
    typeof value.classification === "string" &&
    typeof value.valueDirection === "string" &&
    typeof value.evidenceConfidence === "string" &&
    typeof value.causalConfidence === "string" &&
    typeof value.explanation === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
