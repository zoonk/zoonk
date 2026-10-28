import { isCurrentEdition } from "@zoonk/core/library/exams/blueprint-reading";
import { findSameExam } from "@zoonk/core/library/exams/find-same-exam";
import { type ExamIdentity, buildExamIdentityKey } from "@zoonk/core/library/exams/identity";
import { withAiRetry } from "../../_shared/ai-retry";

type ExamBlueprintLookup = {
  identity: ExamIdentity;
  identityKey: string;
  blueprintId: string | null;
  isCurrent: boolean;
};

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
