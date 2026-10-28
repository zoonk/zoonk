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

export type ActivityContentFor<TId extends ActivityTemplateId> = Extract<
  ActivityStepContent,
  { template: TId }
>;

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

export function exploresSolved(template: string): boolean {
  return getActivityTemplate(template)?.checks.every((kind) => kind === "interaction") ?? false;
}

export function isExploreTemplate(id: string): id is ExploreTemplateId {
  return exploreTemplateIds.has(id);
}

const templatesById: ReadonlyMap<string, ActivityTemplate> = new Map(
  activityTemplates.map((template): [string, ActivityTemplate] => [template.id, template]),
);

export function getActivityTemplate(id: string): ActivityTemplate | null {
  return templatesById.get(id) ?? null;
}

export function showsActivityData(content: { fields: unknown; template: string }): boolean {
  return getActivityTemplate(content.template)?.showsData(content.fields) ?? false;
}
