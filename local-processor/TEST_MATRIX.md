# RiftLab Local Processor Test Matrix

Status: developer checklist  
Scope: local-only, post-match, manual-safe processor behavior  

This matrix documents expected Local Processor behavior. It does not require Riot API calls, ROFL parsing, frame capture, League Client automation, overlays, memory reads, injection, or live-game behavior.

Replace example replay paths with a real local `.rofl` path when running commands.

## 1. Auto-Discovery With No `.rofl` Files

Purpose: Verify the processor fails safely when no replay can be selected automatically.

Example command:

```bash
npx tsx local-processor/src/index.ts
```

Expected console behavior:

- Prints discovered replay directory candidates.
- Prints no replay directory found or no `.rofl` files found.
- Prints `No selected replay; replay input manifest was not written.`

Expected output JSON fields:

- `run-summary.json.selectedReplay` is absent or `undefined`.
- `run-summary.json.replayCount` is `0`.
- `run-summary.json.vodEvidencePlaceholderGeneratedFromManifest` is `false`.
- `replay-input-manifest.json` should not be written by that run.

## 2. Auto-Discovery With `.rofl` Files

Purpose: Verify the processor can select the newest discovered replay without explicit `--replay`.

Example command:

```bash
npx tsx local-processor/src/index.ts
```

Expected console behavior:

- Prints discovered replay directory candidates.
- Prints selected replay directory.
- Prints found `.rofl` files.
- Prints selected replay file.

Expected output JSON fields:

- `run-summary.json.selectedReplay.selectionMode` is `auto-discovered`.
- `run-summary.json.selectedReplay.replayPath` is populated.
- `run-summary.json.replayInputManifestPath` is `local-processor/output/replay-input-manifest.json`.
- `run-summary.json.vodEvidencePlaceholderGeneratedFromManifest` is `true`.
- `replay-input-manifest.json.selectedReplay.selectionMode` is `auto-discovered`.
- `vod-evidence-placeholder.json.source.replay` is populated.

## 3. Explicit `--replay` Valid File

Purpose: Verify explicit replay selection bypasses auto-selection.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-1557836680.rofl"
```

Expected console behavior:

- Prints `Selected replay file from --replay: <path>`.
- Prints found one `.rofl` file.
- Does not auto-select another replay.

Expected output JSON fields:

- `run-summary.json.selectedReplay.selectionMode` is `explicit`.
- `run-summary.json.discoveredReplayDirectories` may be empty.
- `run-summary.json.selectedReplay.replayFileName` matches the explicit file.
- `replay-input-manifest.json.selectedReplay.selectionMode` is `explicit`.

## 4. Explicit `--replay` Invalid Path

Purpose: Verify invalid explicit replay paths fail safely.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/missing/replay.rofl"
```

Expected console behavior:

- Prints a clear error like `Explicit replay file does not exist: <path>`.
- Exits safely.

Expected output JSON fields:

- No new misleading `replay-input-manifest.json` should be written for that failed run.
- No new misleading `vod-evidence-placeholder.json` should be written for that failed run.

## 5. Explicit `--replay` Non-`.rofl` File

Purpose: Verify explicit replay selection rejects non-ROFL files.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Desktop/not-a-replay.txt"
```

Expected console behavior:

- Prints a clear error like `Explicit replay file must have a .rofl extension: <path>`.
- Exits safely.

Expected output JSON fields:

- No new misleading `replay-input-manifest.json` should be written for that failed run.
- No new misleading `vod-evidence-placeholder.json` should be written for that failed run.

## 6. No API Match Context

Purpose: Verify match identity remains unresolved when not provided explicitly.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-1557836680.rofl"
```

Expected console behavior:

- Prints filename hint if the filename matches `<platformId>-<gameId>.rofl`.
- Prints `Match identity unresolved. No matchId/gameId was provided and .rofl metadata parsing is not implemented.`
- Prints `Match context consistency check not applicable.`

Expected output JSON fields:

- `replay-input-manifest.json.matchIdentity.resolutionStatus` is `unresolved`.
- `replay-input-manifest.json.matchIdentity.source.type` is `none`.
- `replay-input-manifest.json.filenameHint.status` may be `filename_hint_only`.
- `replay-input-manifest.json.matchContextConsistency.status` is `not_applicable`.
- `vod-evidence-placeholder.json.source.matchIdentity.resolutionStatus` is `unresolved`.

## 7. Valid API Match Context Matching Filename Hint

Purpose: Verify API context and filename hint consistency check returns match.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-1557836680.rofl" --api-match-context "local-processor/fixtures/api-match-context.sample.json"
```

Expected console behavior:

- Prints `Match identity provided explicitly from external Riot API context. Not verified by Local Processor.`
- Prints `API match context is consistent with filename hint. This is not official verification.`

Expected output JSON fields:

- `replay-input-manifest.json.matchIdentity.resolutionStatus` is `provided_explicitly`.
- `replay-input-manifest.json.matchIdentity.source.providedBy` is `api_match_context_file`.
- `replay-input-manifest.json.matchIdentity.source.verifiedByLocalProcessor` is `false`.
- `replay-input-manifest.json.matchContextConsistency.status` is `match`.
- `replay-input-manifest.json.matchContextConsistency.severity` is `info`.
- `run-summary.json.matchContextConsistencyStatus` is `match`.

## 8. Valid API Match Context Mismatching Filename Hint

Purpose: Verify mismatch detection warns without claiming Riot API verification.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-1557836680.rofl" --api-match-context "local-processor/fixtures/api-match-context.mismatch.sample.json"
```

Expected console behavior:

- Prints `Warning: API match context does not match filename hint. Check that the selected replay belongs to the provided match context.`

Expected output JSON fields:

- `replay-input-manifest.json.matchContextConsistency.status` is `mismatch`.
- `replay-input-manifest.json.matchContextConsistency.severity` is `warning`.
- `replay-input-manifest.json.matchContextConsistency.apiMatchId` comes from API context.
- `replay-input-manifest.json.matchContextConsistency.filenameHintPossibleMatchId` comes from filename hint.
- `run-summary.json.matchContextConsistencyStatus` is `mismatch`.
- `run-summary.json.matchContextConsistencySeverity` is `warning`.
- `run-summary.json.warnings` includes the mismatch warning.

## 9. Invalid API Match Context Path

Purpose: Verify missing context files fail safely.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-1557836680.rofl" --api-match-context "local-processor/fixtures/missing.json"
```

Expected console behavior:

- Prints a clear error like `API match context file does not exist: <path>`.
- Exits safely.

Expected output JSON fields:

- No new misleading `replay-input-manifest.json` should be written for that failed run.
- No new misleading `vod-evidence-placeholder.json` should be written for that failed run.

## 10. Invalid API Match Context `schemaVersion`

Purpose: Verify invalid context schemas fail safely.

Example command:

```bash
npx tsx local-processor/src/index.ts --replay "C:/Users/YourName/Documents/League of Legends/Replays/LA2-1557836680.rofl" --api-match-context "local-processor/fixtures/api-match-context.invalid-schema.sample.json"
```

Expected console behavior:

- Prints a clear error like `API match context schemaVersion must equal "api-match-context.v0.1" and required fields must exist.`
- Exits safely.

Expected output JSON fields:

- No new misleading `replay-input-manifest.json` should be written for that failed run.
- No new misleading `vod-evidence-placeholder.json` should be written for that failed run.

## 11. Future `replay_api_assisted` Branch

Purpose: Track the planned branch where the replay is still opened manually, but later replay processing may use local Replay API only after the replay is already open.

Important safety note:

- RiftLab must not automatically launch League.
- RiftLab must not automatically open replays.
- RiftLab must not automate keyboard or mouse input.

Future tests to add:

- Replay API availability unavailable.
- Replay API availability available.
- HUD and render preset dry-run.
- Playback speed validation.
- Event-window processing plan generation.

Expected future behavior:

- `manual_safe` remains the supported fallback and developer validation branch.
- `replay_api_assisted` becomes the preferred long-term branch only after manual replay open.
- No replay launch automation is introduced.

## 12. Replay API Discovery `liveclientdata_only`

Purpose: Verify the processor distinguishes a reachable local API host from replay control availability.

Example command:

```bash
npx tsx local-processor/src/index.ts --probe-replay-api
```

Expected console behavior:

- Prints that replay endpoint discovery found `liveclientdata` endpoints only.
- Prints that replay render/playback endpoints were not discovered.
- Does not POST to any endpoint.
- Does not change playback, render, camera, or replay state.

Expected output JSON fields:

- `replay-api-endpoints.json.swaggerAvailable` is `true`.
- `replay-api-endpoints.json.endpointDiscovery.hasLiveClientDataEndpoints` is `true`.
- `replay-api-endpoints.json.endpointDiscovery.hasReplayEndpoints` is `false`.
- `replay-api-endpoints.json.endpointDiscovery.hasReplayRenderEndpoint` is `false`.
- `replay-api-endpoints.json.endpointDiscovery.hasReplayPlaybackEndpoint` is `false`.
- `replay-api-endpoints.json.interpretation.status` is `liveclientdata_only`.
- `run-summary.json.replayApiEndpointDiscoveryStatus` is `liveclientdata_only`.

## 13. Future Replay Endpoints Discovered

Purpose: Future test for an environment where replay render/playback endpoints become discoverable.

Example command:

```bash
npx tsx local-processor/src/index.ts --probe-replay-api
```

Expected future output JSON fields:

- `replay-api-endpoints.json.swaggerAvailable` is `true`.
- `replay-api-endpoints.json.endpointDiscovery.hasReplayEndpoints` is `true`.
- `replay-api-endpoints.json.endpointDiscovery.hasReplayRenderEndpoint` is `true` if `/replay/render` is present.
- `replay-api-endpoints.json.endpointDiscovery.hasReplayPlaybackEndpoint` is `true` if `/replay/playback` is present.
- `replay-api-endpoints.json.interpretation.status` is `replay_endpoints_available`.

Important safety note:

- Discovery alone must not imply render or playback control is enabled.
- Any future control step must be implemented separately and only after endpoint semantics are documented.

## 14. Future `/Help` Discovery

Purpose: Future read-only test for built-in endpoint documentation exposed by the local API host.

Expected behavior:

- Uses GET only.
- Does not POST to `/Help` or any related endpoint.
- Does not change client or replay state.
- Records any discovered read-only documentation separately from Swagger discovery.

## 15. Future Read-Only Local Configuration Inspection

Purpose: Document how local client/replay configuration affects endpoint availability without changing client state.

Expected behavior:

- Uses read-only inspection only.
- Does not write client settings.
- Does not launch League.
- Does not open replays automatically.
- Records relevant local state for comparison with endpoint discovery output.

## 16. Endpoint Discovery After Configuration Verification

Purpose: Verify whether endpoint availability changes after manually confirming local replay/client configuration.

Expected behavior:

- Runs endpoint discovery with `--probe-replay-api`.
- Compares `replay-api-endpoints.json` before and after configuration verification.
- Confirms whether `/replay/render` or `/replay/playback` appears.
- Does not POST to replay control endpoints.

## 17. Endpoint Discovery After Different Replay-Open Methods

Purpose: Compare endpoint availability across different manual replay-open paths.

Manual scenarios to compare:

- replay opened from match history
- replay opened from a downloaded replay
- replay opened through any supported user-driven client flow

Expected behavior:

- Local Processor does not open the replay.
- Local Processor only probes after the user manually opens it.
- Results are recorded in `replay-api-endpoints.json`.

## 18. Manual Safe Fallback Remains Available

Purpose: Confirm the screenshot/crop candidate pipeline remains usable while replay API enablement is unresolved.

Expected behavior:

- `--calibration-screenshot` still validates manually provided screenshots.
- minimap crop export still works when calibration passes.
- minimap crop candidates still generate for developer inspection.
- No replay control endpoints are required.

## Later Scenarios Worth Adding

- API context with missing `playerContext` fields.
- API context with valid match ID but different region/platform.
- Filename that does not match `<platformId>-<gameId>.rofl`.
- Config-provided replay directory with multiple `.rofl` files and newest selection.
- Output cleanup behavior after failed runs.
- Replay API assisted availability probe after manual replay open.
- Replay API assisted HUD and playback preset dry-run.
- Event-window based processing plan for objective and death windows.
- Client/replay state logging for endpoint discovery runs.
- Endpoint discovery comparison table across replay-open methods.
