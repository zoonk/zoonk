import { isCurrentEdition } from "@zoonk/core/library/exams/blueprint-reading";
import { findSameExam } from "@zoonk/core/library/exams/find-same-exam";
import { type ExamIdentity, buildExamIdentityKey } from "@zoonk/core/library/exams/identity";
import { withAiRetry } from "../../_shared/ai-retry";

type ExamBlueprintLookup = {
  /** The identity research saves under: the stored exam's when another name matched it. */
  identity: ExamIdentity;
  /** The key research claims, so two learners never research the same exam at once. */
  identityKey: string;
  blueprintId: string | null;
  /** False when the stored edition's exam has passed, so a new notice is looked for. */
  isCurrent: boolean;
};

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

  const blueprint = await withAiRetry(() => findSameExam({ request: identity, searchTerms }));

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
