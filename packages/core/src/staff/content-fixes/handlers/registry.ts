import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type Resolution, refuse } from "../_utils/resolved-change";
import { blueprintSet, cutoffSet, weightsSet } from "./exam-facts";
import { type FixHandler } from "./fix-handler";
import { itemReplace, itemRestore, itemSet } from "./item-content";
import { itemSetReplace, itemSetRestore } from "./item-set";
import { lessonSentenceSet, lessonWordSet } from "./lesson-vocabulary";
import { levelTestSet } from "./level-test";
import { mindMapSet } from "./mind-map";
import { stepAttachPicture, stepDetachPicture } from "./pictures";
import { explanationSet, itemRetire, itemUnretire } from "./practice";
import { pronunciationSet } from "./pronunciation";
import { stepSetOptions, variantSetOptions } from "./screen-options";
import { stepSet, variantSet } from "./screens";
import {
  lessonSourcesSet,
  sourceNoticeSet,
  sourceSet,
  stepCitationSet,
  stepSourcesSet,
} from "./shared-sources";
import { mediaAltSet, scenarioSet, skillSet, tutorAnswerSet, warmUpSet } from "./shared-text";
import { examGraph, languageGraph } from "./structure-graphs";
import { chapterLessons, courseChapters } from "./structure-placements";
import { chapterSkills, lessonSkills, skillPrerequisites } from "./structure-skills";
import { chapterSet, courseSet, lessonSet } from "./text-rows";
import {
  sentenceRestoreClip,
  sentenceRevoice,
  wordRestoreClip,
  wordRevoice,
} from "./vocabulary-revoice";
import { sentenceSet, wordSet } from "./vocabulary-rows";

/**
 * Every model and operation a content fix can change. Adding one is adding its handler here: its
 * proposal schema, `staff models` rules, checks, write, inverse and effects all live in it.
 */
export const FIX_HANDLERS = [
  skillSet,
  warmUpSet,
  scenarioSet,
  tutorAnswerSet,
  mediaAltSet,
  blueprintSet,
  cutoffSet,
  weightsSet,
  sourceSet,
  sourceNoticeSet,
  stepCitationSet,
  lessonSourcesSet,
  stepSourcesSet,
  mindMapSet,
  itemSetReplace,
  itemSetRestore,
  courseSet,
  chapterSet,
  lessonSet,
  stepSet,
  stepDetachPicture,
  stepAttachPicture,
  variantSet,
  explanationSet,
  itemRetire,
  itemUnretire,
  itemSet,
  itemReplace,
  itemRestore,
  levelTestSet,
  wordSet,
  wordRevoice,
  pronunciationSet,
  lessonWordSet,
  sentenceSet,
  sentenceRevoice,
  lessonSentenceSet,
  stepSetOptions,
  variantSetOptions,
  courseChapters,
  chapterLessons,
  chapterSkills,
  lessonSkills,
  skillPrerequisites,
  examGraph,
  languageGraph,
  wordRestoreClip,
  sentenceRestoreClip,
] as const;

/** What `pnpm zoonk staff models` tells an agent it may propose for each model. */
export const FIXABLE_MODELS: ReadonlyMap<
  string,
  { fields: readonly string[]; operation: string; rules: string }[]
> = new Map(
  [...new Set(FIX_HANDLERS.map((handler) => handler.model))].map((model) => [
    model,
    FIX_HANDLERS.flatMap((handler: FixHandler) =>
      handler.model === model && handler.proposal
        ? [{ ...handler.proposal, operation: handler.op }]
        : [],
    ),
  ]),
);

export function findStoredHandler(change: { model: string; op: string }): FixHandler {
  const handler = FIX_HANDLERS.find(
    (candidate: FixHandler) => candidate.model === change.model && candidate.op === change.op,
  );

  if (!handler) {
    throw new Error(`No content fix handler for ${change.model} ${change.op}`);
  }

  return handler;
}

function describeOperations(model: string): string {
  const operations = FIXABLE_MODELS.get(model)?.map((operation) => operation.operation) ?? [];

  return operations.length > 0
    ? `${model} takes ${operations.join(", ")}.`
    : `${model} isn't fixable. Run pnpm zoonk staff models to see what is.`;
}

/** A proposed change names its model and carries one operation's key, such as `set` or `retire`. */
export function prepareProposedChange(
  db: TransactionClient,
  change: unknown,
): Promise<Resolution<unknown>> {
  if (!isJsonObject(change) || typeof change.model !== "string") {
    return Promise.resolve(refuse("Each change is { model, id, <operation> }."));
  }

  const { model } = change;

  const handlers = FIX_HANDLERS.filter(
    (handler: FixHandler) => handler.model === model && handler.proposal && handler.op in change,
  );

  const [handler] = handlers;

  if (!handler || handlers.length > 1) {
    return Promise.resolve(refuse(`A change carries one operation. ${describeOperations(model)}`));
  }

  return handler.propose(db, change);
}
