import { MOCK_MATCH_REPORTS, MOCK_PLAYER } from "@/lib/mock/data";
import type { MatchReport, MatchSummary, Player } from "@/lib/types";

export function getMockPlayerByRiotId(_riotId: string): Player {
  return MOCK_PLAYER;
}

export function getMockRecentMatches(playerId: string): MatchSummary[] {
  if (playerId !== MOCK_PLAYER.id) {
    return [];
  }

  return MOCK_PLAYER.recentMatches;
}

export function getMockMatchReport(matchId: string): MatchReport | undefined {
  return MOCK_MATCH_REPORTS.find((report) => report.id === matchId);
}
