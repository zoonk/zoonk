import { z } from "zod";
import { type ActivityTemplate } from "./define-activity-template";
import { beforeAfterTemplate, predictRevealTemplate } from "./templates/any-subject";
import { balanceTemplate } from "./templates/balance";
import {
  codeRunnerTemplate,
  codeTracerTemplate,
  sqlPlaygroundTemplate,
} from "./templates/computing";
import { decisionTreeTemplate } from "./templates/decision-tree";
import { geometryBoardTemplate, unitCircleTemplate } from "./templates/geometry";
import {
  causeEffectChainTemplate,
  mapExplorerTemplate,
  sourceComparisonTemplate,
  timelineTemplate,
} from "./templates/history-society";
import {
  dialogueSimulatorTemplate,
  listeningSpeedTemplate,
  patternTableTemplate,
  sentenceBuilderTemplate,
} from "./templates/languages";
import {
  scenarioSimulatorTemplate,
  sliderCalculatorTemplate,
  supplyDemandTemplate,
} from "./templates/money-business";
import {
  earTrainerTemplate,
  keyboardFretboardTemplate,
  notationPlayerTemplate,
  rhythmTapperTemplate,
} from "./templates/music";
import {
  areaModelTemplate,
  estimateRevealTemplate,
  numberLineTemplate,
  sliderGraphTemplate,
  stepSolverTemplate,
} from "./templates/numbers-algebra";
import { patternTesterTemplate } from "./templates/pattern-tester";
import {
  chartReaderTemplate,
  distributionExplorerTemplate,
  predictSimulateTemplate,
  samplingSimulatorTemplate,
} from "./templates/probability-data";
import { punnettSquareTemplate } from "./templates/punnett-square";
import {
  argumentBuilderTemplate,
  categorizeTemplate,
  findErrorTemplate,
  matchPairsTemplate,
} from "./templates/reasoning-writing";
import {
  labeledDiagramTemplate,
  moleculeBuilderTemplate,
  parameterSimulationTemplate,
  processOrderTemplate,
} from "./templates/science";

/**
 * Every activity template in catalog order. Each is data: a field schema the writer fills and how
 * code computes its check. Adding a template means adding it here and to `activityContentSchema`.
 */
export const activityTemplates = [
  sliderGraphTemplate,
  numberLineTemplate,
  areaModelTemplate,
  balanceTemplate,
  stepSolverTemplate,
  estimateRevealTemplate,
  geometryBoardTemplate,
  unitCircleTemplate,
  predictSimulateTemplate,
  distributionExplorerTemplate,
  chartReaderTemplate,
  samplingSimulatorTemplate,
  parameterSimulationTemplate,
  labeledDiagramTemplate,
  processOrderTemplate,
  moleculeBuilderTemplate,
  punnettSquareTemplate,
  sliderCalculatorTemplate,
  supplyDemandTemplate,
  scenarioSimulatorTemplate,
  codeRunnerTemplate,
  codeTracerTemplate,
  sqlPlaygroundTemplate,
  patternTesterTemplate,
  sentenceBuilderTemplate,
  patternTableTemplate,
  dialogueSimulatorTemplate,
  listeningSpeedTemplate,
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
  earTrainerTemplate,
  rhythmTapperTemplate,
  predictRevealTemplate,
  beforeAfterTemplate,
] as const;

export type ActivityTemplateId = (typeof activityTemplates)[number]["id"];

/**
 * The `activity` step's content: `{ template, prompt, fields, check, data? }`, discriminated by
 * `template` so renderers get typed fields after checking the template id.
 */
export const activityContentSchema = z.discriminatedUnion("template", [
  sliderGraphTemplate.content,
  numberLineTemplate.content,
  areaModelTemplate.content,
  balanceTemplate.content,
  stepSolverTemplate.content,
  estimateRevealTemplate.content,
  geometryBoardTemplate.content,
  unitCircleTemplate.content,
  predictSimulateTemplate.content,
  distributionExplorerTemplate.content,
  chartReaderTemplate.content,
  samplingSimulatorTemplate.content,
  parameterSimulationTemplate.content,
  labeledDiagramTemplate.content,
  processOrderTemplate.content,
  moleculeBuilderTemplate.content,
  punnettSquareTemplate.content,
  sliderCalculatorTemplate.content,
  supplyDemandTemplate.content,
  scenarioSimulatorTemplate.content,
  codeRunnerTemplate.content,
  codeTracerTemplate.content,
  sqlPlaygroundTemplate.content,
  patternTesterTemplate.content,
  sentenceBuilderTemplate.content,
  patternTableTemplate.content,
  dialogueSimulatorTemplate.content,
  listeningSpeedTemplate.content,
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
  earTrainerTemplate.content,
  rhythmTapperTemplate.content,
  predictRevealTemplate.content,
  beforeAfterTemplate.content,
]);

export type ActivityStepContent = z.infer<typeof activityContentSchema>;

/** One template's content, narrowed by id: `ActivityContentFor<"sliderGraph">["fields"]`. */
export type ActivityContentFor<TId extends ActivityTemplateId> = Extract<
  ActivityStepContent,
  { template: TId }
>;

const templatesById: ReadonlyMap<string, ActivityTemplate> = new Map(
  activityTemplates.map((template): [string, ActivityTemplate] => [template.id, template]),
);

export function getActivityTemplate(id: string): ActivityTemplate | null {
  return templatesById.get(id) ?? null;
}

/**
 * Whether the template shows data (a chart, a simulation's numbers), whose source it cites or
 * which it labels as an example. A sorting or matching activity shows none, so a data note on it
 * would say something false.
 */
export function showsActivityData(template: string): boolean {
  return getActivityTemplate(template)?.needsData === true;
}
