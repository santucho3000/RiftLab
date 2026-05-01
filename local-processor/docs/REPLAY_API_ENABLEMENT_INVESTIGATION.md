# Replay API Enablement Investigation

## Current Finding

The current Local Processor probes show that the local API surface is reachable, but replay control is not confirmed.

Known findings:

- `https://127.0.0.1:2999` is reachable when the local client context is active.
- Swagger is available.
- `/liveclientdata/*` endpoints are available.
- `/swagger/*` endpoints are available.
- built-in utility endpoints are present.
- `/replay/render` was not discovered.
- `/replay/playback` was not discovered.
- `/Help` discovery did not find replay render/playback control functions.

Current interpretation:

```text
liveclientdata_only
```

## Why HUD/Render Standardization Is Blocked

Replay HUD/render standardization depends on confirmed replay control endpoints.

At the moment, RiftLab can verify that the local API host exists and that Live Client Data endpoints are exposed. That is not enough to safely control replay render settings, playback, camera, interface, or timeline position.

Until the correct replay control endpoints are confirmed, RiftLab must not implement:

- render preset changes
- playback speed changes
- seeking
- camera or observer control
- frame capture tied to replay control

## How pyLoL Differs At A High Level

`pyLoL` remains useful as architectural inspiration, but the current RiftLab environment does not expose the same confirmed control surface.

High-level differences:

- `pyLoL` appears to run replays in a more controlled replay environment.
- `pyLoL` appears to expect replay render/playback endpoints or equivalent control surfaces to exist.
- `pyLoL` uses fixed `512x512` minimap frames after standardizing the replay view.
- RiftLab has not yet confirmed the endpoints needed to standardize the replay view in the current environment.

RiftLab should keep the useful idea:

```text
standardized replay view -> fixed 512x512 minimap frames -> CV/tracking
```

RiftLab should not copy `pyLoL` code or assume its client control assumptions apply here.

## What RiftLab Should Do Next

Safe next steps:

- continue GET-only endpoint discovery
- inspect local configuration manually
- document client state when probes are run
- test endpoint discovery after different replay-open methods
- compare discovered endpoint names against `pyLoL` usage without copying code
- keep manual screenshot and crop candidate flow as fallback/dev validation

Do not proceed to HUD/render changes until the correct replay endpoints are confirmed.

## Roadmap Implication

`replay_api_assisted` remains the preferred future path, because standardized replay render still gives RiftLab the best long-term route to stable minimap CV.

`manual_safe` remains the fallback and developer validation path:

- manual screenshot validation
- minimap crop export
- crop candidates
- fixture-driven VOD evidence validation

The practical roadmap is now:

```text
endpoint discovery
-> local configuration/state investigation
-> replay control endpoint confirmation
-> HUD/render dry-run contract
-> fixed 512x512 minimap capture
```

Until replay control endpoints are confirmed, no render/playback control should be implemented.
