# Replay API Assisted Mode

## Purpose

This document records the post-v0.20 architecture pivot for RiftLab Local Processor.

RiftLab is moving away from treating manual screenshot crop tuning as the main long-term flow. Manual screenshot validation and candidate crops remain useful, but only as fallback and developer calibration tools.

The future primary direction is:

```text
user manually opens replay
-> Replay API availability probe
-> standardized replay HUD/render
-> fixed 512x512 minimap crop
-> event-window minimap capture
-> CV/tracking
-> vod-evidence JSON
```

## External Reference

RiftLab uses `pyLoL` as an external technical reference for future replay and minimap processing direction:

- Repository:
  [pyLoL on GitHub](https://github.com/league-of-legends-replay-extractor/pyLoL)
- Public repo summary currently describes it as a League of Legends replay extractor using CV and mentions replay minimap extraction, positional data gathering, OCR, champion tracking, and 512x512 minimap model inputs.

RiftLab does not copy `pyLoL` code. RiftLab also does not inherit `pyLoL` behaviors automatically. We are taking architecture inspiration only.

## What pyLoL Inspires

The useful architectural ideas are:

- standardized replay render and HUD before CV
- a fixed minimap crop after the replay view is standardized
- 512x512 minimap images as the core CV input
- minimap frame sequences instead of one-off screenshots
- future champion, ward, rotation, and spatial tracking from minimap footage

The most important lesson is not `.rofl` parsing. The most important lesson is that a fixed crop becomes practical only after the replay environment is standardized first.

## What RiftLab Must Not Implement

The following `pyLoL`-adjacent behaviors are explicitly out of scope for RiftLab:

- automatic League client launch
- automatic replay opening
- keyboard automation
- mouse automation
- LCU auth or token handling for controlling the general League client
- reverse engineering, decrypting, parsing, or extracting internal data from `.rofl` files
- memory reading
- code injection
- anti-cheat bypass
- overlays
- live-game behavior

These are product and safety boundaries, not temporary omissions.

## Why `.rofl` Parsing Is Forbidden

RiftLab must not reverse engineer or parse `.rofl` internals for product data extraction.

Why:

- it moves the product toward a reverse-engineering path we do not want
- it weakens the safety boundary between post-match tooling and unsupported client internals
- it creates legal, maintenance, and compatibility risk across patches
- it distracts from the more robust architecture: replay view standardization plus minimap CV

RiftLab may select replay files, link them to external match context, and use them as offline inputs. It must not treat `.rofl` as a trusted structured data source.

## Why pyLoL Can Use a Fixed Minimap Crop

`pyLoL` demonstrates that fixed minimap CV becomes viable when the replay presentation is standardized first.

That means:

- replay resolution is controlled
- HUD layout is controlled
- observer view is controlled
- minimap placement becomes predictable
- 512x512 minimap crops become reusable across many replay frames

Without that standardization, HUD scale and render differences force guesswork. That is why RiftLab v0.19 and v0.20 manual screenshot tools are helpful for fallback validation, but not ideal as the default user experience.

## Mode Definitions

### `manual_safe`

Current supported mode.

Properties:

- user manually opens the replay
- Local Processor does not call Replay API yet
- Local Processor does not automate League
- manual screenshot validation is allowed
- minimap crop candidates are allowed for developer inspection

### `replay_api_assisted`

Future intended mode.

Properties:

- user still manually opens the replay
- Local Processor may later probe local Replay API availability only after the replay is already open
- Replay API may later help standardize HUD, render, playback, and event-window seeking
- fixed 512x512 minimap crop becomes the main path after standardization

### Forbidden `.rofl` Reverse Engineering

Not a mode. Not allowed.

Includes:

- decryption
- internal replay parsing
- extracting unsupported internal replay state

### Forbidden Client Launch and Input Automation

Not a mode. Not allowed.

Includes:

- launching League automatically
- opening replays automatically
- keyboard or mouse control
- LCU-based control of the general client

### Forbidden Memory, Injection, and Anti-Cheat Bypass

Not a mode. Not allowed.

Includes:

- memory reading
- DLL injection
- overlays
- anti-cheat bypass
- any live-game interaction path

## What Replay API Assisted Mode May Allow Later

Replay API assisted mode may later support:

- Replay API availability probe
- HUD and render preset application
- playback speed profiles
- event-window seeking
- fixed 512x512 minimap crop
- future minimap frame capture

These are allowed only after the user has manually opened the replay. Replay API assisted mode must remain post-match and offline.

## Why Manual Screenshot Candidates Still Matter

Manual screenshot validation and crop candidates remain useful for:

- developer inspection
- crop preset validation
- HUD variance debugging
- fallback calibration when standardization is incomplete

They should not be treated as the preferred end-user flow. The product should trend toward a standardized replay environment so crop coordinates stop being a user-facing concern.

## New Recommended Pipeline

The recommended long-term pipeline is:

```text
user manually opens replay
-> Replay API availability probe
-> HUD/render preset
-> fixed 512x512 minimap crop
-> event-window minimap capture
-> CV/tracking
-> vod-evidence JSON
```

This keeps RiftLab:

- post-match only
- offline only
- manual-safe at replay open time
- Riot API aligned for official match facts
- CV-first for spatial evidence

## Notes for Future MVPs

Near-term technical work should focus on:

- documenting `replay_api_assisted` as a distinct future branch
- Replay API availability probing after manual replay open
- defining HUD and render standardization targets
- defining event-window capture plans driven by Riot API timeline events
- keeping screenshot candidate tools as fallback validation, not the primary path
