# RiftLab Minimap Reader Lab v0.1

This folder is for offline minimap preprocessing research only.

It does not implement computer vision, champion detection, tracking, video upload, video processing, pyLoL integration, production scoring, League Client interaction, memory reading, overlays, or live-game functionality.

The purpose of v0.1 is narrow:

1. Take a static post-match screenshot or frame image.
2. Use a manually provided minimap bounding box.
3. Crop the minimap.
4. Resize and normalize it to a stable debug size.
5. Write debug metadata for future experiments.

This prepares RiftLab for later lab work on minimap coordinate normalization, champion icon detection, ward context, objective presence, rotations, team spacing, and zone control.

## Folder Structure

- `input/`: place local screenshots or frame images here.
- `config/`: minimap crop configs.
- `output/`: generated crops, normalized minimap images, and debug metadata.

## Run

Place a screenshot at:

```text
labs/minimap-reader-lab/input/sample-frame.png
```

Then run:

```bash
npm run lab:minimap:crop
```

Or provide a custom config:

```bash
npm run lab:minimap:crop -- labs/minimap-reader-lab/config/sample-minimap-config.json
```

The script writes:

- `labs/minimap-reader-lab/output/minimap-crop.png`
- `labs/minimap-reader-lab/output/minimap-normalized.png`
- `labs/minimap-reader-lab/output/debug-metadata.json`

## Config

`config/sample-minimap-config.json` defines:

- input image path
- output directory
- manual minimap bounding box
- normalized output size
- coordinate system metadata

The bounding box is in source image pixel coordinates.

## Research Boundary

This lab is not connected to production. It is not imported by app pages, Riot API report logic, scoring, or the Causal Impact Engine. Future VOD evidence work should consume validated evidence JSON, not raw lab image files.

