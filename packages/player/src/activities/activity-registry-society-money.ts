import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

/**
 * Money and business, history and society: calculators, supply and demand, what-if scenarios,
 * timelines, maps, cause and effect, and sources. Spread into `activityRenderers`.
 */
export const societyMoneyRenderers: ActivityRendererMap<
  | "causeEffectChain"
  | "mapExplorer"
  | "scenarioSimulator"
  | "sliderCalculator"
  | "sourceComparison"
  | "supplyDemand"
  | "timeline"
> = {
  causeEffectChain: defineActivityRenderer({
    badge: "linkCauses",
    load: () =>
      import("./cause-effect-chain/cause-effect-chain-activity").then(
        (module) => module.CauseEffectChainActivity,
      ),
    template: "causeEffectChain",
  }),
  mapExplorer: defineActivityRenderer({
    badge: "exploreMap",
    load: () =>
      import("./map-explorer/map-explorer-activity").then((module) => module.MapExplorerActivity),
    template: "mapExplorer",
  }),
  scenarioSimulator: defineActivityRenderer({
    badge: "whatIf",
    load: () =>
      import("./scenario-simulator/scenario-simulator-activity").then(
        (module) => module.ScenarioSimulatorActivity,
      ),
    template: "scenarioSimulator",
  }),
  sliderCalculator: defineActivityRenderer({
    badge: "tryIt",
    load: () =>
      import("./slider-calculator/slider-calculator-activity").then(
        (module) => module.SliderCalculatorActivity,
      ),
    template: "sliderCalculator",
  }),
  sourceComparison: defineActivityRenderer({
    badge: "compareSources",
    load: () =>
      import("./source-comparison/source-comparison-activity").then(
        (module) => module.SourceComparisonActivity,
      ),
    template: "sourceComparison",
  }),
  supplyDemand: defineActivityRenderer({
    badge: "moveCurve",
    load: () =>
      import("./supply-demand/supply-demand-activity").then(
        (module) => module.SupplyDemandActivity,
      ),
    template: "supplyDemand",
  }),
  timeline: defineActivityRenderer({
    badge: "placeInTime",
    load: () => import("./timeline/timeline-activity").then((module) => module.TimelineActivity),
    template: "timeline",
  }),
};
