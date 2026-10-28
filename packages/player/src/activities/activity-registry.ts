import { type ActivityTemplateId } from "@zoonk/core/library/activities/templates";
import {
  type ActivityRendererEntry,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";
import { languageRenderers } from "./activity-registry-languages";
import { musicRenderers } from "./activity-registry-music";
import { scienceRenderers } from "./activity-registry-science";
import { societyMoneyRenderers } from "./activity-registry-society-money";

export const activityRenderers: {
  [TId in ActivityTemplateId]: ActivityRendererEntry<TId>;
} = {
  areaModel: defineActivityRenderer({
    badge: "splitIt",
    load: () =>
      import("./area-model/area-model-activity").then((module) => module.AreaModelActivity),
    template: "areaModel",
  }),
  argumentBuilder: defineActivityRenderer({
    badge: "buildArgument",
    load: () =>
      import("./argument-builder/argument-builder-activity").then(
        (module) => module.ArgumentBuilderActivity,
      ),
    template: "argumentBuilder",
  }),
  balance: defineActivityRenderer({
    badge: "handsOn",
    load: () => import("./balance/balance-activity").then((module) => module.BalanceActivity),
    template: "balance",
  }),
  beforeAfter: defineActivityRenderer({
    badge: "beforeAfter",
    load: () =>
      import("./before-after/before-after-activity").then((module) => module.BeforeAfterActivity),
    template: "beforeAfter",
  }),
  categorize: defineActivityRenderer({
    badge: "sortGroups",
    load: () =>
      import("./categorize/categorize-activity").then((module) => module.CategorizeActivity),
    template: "categorize",
  }),
  chartReader: defineActivityRenderer({
    badge: "readChart",
    load: () =>
      import("./chart-reader/chart-reader-activity").then((module) => module.ChartReaderActivity),
    template: "chartReader",
  }),
  codeRunner: defineActivityRenderer({
    badge: "runCode",
    load: () =>
      import("./code-runner/code-runner-activity").then((module) => module.CodeRunnerActivity),
    template: "codeRunner",
  }),
  codeTracer: defineActivityRenderer({
    badge: "stepThrough",
    load: () =>
      import("./code-tracer/code-tracer-activity").then((module) => module.CodeTracerActivity),
    template: "codeTracer",
  }),
  decisionTree: defineActivityRenderer({
    badge: "followKey",
    load: () =>
      import("./decision-tree/decision-tree-activity").then(
        (module) => module.DecisionTreeActivity,
      ),
    template: "decisionTree",
  }),
  distributionExplorer: defineActivityRenderer({
    badge: "explore",
    load: () =>
      import("./distribution-explorer/distribution-explorer-activity").then(
        (module) => module.DistributionExplorerActivity,
      ),
    template: "distributionExplorer",
  }),
  findError: defineActivityRenderer({
    badge: "findError",
    load: () =>
      import("./find-error/find-error-activity").then((module) => module.FindErrorActivity),
    template: "findError",
  }),
  formulaModel: defineActivityRenderer({
    badge: "tryIt",
    load: () =>
      import("./formula-model/formula-model-activity").then(
        (module) => module.FormulaModelActivity,
      ),
    template: "formulaModel",
  }),
  geometryBoard: defineActivityRenderer({
    badge: "dragCorner",
    load: () =>
      import("./geometry-board/geometry-board-activity").then(
        (module) => module.GeometryBoardActivity,
      ),
    template: "geometryBoard",
  }),
  guessReveal: defineActivityRenderer({
    badge: "estimateFirst",
    load: () =>
      import("./guess-reveal/guess-reveal-activity").then((module) => module.GuessRevealActivity),
    template: "guessReveal",
  }),
  matchPairs: defineActivityRenderer({
    badge: "matchPairs",
    load: () =>
      import("./match-pairs/match-pairs-activity").then((module) => module.MatchPairsActivity),
    template: "matchPairs",
  }),
  numberLine: defineActivityRenderer({
    badge: "placeIt",
    load: () =>
      import("./number-line/number-line-activity").then((module) => module.NumberLineActivity),
    template: "numberLine",
  }),
  patternTester: defineActivityRenderer({
    badge: "testPattern",
    load: () =>
      import("./pattern-tester/pattern-tester-activity").then(
        (module) => module.PatternTesterActivity,
      ),
    template: "patternTester",
  }),
  randomSimulation: defineActivityRenderer({
    badge: ({ fields }) => (fields.mode === "chance" ? "predictFirst" : "simulate"),
    checkFirst: ({ fields }) => fields.mode === "chance",
    load: () =>
      import("./random-simulation/random-simulation-activity").then(
        (module) => module.RandomSimulationActivity,
      ),
    template: "randomSimulation",
  }),
  sqlPlayground: defineActivityRenderer({
    badge: "queryData",
    load: () =>
      import("./sql-playground/sql-playground-activity").then(
        (module) => module.SqlPlaygroundActivity,
      ),
    template: "sqlPlayground",
  }),
  stepSolver: defineActivityRenderer({
    badge: "stepByStep",
    load: () =>
      import("./step-solver/step-solver-activity").then((module) => module.StepSolverActivity),
    template: "stepSolver",
  }),
  unitCircle: defineActivityRenderer({
    badge: "turnIt",
    load: () =>
      import("./unit-circle/unit-circle-activity").then((module) => module.UnitCircleActivity),
    template: "unitCircle",
  }),
  ...languageRenderers,
  ...musicRenderers,
  ...scienceRenderers,
  ...societyMoneyRenderers,
};
