# Replay Processing Strategy

## Goal

RiftLab should not make the user watch or process an entire replay by default.

The Local Processor should eventually operate on targeted replay windows informed by official Riot API events, then use minimap CV only where it improves causal interpretation.

## Core Strategy

Default replay processing should be event-window based.

Reason:

- most scoring and causal interpretation needs are concentrated around deaths, objectives, structures, rotations, and teamfights
- targeted windows are much faster than full replay scans
- targeted windows are easier to validate
- targeted windows fit the Local Processor safety model better than an always-on or long-running capture flow

## Recommended Processing Modes

### `objective_windows_default`

Recommended MVP default.

- process only objective-related windows
- prioritize Dragon, Herald, Baron, Elder, and high-value structure moments
- pair each capture window with Riot API timeline context

### `fast_scan`

Optional later mode.

- process a small number of curated windows quickly
- useful for lightweight summaries or time-constrained local runs

### `full_scan_advanced`

Advanced later mode, not MVP default.

- scan much larger portions of a replay
- higher time cost
- higher storage and validation cost
- more useful for research than for default end-user flow

### `teamfight_detail`

Optional later mode.

- capture dense windows around fight clusters
- useful when evaluating setup, spacing, isolation, collapse timing, or follow-up conversion

## Replay Speed Strategy

Playback speed should be configurable in future Replay API assisted mode.

Key planning assumptions:

- `x4` playback can reduce total processing time if the replay environment and downstream capture remain stable
- a 30 minute replay at `x4` is about 7.5 minutes of real time
- 10 windows of 75 seconds each at `x4` is about 3 minutes of real time

Important boundary:

- supported playback speeds must be probed and validated later
- RiftLab must not assume specific playback controls work until Replay API assisted mode proves them

## Example Event Windows

Suggested initial windows:

- objective: 45 seconds before to 30 seconds after
- death before objective: 30 seconds before death to 45 seconds after objective
- structure loss: 30 seconds before to 30 seconds after
- teamfight cluster: 20 seconds before to 30 seconds after

These are planning defaults only. Exact windows should be validated against future replay capture quality.

## pyLoL Alignment

`pyLoL` informs the architecture direction in a narrow and deliberate way:

- use it as inspiration for replay-based minimap CV structure
- do not copy code
- do not implement automatic client launch or replay opening
- do not use LCU auth or token handling to control the general League client
- prefer manual replay open plus Replay API assisted standardization
- keep the fixed 512x512 minimap crop as the downstream CV target after standardization

## Manual Screenshot Fallback

The manual screenshot and crop candidate flow remains useful, but only as:

- developer validation
- fallback calibration
- HUD variance debugging

It is not the recommended long-term default flow.

## Recommended Long-Term Pipeline

```text
Riot API timeline events
-> event-window processing plan
-> user manually opens replay
-> Replay API availability probe
-> HUD/render standardization
-> fixed 512x512 minimap crop
-> event-window minimap capture
-> CV/tracking
-> vod-evidence JSON
```

## MVP Guidance

The next replay-processing MVP should favor:

- Replay API availability probing after manual replay open
- defining a dry-run HUD and render preset contract
- defining event-window processing plans from Riot API timeline data

It should avoid:

- full replay scan as the default path
- replay launch automation
- input automation
- `.rofl` reverse engineering
