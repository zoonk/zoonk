import "server-only";
import {
  type Activity,
  type Chapter,
  type ContentManagementMode,
  type Course,
  type Lesson,
} from "@zoonk/db";

type ManagedContent = Pick<Activity | Chapter | Course | Lesson, "managementMode" | "staleAt">;

export type ContentManagementState = {
  isAiManaged: boolean;
  isAutomaticRegenerationEligible: boolean;
  isManual: boolean;
  isPinned: boolean;
  isStale: boolean;
  managementMode: ContentManagementMode;
};

/**
 * This helper exists so every regeneration path reads the same policy from the
 * same metadata instead of re-deriving intent from organization slugs or other
 * incidental signals. Automatic regeneration is only allowed for AI-managed
 * content whose stale deadline has already passed.
 */
export function getContentManagementState({
  content,
  now = new Date(),
}: {
  content: ManagedContent;
  now?: Date;
}): ContentManagementState {
  const isAiManaged = isAiManagedContent({ managementMode: content.managementMode });
  const isManual = isManualContent({ managementMode: content.managementMode });
  const isPinned = isPinnedContent({ managementMode: content.managementMode });
  const isStale = isAiManaged && hasReachedStaleDeadline({ now, staleAt: content.staleAt });

  return {
    isAiManaged,
    isAutomaticRegenerationEligible: canAutomaticallyRegenerate({
      isAiManaged,
      isStale,
    }),
    isManual,
    isPinned,
    isStale,
    managementMode: content.managementMode,
  };
}

/**
 * This helper exists because "AI-managed" is the only mode that allows the
 * system to change curriculum without a person opting in at that moment.
 */
function isAiManagedContent({ managementMode }: { managementMode: ContentManagementMode }) {
  return managementMode === "ai";
}

/**
 * This helper exists so manual content can stay explicit in the return value.
 * Future callers should not have to infer "manual" by negating other flags.
 */
function isManualContent({ managementMode }: { managementMode: ContentManagementMode }) {
  return managementMode === "manual";
}

/**
 * This helper exists because pinned content is a distinct promise: even if the
 * system produced it originally, we must treat it as protected from automatic
 * replacement until someone changes the mode explicitly.
 */
function isPinnedContent({ managementMode }: { managementMode: ContentManagementMode }) {
  return managementMode === "pinned";
}

/**
 * This helper exists to define "stale" as an explicit deadline rather than an
 * implicit age guess. If no stale deadline exists yet, the content is still
 * considered fresh for automatic-regeneration purposes.
 */
function hasReachedStaleDeadline({ now, staleAt }: { now: Date; staleAt: Date | null }) {
  return Boolean(staleAt && staleAt <= now);
}

/**
 * This helper exists so the final eligibility rule stays obvious at call sites.
 * Automatic regeneration requires both explicit AI ownership and an expired
 * stale deadline; anything manual or pinned stays protected.
 */
function canAutomaticallyRegenerate({
  isAiManaged,
  isStale,
}: {
  isAiManaged: boolean;
  isStale: boolean;
}) {
  return isAiManaged && isStale;
}
