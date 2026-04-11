import "server-only";
import {
  type Activity,
  type Chapter,
  type ContentManagementMode,
  type Course,
  type Lesson,
  type LessonKind,
} from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

type ManagedContent = Pick<Activity | Chapter | Course | Lesson, "managementMode">;
type VersionedLesson = Pick<
  Lesson,
  "generationVersion" | "isRegenerating" | "kind" | "managementMode"
>;

const lessonGenerationVersions: Record<LessonKind, number> = {
  core: 1,
  custom: 1,
  language: 1,
};

type ContentManagementState = {
  allowsAutomaticRegeneration: boolean;
  isAiManaged: boolean;
  isManual: boolean;
  isPinned: boolean;
  managementMode: ContentManagementMode;
};

type LessonGenerationState = ContentManagementState & {
  currentGenerationVersion: number | null;
  hasGenerationVersionMismatch: boolean;
  needsInitialGeneration: boolean;
  shouldAutoEnqueueRegeneration: boolean;
  isOutdated: boolean;
  targetGenerationVersion: number;
};

/**
 * This helper exists so every caller reads the same ownership policy from
 * explicit metadata instead of inferring it from organization slugs or other
 * incidental signals. Only AI-managed content is eligible for automatic
 * regeneration; manual and pinned content stay protected.
 */
function getContentManagementState({
  content,
}: {
  content: ManagedContent;
}): ContentManagementState {
  const isAiManaged = isAiManagedContent({ managementMode: content.managementMode });
  const isManual = isManualContent({ managementMode: content.managementMode });
  const isPinned = isPinnedContent({ managementMode: content.managementMode });

  return {
    allowsAutomaticRegeneration: isAiManaged,
    isAiManaged,
    isManual,
    isPinned,
    managementMode: content.managementMode,
  };
}

/**
 * This helper exists so the app and workflow code share one definition of what
 * it means for an AI-managed lesson to be behind the current manual rollout.
 *
 * A version mismatch only matters for AI-managed lessons; manual and pinned
 * lessons should stay protected even if their stored version is different.
 *
 * `isRegenerating` only means "a background refresh is currently in flight";
 * freshness still comes entirely from comparing the stored version to the
 * target version for that lesson kind.
 */
export function getLessonGenerationState({
  lesson,
}: {
  lesson: VersionedLesson;
}): LessonGenerationState {
  const managementState = getContentManagementState({ content: lesson });
  const targetGenerationVersion = getTargetLessonGenerationVersion(lesson.kind);

  if (!managementState.isAiManaged) {
    return {
      ...managementState,
      currentGenerationVersion: lesson.generationVersion,
      hasGenerationVersionMismatch: false,
      isOutdated: false,
      needsInitialGeneration: false,
      shouldAutoEnqueueRegeneration: false,
      targetGenerationVersion,
    };
  }

  const isNewLesson = lesson.generationVersion === null;
  const hasGenerationVersionMismatch = lesson.generationVersion !== targetGenerationVersion;
  const needsInitialGeneration = isNewLesson;
  const shouldAutoEnqueueRegeneration =
    !isNewLesson && hasGenerationVersionMismatch && !lesson.isRegenerating;

  return {
    ...managementState,
    currentGenerationVersion: lesson.generationVersion,
    hasGenerationVersionMismatch,
    isOutdated: hasGenerationVersionMismatch,
    needsInitialGeneration,
    shouldAutoEnqueueRegeneration,
    targetGenerationVersion,
  };
}

/**
 * This helper exists so manual regeneration decisions live in one shared place.
 * Each lesson kind gets its own version track because we may decide to refresh
 * core, custom, and language lessons independently over time.
 */
export function getTargetLessonGenerationVersion(kind: LessonKind): number {
  return lessonGenerationVersions[kind];
}

/**
 * This helper exists so new curriculum rows get a consistent initial ownership
 * mode. Content created inside the first-party AI namespace should stay
 * AI-managed by default, while content created elsewhere should default to
 * manual ownership until someone explicitly chooses another mode.
 */
export function getDefaultContentManagementMode({
  organizationSlug,
}: {
  organizationSlug?: string | null;
}): ContentManagementMode {
  return organizationSlug === AI_ORG_SLUG ? "ai" : "manual";
}

/**
 * This helper exists because AI-managed content is the only mode that allows
 * the system to change curriculum without a person opting in at that moment.
 */
function isAiManagedContent({ managementMode }: { managementMode: ContentManagementMode }) {
  return managementMode === "ai";
}

/**
 * This helper exists so callers do not need to infer "manual" by negating
 * other flags. Keeping the mode explicit makes manual protections easier to
 * reason about in future regeneration logic.
 */
function isManualContent({ managementMode }: { managementMode: ContentManagementMode }) {
  return managementMode === "manual";
}

/**
 * This helper exists because pinned content is a distinct promise: even if the
 * system created it originally, automatic regeneration must treat it as
 * protected until someone changes the mode explicitly.
 */
function isPinnedContent({ managementMode }: { managementMode: ContentManagementMode }) {
  return managementMode === "pinned";
}
