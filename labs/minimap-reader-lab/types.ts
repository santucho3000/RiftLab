export type MinimapBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MinimapOutputSize = {
  width: number;
  height: number;
};

export type MinimapCoordinateSystem = {
  type: "summoners_rift_minimap_normalized";
  xRange: [number, number];
  yRange: [number, number];
  origin: "blue_bottom_left";
};

export type MinimapReaderConfig = {
  inputImagePath: string;
  outputDir: string;
  minimapBoundingBox: MinimapBoundingBox;
  outputSize: MinimapOutputSize;
  coordinateSystem: MinimapCoordinateSystem;
  notes?: string;
};

export type MinimapCropResult = {
  inputImagePath: string;
  originalImageWidth: number;
  originalImageHeight: number;
  minimapBoundingBox: MinimapBoundingBox;
  outputSize: MinimapOutputSize;
  outputFiles: {
    crop: string;
    normalized: string;
    debugMetadata: string;
  };
  coordinateSystem: MinimapCoordinateSystem;
  createdAt: string;
  warnings: string[];
};

export type MinimapDebugMetadata = MinimapCropResult;
