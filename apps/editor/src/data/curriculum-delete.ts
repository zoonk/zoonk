import "server-only";
import {
  type ContentDeleteDecision,
  type ContentDeleteTarget,
  getContentDeleteDecision,
} from "@zoonk/core/content/lifecycle";

type CurriculumDeletePermission = "delete" | "update";

/**
 * Builds the deletion plan used by editor mutations so every curriculum delete
 * entry point follows the same lifecycle rule. The plan keeps three decisions
 * together: whether the content must be archived, which permission is required,
 * and why the lifecycle layer considered it historically significant.
 */
export async function getCurriculumDeletePlan({
  isPublished,
  target,
}: {
  isPublished: boolean;
  target: ContentDeleteTarget;
}): Promise<ContentDeleteDecision & { permission: CurriculumDeletePermission }> {
  const decision = await getContentDeleteDecision(target);

  return {
    ...decision,
    permission: getCurriculumDeletePermission({
      isPublished,
    }),
  };
}

/**
 * Archived rows should stop reserving the public slug they used while active.
 * We rewrite the slug to a deterministic archived-only value so editors can
 * create new active curriculum with the original slug without changing DB
 * uniqueness rules.
 */
export function getArchivedSlug({ id, slug }: { id: string; slug: string }) {
  return `${slug}--archived-${id}`;
}

/**
 * Preserves the current published-content privilege boundary while still requiring
 * the same UX regardless of whether the underlying mutation archives or hard
 * deletes. Published content still requires `delete`, while unpublished content
 * continues to use `update` even when the lifecycle layer decides to archive it.
 */
function getCurriculumDeletePermission({
  isPublished,
}: {
  isPublished: boolean;
}): CurriculumDeletePermission {
  if (isPublished) {
    return "delete";
  }

  return "update";
}
