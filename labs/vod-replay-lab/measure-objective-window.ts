import fs from "node:fs/promises";
import path from "node:path";

import type {
  FightSetupSignal,
  ObjectivePresenceSignal,
  RotationSignal,
  TeamSpacingSignal,
  VodEvidenceBundle,
  VodParticipant,
  ZoneControlSignal,
} from "../../lib/vod-evidence/types";
import { validateVodEvidenceBundle } from "../../lib/vod-evidence/validation";

type FixtureWithLabInterpretation = VodEvidenceBundle & {
  labInterpretation?: {
    expectedApiOnlyInterpretation?: string;
    expectedVodEnhancedInterpretation?: string;
    expectedMeasurementSignals?: string[];
  };
};

type ObjectivePresenceMeasurement = {
  objectiveType: string;
  window: string;
  bluePresentCount: number;
  redPresentCount: number;
  presenceAdvantage: "Blue advantage" | "Red advantage" | "Even";
  controllingSide: string;
  confidence: number;
};

type IsolationMeasurement = {
  teamSide: string;
  isolatedParticipantLabels: string[];
  time: number;
  averageDistance?: number;
  confidence: number;
};

type ZoneControlMeasurement = {
  region: string;
  controllingSide: string;
  blueOccupancySeconds?: number;
  redOccupancySeconds?: number;
  wardCoverage?: {
    blue: number;
    red: number;
  };
  zoneControlAdvantage: "Blue" | "Red" | "Even" | "Unknown";
  confidence: number;
};

type RotationMeasurement = {
  participantLabel: string;
  fromRegion: string;
  toRegion: string;
  rotationType: string;
  arrivedBeforeOpponentSeconds?: number;
  classification: "first_move" | "late_rotation" | "even_rotation" | "unknown";
  confidence: number;
};

type FightSetupMeasurement = {
  window: string;
  blueFormation?: string;
  redFormation?: string;
  playerContextParticipantLabel?: string;
  playerContextState?: string;
  distanceFromTeam?: number;
  confidence: number;
};

type FixtureMeasurementSummary = {
  fixtureName: string;
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  objectivePresenceMeasurements: ObjectivePresenceMeasurement[];
  isolationMeasurements: IsolationMeasurement[];
  zoneControlMeasurements: ZoneControlMeasurement[];
  rotationMeasurements: RotationMeasurement[];
  fightSetupMeasurements: FightSetupMeasurement[];
  generatedInterpretation: string;
  expectedVodEnhancedInterpretation?: string;
};

const fixturesDir = path.join(process.cwd(), "labs", "vod-replay-lab", "fixtures");
const outputDir = path.join(process.cwd(), "labs", "vod-replay-lab", "output");
const outputFile = path.join(outputDir, "objective-window-measurements.json");

async function main() {
  const fixtureNames = (await fs.readdir(fixturesDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const summaries: FixtureMeasurementSummary[] = [];

  for (const fixtureName of fixtureNames) {
    const fixturePath = path.join(fixturesDir, fixtureName);
    const parsed = JSON.parse(await fs.readFile(fixturePath, "utf8")) as unknown;

    if (!isVodEvidenceV01(parsed)) {
      console.log(`Skipping ${fixtureName}: schemaVersion is not vod-evidence.v0.1`);
      continue;
    }

    const validation = validateVodEvidenceBundle(parsed);

    if (!validation.isValid) {
      console.log(`\n${fixtureName}`);
      console.log("Validation failed:");
      validation.errors.forEach((error) => console.log(`- ${error}`));
      summaries.push({
        fixtureName,
        isValid: false,
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
        objectivePresenceMeasurements: [],
        isolationMeasurements: [],
        zoneControlMeasurements: [],
        rotationMeasurements: [],
        fightSetupMeasurements: [],
        generatedInterpretation: "Fixture validation failed; measurements skipped.",
        expectedVodEnhancedInterpretation: parsed.labInterpretation?.expectedVodEnhancedInterpretation,
      });
      continue;
    }

    const bundle = parsed;
    const objectivePresenceMeasurements = bundle.objectivePresenceSignals.map(measureObjectivePresence);
    const isolationMeasurements = bundle.teamSpacingSignals.flatMap((signal) =>
      measureIsolation(signal, bundle.participants),
    );
    const zoneControlMeasurements = bundle.zoneControlSignals.map(measureZoneControl);
    const rotationMeasurements = bundle.rotationSignals.map((signal) => measureRotation(signal, bundle.participants));
    const fightSetupMeasurements = bundle.fightSetupSignals.map((signal) =>
      measureFightSetup(signal, bundle.participants),
    );
    const generatedInterpretation = generateInterpretation({
      participants: bundle.participants,
      objectivePresenceMeasurements,
      isolationMeasurements,
      zoneControlMeasurements,
      rotationMeasurements,
      fightSetupMeasurements,
    });

    const summary: FixtureMeasurementSummary = {
      fixtureName,
      isValid: true,
      validationErrors: [],
      validationWarnings: validation.warnings,
      objectivePresenceMeasurements,
      isolationMeasurements,
      zoneControlMeasurements,
      rotationMeasurements,
      fightSetupMeasurements,
      generatedInterpretation,
      expectedVodEnhancedInterpretation: bundle.labInterpretation?.expectedVodEnhancedInterpretation,
    };

    summaries.push(summary);
    printSummary(summary);
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(summaries, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${path.relative(process.cwd(), outputFile)}`);
}

function isVodEvidenceV01(value: unknown): value is FixtureWithLabInterpretation {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === "vod-evidence.v0.1"
  );
}

function measureObjectivePresence(signal: ObjectivePresenceSignal): ObjectivePresenceMeasurement {
  const bluePresentCount = signal.bluePresentParticipantIds.length;
  const redPresentCount = signal.redPresentParticipantIds.length;

  return {
    objectiveType: signal.objectiveType,
    window: formatWindow(signal.windowStart, signal.windowEnd),
    bluePresentCount,
    redPresentCount,
    presenceAdvantage:
      bluePresentCount > redPresentCount
        ? "Blue advantage"
        : redPresentCount > bluePresentCount
          ? "Red advantage"
          : "Even",
    controllingSide: signal.controllingSide,
    confidence: signal.confidence,
  };
}

function measureIsolation(signal: TeamSpacingSignal, participants: VodParticipant[]): IsolationMeasurement[] {
  if (signal.isolatedParticipantIds.length === 0) return [];

  return [
    {
      teamSide: signal.teamSide,
      isolatedParticipantLabels: signal.isolatedParticipantIds.map((participantId) =>
        labelParticipant(participantId, participants),
      ),
      time: signal.time,
      averageDistance: signal.averageDistance,
      confidence: signal.confidence,
    },
  ];
}

function measureZoneControl(signal: ZoneControlSignal): ZoneControlMeasurement {
  const zoneControlAdvantage = classifyZoneControl(signal);

  return {
    region: signal.region,
    controllingSide: signal.controllingSide,
    blueOccupancySeconds: signal.blueOccupancySeconds,
    redOccupancySeconds: signal.redOccupancySeconds,
    wardCoverage: signal.wardCoverage,
    zoneControlAdvantage,
    confidence: signal.confidence,
  };
}

function measureRotation(signal: RotationSignal, participants: VodParticipant[]): RotationMeasurement {
  return {
    participantLabel: labelParticipant(signal.participantId, participants),
    fromRegion: signal.fromRegion,
    toRegion: signal.toRegion,
    rotationType: signal.rotationType,
    arrivedBeforeOpponentSeconds: signal.arrivedBeforeOpponentSeconds,
    classification: classifyRotation(signal),
    confidence: signal.confidence,
  };
}

function measureFightSetup(signal: FightSetupSignal, participants: VodParticipant[]): FightSetupMeasurement {
  return {
    window: formatWindow(signal.windowStart, signal.windowEnd),
    blueFormation: signal.blueFormation,
    redFormation: signal.redFormation,
    playerContextParticipantLabel:
      signal.playerContext !== undefined
        ? labelParticipant(signal.playerContext.participantId, participants)
        : undefined,
    playerContextState: signal.playerContext?.state,
    distanceFromTeam: signal.playerContext?.distanceFromTeam,
    confidence: signal.confidence,
  };
}

function classifyZoneControl(signal: ZoneControlSignal): "Blue" | "Red" | "Even" | "Unknown" {
  if (signal.blueOccupancySeconds === undefined || signal.redOccupancySeconds === undefined) {
    return signal.controllingSide === "Blue" || signal.controllingSide === "Red" ? signal.controllingSide : "Unknown";
  }

  const delta = signal.blueOccupancySeconds - signal.redOccupancySeconds;
  if (Math.abs(delta) <= 5) return "Even";
  return delta > 0 ? "Blue" : "Red";
}

function classifyRotation(signal: RotationSignal): "first_move" | "late_rotation" | "even_rotation" | "unknown" {
  if (signal.rotationType === "first_move") return "first_move";
  if (signal.rotationType === "late_rotation") return "late_rotation";

  if (typeof signal.arrivedBeforeOpponentSeconds !== "number") return "unknown";
  if (Math.abs(signal.arrivedBeforeOpponentSeconds) <= 3) return "even_rotation";
  return signal.arrivedBeforeOpponentSeconds > 0 ? "first_move" : "late_rotation";
}

function generateInterpretation(input: {
  participants: VodParticipant[];
  objectivePresenceMeasurements: ObjectivePresenceMeasurement[];
  isolationMeasurements: IsolationMeasurement[];
  zoneControlMeasurements: ZoneControlMeasurement[];
  rotationMeasurements: RotationMeasurement[];
  fightSetupMeasurements: FightSetupMeasurement[];
}) {
  const objective = input.objectivePresenceMeasurements[0];
  const zone = input.zoneControlMeasurements[0];
  const isolation = input.isolationMeasurements[0];
  const lateRotation = input.rotationMeasurements.find((rotation) => rotation.classification === "late_rotation");
  const firstMove = input.rotationMeasurements.find((rotation) => rotation.classification === "first_move");
  const fightPlayer = input.fightSetupMeasurements.find((fight) => fight.playerContextParticipantLabel);

  if (
    objective?.controllingSide === "Blue" &&
    zone?.zoneControlAdvantage === "Blue" &&
    fightPlayer?.playerContextState === "frontline"
  ) {
    const displacedEnemy = input.isolationMeasurements
      .flatMap((measurement) => measurement.isolatedParticipantLabels)
      .find((label) => label.startsWith("Red "));

    return `Spatial fixture suggests possible enabling trade: ${fightPlayer.playerContextParticipantLabel} died or fought forward while Blue controlled ${humanizeRegion(
      zone.region,
    )}${displacedEnemy ? ` and ${displacedEnemy} was displaced away from the objective` : ""}.`;
  }

  if (objective?.objectiveType === "Rift Herald" && zone?.zoneControlAdvantage === "Red" && lateRotation) {
    return `Spatial fixture suggests tempo/setup issue: Red controlled ${humanizeRegion(zone.region)}${
      firstMove ? ` after ${firstMove.participantLabel} moved first` : ""
    }, while ${lateRotation.participantLabel} rotated late into ${humanizeRegion(lateRotation.toRegion)}.`;
  }

  if (
    objective?.controllingSide === "Red" &&
    zone?.zoneControlAdvantage === "Red" &&
    isolation?.teamSide === "Blue"
  ) {
    return `Spatial fixture suggests isolated objective-window value loss: ${isolation.isolatedParticipantLabels.join(
      ", ",
    )} was isolated while Red controlled ${humanizeRegion(zone.region)} and had stronger ${objective.objectiveType} presence.`;
  }

  return "Spatial fixture produced measurements, but no strong lab interpretation was inferred.";
}

function labelParticipant(participantId: number, participants: VodParticipant[]) {
  const participant = participants.find((candidate) => candidate.participantId === participantId);
  if (!participant) return `Participant ${participantId}`;

  const role = inferRoleLabel(participant.detectorLabel);
  const champion = participant.championName ?? participant.detectorLabel ?? `Participant ${participantId}`;
  return `${participant.teamSide}${role ? ` ${role}` : ""} (${champion})`;
}

function inferRoleLabel(detectorLabel?: string) {
  if (!detectorLabel) return "";
  const normalized = detectorLabel.toLowerCase();
  if (normalized.includes("top")) return "Top";
  if (normalized.includes("jungle")) return "Jungle";
  if (normalized.includes("mid")) return "Mid";
  if (normalized.includes("adc") || normalized.includes("bottom")) return "ADC";
  if (normalized.includes("support")) return "Support";
  return "";
}

function humanizeRegion(region: string) {
  return region.replaceAll("_", " ");
}

function formatWindow(start: number, end: number) {
  return `${formatTimestamp(start)}-${formatTimestamp(end)}`;
}

function formatTimestamp(seconds: number) {
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

function printSummary(summary: FixtureMeasurementSummary) {
  console.log(`\n${summary.fixtureName}`);
  console.log(`Valid: ${summary.isValid}`);

  if (summary.validationWarnings.length > 0) {
    console.log("Warnings:");
    summary.validationWarnings.forEach((warning) => console.log(`- ${warning}`));
  }

  console.log(`Interpretation: ${summary.generatedInterpretation}`);

  summary.objectivePresenceMeasurements.forEach((measurement) => {
    console.log(
      `Objective: ${measurement.objectiveType} ${measurement.window} | Blue ${measurement.bluePresentCount} vs Red ${measurement.redPresentCount} | ${measurement.presenceAdvantage} | control ${measurement.controllingSide} | confidence ${measurement.confidence}`,
    );
  });

  summary.isolationMeasurements.forEach((measurement) => {
    console.log(
      `Isolation: ${measurement.isolatedParticipantLabels.join(", ")} at ${formatTimestamp(
        measurement.time,
      )} | distance ${measurement.averageDistance ?? "unknown"} | confidence ${measurement.confidence}`,
    );
  });

  summary.zoneControlMeasurements.forEach((measurement) => {
    console.log(
      `Zone: ${humanizeRegion(measurement.region)} | advantage ${measurement.zoneControlAdvantage} | control ${measurement.controllingSide} | confidence ${measurement.confidence}`,
    );
  });

  summary.rotationMeasurements.forEach((measurement) => {
    console.log(
      `Rotation: ${measurement.participantLabel} ${humanizeRegion(measurement.fromRegion)} -> ${humanizeRegion(
        measurement.toRegion,
      )} | ${measurement.classification} | confidence ${measurement.confidence}`,
    );
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
