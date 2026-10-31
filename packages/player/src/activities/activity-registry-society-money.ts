import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

export const societyMoneyRenderers: ActivityRendererMap<
  "causeEffectChain" | "lineCrossing" | "mapExplorer" | "sourceComparison" | "timeline"
> = {
  causeEffectChain: defineActivityRenderer({
    badge: "linkCauses",
    load: () =>
      import("./cause-effect-chain/cause-effect-chain-activity").then(
        (module) => module.CauseEffectChainActivity,
      ),
    template: "causeEffectChain",
  }),
  lineCrossing: defineActivityRenderer({
    badge: "moveCurve",
    load: () =>
      import("./line-crossing/line-crossing-activity").then(
        (module) => module.LineCrossingActivity,
      ),
    template: "lineCrossing",
  }),
  mapExplorer: defineActivityRenderer({
    badge: "exploreMap",
    load: () =>
      import("./map-explorer/map-explorer-activity").then((module) => module.MapExplorerActivity),
    template: "mapExplorer",
  }),
  sourceComparison: defineActivityRenderer({
    badge: "compareSources",
    load: () =>
      import("./source-comparison/source-comparison-activity").then(
        (module) => module.SourceComparisonActivity,
      ),
    template: "sourceComparison",
  }),
  timeline: defineActivityRenderer({
    badge: "placeInTime",
    load: () => import("./timeline/timeline-activity").then((module) => module.TimelineActivity),
    template: "timeline",
  }),
};
