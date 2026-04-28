import type { VodEvidenceBundle } from "@/lib/vod-evidence/types";

export type VodEvidenceValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

type ValidationContext = {
  errors: string[];
  warnings: string[];
  participantIds: Set<number>;
};

export function validateVodEvidenceBundle(bundle: unknown): VodEvidenceValidationResult {
  const context: ValidationContext = {
    errors: [],
    warnings: [],
    participantIds: new Set<number>(),
  };

  if (!isRecord(bundle)) {
    return {
      isValid: false,
      errors: ["Bundle must be an object."],
      warnings: [],
    };
  }

  validateRequiredRootShape(bundle, context);

  if (bundle.schemaVersion === "vod-evidence.v0.1") {
    validateParticipants(bundle.participants, context);
    validateChampionTracks(bundle.championTracks, context);
    validateWardSamples(bundle.wardSamples, context);
    validateObjectivePresenceSignals(bundle.objectivePresenceSignals, context);
    validateRotationSignals(bundle.rotationSignals, context);
    validateTeamSpacingSignals(bundle.teamSpacingSignals, context);
    validateZoneControlSignals(bundle.zoneControlSignals, context);
    validateFightSetupSignals(bundle.fightSetupSignals, context);
    validateWaveStateSignals(bundle.waveStateSignals, context);
    validateOcrSignals(bundle.ocrSignals, context);
    validateQuality(bundle.quality, context);
    validateMatch(bundle.match, context);
  }

  return {
    isValid: context.errors.length === 0,
    errors: context.errors,
    warnings: context.warnings,
  };
}

function validateRequiredRootShape(bundle: Record<string, unknown>, context: ValidationContext) {
  if (bundle.schemaVersion !== "vod-evidence.v0.1") {
    context.errors.push('schemaVersion must equal "vod-evidence.v0.1".');
  }

  requireRecord(bundle, "source", context);
  requireRecord(bundle, "match", context);
  requireRecord(bundle, "coordinateSystem", context);
  requireArray(bundle, "participants", context);
  requireArray(bundle, "championTracks", context);
  requireArray(bundle, "wardSamples", context);
  requireArray(bundle, "objectivePresenceSignals", context);
  requireArray(bundle, "rotationSignals", context);
  requireArray(bundle, "teamSpacingSignals", context);
  requireArray(bundle, "zoneControlSignals", context);
  requireArray(bundle, "fightSetupSignals", context);
  requireRecord(bundle, "quality", context);

  if (bundle.waveStateSignals !== undefined && !Array.isArray(bundle.waveStateSignals)) {
    context.errors.push("waveStateSignals must be an array when provided.");
  }

  if (bundle.ocrSignals !== undefined && !Array.isArray(bundle.ocrSignals)) {
    context.errors.push("ocrSignals must be an array when provided.");
  }
}

function validateParticipants(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((participant, index) => {
    if (!isRecord(participant)) {
      context.errors.push(`participants[${index}] must be an object.`);
      return;
    }

    const participantId = participant.participantId;
    if (!isNonNegativeNumber(participantId) || !Number.isInteger(participantId)) {
      context.errors.push(`participants[${index}].participantId must be a non-negative integer.`);
      return;
    }

    if (context.participantIds.has(participantId)) {
      context.errors.push(`participants[${index}].participantId duplicates ${participantId}.`);
    }

    context.participantIds.add(participantId);
  });

  if (context.participantIds.size === 0) {
    context.warnings.push("No participants were provided; participant references cannot be validated.");
  }
}

function validateChampionTracks(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((track, trackIndex) => {
    if (!isRecord(track)) {
      context.errors.push(`championTracks[${trackIndex}] must be an object.`);
      return;
    }

    validateParticipantRef(track.participantId, `championTracks[${trackIndex}].participantId`, context);
    validateConfidence(track.trackConfidence, `championTracks[${trackIndex}].trackConfidence`, context);

    if (!Array.isArray(track.samples)) {
      context.errors.push(`championTracks[${trackIndex}].samples must be an array.`);
      return;
    }

    track.samples.forEach((sample, sampleIndex) => {
      if (!isRecord(sample)) {
        context.errors.push(`championTracks[${trackIndex}].samples[${sampleIndex}] must be an object.`);
        return;
      }

      validateNonNegativeTime(sample.t, `championTracks[${trackIndex}].samples[${sampleIndex}].t`, context);
      validateConfidence(
        sample.confidence,
        `championTracks[${trackIndex}].samples[${sampleIndex}].confidence`,
        context,
      );
    });

    if (Array.isArray(track.gaps)) {
      track.gaps.forEach((gap, gapIndex) => {
        if (!isRecord(gap)) {
          context.errors.push(`championTracks[${trackIndex}].gaps[${gapIndex}] must be an object.`);
          return;
        }

        validateWindow(
          gap.startTime,
          gap.endTime,
          `championTracks[${trackIndex}].gaps[${gapIndex}]`,
          context,
        );
      });
    }
  });
}

function validateWardSamples(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((sample, index) => {
    if (!isRecord(sample)) {
      context.errors.push(`wardSamples[${index}] must be an object.`);
      return;
    }

    validateNonNegativeTime(sample.t, `wardSamples[${index}].t`, context);
    validateConfidence(sample.confidence, `wardSamples[${index}].confidence`, context);
  });
}

function validateObjectivePresenceSignals(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((signal, index) => {
    if (!isRecord(signal)) {
      context.errors.push(`objectivePresenceSignals[${index}] must be an object.`);
      return;
    }

    validateWindow(signal.windowStart, signal.windowEnd, `objectivePresenceSignals[${index}]`, context);
    validateConfidence(signal.confidence, `objectivePresenceSignals[${index}].confidence`, context);
    validateParticipantRefs(
      signal.bluePresentParticipantIds,
      `objectivePresenceSignals[${index}].bluePresentParticipantIds`,
      context,
    );
    validateParticipantRefs(
      signal.redPresentParticipantIds,
      `objectivePresenceSignals[${index}].redPresentParticipantIds`,
      context,
    );
    validateParticipantRefs(
      signal.blueArrivalOrder,
      `objectivePresenceSignals[${index}].blueArrivalOrder`,
      context,
      true,
    );
    validateParticipantRefs(
      signal.redArrivalOrder,
      `objectivePresenceSignals[${index}].redArrivalOrder`,
      context,
      true,
    );
  });
}

function validateRotationSignals(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((signal, index) => {
    if (!isRecord(signal)) {
      context.errors.push(`rotationSignals[${index}] must be an object.`);
      return;
    }

    validateParticipantRef(signal.participantId, `rotationSignals[${index}].participantId`, context);
    validateWindow(signal.startTime, signal.endTime, `rotationSignals[${index}]`, context);
    validateConfidence(signal.confidence, `rotationSignals[${index}].confidence`, context);
  });
}

function validateTeamSpacingSignals(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((signal, index) => {
    if (!isRecord(signal)) {
      context.errors.push(`teamSpacingSignals[${index}] must be an object.`);
      return;
    }

    validateNonNegativeTime(signal.time, `teamSpacingSignals[${index}].time`, context);
    validateConfidence(signal.confidence, `teamSpacingSignals[${index}].confidence`, context);
    validateParticipantRefs(
      signal.isolatedParticipantIds,
      `teamSpacingSignals[${index}].isolatedParticipantIds`,
      context,
    );
    validateParticipantRefs(
      signal.clusterParticipantIds,
      `teamSpacingSignals[${index}].clusterParticipantIds`,
      context,
    );
  });
}

function validateZoneControlSignals(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((signal, index) => {
    if (!isRecord(signal)) {
      context.errors.push(`zoneControlSignals[${index}] must be an object.`);
      return;
    }

    validateWindow(signal.windowStart, signal.windowEnd, `zoneControlSignals[${index}]`, context);
    validateConfidence(signal.confidence, `zoneControlSignals[${index}].confidence`, context);

    if (isRecord(signal.wardCoverage)) {
      validateConfidence(signal.wardCoverage.blue, `zoneControlSignals[${index}].wardCoverage.blue`, context);
      validateConfidence(signal.wardCoverage.red, `zoneControlSignals[${index}].wardCoverage.red`, context);
    }
  });
}

function validateFightSetupSignals(value: unknown, context: ValidationContext) {
  if (!Array.isArray(value)) return;

  value.forEach((signal, index) => {
    if (!isRecord(signal)) {
      context.errors.push(`fightSetupSignals[${index}] must be an object.`);
      return;
    }

    validateWindow(signal.windowStart, signal.windowEnd, `fightSetupSignals[${index}]`, context);
    validateConfidence(signal.confidence, `fightSetupSignals[${index}].confidence`, context);

    if (isRecord(signal.playerContext)) {
      validateParticipantRef(
        signal.playerContext.participantId,
        `fightSetupSignals[${index}].playerContext.participantId`,
        context,
      );
    }
  });
}

function validateWaveStateSignals(value: unknown, context: ValidationContext) {
  if (value === undefined) return;
  if (!Array.isArray(value)) return;

  value.forEach((signal, index) => {
    if (!isRecord(signal)) {
      context.errors.push(`waveStateSignals[${index}] must be an object.`);
      return;
    }

    validateNonNegativeTime(signal.time, `waveStateSignals[${index}].time`, context);
    validateConfidence(signal.confidence, `waveStateSignals[${index}].confidence`, context);
  });
}

function validateOcrSignals(value: unknown, context: ValidationContext) {
  if (value === undefined) return;
  if (!Array.isArray(value)) return;

  value.forEach((signal, index) => {
    if (!isRecord(signal)) {
      context.errors.push(`ocrSignals[${index}] must be an object.`);
      return;
    }

    validateNonNegativeTime(signal.time, `ocrSignals[${index}].time`, context);
    validateConfidence(signal.confidence, `ocrSignals[${index}].confidence`, context);

    if (signal.participantId !== undefined) {
      validateParticipantRef(signal.participantId, `ocrSignals[${index}].participantId`, context);
    }
  });
}

function validateQuality(value: unknown, context: ValidationContext) {
  if (!isRecord(value)) return;

  validateConfidence(value.overallConfidence, "quality.overallConfidence", context);
  validateOptionalConfidence(value.minimapConfidence, "quality.minimapConfidence", context);
  validateOptionalConfidence(value.ocrConfidence, "quality.ocrConfidence", context);

  if (!Array.isArray(value.unsupportedReasons)) {
    context.errors.push("quality.unsupportedReasons must be an array.");
  }

  if (!Array.isArray(value.warnings)) {
    context.errors.push("quality.warnings must be an array.");
  }
}

function validateMatch(value: unknown, context: ValidationContext) {
  if (!isRecord(value)) return;

  if (value.durationSeconds !== undefined) {
    validateNonNegativeTime(value.durationSeconds, "match.durationSeconds", context);
  }

  if (!isRecord(value.timeAlignment)) {
    context.errors.push("match.timeAlignment must exist.");
    return;
  }

  validateConfidence(value.timeAlignment.confidence, "match.timeAlignment.confidence", context);

  if (
    typeof value.timeAlignment.videoStartOffsetMs !== "number" ||
    !Number.isFinite(value.timeAlignment.videoStartOffsetMs)
  ) {
    context.errors.push("match.timeAlignment.videoStartOffsetMs must be a finite number.");
  }
}

function validateWindow(start: unknown, end: unknown, path: string, context: ValidationContext) {
  validateNonNegativeTime(start, `${path}.start`, context);
  validateNonNegativeTime(end, `${path}.end`, context);

  if (typeof start === "number" && typeof end === "number" && end < start) {
    context.errors.push(`${path} end time must be greater than or equal to start time.`);
  }
}

function validateParticipantRefs(
  value: unknown,
  path: string,
  context: ValidationContext,
  optional = false,
) {
  if (value === undefined && optional) return;

  if (!Array.isArray(value)) {
    context.errors.push(`${path} must be an array.`);
    return;
  }

  value.forEach((participantId, index) => {
    validateParticipantRef(participantId, `${path}[${index}]`, context);
  });
}

function validateParticipantRef(value: unknown, path: string, context: ValidationContext) {
  if (!isNonNegativeNumber(value) || !Number.isInteger(value)) {
    context.errors.push(`${path} must be a non-negative integer participant ID.`);
    return;
  }

  if (context.participantIds.size > 0 && !context.participantIds.has(value)) {
    context.errors.push(`${path} references missing participant ID ${value}.`);
  }
}

function validateConfidence(value: unknown, path: string, context: ValidationContext) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    context.errors.push(`${path} must be a finite number between 0 and 1.`);
    return;
  }

  if (value < 0 || value > 1) {
    context.errors.push(`${path} must be between 0 and 1.`);
  }
}

function validateOptionalConfidence(value: unknown, path: string, context: ValidationContext) {
  if (value === undefined) return;
  validateConfidence(value, path, context);
}

function validateNonNegativeTime(value: unknown, path: string, context: ValidationContext) {
  if (!isNonNegativeNumber(value)) {
    context.errors.push(`${path} must be a non-negative finite number.`);
  }
}

function requireRecord(bundle: Record<string, unknown>, key: string, context: ValidationContext) {
  if (!isRecord(bundle[key])) {
    context.errors.push(`${key} must exist and be an object.`);
  }
}

function requireArray(bundle: Record<string, unknown>, key: string, context: ValidationContext) {
  if (!Array.isArray(bundle[key])) {
    context.errors.push(`${key} must exist and be an array.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isVodEvidenceBundle(bundle: unknown): bundle is VodEvidenceBundle {
  return validateVodEvidenceBundle(bundle).isValid;
}
