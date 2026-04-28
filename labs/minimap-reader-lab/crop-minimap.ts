import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { MinimapBoundingBox, MinimapDebugMetadata, MinimapReaderConfig } from "./types";

const defaultConfigPath = path.join(
  process.cwd(),
  "labs",
  "minimap-reader-lab",
  "config",
  "sample-minimap-config.json",
);

async function main() {
  const configPath = resolveFromCwd(process.argv[2] ?? defaultConfigPath);
  const config = await readConfig(configPath);
  const inputImagePath = resolveFromCwd(config.inputImagePath);
  const outputDir = resolveFromCwd(config.outputDir);

  if (!(await fileExists(inputImagePath))) {
    console.log(
      "Place a screenshot at labs/minimap-reader-lab/input/sample-frame.png or update the config inputImagePath.",
    );
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });

  const image = sharp(inputImagePath);
  const metadata = await image.metadata();
  const originalImageWidth = metadata.width;
  const originalImageHeight = metadata.height;

  if (!originalImageWidth || !originalImageHeight) {
    throw new Error("Unable to read source image dimensions.");
  }

  const warnings = validateBoundingBox(config.minimapBoundingBox, originalImageWidth, originalImageHeight);
  validateOutputSize(config.outputSize.width, config.outputSize.height);

  if (warnings.length > 0) {
    throw new Error(`Invalid minimap config:\n${warnings.map((warning) => `- ${warning}`).join("\n")}`);
  }

  const cropPath = path.join(outputDir, "minimap-crop.png");
  const normalizedPath = path.join(outputDir, "minimap-normalized.png");
  const debugMetadataPath = path.join(outputDir, "debug-metadata.json");

  await sharp(inputImagePath)
    .extract({
      left: config.minimapBoundingBox.x,
      top: config.minimapBoundingBox.y,
      width: config.minimapBoundingBox.width,
      height: config.minimapBoundingBox.height,
    })
    .png()
    .toFile(cropPath);

  await sharp(cropPath).resize(config.outputSize.width, config.outputSize.height).png().toFile(normalizedPath);

  const debugMetadata: MinimapDebugMetadata = {
    inputImagePath: toProjectRelative(inputImagePath),
    originalImageWidth,
    originalImageHeight,
    minimapBoundingBox: config.minimapBoundingBox,
    outputSize: config.outputSize,
    outputFiles: {
      crop: toProjectRelative(cropPath),
      normalized: toProjectRelative(normalizedPath),
      debugMetadata: toProjectRelative(debugMetadataPath),
    },
    coordinateSystem: config.coordinateSystem,
    createdAt: new Date().toISOString(),
    warnings: [
      "Lab-only preprocessing output. Not real champion detection, not tracking, and not scoring input.",
    ],
  };

  await fs.writeFile(debugMetadataPath, `${JSON.stringify(debugMetadata, null, 2)}\n`, "utf8");

  console.log("Minimap crop complete.");
  console.log(`Crop: ${toProjectRelative(cropPath)}`);
  console.log(`Normalized: ${toProjectRelative(normalizedPath)}`);
  console.log(`Debug metadata: ${toProjectRelative(debugMetadataPath)}`);
}

async function readConfig(configPath: string): Promise<MinimapReaderConfig> {
  if (!(await fileExists(configPath))) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const parsed = JSON.parse(await fs.readFile(configPath, "utf8")) as unknown;
  return validateConfig(parsed);
}

function validateConfig(value: unknown): MinimapReaderConfig {
  if (!isRecord(value)) {
    throw new Error("Config must be an object.");
  }

  if (typeof value.inputImagePath !== "string" || value.inputImagePath.length === 0) {
    throw new Error("Config inputImagePath must be a non-empty string.");
  }

  if (typeof value.outputDir !== "string" || value.outputDir.length === 0) {
    throw new Error("Config outputDir must be a non-empty string.");
  }

  if (!isBoundingBox(value.minimapBoundingBox)) {
    throw new Error("Config minimapBoundingBox must include numeric x, y, width, and height.");
  }

  if (!isRecord(value.outputSize)) {
    throw new Error("Config outputSize must be an object.");
  }

  if (typeof value.outputSize.width !== "number" || typeof value.outputSize.height !== "number") {
    throw new Error("Config outputSize must include numeric width and height.");
  }

  if (!isRecord(value.coordinateSystem)) {
    throw new Error("Config coordinateSystem must be an object.");
  }

  if (value.coordinateSystem.type !== "summoners_rift_minimap_normalized") {
    throw new Error('Config coordinateSystem.type must be "summoners_rift_minimap_normalized".');
  }

  if (!isNumberTuple(value.coordinateSystem.xRange) || !isNumberTuple(value.coordinateSystem.yRange)) {
    throw new Error("Config coordinateSystem xRange and yRange must be numeric 2-tuples.");
  }

  if (value.coordinateSystem.origin !== "blue_bottom_left") {
    throw new Error('Config coordinateSystem.origin must be "blue_bottom_left".');
  }

  return {
    inputImagePath: value.inputImagePath,
    outputDir: value.outputDir,
    minimapBoundingBox: value.minimapBoundingBox,
    outputSize: {
      width: value.outputSize.width,
      height: value.outputSize.height,
    },
    coordinateSystem: {
      type: value.coordinateSystem.type,
      xRange: value.coordinateSystem.xRange,
      yRange: value.coordinateSystem.yRange,
      origin: value.coordinateSystem.origin,
    },
    notes: typeof value.notes === "string" ? value.notes : undefined,
  };
}

function validateBoundingBox(box: MinimapBoundingBox, sourceWidth: number, sourceHeight: number) {
  const warnings: string[] = [];

  if (box.x < 0) warnings.push("minimapBoundingBox.x must be >= 0.");
  if (box.y < 0) warnings.push("minimapBoundingBox.y must be >= 0.");
  if (box.width <= 0) warnings.push("minimapBoundingBox.width must be > 0.");
  if (box.height <= 0) warnings.push("minimapBoundingBox.height must be > 0.");
  if (box.x + box.width > sourceWidth) warnings.push("minimapBoundingBox must fit inside source image width.");
  if (box.y + box.height > sourceHeight) warnings.push("minimapBoundingBox must fit inside source image height.");

  return warnings;
}

function validateOutputSize(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    throw new Error("outputSize width and height must be > 0.");
  }
}

function isBoundingBox(value: unknown): value is MinimapBoundingBox {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function isNumberTuple(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveFromCwd(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function toProjectRelative(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
