import type { FusionOutcome, FusionRuleId } from "@/lib/vod-evidence/fusion-types";

export type LabFusionRuleDraft = {
  ruleId: FusionRuleId;
  chainType: string;
  requiredApiSignals: string[];
  helpfulVodSignals: string[];
  possibleFusionOutcomes: FusionOutcome[];
  confidenceCap: "medium" | "medium/high" | "high";
  explanationTemplate: string;
};

export const labFusionRules: LabFusionRuleDraft[] = [
  {
    ruleId: "death_before_enemy_objective",
    chainType: "Death before enemy objective",
    requiredApiSignals: ["player death timestamp", "enemy objective timestamp", "objective type", "player team"],
    helpfulVodSignals: [
      "isolation near objective area",
      "enemy objective presence advantage",
      "enemy first zone control",
      "allies far away",
      "enemy ward or vision control",
    ],
    possibleFusionOutcomes: ["strengthen_api_chain", "weaken_api_chain", "reclassify_as_trade", "insufficient_vod_context"],
    confidenceCap: "medium/high",
    explanationTemplate:
      "API confirms the death before enemy objective. VOD evidence may strengthen the value-loss chain if isolation, enemy presence, and enemy zone control agree.",
  },
  {
    ruleId: "death_before_allied_objective",
    chainType: "Death before allied objective",
    requiredApiSignals: ["player death timestamp", "allied objective timestamp", "objective type", "player team"],
    helpfulVodSignals: [
      "allied pit control",
      "player zones enemy jungler",
      "enemy support or jungle displaced",
      "player frontline context",
      "allied team grouped near objective",
    ],
    possibleFusionOutcomes: [
      "confirm_api_chain",
      "reclassify_as_trade",
      "reclassify_as_positive",
      "reclassify_as_neutral",
      "conflicting_evidence",
    ],
    confidenceCap: "medium",
    explanationTemplate:
      "API confirms the death before allied objective. VOD evidence may reclassify the death as trade or positive if it helped secure the objective.",
  },
  {
    ruleId: "death_followed_by_structure_loss",
    chainType: "Death followed by structure loss",
    requiredApiSignals: ["player death timestamp", "structure kill timestamp", "lane or structure type", "teams"],
    helpfulVodSignals: [
      "lane collapse after death",
      "enemy wave already pressuring",
      "allies unable to defend",
      "player responsible for lane or zone",
      "cross-map structure trade",
    ],
    possibleFusionOutcomes: ["strengthen_api_chain", "weaken_api_chain", "reclassify_as_trade", "conflicting_evidence"],
    confidenceCap: "medium/high",
    explanationTemplate:
      "API confirms death and later structure loss. VOD evidence determines whether the death caused collapse or whether the map state made it a trade.",
  },
  {
    ruleId: "objective_loss_poor_contest",
    chainType: "Objective loss / poor contest",
    requiredApiSignals: ["objective timestamp", "objective owner", "nearby death or contest window"],
    helpfulVodSignals: [
      "enemy first move",
      "enemy river control",
      "allied late rotation",
      "staggered allied entry",
      "poor team spacing",
      "enemy-favored fight setup",
    ],
    possibleFusionOutcomes: ["strengthen_api_chain", "reclassify_reason_only", "insufficient_vod_context"],
    confidenceCap: "medium",
    explanationTemplate:
      "API confirms the objective loss. VOD evidence may explain it as tempo/setup failure rather than generic objective loss.",
  },
  {
    ruleId: "kill_teamfight_into_map_gain",
    chainType: "Kill or teamfight into map gain",
    requiredApiSignals: ["kill cluster", "objective or structure conversion", "conversion timing"],
    helpfulVodSignals: [
      "team grouped correctly",
      "zone control won before objective",
      "immediate pressure conversion",
      "enemy displaced from objective area",
      "unrelated cross-map context",
    ],
    possibleFusionOutcomes: ["confirm_api_chain", "strengthen_api_chain", "weaken_api_chain", "conflicting_evidence"],
    confidenceCap: "medium/high",
    explanationTemplate:
      "API confirms kills and map gain timing. VOD evidence determines whether the gain was causally linked or merely coincidental.",
  },
  {
    ruleId: "side_pressure_trade",
    chainType: "Side pressure / trade",
    requiredApiSignals: ["death or pressure-side event", "cross-map objective or structure", "team ownership"],
    helpfulVodSignals: [
      "player pulls enemies to side lane",
      "team takes objective elsewhere",
      "enemy loses tempo chasing",
      "cross-map pressure visible",
      "side death after forcing response",
    ],
    possibleFusionOutcomes: [
      "reclassify_as_trade",
      "reclassify_as_positive",
      "reclassify_as_neutral",
      "insufficient_vod_context",
    ],
    confidenceCap: "medium",
    explanationTemplate:
      "API may misread side pressure as isolated death or unrelated map gain. VOD evidence can classify the sequence as pressure, trade, or value loss.",
  },
];
