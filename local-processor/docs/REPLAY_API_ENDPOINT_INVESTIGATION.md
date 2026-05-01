# Replay API Endpoint Investigation

## Current Finding

Local Processor v0.23 confirmed that the local API host can be reachable while replay render and playback endpoints are not available.

Observed v0.23 discovery result:

- host `https://127.0.0.1:2999` is reachable
- Swagger is available at `/swagger/v2/swagger.json`
- `liveclientdata` endpoints are available
- `/replay/render` was not discovered
- `/replay/playback` was not discovered
- interpretation status is `liveclientdata_only`

Observed endpoint families include:

- `/liveclientdata/allgamedata`
- `/liveclientdata/gamestats`
- `/liveclientdata/playerlist`
- `/swagger/v2/swagger.json`
- built-in utility endpoints such as `/Help`

## Why HUD/Render Presets Are Blocked

HUD and render preset work depends on confirmed replay control endpoints.

Right now, the local host appears to expose Live Client Data API endpoints, not replay render/playback controls. Because `/replay/render` and `/replay/playback` were not present in Swagger and direct requests returned `404 RESOURCE_NOT_FOUND`, RiftLab must not implement HUD or playback control yet.

The safe conclusion is:

- local API host reachable does not mean replay control is available
- Swagger availability does not mean `/replay/*` endpoints exist
- `liveclientdata_only` is useful, but not enough for replay_api_assisted standardization

## Possible Explanations

Several explanations remain plausible:

- `/replay/*` endpoints may have changed or been removed in the current client version
- `pyLoL` may rely on a different client or replay launch context
- `pyLoL` may use endpoints not exposed in the Swagger document
- replay render/playback controls may require a different client state or route
- the current environment may expose Live Client Data API but not Replay API controls

These are hypotheses only. RiftLab should not build against any one explanation until endpoint behavior is confirmed.

## Safe And Allowed Research

The following research remains allowed:

- GET-only endpoint discovery
- `/swagger/v2/swagger.json` inspection
- `/Help` inspection if it is read-only and does not alter state
- comparing discovered paths against documented or observed endpoint usage
- recording the client and replay state when discovery is run

No POST requests should be made until endpoint semantics are known.

## Forbidden Boundaries

The following remain forbidden:

- `.rofl` parsing, decryption, or reverse engineering
- League client launch automation
- automatic replay opening
- keyboard automation
- mouse automation
- LCU auth or token handling for general client control
- memory reading
- code injection
- anti-cheat bypass
- overlays
- live-game behavior

These boundaries still apply even if a future endpoint appears useful.

## Recommended Next Research Steps

Next safe steps:

- call `/Help` with read-only intent if it does not alter state
- inspect Swagger paths for render, playback, camera, time, seek, or observer equivalents
- compare discovered endpoints against `pyLoL` endpoint usage without copying code
- document client state when endpoint discovery is run
- document whether the replay was opened from match history, from a downloaded replay, or from a direct `.rofl` action
- test discovery with replay opened from match history versus direct `.rofl` if applicable
- keep manual screenshot and crop candidate fallback available

## Roadmap Implication

`replay_api_assisted` remains the preferred future direction, but HUD/render presets are blocked until replay control endpoints are confirmed.

Current practical roadmap:

- keep `manual_safe` screenshot and candidate tooling as fallback/dev validation
- continue GET-only endpoint discovery
- avoid render/playback POST work
- avoid assuming pyLoL endpoints exist in the current client environment

The next technical probe should focus on read-only endpoint inspection and state documentation, not control.
