import { isFillable } from "@zoonk/core/library/activities/combination-grid";
import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

export const scienceRenderers: ActivityRendererMap<
  "combinationGrid" | "labeledDiagram" | "moleculeBuilder" | "processOrder"
> = {
  combinationGrid: defineActivityRenderer({
    badge: ({ fields }) => (isFillable(fields) ? "fillSquare" : "readChart"),
    load: () =>
      import("./combination-grid/combination-grid-activity").then(
        (module) => module.CombinationGridActivity,
      ),
    template: "combinationGrid",
  }),
  labeledDiagram: defineActivityRenderer({
    badge: "labelIt",
    load: () =>
      import("./labeled-diagram/labeled-diagram-activity").then(
        (module) => module.LabeledDiagramActivity,
      ),
    template: "labeledDiagram",
  }),
  moleculeBuilder: defineActivityRenderer({
    badge: "buildIt",
    load: () =>
      import("./molecule-builder/molecule-builder-activity").then(
        (module) => module.MoleculeBuilderActivity,
      ),
    template: "moleculeBuilder",
  }),
  processOrder: defineActivityRenderer({
    badge: "putInOrder",
    load: () =>
      import("./process-order/process-order-activity").then(
        (module) => module.ProcessOrderActivity,
      ),
    template: "processOrder",
  }),
};
