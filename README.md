# RiftLab

RiftLab is a post-match competitive telemetry MVP for League of Legends.

Current state:
- Resolves Riot IDs through Riot Account-V1.
- Fetches the latest 5 Match-V5 match IDs.
- Loads details for one selected match on demand.
- Keeps the original mock RiftLab reports available separately.
- Does not fetch timelines yet.
- Does not generate full real impact reports yet.
- Does not use authentication or a database.

## Requirements

- Node.js 20 or newer recommended.
- A Riot Developer API key if you want real Riot data.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

3. Edit `.env.local` and add your Riot API key:

```env
RIOT_API_KEY=your_riot_api_key_here
RIOT_ACCOUNT_REGION=americas
RIOT_MATCH_REGION=americas
```

For LAS / Latin America, Match-V5 uses `americas`.

4. Start the app:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

## Environment Safety

Do not commit `.env.local`.

This repo includes `.env.example` with placeholders only. Your real Riot API key should stay only in `.env.local` on your machine or in your deployment provider's secret manager.

## Project Structure

```text
app/                 Next.js App Router pages and API routes
components/          UI components
lib/adapters/        Riot API client and Riot DTO placeholder types
lib/events/          Event detection placeholders
lib/mock/            Mock MVP data and provider
lib/reports/         Report generation and real match summary helpers
lib/scoring/         Scoring helpers
lib/types/           Domain and UI TypeScript types
```

## Current Riot API Flow

```text
Riot ID
-> Account-V1 resolves PUUID
-> Match-V5 fetches latest 5 match IDs
-> User selects one match ID
-> Match-V5 fetches that match detail
-> RiftLab displays a basic real match summary
```

Full RiftLab scoring, timeline analysis, and real report generation are intentionally not connected yet.
