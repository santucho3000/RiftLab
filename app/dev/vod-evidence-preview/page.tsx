import sampleVodEvidence from "@/fixtures/vod-evidence/sample-vod-evidence.json";
import {
  isVodEvidenceBundle,
  validateVodEvidenceBundle,
  type ChampionTrack,
  type VodEvidenceBundle,
} from "@/lib/vod-evidence";

export const metadata = {
  title: "RiftLab | VOD Evidence Preview",
};

export default function VodEvidencePreviewPage() {
  const rawBundle: unknown = sampleVodEvidence;
  const validation = validateVodEvidenceBundle(rawBundle);
  const bundle = isVodEvidenceBundle(rawBundle) ? rawBundle : null;

  return (
    <main className="min-h-screen lab-grid px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="section-primary">
          <p className="eyebrow">Developer Preview</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-lab-text">VOD Evidence Preview</h1>
              <p className="mt-4 max-w-3xl body-copy-lg text-slate-300">
                Developer Preview — not used in scoring yet. This page loads the local sample
                fixture, validates the VOD Evidence v0.1 shape, and displays the future evidence
                format without changing the current Riot API report.
              </p>
            </div>
            <span className="w-fit rounded-md border border-lab-amber/30 bg-lab-amber/[0.08] px-4 py-3 text-sm font-semibold text-lab-amber">
              Internal only
            </span>
          </div>
        </section>

        <div className="mt-8 grid gap-6">
          <ValidationSection validation={validation} />
          {bundle ? <BundlePreview bundle={bundle} /> : null}
        </div>
      </div>
    </main>
  );
}

function BundlePreview({ bundle }: { bundle: VodEvidenceBundle }) {
  return (
    <>
      <PreviewSection title="Source">
        <DefinitionGrid
          items={[
            ["Source type", bundle.source.type],
            ["Tool name", bundle.source.toolName],
            ["Tool version", bundle.source.toolVersion],
            ["Model version", bundle.source.modelVersion ?? "Not provided"],
            ["Created at", bundle.source.createdAt],
          ]}
        />
      </PreviewSection>

      <PreviewSection title="Match">
        <DefinitionGrid
          items={[
            ["Match ID", bundle.match.matchId ?? "Not provided"],
            ["Region", bundle.match.region ?? "Not provided"],
            ["Game version", bundle.match.gameVersion ?? "Not provided"],
            ["Duration", formatDuration(bundle.match.durationSeconds)],
            ["Time alignment method", bundle.match.timeAlignment.method],
            ["Time alignment confidence", formatConfidence(bundle.match.timeAlignment.confidence)],
          ]}
        />
      </PreviewSection>

      <PreviewSection title="Participants">
        <SimpleTable
          headers={["Participant ID", "Team", "Champion", "Detector label"]}
          rows={bundle.participants.map((participant) => [
            participant.participantId,
            participant.teamSide,
            participant.championName ?? "Unknown",
            participant.detectorLabel ?? "Not provided",
          ])}
        />
      </PreviewSection>

      <PreviewSection title="Champion Tracks Summary">
        <SimpleTable
          headers={["Champion", "Participant ID", "Samples", "Track confidence", "First sample", "Last sample"]}
          rows={bundle.championTracks.map((track) => [
            track.championName ?? "Unknown",
            track.participantId,
            track.samples.length,
            formatConfidence(track.trackConfidence),
            formatTrackSampleTime(track, "first"),
            formatTrackSampleTime(track, "last"),
          ])}
        />
      </PreviewSection>

      <PreviewSection title="Ward Samples Summary">
        <SimpleTable
          headers={["Time", "Team", "Ward type", "Map position", "Confidence"]}
          rows={bundle.wardSamples.map((sample) => [
            formatSeconds(sample.t),
            sample.teamSide,
            sample.wardType,
            formatPosition(sample.x, sample.y),
            formatConfidence(sample.confidence),
          ])}
        />
      </PreviewSection>

      <PreviewSection title="Objective Presence Signals">
        <SimpleTable
          headers={["Objective", "Window", "Control", "Blue present", "Red present", "Confidence"]}
          rows={bundle.objectivePresenceSignals.map((signal) => [
            signal.objectiveType,
            formatWindow(signal.windowStart, signal.windowEnd),
            signal.controllingSide,
            signal.bluePresentParticipantIds.join(", ") || "None",
            signal.redPresentParticipantIds.join(", ") || "None",
            formatConfidence(signal.confidence),
          ])}
        />
      </PreviewSection>

      <PreviewSection title="Rotation / Team Spacing / Zone Control / Fight Setup / Wave State">
        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            title="Rotation"
            rows={bundle.rotationSignals.map((signal) => [
              signal.id,
              `P${signal.participantId} ${signal.fromRegion} -> ${signal.toRegion}, ${formatWindow(signal.startTime, signal.endTime)}, ${signal.rotationType}, ${formatConfidence(signal.confidence)}`,
            ])}
          />
          <SummaryCard
            title="Team Spacing"
            rows={bundle.teamSpacingSignals.map((signal) => [
              signal.id,
              `${signal.teamSide} ${signal.context} at ${formatSeconds(signal.time)}. Isolated: ${formatIds(signal.isolatedParticipantIds)}. Cluster: ${formatIds(signal.clusterParticipantIds)}. Confidence ${formatConfidence(signal.confidence)}`,
            ])}
          />
          <SummaryCard
            title="Zone Control"
            rows={bundle.zoneControlSignals.map((signal) => [
              signal.id,
              `${signal.region}, ${formatWindow(signal.windowStart, signal.windowEnd)}, controlled by ${signal.controllingSide}. Confidence ${formatConfidence(signal.confidence)}`,
            ])}
          />
          <SummaryCard
            title="Fight Setup"
            rows={bundle.fightSetupSignals.map((signal) => [
              signal.id,
              `${formatWindow(signal.windowStart, signal.windowEnd)}. Blue: ${signal.blueFormation ?? "unknown"}, Red: ${signal.redFormation ?? "unknown"}. Confidence ${formatConfidence(signal.confidence)}`,
            ])}
          />
          <SummaryCard
            title="Wave State"
            rows={(bundle.waveStateSignals ?? []).map((signal) => [
              signal.id,
              `${signal.lane} at ${formatSeconds(signal.time)}: ${signal.state}. Confidence ${formatConfidence(signal.confidence)}`,
            ])}
          />
          <SummaryCard
            title="OCR"
            rows={(bundle.ocrSignals ?? []).map((signal) => [
              `${signal.field} ${formatSeconds(signal.time)}`,
              `${signal.value}, confidence ${formatConfidence(signal.confidence)}`,
            ])}
          />
        </div>
      </PreviewSection>

      <PreviewSection title="Quality">
        <DefinitionGrid
          items={[
            ["Overall confidence", formatConfidence(bundle.quality.overallConfidence)],
            ["Minimap confidence", formatOptionalConfidence(bundle.quality.minimapConfidence)],
            ["OCR confidence", formatOptionalConfidence(bundle.quality.ocrConfidence)],
            ["Frame sample rate", bundle.quality.frameSampleRate ?? "Not provided"],
            ["Warnings", bundle.quality.warnings.length > 0 ? bundle.quality.warnings.join(" | ") : "None"],
          ]}
        />
      </PreviewSection>
    </>
  );
}

function ValidationSection({
  validation,
}: {
  validation: ReturnType<typeof validateVodEvidenceBundle>;
}) {
  return (
    <PreviewSection title="Validation Result">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="quiet-surface p-4">
          <p className="label-muted">isValid</p>
          <p className={validation.isValid ? "mt-2 text-2xl font-semibold text-lab-green" : "mt-2 text-2xl font-semibold text-lab-red"}>
            {String(validation.isValid)}
          </p>
        </div>
        <ListCard title="Errors" items={validation.errors} tone="risk" />
        <ListCard title="Warnings" items={validation.warnings} tone="warning" />
      </div>
    </PreviewSection>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section-secondary">
      <h2 className="text-2xl font-semibold text-lab-text">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DefinitionGrid({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="quiet-surface p-4">
          <p className="label-muted">{label}</p>
          <p className="mt-2 break-words text-sm font-semibold leading-6 text-lab-text">{value}</p>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-white/[0.07]">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-lab-panel2/80 text-lab-subdued">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-white/[0.07] px-4 py-3 label-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="bg-black/10 text-slate-300">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-white/[0.05] px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <article className="quiet-surface p-4">
      <p className="label-muted">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.length > 0 ? (
          rows.map(([label, detail]) => (
            <div key={`${title}-${label}`} className="rounded-md border border-white/[0.06] bg-lab-panel2/50 p-3">
              <p className="font-semibold text-lab-text">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-lab-muted">No signals provided.</p>
        )}
      </div>
    </article>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "risk" | "warning" }) {
  const toneClass =
    tone === "risk"
      ? "border-lab-red/25 bg-lab-red/[0.04]"
      : "border-lab-amber/25 bg-lab-amber/[0.04]";

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <p className="label-muted">{title}</p>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.length > 0 ? items.map((item) => <p key={item}>{item}</p>) : <p>None</p>}
      </div>
    </div>
  );
}

function formatTrackSampleTime(track: ChampionTrack, position: "first" | "last") {
  if (track.samples.length === 0) return "No samples";
  const sample = position === "first" ? track.samples[0] : track.samples[track.samples.length - 1];
  return formatSeconds(sample.t);
}

function formatDuration(seconds: number | undefined) {
  if (seconds === undefined) return "Not provided";
  return `${formatSeconds(seconds)} (${seconds}s)`;
}

function formatWindow(start: number, end: number) {
  return `${formatSeconds(start)} - ${formatSeconds(end)}`;
}

function formatSeconds(seconds: number) {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatOptionalConfidence(value: number | undefined) {
  return value === undefined ? "Not provided" : formatConfidence(value);
}

function formatPosition(x: number, y: number) {
  return `${x.toFixed(2)}, ${y.toFixed(2)}`;
}

function formatIds(ids: number[]) {
  return ids.length > 0 ? ids.map((id) => `P${id}`).join(", ") : "None";
}
