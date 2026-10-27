import { z } from "zod";
import { type ActivityTemplate } from "./define-activity-template";
import { beforeAfterTemplate } from "./templates/any-subject";
import { balanceTemplate } from "./templates/balance";
import { combinationGridTemplate } from "./templates/combination-grid";
import {
  codeRunnerTemplate,
  codeTracerTemplate,
  sqlPlaygroundTemplate,
} from "./templates/computing";
import { decisionTreeTemplate } from "./templates/decision-tree";
import { formulaModelTemplate } from "./templates/formula-model";
import { geometryBoardTemplate, unitCircleTemplate } from "./templates/geometry";
import { guessRevealTemplate } from "./templates/guess-reveal";
import {
  causeEffectChainTemplate,
  mapExplorerTemplate,
  sourceComparisonTemplate,
  timelineTemplate,
} from "./templates/history-society";
import { labeledDiagramTemplate } from "./templates/labeled-diagram";
import { dialogueSimulatorTemplate, patternTableTemplate } from "./templates/languages";
import { lineCrossingTemplate } from "./templates/line-crossing";
import {
  keyboardFretboardTemplate,
  notationPlayerTemplate,
  rhythmTapperTemplate,
} from "./templates/music";
import {
  areaModelTemplate,
  numberLineTemplate,
  stepSolverTemplate,
} from "./templates/numbers-algebra";
import { patternTesterTemplate } from "./templates/pattern-tester";
import { chartReaderTemplate, distributionExplorerTemplate } from "./templates/probability-data";
import { randomSimulationTemplate } from "./templates/random-simulation";
import {
  argumentBuilderTemplate,
  categorizeTemplate,
  findErrorTemplate,
  matchPairsTemplate,
} from "./templates/reasoning-writing";
import { moleculeBuilderTemplate, processOrderTemplate } from "./templates/science";

/**
 * Every activity template in catalog order. Each is data: a field schema the writer fills and how
 * code computes its check. Adding a template means adding it here and to `activityContentSchema`.
 */
export const activityTemplates = [
  formulaModelTemplate,
  numberLineTemplate,
  areaModelTemplate,
  balanceTemplate,
  stepSolverTemplate,
  guessRevealTemplate,
  geometryBoardTemplate,
  unitCircleTemplate,
  randomSimulationTemplate,
  distributionExplorerTemplate,
  chartReaderTemplate,
  labeledDiagramTemplate,
  processOrderTemplate,
  moleculeBuilderTemplate,
  combinationGridTemplate,
  lineCrossingTemplate,
  codeRunnerTemplate,
  codeTracerTemplate,
  sqlPlaygroundTemplate,
  patternTesterTemplate,
  patternTableTemplate,
  dialogueSimulatorTemplate,
  timelineTemplate,
  mapExplorerTemplate,
  causeEffectChainTemplate,
  sourceComparisonTemplate,
  categorizeTemplate,
  matchPairsTemplate,
  argumentBuilderTemplate,
  findErrorTemplate,
  decisionTreeTemplate,
  keyboardFretboardTemplate,
  notationPlayerTemplate,
  rhythmTapperTemplate,
  beforeAfterTemplate,
] as const;

export type ActivityTemplateId = (typeof activityTemplates)[number]["id"];

/**
 * The `activity` step's content: `{ template, prompt, fields, check, data? }`, discriminated by
 * `template` so renderers get typed fields after checking the template id.
 */
export const activityContentSchema = z.discriminatedUnion("template", [
  formulaModelTemplate.content,
  numberLineTemplate.content,
  areaModelTemplate.content,
  balanceTemplate.content,
  stepSolverTemplate.content,
  guessRevealTemplate.content,
  geometryBoardTemplate.content,
  unitCircleTemplate.content,
  randomSimulationTemplate.content,
  distributionExplorerTemplate.content,
  chartReaderTemplate.content,
  labeledDiagramTemplate.content,
  processOrderTemplate.content,
  moleculeBuilderTemplate.content,
  combinationGridTemplate.content,
  lineCrossingTemplate.content,
  codeRunnerTemplate.content,
  codeTracerTemplate.content,
  sqlPlaygroundTemplate.content,
  patternTesterTemplate.content,
  patternTableTemplate.content,
  dialogueSimulatorTemplate.content,
  timelineTemplate.content,
  mapExplorerTemplate.content,
  causeEffectChainTemplate.content,
  sourceComparisonTemplate.content,
  categorizeTemplate.content,
  matchPairsTemplate.content,
  argumentBuilderTemplate.content,
  findErrorTemplate.content,
  decisionTreeTemplate.content,
  keyboardFretboardTemplate.content,
  notationPlayerTemplate.content,
  rhythmTapperTemplate.content,
  beforeAfterTemplate.content,
]);

export type ActivityStepContent = z.infer<typeof activityContentSchema>;

/** One template's content, narrowed by id: `ActivityContentFor<"formulaModel">["fields"]`. */
export type ActivityContentFor<TId extends ActivityTemplateId> = Extract<
  ActivityStepContent,
  { template: TId }
>;

/**
 * The templates an explanation screen can show to explore, with no question and no check: a model
 * to move (a slider, a curve, a simulation), a process, a timeline, a tree, a map or a program to
 * run. Templates that only make sense as a question (sort, match, find the error, guess then see)
 * stay activities.
 */
export const exploreActivitySchema = z.discriminatedUnion("template", [
  formulaModelTemplate.explore,
  numberLineTemplate.explore,
  areaModelTemplate.explore,
  balanceTemplate.explore,
  geometryBoardTemplate.explore,
  unitCircleTemplate.explore,
  randomSimulationTemplate.explore,
  distributionExplorerTemplate.explore,
  chartReaderTemplate.explore,
  labeledDiagramTemplate.explore,
  processOrderTemplate.explore,
  moleculeBuilderTemplate.explore,
  combinationGridTemplate.explore,
  lineCrossingTemplate.explore,
  codeRunnerTemplate.explore,
  codeTracerTemplate.explore,
  sqlPlaygroundTemplate.explore,
  patternTesterTemplate.explore,
  timelineTemplate.explore,
  mapExplorerTemplate.explore,
  causeEffectChainTemplate.explore,
  decisionTreeTemplate.explore,
  keyboardFretboardTemplate.explore,
  notationPlayerTemplate.explore,
  beforeAfterTemplate.explore,
]);

export type ExploreActivityContent = z.infer<typeof exploreActivitySchema>;

export type ExploreTemplateId = ExploreActivityContent["template"];

const exploreTemplateIds: ReadonlySet<string> = new Set(
  exploreActivitySchema.options.map((option) => option.shape.template.value),
);

/**
 * Whether the template shows its solved state when explored (the steps in order, the program that
 * prints its output): its canvas only answers, with every check an interaction. Others are played
 * with freely.
 */
export function exploresSolved(template: string): boolean {
  return getActivityTemplate(template)?.checks.every((kind) => kind === "interaction") ?? false;
}

/** Whether an explanation screen can show the template to explore. */
export function isExploreTemplate(id: string): id is ExploreTemplateId {
  return exploreTemplateIds.has(id);
}

const templatesById: ReadonlyMap<string, ActivityTemplate> = new Map(
  activityTemplates.map((template): [string, ActivityTemplate] => [template.id, template]),
);

export function getActivityTemplate(id: string): ActivityTemplate | null {
  return templatesById.get(id) ?? null;
}

/**
 * Whether an activity shows data (a chart, a simulation's numbers), whose source it cites or which
 * it labels as an example. A sorting or matching activity shows none, so a data note on it would
 * say something false; an engine with modes decides from its fields.
 */
export function showsActivityData(content: { fields: unknown; template: string }): boolean {
  return getActivityTemplate(content.template)?.showsData(content.fields) ?? false;
}
