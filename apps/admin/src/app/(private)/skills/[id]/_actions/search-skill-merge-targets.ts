"use server";

import { searchSkillMergeTargets } from "@/data/skills/search-merge-targets";
import { assertAdmin } from "@/lib/admin-guard";
import { isUuid } from "@zoonk/utils/uuid";

export async function searchSkillMergeTargetsAction({
  duplicateId,
  query,
}: {
  duplicateId: string;
  query: string;
}) {
  await assertAdmin();
  const search = query.trim().slice(0, 100);

  if (!isUuid(duplicateId) || search.length < 2) {
    return [];
  }

  return searchSkillMergeTargets(duplicateId, search);
}
