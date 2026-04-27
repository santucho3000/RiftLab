import type { MatchReport, MatchSummary, MetricScore, Player } from "@/lib/types";
import { getMetricStatus } from "@/lib/scoring";

function metric(
  name: string,
  score: number,
  explanation: string,
  evidence: string[],
  options: Pick<MetricScore, "polarity" | "displayValue"> = {},
): MetricScore {
  return {
    name,
    score,
    status: getMetricStatus(score),
    ...options,
    explanation,
    evidence,
  };
}

const recentMatches: MatchSummary[] = [
  {
    id: "RL-2026-001",
    champion: "Azir",
    role: "Mid",
    result: "Win",
    duration: "31:42",
    kda: "8 / 3 / 11",
    csPerMinute: 8.6,
    goldPerMinute: 452,
    visionScore: 28,
    impactScore: 84,
    teamScore: 76,
  },
  {
    id: "RL-2026-002",
    champion: "Taliyah",
    role: "Jungle",
    result: "Win",
    duration: "28:19",
    kda: "6 / 2 / 14",
    csPerMinute: 6.2,
    goldPerMinute: 418,
    visionScore: 34,
    impactScore: 79,
    teamScore: 82,
  },
  {
    id: "RL-2026-003",
    champion: "Orianna",
    role: "Mid",
    result: "Loss",
    duration: "35:08",
    kda: "5 / 6 / 9",
    csPerMinute: 8.1,
    goldPerMinute: 407,
    visionScore: 24,
    impactScore: 61,
    teamScore: 48,
  },
  {
    id: "RL-2026-004",
    champion: "Viego",
    role: "Jungle",
    result: "Win",
    duration: "26:55",
    kda: "9 / 4 / 8",
    csPerMinute: 5.9,
    goldPerMinute: 431,
    visionScore: 30,
    impactScore: 73,
    teamScore: 69,
  },
  {
    id: "RL-2026-005",
    champion: "Syndra",
    role: "Mid",
    result: "Loss",
    duration: "32:11",
    kda: "7 / 7 / 6",
    csPerMinute: 7.7,
    goldPerMinute: 425,
    visionScore: 21,
    impactScore: 57,
    teamScore: 44,
  },
];

export const MOCK_PLAYER: Player = {
  id: "player-test-las",
  riotId: "TestPlayer#LAS",
  name: "TestPlayer",
  tag: "LAS",
  region: "LAS",
  mainRoles: ["Mid", "Jungle"],
  averageImpactScore: 71,
  averageTeamScore: 64,
  profile: {
    archetype: "High pressure mid/jungle player",
    strengths: [
      "Converts lane priority into objective access",
      "Creates strong mid-game pressure windows",
      "Turns won fights into map control when tempo is aligned",
    ],
    weaknesses: [
      "Late objective resets reduce setup quality",
      "Shutdown risk increases when playing from ahead",
      "Vision impact drops after 20 minutes",
    ],
    improvementPriority:
      "Protect high-value objective windows by resetting earlier and pairing side pressure with team vision.",
  },
  recentMatches,
};

const mainReport: MatchReport = {
  id: "RL-2026-001",
  player: {
    id: MOCK_PLAYER.id,
    riotId: MOCK_PLAYER.riotId,
    name: MOCK_PLAYER.name,
    tag: MOCK_PLAYER.tag,
    region: MOCK_PLAYER.region,
  },
  champion: "Azir",
  role: "Mid",
  result: "Win",
  duration: "31:42",
  gameMode: "Ranked Solo/Duo",
  patch: "Patch placeholder 15.x",
  teamSide: "Blue",
  confidence: 0.78,
  individualImpactScore: 84,
  teamPerformanceScore: 76,
  mainValueSource:
    "Pressure Value: between minutes 9 and 11, mid priority let your jungler enter river first and secure Herald. Herald later converted into mid tower and opened central map control.",
  mainValueLoss:
    "A shutdown death 42 seconds before third dragon removed your wave pressure and reduced your team's ability to contest river vision.",
  teamLevelIssue:
    "Tempo synchronization before objectives was inconsistent, especially around the third dragon setup.",
  matchDiagnosis: {
    summary:
      "Your main value came from converting mid priority into Herald access and central map control. Your largest value loss came from a shutdown death before third dragon, which weakened river control and increased throw risk. As a team, the biggest issue was tempo synchronization before objectives, so the main improvement priority is resetting earlier as a unit before neutral timers.",
    mainImprovementPriority:
      "Reset 65 to 75 seconds before major objectives, then use your pushed mid wave to enter river with jungle instead of arriving after vision is contested.",
  },
  impactChain: {
    title: "Mid priority converted into central map control",
    steps: [
      {
        label: "Action",
        detail: "Mid push at 09:40 forced the enemy mid to catch the wave under tower.",
      },
      {
        label: "Enabled Window",
        detail: "Your jungler entered river first while support protected the upper pixel brush.",
      },
      {
        label: "Objective Gain",
        detail: "Herald was secured at 10:15 without a 50/50 contest.",
      },
      {
        label: "Map Gain",
        detail: "Herald broke mid tower and opened access to enemy raptors.",
      },
      {
        label: "Team Value",
        detail: "Central control created safer Baron-side vision and easier rotations.",
      },
    ],
  },
  teamReview: {
    identity:
      "A mid-priority composition that wins by entering river first, converting neutral objectives, and using central lane control to set Baron-side vision.",
    bestCollectiveWindow:
      "09:40 to 13:20: mid push, first river entry, Herald secure, and mid tower conversion formed the cleanest team sequence.",
    worstCollectiveWindow:
      "21:35 to 22:20: staggered resets left river dark before third dragon and forced the team to contest from a reactive position.",
    improvementPriority:
      "Call synchronized resets before objective timers and assign one player to hold mid wave while support and jungle refresh vision.",
  },
  individualMetrics: [
    metric("Direct Value", 76, "You created direct combat and economy value without being the only fed carry.", [
      "Maintained +520 gold over the lane opponent at 14 minutes.",
      "Participated in 68% of team kills while holding 8.6 CS/min.",
    ]),
    metric("Pressure Value", 84, "Your lane and side pressure repeatedly made neutral objective windows possible.", [
      "Mid priority helped secure Herald at 10:15.",
      "Side pressure forced two enemies bot before the Baron setup.",
    ]),
    metric("Information Value", 71, "Vision was useful when placed before objective windows, but it dropped in late river setups.", [
      "Placed control ward 52 seconds before Herald and protected river entry.",
      "Lost vision line before third dragon after a late reset.",
    ]),
    metric("Objective Contribution", 82, "Your movement converted lane priority into objective access.", [
      "Rotated first to Herald with mid wave pushed under tower.",
      "Zoned enemy mid from entering river during first dragon contest.",
    ]),
    metric("Conversion Value", 79, "Most advantages became map value rather than isolated kills.", [
      "Bot kill at 08:42 converted into dragon and deep vision.",
      "Teamfight win at 18:20 converted into mid tier 1 tower.",
    ]),
    metric("Value Lost", 38, "This is a penalty signal, not a positive performance score. The main cost came from one high-value death before an objective.", [
      "Died 42 seconds before third dragon.",
      "Gave shutdown during a high-value objective window.",
    ], { polarity: "cost", displayValue: "Risk Cost: High" }),
  ],
  teamMetrics: [
    metric("Objective Setup", 81, "The team usually arrived early enough to make objectives playable.", [
      "Herald setup began with mid priority and support river ward.",
      "Baron pick at 23:10 was immediately converted into objective pressure.",
    ]),
    metric("Vision Control", 68, "Vision was strong around Herald and Baron, but inconsistent around dragon three.", [
      "Deep raptor ward revealed enemy jungle path before Herald.",
      "River control collapsed after staggered resets at 21:40.",
    ]),
    metric("Tempo Sync", 54, "Several resets happened out of sequence, making clean setups harder than necessary.", [
      "ADC reset 18 seconds later than jungle before third dragon.",
      "Top arrived after river vision was already contested.",
    ]),
    metric("Pressure Conversion", 78, "The team converted pressure into towers and objectives more often than not.", [
      "Mid tower fell after Herald, creating access to enemy raptors.",
      "Bot pressure pulled two defenders before Baron vision setup.",
    ]),
    metric("Teamfight Conversion", 73, "Won fights generally produced map value, but cleanup paths were sometimes slow.", [
      "18:20 fight win converted into mid tower.",
      "Late fight win produced only jungle camps instead of inhibitor pressure.",
    ]),
    metric("Throw Risk", 45, "The lead was threatened by shutdown deaths and late objective resets.", [
      "Shutdown death at 27:45 increased enemy Baron threat.",
      "Late dragon setup forced a fight without full river control.",
    ]),
  ],
  timelineEvents: [
    {
      timestamp: "08:42",
      title: "Bot kill converted into dragon",
      type: "Conversion",
      severity: "Medium",
      affectedMetric: "Conversion Value",
      explanation:
        "Your pushed mid wave let you move first, cover river, and turn bot pressure into the first dragon instead of a disconnected kill.",
      cause: "Mid wave was already pushed when bot lane forced enemy summoners.",
      consequence: "You arrived river first and covered the dragon start.",
      valueDelta: "+1 dragon, deep bot-side vision, and reduced enemy jungle tempo.",
      confidence: 0.76,
    },
    {
      timestamp: "10:15",
      title: "Herald secured after mid priority",
      type: "Objective Setup",
      severity: "High",
      affectedMetric: "Pressure Value",
      explanation:
        "Your lane priority forced the enemy mid to catch the wave. Your jungler entered river first, started Herald, and converted it into mid tower three minutes later.",
      cause: "Mid push at 09:40 trapped the enemy mid under tower.",
      consequence: "Jungle entered river first and started Herald with lane cover.",
      valueDelta: "+Herald, +mid tower, and central map control opened.",
      confidence: 0.84,
    },
    {
      timestamp: "14:30",
      title: "Jungler death before dragon",
      type: "Risk Window",
      severity: "Medium",
      affectedMetric: "Tempo Sync",
      explanation:
        "The team lost river control for 31 seconds. You recovered the wave, but the setup became reactive instead of controlled.",
      cause: "Jungle stayed for one extra camp while dragon timer was approaching.",
      consequence: "Enemy support entered river first and cleared the first ward line.",
      valueDelta: "-31 seconds of river control and lower dragon setup quality.",
      confidence: 0.68,
    },
    {
      timestamp: "18:20",
      title: "Teamfight win converted into mid tower",
      type: "Conversion",
      severity: "High",
      affectedMetric: "Teamfight Conversion",
      explanation:
        "After winning the river fight, your team grouped immediately, used the cannon wave, and took mid tier 1. This created the map lane needed for Baron vision.",
      cause: "Enemy mid walked into a narrow river angle without side-lane pressure.",
      consequence: "Your team collapsed first and kept the cannon wave alive.",
      valueDelta: "+mid tower, +enemy raptor access, and stronger Baron-side setup.",
      confidence: 0.81,
    },
    {
      timestamp: "23:10",
      title: "Pick before Baron converted into objective",
      type: "Objective",
      severity: "High",
      affectedMetric: "Objective Setup",
      explanation:
        "The enemy support face-checked without mid priority. Your team punished the pick, swept vision, and started Baron with a numbers advantage.",
      cause: "Mid wave pressure forced the enemy support to check fog alone.",
      consequence: "The pick created a 5v4 Baron window.",
      valueDelta: "+Baron pressure and forced enemy defensive rotations.",
      confidence: 0.79,
    },
    {
      timestamp: "27:45",
      title: "Shutdown death increased throw risk",
      type: "Value Lost",
      severity: "High",
      affectedMetric: "Throw Risk",
      explanation:
        "You died while side pressure was your team's main map lever. The enemy gained shutdown gold and forced your team to give up deep vision.",
      cause: "Side-lane extension happened while Baron-side vision was not refreshed.",
      consequence: "Enemy collected shutdown gold and pushed your team out of top river.",
      valueDelta: "-shutdown gold, -side pressure, and increased Baron throw risk.",
      confidence: 0.73,
    },
  ],
  individualRecommendations: [
    {
      title: "Convert priority into earlier river presence",
      explanation:
        "Your biggest gains came when mid push turned into objective access. When you have a pushed wave before a neutral objective, move with jungle before the enemy can contest vision.",
      priority: "High",
      relatedMetric: "Pressure Value",
    },
    {
      title: "Protect shutdown windows",
      explanation:
        "Your lead becomes team value only while you remain on the map. Avoid side-lane extensions during the 60 seconds before dragon or Baron unless your team already owns vision.",
      priority: "High",
      relatedMetric: "Value Lost",
    },
    {
      title: "Refresh late-game control wards sooner",
      explanation:
        "Your early vision created useful information, but late setups were thinner. Buy and place control wards before resetting for objective timers.",
      priority: "Medium",
      relatedMetric: "Information Value",
    },
  ],
  teamRecommendations: [
    {
      title: "Synchronize resets before objectives",
      explanation:
        "The team's weakest area was Tempo Sync. Reset as a unit 65 to 75 seconds before major objectives so river setup starts before the enemy arrives.",
      priority: "High",
      relatedMetric: "Tempo Sync",
    },
    {
      title: "Assign pressure before Baron setups",
      explanation:
        "When side pressure pulled defenders, Baron became easy to set up. Make the pressure role explicit so the rest of the team can sweep and hold mid.",
      priority: "Medium",
      relatedMetric: "Pressure Conversion",
    },
    {
      title: "After won fights, call the map objective first",
      explanation:
        "Some fight wins created only jungle camp value. Decide the tower, Baron, dragon, or reset call immediately after the last kill lands.",
      priority: "Medium",
      relatedMetric: "Teamfight Conversion",
    },
  ],
  charts: {
    goldDiffOverTime: [
      { minute: 5, goldDiff: 120 },
      { minute: 10, goldDiff: 840 },
      { minute: 15, goldDiff: 1410 },
      { minute: 20, goldDiff: 2320 },
      { minute: 25, goldDiff: 1780 },
      { minute: 30, goldDiff: 2980 },
    ],
    impactByPhase: [
      { label: "Early", value: 78 },
      { label: "Mid", value: 88 },
      { label: "Late", value: 69 },
    ],
    individualMetricScores: [
      { label: "Direct", value: 76 },
      { label: "Pressure", value: 84 },
      { label: "Info", value: 71 },
      { label: "Objective", value: 82 },
      { label: "Conversion", value: 79 },
      { label: "Value Lost", value: 38 },
    ],
    teamMetricScores: [
      { label: "Setup", value: 81 },
      { label: "Vision", value: 68 },
      { label: "Tempo", value: 54 },
      { label: "Pressure", value: 78 },
      { label: "Fights", value: 73 },
      { label: "Throw Risk", value: 45 },
    ],
  },
};

function reportFromSummary(summary: MatchSummary, overrides: Partial<MatchReport>): MatchReport {
  return {
    ...mainReport,
    ...overrides,
    id: summary.id,
    champion: summary.champion,
    role: summary.role,
    result: summary.result,
    duration: summary.duration,
    individualImpactScore: summary.impactScore,
    teamPerformanceScore: summary.teamScore,
  };
}

export const MOCK_MATCH_REPORTS: MatchReport[] = [
  mainReport,
  reportFromSummary(recentMatches[1], {
    teamSide: "Red",
    confidence: 0.74,
    mainValueSource:
      "Information Value: early jungle tracking gave bot lane enough warning to avoid the first gank and enabled a cross-map invade.",
    mainValueLoss:
      "One delayed reset after second dragon reduced tempo and prevented the team from placing Baron-side vision early.",
    teamLevelIssue:
      "The team generated early jungle information well, but reset timing delayed the first Baron-side vision layer.",
    matchDiagnosis: {
      summary:
        "Your main value came from tracking the enemy jungle path and turning that information into safe lanes and a cross-map invade. Your largest value loss came from a delayed reset after second dragon, which slowed Baron-side vision and reduced tempo. As a team, the biggest issue was converting early information into a clean mid-game setup.",
      mainImprovementPriority:
        "After successful cross-map plays, reset immediately and move vision to the next objective side before the enemy support arrives.",
    },
    impactChain: {
      title: "Jungle tracking converted into cross-map tempo",
      steps: [
        { label: "Action", detail: "Raptor ward spotted the enemy jungler pathing bot at 06:35." },
        { label: "Enabled Window", detail: "Bot lane backed off and mid held wave priority." },
        { label: "Objective Gain", detail: "You invaded top camps with lane cover." },
        { label: "Map Gain", detail: "Enemy jungle lost tempo and top river became safe." },
        { label: "Team Value", detail: "Bot avoided the gank while your team gained cross-map resources." },
      ],
    },
    teamReview: {
      identity:
        "A tracking-first jungle game that wins by reading enemy pathing and moving pressure to the opposite side.",
      bestCollectiveWindow:
        "06:35 to 08:10: enemy jungle spotted bot, bot lane disengaged, and top-side invade landed without losing wave states.",
      worstCollectiveWindow:
        "18:40 to 19:35: delayed reset after second dragon slowed Baron-side setup.",
      improvementPriority:
        "Move the whole team from information gain into immediate reset and next-side vision.",
    },
  }),
  reportFromSummary(recentMatches[2], {
    confidence: 0.66,
    mainValueSource:
      "Direct Value: stable laning and kill participation kept the game playable despite losing objective control.",
    mainValueLoss:
      "Tempo Sync: late resets before dragon repeatedly forced the team into low-control fights.",
    teamLevelIssue:
      "The team fought from delayed positions and rarely owned river before dragon timers.",
    matchDiagnosis: {
      summary:
        "Your main value came from stable laning and teamfight participation that kept the match playable. Your largest value loss came from repeated late resets before dragon, which forced low-control river entries. As a team, the biggest issue was objective tempo, so the priority is calling earlier resets instead of reacting after vision is gone.",
      mainImprovementPriority:
        "Use mid wave control to start objective resets sooner, then enter river with support before the enemy establishes wards.",
    },
    impactChain: {
      title: "Stable lane value failed to become dragon control",
      steps: [
        { label: "Action", detail: "Mid wave was stabilized before the second dragon timer." },
        { label: "Enabled Window", detail: "Your team had a chance to reset first and set river." },
        { label: "Objective Gain", detail: "The window was missed after staggered recalls." },
        { label: "Map Gain", detail: "Enemy support cleared river and held choke points." },
        { label: "Team Value", detail: "The fight became playable mechanically, but low-control strategically." },
      ],
    },
    teamReview: {
      identity:
        "A scaling teamfight composition that needed early setup to make dragon fights stable.",
      bestCollectiveWindow:
        "16:20 to 17:10: grouped mid wave and won the first clean front-to-back fight.",
      worstCollectiveWindow:
        "22:00 to 23:05: late recalls before dragon handed river control to the enemy.",
      improvementPriority:
        "Treat reset timing as part of the fight plan, not as a separate action after farming one more wave.",
    },
  }),
  reportFromSummary(recentMatches[3], {
    teamSide: "Red",
    confidence: 0.71,
    mainValueSource:
      "Objective Contribution: jungle pathing connected winning lanes to early neutral objectives.",
    mainValueLoss:
      "Throw Risk: two forced skirmishes after objectives gave shutdown windows back to the enemy.",
    teamLevelIssue:
      "The team secured objectives well, then overextended instead of resetting with the value already banked.",
    matchDiagnosis: {
      summary:
        "Your main value came from jungle pathing that connected winning lanes to early neutral objectives. Your largest value loss came from forced skirmishes after objectives, which reopened shutdown windows for the enemy. As a team, the issue was post-objective discipline, so the priority is banking gains before looking for another fight.",
      mainImprovementPriority:
        "After securing an objective, reset and spend unless the next wave state creates a clearly numbered fight.",
    },
    impactChain: {
      title: "Winning lane cover turned into early neutral control",
      steps: [
        { label: "Action", detail: "Pathing matched mid and bot priority before first dragon." },
        { label: "Enabled Window", detail: "Enemy jungle had to cover a losing lane instead of contesting river." },
        { label: "Objective Gain", detail: "Dragon was secured without losing bot tempo." },
        { label: "Map Gain", detail: "Bot river vision stayed active for the next invade." },
        { label: "Team Value", detail: "The team gained objective tempo and safer lane assignments." },
      ],
    },
    teamReview: {
      identity:
        "A proactive jungle-led team that creates value by connecting lane priority to neutral objectives.",
      bestCollectiveWindow:
        "07:50 to 10:40: bot cover, first dragon, and invade chained together cleanly.",
      worstCollectiveWindow:
        "20:10 to 21:00: post-objective chase gave the enemy a shutdown and slowed Baron setup.",
      improvementPriority:
        "End the play after the objective unless vision and waves already support the next action.",
    },
  }),
  reportFromSummary(recentMatches[4], {
    confidence: 0.63,
    mainValueSource:
      "Pressure Value: mid lane push created windows, but the team converted only some of them.",
    mainValueLoss:
      "Value Lost: deaths around side waves removed your team's main source of map pressure.",
    teamLevelIssue:
      "The team did not consistently convert mid pressure into vision or neutral objective starts.",
    matchDiagnosis: {
      summary:
        "Your main value came from mid pressure that created several playable windows. Your largest value loss came from side-wave deaths that removed your team's main map lever. As a team, the biggest issue was pressure conversion, so the priority is pairing your push with jungle-support movement before extending side lanes.",
      mainImprovementPriority:
        "When mid pressure is created, immediately choose one conversion: river vision, invade, dragon start, or tower damage.",
    },
    impactChain: {
      title: "Mid pressure created windows that were only partially converted",
      steps: [
        { label: "Action", detail: "Mid push forced the enemy mage to clear under tower." },
        { label: "Enabled Window", detail: "Jungle and support could move into fog first." },
        { label: "Objective Gain", detail: "Only partial river vision was placed before resets split." },
        { label: "Map Gain", detail: "Enemy cleared wards before dragon and neutralized the window." },
        { label: "Team Value", detail: "Pressure existed, but it did not become durable control." },
      ],
    },
    teamReview: {
      identity:
        "A pressure-oriented mid composition that needed coordinated conversion to turn push into map control.",
      bestCollectiveWindow:
        "11:20 to 12:10: mid push and support roam forced enemy jungle back.",
      worstCollectiveWindow:
        "24:40 to 25:30: side-wave death removed pressure before the dragon contest.",
      improvementPriority:
        "Attach jungle-support movement to every mid push before objective timers.",
    },
  }),
];
