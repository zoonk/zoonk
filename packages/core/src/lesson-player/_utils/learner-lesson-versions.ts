import "server-only";
import { type StepVariant } from "@zoonk/db";
import { safeParseStepContent } from "../../library/steps/contract/step-contract";
import {
  type LearnerVersionKeys,
  findLearnerVersion,
  loadLearnerVersionKeys,
  loadLearnerVersions,
} from "../../library/variants/learner-versions";
import {
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
  type PlayableTeachingStepOf,
  type TeachingStepKind,
} from "../contract";

/**
 * A screen with its version's content. A field or tool version changes the example, so the
 * original's picture no longer fits; a version that doesn't parse leaves the shared screen.
 */
function withContent<TKind extends TeachingStepKind>({
  step,
  version,
}: {
  step: PlayableTeachingStepOf<TKind>;
  version: StepVariant;
}): PlayableTeachingStepOf<TKind> {
  const parsed = safeParseStepContent(step.kind, version.content);
  return parsed.success ? { ...step, content: parsed.data, image: null } : step;
}

/** The screens that have field or tool versions; every other one stays shared. */
type VersionedStep =
  | PlayableTeachingStepOf<"challenge">
  | PlayableTeachingStepOf<"check">
  | PlayableTeachingStepOf<"explanation">
  | PlayableTeachingStepOf<"workedExample">;

const VERSIONED_KINDS = new Set<string>(["challenge", "check", "explanation", "workedExample"]);

function isVersionedStep(step: PlayableLibraryStep): step is VersionedStep {
  return VERSIONED_KINDS.has(step.kind);
}

function toSeenStep({
  keys,
  step,
  versions,
}: {
  keys: LearnerVersionKeys;
  step: PlayableLibraryStep;
  versions: readonly StepVariant[];
}): PlayableLibraryStep {
  const version = findLearnerVersion({ keys, step, versions });

  if (!version || !isVersionedStep(step)) {
    return step;
  }

  switch (step.kind) {
    case "challenge":
      return withContent({ step, version });
    case "check":
      return withContent({ step, version });
    case "explanation":
      return withContent({ step, version });
    case "workedExample":
      return withContent({ step, version });
    default:
      return step;
  }
}

/**
 * The shared lesson as this learner sees it: screens with a version in their field or tool (a
 * chapter challenge set in their work, a hands-on screen in the tool they use or without
 * installing anything) show that version, and every other screen stays the shared one. A version
 * that isn't made yet never blocks the lesson.
 */
export async function withLearnerLessonVersions({
  lesson,
  userId,
}: {
  lesson: PlayableLibraryLesson;
  userId: string;
}): Promise<PlayableLibraryLesson> {
  const keys = await loadLearnerVersionKeys({ lessonId: lesson.id, userId });

  const versions = await loadLearnerVersions({
    keys,
    stepIds: lesson.steps.map((step) => step.id),
  });

  if (versions.length === 0) {
    return lesson;
  }

  return { ...lesson, steps: lesson.steps.map((step) => toSeenStep({ keys, step, versions })) };
}
