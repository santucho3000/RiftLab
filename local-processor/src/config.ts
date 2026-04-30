import { readFile } from "node:fs/promises";
import path from "node:path";

import type { LocalProcessorConfig, ReplayProcessingMode } from "./types";

const supportedModes: ReplayProcessingMode[] = ["manual_safe", "semi_auto_future", "server_future"];

export async function loadLocalProcessorConfig(configPath: string): Promise<LocalProcessorConfig> {
  const resolvedPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  const parsed = JSON.parse(await readFile(resolvedPath, "utf8")) as unknown;
  return validateLocalProcessorConfig(parsed);
}

function validateLocalProcessorConfig(value: unknown): LocalProcessorConfig {
  if (!isRecord(value)) {
    throw new Error("Config must be an object.");
  }

  if (typeof value.replayDirectory !== "string") {
    throw new Error("Config replayDirectory must be a string.");
  }

  if (typeof value.outputDirectory !== "string" || value.outputDirectory.length === 0) {
    throw new Error("Config outputDirectory must be a non-empty string.");
  }

  if (typeof value.region !== "string" || value.region.length === 0) {
    throw new Error("Config region must be a non-empty string.");
  }

  if (!isReplayProcessingMode(value.mode)) {
    throw new Error(`Config mode must be one of: ${supportedModes.join(", ")}.`);
  }

  if (!isRecord(value.capture)) {
    throw new Error("Config capture must be an object.");
  }

  if (typeof value.capture.targetFps !== "number" || value.capture.targetFps <= 0) {
    throw new Error("Config capture.targetFps must be a positive number.");
  }

  if (!isRecord(value.capture.resolution)) {
    throw new Error("Config capture.resolution must be an object.");
  }

  if (
    typeof value.capture.resolution.width !== "number" ||
    value.capture.resolution.width <= 0 ||
    typeof value.capture.resolution.height !== "number" ||
    value.capture.resolution.height <= 0
  ) {
    throw new Error("Config capture.resolution width and height must be positive numbers.");
  }

  if (!isRecord(value.capture.minimapBoundingBox)) {
    throw new Error("Config capture.minimapBoundingBox must be an object.");
  }

  const box = value.capture.minimapBoundingBox;
  if (
    typeof box.x !== "number" ||
    typeof box.y !== "number" ||
    typeof box.width !== "number" ||
    typeof box.height !== "number" ||
    box.x < 0 ||
    box.y < 0 ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    throw new Error("Config capture.minimapBoundingBox must have x/y >= 0 and width/height > 0.");
  }

  return {
    replayDirectory: value.replayDirectory,
    outputDirectory: value.outputDirectory,
    region: value.region,
    mode: value.mode,
    capture: {
      targetFps: value.capture.targetFps,
      resolution: {
        width: value.capture.resolution.width,
        height: value.capture.resolution.height,
      },
      minimapBoundingBox: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
    },
  };
}

function isReplayProcessingMode(value: unknown): value is ReplayProcessingMode {
  return typeof value === "string" && supportedModes.includes(value as ReplayProcessingMode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
