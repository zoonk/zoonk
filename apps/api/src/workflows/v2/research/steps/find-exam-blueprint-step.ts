import { decideExamIdentity } from "@zoonk/ai/tasks/v2/research/exam-identity-decision";
import {
  type ExamIdentity,
  buildExamIdentityKey,
  findExamBlueprintByKey,
  searchExamBlueprints,
} from "@zoonk/core/library/exams/identity";
import { type ExamBlueprint } from "@zoonk/db";
import { withAiRetry } from "../../_shared/ai-retry";

const DAY_MS = 86_400_000;

export type ExamBlueprintLookup = {
  /** The identity research saves under: the stored exam's when another name matched it. */
  identity: ExamIdentity;
  /** The key research claims, so two learners never research the same exam at once. */
  identityKey: string;
  blueprintId: string | null;
  /** False when the stored edition's exam has passed, so a new notice is looked for. */
  isCurrent: boolean;
};

async function findSameExam({
  identity,
  searchTerms,
}: {
  identity: ExamIdentity;
  searchTerms: string[];
}): Promise<ExamBlueprint | null> {
  const identityKey = buildExamIdentityKey(identity);
  const exact = await findExamBlueprintByKey({ identityKey, language: identity.language });

  // Private blueprints only match their owner's exact key.
  if (exact || identity.ownerId) {
    return exact;
  }

  const candidates = await searchExamBlueprints({
    country: identity.country,
    language: identity.language,
    terms: [identity.name, ...searchTerms],
  });

  if (candidates.length === 0) {
    return null;
  }

  const match = await withAiRetry(() => decideExamIdentity({ candidates, request: identity }));

  return candidates.find((candidate) => candidate.id === match?.id) ?? null;
}

/** A stored edition stays current until a day after its exam; one without a date always is. */
function isCurrentEdition({ blueprint, now }: { blueprint: ExamBlueprint; now: Date }): boolean {
  return !blueprint.examDate || blueprint.examDate.getTime() + DAY_MS > now.getTime();
}

/**
 * Finds the exam's canonical blueprint: its exact key first, then shared
 * blueprints of the same country whose names match, confirmed one by one by
 * an evaluation model. The first learner for an exam triggers research;
 * everyone after reads the stored result.
 */
export async function findExamBlueprintStep({
  identity,
  searchTerms,
}: {
  identity: ExamIdentity;
  searchTerms: string[];
}): Promise<ExamBlueprintLookup> {
  "use step";

  const blueprint = await findSameExam({ identity, searchTerms });

  if (!blueprint) {
    return {
      blueprintId: null,
      identity,
      identityKey: buildExamIdentityKey(identity),
      isCurrent: false,
    };
  }

  return {
    blueprintId: blueprint.id,
    identity: {
      board: blueprint.board,
      country: blueprint.country,
      language: blueprint.language,
      name: blueprint.name,
      ownerId: identity.ownerId,
      role: blueprint.role,
    },
    identityKey: blueprint.identityKey,
    isCurrent: isCurrentEdition({ blueprint, now: new Date() }),
  };
}
