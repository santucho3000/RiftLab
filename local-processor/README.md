# RiftLab Local Processor MVP v0.4

This is a local-only research/MVP scaffold for future post-match replay processing.

It is intentionally safe and limited:

- post-match only
- no live-game analysis
- no anti-cheat interaction
- no memory reading
- no code injection
- no overlays
- no League Client automation yet
- no champion detection
- no tracking
- no video upload
- no `.rofl` parsing

RiftLab Web stays API-first. The future RiftLab Local Processor direction is:

```text
.rofl replay
-> controlled post-match replay capture
-> minimap frames
-> optional spatial measurements
-> vod-evidence.v0.1 JSON
-> RiftLab Web evidence preview / future fusion
```

For v0.4, this scaffold only:

1. Loads a local config file.
2. Checks known safe replay directories.
3. Accepts an explicit `--replay <path-to-rofl>` file.
4. Scans one selected replay directory for `.rofl` files when `--replay` is not provided.
5. Selects the newest `.rofl` file when auto-discovery finds replay candidates.
6. Prints found replay candidates.
7. Writes a replay input manifest when a replay is selected.
8. Writes a run summary JSON.
9. Writes a placeholder `vod-evidence.v0.1` JSON export.

## Run

No heavy dependencies are required. This package uses Node built-ins.

From the repo root:

```bash
npx tsx local-processor/src/index.ts
```

Run with an explicit replay file:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-0000000000.rofl"
```

Run with explicit match identity:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-0000000000.rofl" --match-id "LA2_1557836680"
```

Or with a numeric game ID:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-0000000000.rofl" --game-id "1557836680"
```

You can provide both `--match-id` and `--game-id`. v0.6 stores both but does not validate their relationship.

Run with API match context exported by the RiftLab web app:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-0000000000.rofl" --api-match-context "local-processor/config/api-match-context.example.json"
```

If `--api-match-context` is provided together with `--match-id` or `--game-id`, the API match context file has priority and CLI identity arguments are ignored with a warning in `run-summary.json`.

Or from `local-processor/` after installing its tiny dev toolchain:

```bash
npm install
npm run dev
```

Or pass a custom config path:

```bash
npm run dev -- config/local-processor.example.json
```

If `replayDirectory` is empty, the processor will try conservative auto-discovery.

If `--replay` is provided, that file is selected directly. The processor validates that the file exists and has a `.rofl` extension. It does not auto-select another replay in this mode.

## Replay Directory Discovery

The processor never scans the whole disk. It only checks known safe folders.

On Windows, v0.2 checks:

- `%USERPROFILE%/Documents/League of Legends/Replays`
- `%USERPROFILE%/OneDrive/Documents/League of Legends/Replays`
- `%USERPROFILE%/OneDrive/Documentos/League of Legends/Replays`
- `%USERPROFILE%/Documents/League of Legends/Highlights`
- `%USERPROFILE%/Videos/League of Legends`

For each candidate, it checks:

- whether the directory exists
- how many `.rofl` files it contains
- the newest replay `modifiedAt`, if any `.rofl` files exist

If `replayDirectory` is set in the config, that directory is scanned first and marked with source `config`. Auto-discovered folders are still printed as suggestions.

If `replayDirectory` is empty, the processor selects the first existing candidate with `.rofl` files. If none are found, it prints:

```text
No replay directory found automatically. Set replayDirectory in local-processor/config/local-processor.example.json or pass a custom config.
```

## Manual Override

To override discovery, edit:

```text
local-processor/config/local-processor.example.json
```

Set:

```json
{
  "replayDirectory": "C:/Users/YourName/Documents/League of Legends/Replays"
}
```

Then run the processor again.

## Explicit Replay Selection

`--replay` is useful when you already know which `.rofl` file should be used for a future processing run:

```bash
npx tsx local-processor/src/index.ts --replay "C:/path/to/replay.rofl"
```

Expected valid output includes:

```text
Selected replay file from --replay: C:/path/to/replay.rofl
```

If the path does not exist, the processor exits safely with:

```text
Explicit replay file does not exist: C:/path/to/replay.rofl
```

If the path does not end in `.rofl`, the processor exits safely with:

```text
Explicit replay file must have a .rofl extension: C:/path/to/file.txt
```

`run-summary.json` includes selected replay metadata:

- `replayPath`
- `replayFileName`
- `replaySizeBytes`
- `replayModifiedAt`
- `selectionMode`: `explicit` or `auto-discovered`

v0.6 also includes `matchIdentity`. Match identity is only set when provided explicitly through `--match-id` or `--game-id`. The Local Processor does not parse `.rofl` metadata and does not guess match IDs from filenames.

v0.8 adds a `matchIdentity.source` object. Explicit identity is marked as external Riot API context provided by CLI, but `verifiedByLocalProcessor` remains `false` because the Local Processor does not call Riot API.

v0.9 supports `--api-match-context <path-to-json>`. This file represents official match context exported by the RiftLab web app after Riot API lookup. The Local Processor validates the local file shape but still does not call Riot API or verify the identity itself.

v0.10 adds a local consistency check when both API match context and filename hint are available. It compares `apiMatchContext.matchIdentity.matchId` with `filenameHint.possibleMatchId`. A match is informational only; a mismatch warns that the replay and API context may not belong together. This is not Riot API verification.

v0.13 writes `local-processor/output/processing-job-plan.json` after a replay input manifest is created. The plan lists future stages but does not execute them. All replay opening remains manual, and future capture/minimap stages are marked as `future`.

v0.14 writes `local-processor/output/manual-replay-open-checklist.json` after the processing job plan. Every step is marked `manual_required`; the Local Processor still does not launch, click, or automate the League client.

v0.15 writes `local-processor/output/replay-window-readiness.json`. This describes future passive window lookup requirements, but `enabledNow` and frame capture remain `false`.

v0.16 writes `local-processor/output/fixed-capture-preset.json`. This defines a future fixed 1920x1080 replay capture preset and minimap crop placeholder, but both capture and minimap crop are disabled now.

v0.17 writes `local-processor/output/calibration-screenshot-contract.json`. This defines how a future manually supplied replay screenshot could be accepted for minimap crop calibration, but screenshot capture and validation are disabled now.

v0.18 adds optional manual screenshot validation:

```bash
npx tsx local-processor/src/index.ts --replay "C:/path/to/LA2-1557836680.rofl" --calibration-screenshot "C:/path/to/manual-replay-screenshot.png"
```

The screenshot must be provided manually by the user. The Local Processor does not capture screenshots, detect windows, click the client, or perform visual minimap/champion analysis. It only reads basic image dimensions from `png`, `jpg`, or `jpeg` files and checks the fixed minimap crop preset against the image bounds.

If validation runs, it writes:

```text
local-processor/output/calibration-report.json
```

The report status is:

- `pass` when the screenshot is readable, matches the expected 1920x1080 preset, and the minimap crop is within bounds
- `warning` when the image is readable and the crop is valid, but resolution differs from the preset
- `fail` when image dimensions cannot be read or the crop is outside image bounds

If `--calibration-screenshot` is not provided, no calibration report is written.

v0.19 exports minimap crop previews when `--calibration-screenshot` is provided and calibration status is `pass` or `warning`:

```text
local-processor/output/minimap-crop.png
local-processor/output/minimap-normalized.png
local-processor/output/minimap-crop-metadata.json
```

These images are derived only from the manually provided screenshot path. The processor still does not capture screenshots, capture frames, detect windows, detect champions, detect wards, detect objectives, or analyze minimap content.

v0.20 also generates five automatic minimap crop candidates from likely bottom-right minimap regions:

```text
local-processor/output/minimap-candidates/candidate-01.png
local-processor/output/minimap-candidates/candidate-02.png
local-processor/output/minimap-candidates/candidate-03.png
local-processor/output/minimap-candidates/candidate-04.png
local-processor/output/minimap-candidates/candidate-05.png
local-processor/output/minimap-candidates/candidates-metadata.json
```

These candidates are for developer inspection only. The user does not need to enter crop coordinates. No automatic candidate selection or minimap analysis is performed yet.

v0.22 adds an opt-in Replay API availability probe:

```bash
npx tsx local-processor/src/index.ts --probe-replay-api
```

This probe only performs short local `GET` requests against replay-scoped endpoints at `https://127.0.0.1:2999`. It does not launch League, does not open a replay, does not change playback or render settings, does not seek, and does not capture frames. It only checks whether a replay API appears available after the user has opened a replay manually.

If requested, it writes:

```text
local-processor/output/replay-api-status.json
```

v0.23 extends the probe with Swagger-based endpoint discovery:

```text
local-processor/output/replay-api-endpoints.json
```

This report fetches `/swagger/v2/swagger.json`, classifies discovered paths, and helps us distinguish between replay-capable endpoints and environments that expose only `liveclientdata` endpoints.

v0.25 adds opt-in `/Help` documentation discovery:

```bash
npx tsx local-processor/src/index.ts --probe-replay-api --probe-replay-help
```

This calls only `/Help` with an empty POST body because Swagger exposes it as a built-in documentation endpoint. It does not call `/Exit`, `/Cancel`, `/Subscribe`, `/Unsubscribe`, `/AsyncDelete`, `/replay/render`, or `/replay/playback`, and it does not change playback, render, camera, or replay state.

If requested, it writes:

```text
local-processor/output/replay-api-help-discovery.json
```

v0.28 adds read-only local replay config inspection:

```bash
npx tsx local-processor/src/index.ts --inspect-local-replay-config
```

This inspects only known safe/common local config file paths and writes:

```text
local-processor/output/local-replay-config-inspection.json
```

It reads text config files only. It does not modify Riot or League files, does not launch League, does not open replays, does not change replay state, and does not capture frames.

v0.29 also writes a read-only recommendation report when local replay config inspection is requested:

```text
local-processor/output/replay-api-config-recommendation.json
```

The recommendation report summarizes the detected `game.cfg` values and lists manual checks for future replay API enablement experiments. The Local Processor still does not modify League config files.

To test a mismatch intentionally:

```bash
npx tsx local-processor/src/index.ts --replay "C:/path/to/LA2-1557836680.rofl" --api-match-context "local-processor/fixtures/api-match-context.mismatch.sample.json"
```

Expected result:

- console warns that API match context does not match filename hint
- `replay-input-manifest.json.matchContextConsistency.status` is `mismatch`
- `replay-input-manifest.json.matchContextConsistency.severity` is `warning`
- `run-summary.json.warnings` includes a mismatch warning

v0.7 also includes `filenameHint` when a replay filename matches:

```text
<platformId>-<gameId>.rofl
```

Example:

```text
LA2-1557836680.rofl -> possibleMatchId LA2_1557836680
```

This hint is low confidence and not verified against Riot API. It must not replace explicit match identity or official Riot API facts.

## Replay Input Manifest

When a replay is selected, v0.4 writes:

```text
local-processor/output/replay-input-manifest.json
```

This manifest represents the selected `.rofl` file as the official input for future offline processing stages. It includes:

- schema version
- selected replay metadata
- match identity, if explicitly provided
- filename hint, if the replay filename matches the common pattern
- current and next processing stage
- safety flags confirming that this scaffold does not launch League, automate the client, read memory, inject code, create overlays, bypass anti-cheat, or perform live-game analysis

If no replay is selected, no manifest is written.

## Manual Safe Flow

Current manual-safe instruction:

> Open the replay manually in the League client. Future versions will capture frames from the replay window.

This processor does not open the League client and does not automate it.

v0.4 still does not open, parse, or automate League. It only discovers or selects local replay files after the match.
