# RiftLab Local Processor MVP v0.1

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

For v0.1, this scaffold only:

1. Loads a local config file.
2. Scans a user-provided replay directory for `.rofl` files.
3. Prints found replay candidates.
4. Writes a run summary JSON.
5. Writes a placeholder `vod-evidence.v0.1` JSON export.

## Run

No heavy dependencies are required. This package uses Node built-ins.

From the repo root:

```bash
npx tsx local-processor/src/index.ts
```

Or from `local-processor/` after installing its tiny dev toolchain:

```bash
npm install
npm run dev
```

Or pass a custom config path:

```bash
npm run dev -- config/local-processor.example.json
```

If `replayDirectory` is empty, the processor will skip discovery and write placeholder outputs.

## Manual Safe Flow

Current manual-safe instruction:

> Open the replay manually in the League client. Future versions will capture frames from the replay window.

This processor does not open the League client and does not automate it.
