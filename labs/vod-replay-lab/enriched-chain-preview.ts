import fs from "node:fs/promises";
import path from "node:path";

type ConfidenceLabel = "low" | "low/medium" | "medium" | "medium/high" | "high";
type ChainClassification = "negative" | "neutral / small tempo cost" | "possible positive trade";
type ValueDirection = "lost" | "neutral or trade" | "possible gain";

type ObjectivePresenceMeasurement = {
  objectiveType: string;
  window: string;
  bluePresentCount: number;
  redPresentCount: number;
  presenceAdvantage: string;
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
  zoneControlAdvantage: string;
  confidence: number;
};

type RotationMeasurement = {
  participantLabel: string;
  fromRegion: string;
  toRegion: string;
  rotationType: string;
  arrivedBeforeOpponentSeconds?: number;
  classification: string;
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

type MeasurementSummary = {
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

type ChainPreview = {
  fixtureName: string;
  apiOnlyChain: {
    title: string;
    classification: ChainClassification;
    valueDirection: ValueDirection;
    evidenceConfidence: ConfidenceLabel;
    causalConfidence: ConfidenceLabel;
    explanation: string;
  };
  vodEnhancedChain: {
    title: string;
    classification: ChainClassification;
    valueDirection: ValueDirection;
    evidenceConfidence: ConfidenceLabel;
    causalConfidence: ConfidenceLabel;
    explanation: string;
    supportingSignals: string[];
  };
  confidenceChange: string;
  classificationChange: string;
  scoringImpactRecommendation: string;
};

const measurementsFile = path.join(
  process.cwd(),
  "labs",
  "vod-replay-lab",
  "output",
  "objective-window-measurements.json",
);
const outputFile = path.join(process.cwd(), "labs", "vod-replay-lab", "output", "enriched-chain-preview.json");

async function main() {
  if (!(await fileExists(measurementsFile))) {
    console.log("Run measure-objective-window.ts first.");
    return;
  }

  const measurements = JSON.parse(await fs.readFile(measurementsFile, "utf8")) as MeasurementSummary[];
  const previews = measurements.filter((summary) => summary.isValid).map(generatePreview);

  await fs.writeFile(outputFile, `${JSON.stringify(previews, null, 2)}\n`, "utf8");

  previews.forEach(printPreview);
  console.log(`\nWrote ${path.relative(process.cwd(), outputFile)}`);
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function generatePreview(summary: MeasurementSummary): ChainPreview {
  if (summary.fixtureName === "isolated-death-before-dragon.json") {
    return generateIsolatedDeathPreview(summary);
  }

  if (summary.fixtureName === "useful-death-before-allied-dragon.json") {
    return generateUsefulDeathPreview(summary);
  }

  if (summary.fixtureName === "late-rotation-to-herald.json") {
    return generateLateRotationPreview(summary);
  }

  return generateGenericPreview(summary);
}

function generateIsolatedDeathPreview(summary: MeasurementSummary): ChainPreview {
  const isolation = summary.isolationMeasurements[0];
  const objective = summary.objectivePresenceMeasurements[0];
  const zone = summary.zoneControlMeasurements[0];

  return {
    fixtureName: summary.fixtureName,
    apiOnlyChain: {
      title: "Death before enemy Dragon",
      classification: "negative",
      valueDirection: "lost",
      evidenceConfidence: "high",
      causalConfidence: "medium",
      explanation:
        "Riot API confirms the player death occurred before an enemy Dragon window, but API alone cannot confirm positioning, vision, isolation, or contest intent.",
    },
    vodEnhancedChain: {
      title: "Isolated death before enemy Dragon control",
      classification: "negative",
      valueDirection: "lost",
      evidenceConfidence: "medium/high",
      causalConfidence: "medium/high",
      explanation: `${summary.generatedInterpretation} This would support upgrading the API-only chain from timing association to stronger objective-window value loss if real VOD evidence validated it.`,
      supportingSignals: compact([
        isolation
          ? `Isolated participant: ${isolation.isolatedParticipantLabels.join(", ")} at ${formatSeconds(
              isolation.time,
            )}`
          : undefined,
        objective
          ? `Objective presence: ${objective.presenceAdvantage} (${objective.bluePresentCount} Blue vs ${objective.redPresentCount} Red)`
          : undefined,
        zone
          ? `Zone control: ${zone.zoneControlAdvantage} controlled ${humanizeRegion(zone.region)}`
          : undefined,
      ]),
    },
    confidenceChange: "causal confidence medium -> medium/high",
    classificationChange: "classification remains negative; reason becomes isolated objective-window value loss",
    scoringImpactRecommendation:
      "Increase death/objective value-loss confidence if real evidence validates isolation, enemy zone control, and enemy objective presence.",
  };
}

function generateUsefulDeathPreview(summary: MeasurementSummary): ChainPreview {
  const objective = summary.objectivePresenceMeasurements[0];
  const zone = summary.zoneControlMeasurements[0];
  const displacedEnemy = summary.isolationMeasurements
    .flatMap((measurement) => measurement.isolatedParticipantLabels)
    .find((label) => label.startsWith("Red "));
  const frontline = summary.fightSetupMeasurements.find(
    (measurement) => measurement.playerContextState === "frontline",
  );

  return {
    fixtureName: summary.fixtureName,
    apiOnlyChain: {
      title: "Death before allied Dragon",
      classification: "neutral / small tempo cost",
      valueDirection: "neutral or trade",
      evidenceConfidence: "high",
      causalConfidence: "low/medium",
      explanation:
        "Riot API confirms the player died before an allied Dragon, so this should not be counted as objective loss. API alone cannot determine whether the death was useful.",
    },
    vodEnhancedChain: {
      title: "Possible enabling trade before allied Dragon",
      classification: "possible positive trade",
      valueDirection: "possible gain",
      evidenceConfidence: "medium/high",
      causalConfidence: "medium",
      explanation: `${summary.generatedInterpretation} This remains medium confidence because useful-death classification still needs fight context and intent cannot be proven from minimap evidence alone.`,
      supportingSignals: compact([
        objective
          ? `Objective presence: ${objective.presenceAdvantage} (${objective.bluePresentCount} Blue vs ${objective.redPresentCount} Red)`
          : undefined,
        zone ? `Zone control: ${zone.zoneControlAdvantage} controlled ${humanizeRegion(zone.region)}` : undefined,
        displacedEnemy ? `Enemy displacement proxy: ${displacedEnemy} isolated away from the pit` : undefined,
        frontline
          ? `Fight setup: ${frontline.playerContextParticipantLabel} shown as ${frontline.playerContextState}`
          : undefined,
      ]),
    },
    confidenceChange: "causal confidence low/medium -> medium",
    classificationChange: "neutral / small tempo cost -> possible positive trade",
    scoringImpactRecommendation:
      "Do not penalize as pure death. Consider enabling-trade evidence only if real VOD validates allied objective control and enemy jungler displacement.",
  };
}

function generateLateRotationPreview(summary: MeasurementSummary): ChainPreview {
  const objective = summary.objectivePresenceMeasurements[0];
  const zone = summary.zoneControlMeasurements[0];
  const lateRotation = summary.rotationMeasurements.find((measurement) => measurement.classification === "late_rotation");
  const firstMove = summary.rotationMeasurements.find((measurement) => measurement.classification === "first_move");
  const setup = summary.fightSetupMeasurements[0];

  return {
    fixtureName: summary.fixtureName,
    apiOnlyChain: {
      title: "Poor Herald contest / objective loss",
      classification: "negative",
      valueDirection: "lost",
      evidenceConfidence: "high",
      causalConfidence: "low/medium",
      explanation:
        "Riot API confirms objective outcome and timing, but API alone cannot explain setup quality, first move, or rotation timing.",
    },
    vodEnhancedChain: {
      title: "Late rotation and enemy first control before Herald",
      classification: "negative",
      valueDirection: "lost",
      evidenceConfidence: "medium/high",
      causalConfidence: "medium",
      explanation: `${summary.generatedInterpretation} The classification remains negative, but the causal reason shifts from generic objective loss to tempo, first-move, and setup quality.`,
      supportingSignals: compact([
        objective
          ? `Objective presence: ${objective.presenceAdvantage} (${objective.bluePresentCount} Blue vs ${objective.redPresentCount} Red)`
          : undefined,
        zone ? `Zone control: ${zone.zoneControlAdvantage} controlled ${humanizeRegion(zone.region)}` : undefined,
        firstMove ? `First move: ${firstMove.participantLabel} reached ${humanizeRegion(firstMove.toRegion)} first` : undefined,
        lateRotation
          ? `Late rotation: ${lateRotation.participantLabel} arrived ${Math.abs(
              lateRotation.arrivedBeforeOpponentSeconds ?? 0,
            )}s after opponent timing`
          : undefined,
        setup ? `Fight setup: Blue ${setup.blueFormation}; Red ${setup.redFormation}` : undefined,
      ]),
    },
    confidenceChange: "causal confidence low/medium -> medium",
    classificationChange: "classification remains negative; reason changes to tempo/setup issue",
    scoringImpactRecommendation:
      "Classify as rotation/setup issue, not simply objective lost. Keep confidence capped until real VOD confirms first move, zone control, and staggered entry.",
  };
}

function generateGenericPreview(summary: MeasurementSummary): ChainPreview {
  return {
    fixtureName: summary.fixtureName,
    apiOnlyChain: {
      title: "API-only objective-window chain",
      classification: "negative",
      valueDirection: "lost",
      evidenceConfidence: "high",
      causalConfidence: "low/medium",
      explanation: "Riot API confirms timing, but spatial context is unavailable.",
    },
    vodEnhancedChain: {
      title: "VOD-enhanced objective-window chain",
      classification: "negative",
      valueDirection: "lost",
      evidenceConfidence: "medium/high",
      causalConfidence: "medium",
      explanation: summary.generatedInterpretation,
      supportingSignals: [],
    },
    confidenceChange: "causal confidence low/medium -> medium",
    classificationChange: "classification unchanged",
    scoringImpactRecommendation: "Use as research-only evidence until a validated VOD pipeline exists.",
  };
}

function compact(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

function humanizeRegion(region: string) {
  return region.replaceAll("_", " ");
}

function formatSeconds(seconds: number) {
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

function printPreview(preview: ChainPreview) {
  console.log(`\n${preview.fixtureName}`);
  console.log(`API-only: ${preview.apiOnlyChain.title}`);
  console.log(`  ${preview.apiOnlyChain.classification} / ${preview.apiOnlyChain.valueDirection}`);
  console.log(`  ${preview.apiOnlyChain.explanation}`);
  console.log(`VOD-enhanced: ${preview.vodEnhancedChain.title}`);
  console.log(`  ${preview.vodEnhancedChain.classification} / ${preview.vodEnhancedChain.valueDirection}`);
  console.log(`  ${preview.vodEnhancedChain.explanation}`);
  console.log(`Confidence: ${preview.confidenceChange}`);
  console.log(`Classification: ${preview.classificationChange}`);
  console.log(`Scoring recommendation: ${preview.scoringImpactRecommendation}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
