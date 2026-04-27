export type Result = "Win" | "Loss";
export type Role = "Top" | "Jungle" | "Mid" | "ADC" | "Support";
export type Champion = string;
export type ObjectiveType = "Dragon" | "Rift Herald" | "Baron" | "Tower" | "Inhibitor" | "Voidgrubs";
export type MetricStatus = "Strong" | "Average" | "Weak" | "Critical";
export type RecommendationPriority = "High" | "Medium" | "Low";
export type EventSeverity = "High" | "Medium" | "Low";
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type RiskStatus = "Low" | "Medium" | "High" | "Critical";
export type MetricPolarity = "positive" | "cost";

export type Participant = {
  id: string;
  playerId?: string;
  riotId?: string;
  champion: Champion;
  role: Role;
  teamId: string;
  kills: number;
  deaths: number;
  assists: number;
  csPerMinute: number;
  goldPerMinute: number;
  visionScore: number;
};

export type Team = {
  id: string;
  side: "Blue" | "Red";
  result: Result;
  participants: Participant[];
  objectives: Partial<Record<ObjectiveType, number>>;
};

export type NormalizedMatchData = {
  id: string;
  gameMode: string;
  patch: string;
  durationSeconds: number;
  teams: Team[];
  participants: Participant[];
  rawSource: "mock" | "riot";
};

export type ReportGenerationInput = {
  matchData: NormalizedMatchData;
  focusParticipantId: string;
};

export type Player = {
  id: string;
  riotId: string;
  name: string;
  tag: string;
  region: string;
  mainRoles: Role[];
  averageImpactScore: number;
  averageTeamScore: number;
  profile: PlayerProfile;
  recentMatches: MatchSummary[];
};

export type PlayerProfile = {
  archetype: string;
  strengths: string[];
  weaknesses: string[];
  improvementPriority: string;
};

export type MatchSummary = {
  id: string;
  champion: Champion;
  role: Role;
  result: Result;
  duration: string;
  kda: string;
  csPerMinute: number;
  goldPerMinute: number;
  visionScore: number;
  impactScore: number;
  teamScore: number;
};

export type MetricScore = {
  name: string;
  score: number;
  status: MetricStatus;
  polarity?: MetricPolarity;
  displayValue?: string;
  explanation: string;
  evidence: string[];
};

export type TimelineEvent = {
  timestamp: string;
  title: string;
  type: string;
  severity: EventSeverity;
  affectedMetric: string;
  explanation: string;
  cause: string;
  consequence: string;
  valueDelta: string;
  confidence: number;
};

export type MatchDiagnosis = {
  summary: string;
  mainImprovementPriority: string;
};

export type ImpactChainStep = {
  label: string;
  detail: string;
};

export type ImpactChain = {
  title: string;
  steps: ImpactChainStep[];
};

export type TeamReview = {
  identity: string;
  bestCollectiveWindow: string;
  worstCollectiveWindow: string;
  improvementPriority: string;
};

export type Recommendation = {
  title: string;
  explanation: string;
  priority: RecommendationPriority;
  relatedMetric: string;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type GoldDiffPoint = {
  minute: number;
  goldDiff: number;
};

export type ChartData = {
  goldDiffOverTime: GoldDiffPoint[];
  impactByPhase: ChartPoint[];
  individualMetricScores: ChartPoint[];
  teamMetricScores: ChartPoint[];
};

export type MatchReport = {
  id: string;
  player: Pick<Player, "id" | "riotId" | "name" | "tag" | "region">;
  champion: Champion;
  role: Role;
  result: Result;
  duration: string;
  gameMode: string;
  patch: string;
  teamSide: "Blue" | "Red";
  confidence: number;
  individualImpactScore: number;
  teamPerformanceScore: number;
  mainValueSource: string;
  mainValueLoss: string;
  teamLevelIssue: string;
  matchDiagnosis: MatchDiagnosis;
  impactChain: ImpactChain;
  teamReview: TeamReview;
  individualMetrics: MetricScore[];
  teamMetrics: MetricScore[];
  timelineEvents: TimelineEvent[];
  individualRecommendations: Recommendation[];
  teamRecommendations: Recommendation[];
  charts: ChartData;
};
