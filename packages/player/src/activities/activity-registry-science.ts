import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

/**
 * Science: parameter simulations, labeled diagrams, process order, molecules and Punnett squares.
 * Spread into `activityRenderers`.
 */
export const scienceRenderers: ActivityRendererMap<
  "labeledDiagram" | "moleculeBuilder" | "parameterSimulation" | "processOrder" | "punnettSquare"
> = {
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
  parameterSimulation: defineActivityRenderer({
    badge: "tryIt",
    load: () =>
      import("./parameter-simulation/parameter-simulation-activity").then(
        (module) => module.ParameterSimulationActivity,
      ),
    template: "parameterSimulation",
  }),
  processOrder: defineActivityRenderer({
    badge: "putInOrder",
    load: () =>
      import("./process-order/process-order-activity").then(
        (module) => module.ProcessOrderActivity,
      ),
    template: "processOrder",
  }),
  punnettSquare: defineActivityRenderer({
    badge: "fillSquare",
    load: () =>
      import("./punnett-square/punnett-square-activity").then(
        (module) => module.PunnettSquareActivity,
      ),
    template: "punnettSquare",
  }),
};
