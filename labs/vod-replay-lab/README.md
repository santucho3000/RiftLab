# RiftLab VOD Replay Lab

This folder is for isolated post-match research fixtures and TypeScript-only lab interfaces.

It is not production code. It does not implement computer vision, video upload, pyLoL integration, League Client automation, live-game analysis, model inference, or scoring integration.

The current research target is one objective window at a time:

- 90 seconds before an objective
- 45 seconds after an objective
- champion positions
- team presence
- isolation
- rotation direction
- zone control

The goal is to learn whether spatial evidence can improve RiftLab's Causal Impact Chains before any scoring changes are made.

See `docs/vod-replay-lab-plan.md` for the full plan.

## Fixtures

Fixtures in `labs/vod-replay-lab/fixtures` are manually authored research data. They are not real VOD output and should not be used for production scoring.

- `isolated-death-before-dragon.json`: tests an API-only death-before-Dragon chain where spatial evidence suggests isolated river positioning, stronger enemy presence, and enemy zone control. Expected interpretation: value lost with higher causal confidence if real evidence validated it.
- `useful-death-before-allied-dragon.json`: tests a death-before-objective chain where allied team secures Dragon and spatial evidence suggests the dead player zoned or pulled enemy members away. Expected interpretation: possible neutral or positive trade, not automatic value lost.
- `late-rotation-to-herald.json`: tests a poorly contested Herald where spatial evidence suggests late/staggered allied rotation and enemy first river control. Expected interpretation: tempo/setup issue with confidence limits.
- `objective-window-sample.json`: older minimal lab shape for one Dragon window. Kept as a simple research example.

## Validation Note

The production VOD evidence validator can validate the three `vod-evidence.v0.1` fixtures because they follow the same root shape. A lightweight validation check can import `validateVodEvidenceBundle` from `lib/vod-evidence/validation.ts`, read each JSON file, and print `isValid`, `errors`, and `warnings`.

No heavy dependencies are required. The lab should keep validation read-only and separate from the current Riot API report.

## Objective Window Measurement Script

Run the lab-only measurement script with:

```bash
npx tsx labs/vod-replay-lab/measure-objective-window.ts
```

The script:

- reads JSON fixtures from `labs/vod-replay-lab/fixtures`
- processes only `schemaVersion: "vod-evidence.v0.1"`
- validates each fixture with `validateVodEvidenceBundle`
- computes objective presence, isolation, zone control, rotation timing, and fight setup summaries
- prints readable lab interpretations to the console
- writes `labs/vod-replay-lab/output/objective-window-measurements.json`

This output is research-only. It is not imported by production pages, not connected to scoring, and not used by the current Riot API report.

## Enriched Chain Preview Script

After generating objective-window measurements, run:

```bash
npx tsx labs/vod-replay-lab/enriched-chain-preview.ts
```

The preview script reads `labs/vod-replay-lab/output/objective-window-measurements.json` and writes:

```text
labs/vod-replay-lab/output/enriched-chain-preview.json
```

It compares each API-only Causal Impact Chain with a VOD/spatially enriched interpretation:

- API-only classification and confidence
- VOD-enhanced classification and confidence
- confidence change
- classification change
- scoring impact recommendation for future research

This is still research-only. It does not change production scoring, does not change the Riot API report, and does not connect VOD evidence to the current app.
