import { getMockMatchReport } from "@/lib/mock/provider";
import type { NormalizedMatchData, TimelineEvent } from "@/lib/types";

// Future data flow:
// Riot API match data
// -> normalize raw match
// -> detect events
// -> apply scoring rules
// -> generate report
// -> render UI

export function detectKeyEventsFromTimeline(matchData?: NormalizedMatchData): TimelineEvent[] {
  return getMockTimeline(matchData);
}

export function detectObjectiveWindows(matchData?: NormalizedMatchData): TimelineEvent[] {
  return getMockTimeline(matchData).filter((event) =>
    ["Objective Setup", "Objective"].includes(event.type),
  );
}

export function detectDeathsBeforeObjectives(matchData?: NormalizedMatchData): TimelineEvent[] {
  return getMockTimeline(matchData).filter((event) =>
    event.type === "Risk Window" || event.type === "Value Lost",
  );
}

export function detectConversionEvents(matchData?: NormalizedMatchData): TimelineEvent[] {
  return getMockTimeline(matchData).filter((event) => event.type === "Conversion");
}

export function detectPressureWindows(matchData?: NormalizedMatchData): TimelineEvent[] {
  return getMockTimeline(matchData).filter((event) =>
    event.affectedMetric.includes("Pressure"),
  );
}

function getMockTimeline(matchData?: NormalizedMatchData): TimelineEvent[] {
  const report = getMockMatchReport(matchData?.id ?? "RL-2026-001");
  return report?.timelineEvents ?? [];
}
