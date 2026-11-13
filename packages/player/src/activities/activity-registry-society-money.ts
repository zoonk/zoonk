import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

export const societyMoneyRenderers: ActivityRendererMap<
  "causeEffectChain" | "lineCrossing" | "mapExplorer" | "sourceComparison" | "timeline"
> = {
  causeEffectChain: defineActivityRenderer({
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
    load: () =>
      import("./map-explorer/map-explorer-activity").then((module) => module.MapExplorerActivity),
    template: "mapExplorer",
  }),
  sourceComparison: defineActivityRenderer({
    load: () =>
      import("./source-comparison/source-comparison-activity").then(
        (module) => module.SourceComparisonActivity,
      ),
    template: "sourceComparison",
  }),
  timeline: defineActivityRenderer({
    load: () => import("./timeline/timeline-activity").then((module) => module.TimelineActivity),
    template: "timeline",
  }),
};
