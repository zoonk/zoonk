import "server-only";
import { type StepVariant, prisma } from "@zoonk/db";
import { safeParseStepContent } from "../../library/steps/contract/step-contract";
import {
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
  type PlayableStepVariant,
  type PlayableTeachingStepOf,
} from "../contract";

/** The screens "Simpler" and "Go deeper" are written for. */
type DepthStepKind = "explanation" | "workedExample";

/**
 * The shared "Simpler" and "Go deeper" versions of these screens. They're read with every lesson
 * load instead of being cached with the lesson: a version is written while someone plays, by
 * whichever app they play in, and each app has its own cache, so a cached lesson would miss it.
 */
export function loadDepthVersions(stepIds: readonly string[]): Promise<StepVariant[]> {
  return prisma.stepVariant.findMany({
    where: { key: "", kind: { in: ["deeper", "simpler"] }, stepId: { in: [...stepIds] } },
  });
}

/** A depth version counts only when it parses as the same kind of screen. */
function getDepthVersion<TKind extends DepthStepKind>({
  depth,
  step,
  versions,
}: {
  depth: "deeper" | "simpler";
  step: PlayableTeachingStepOf<TKind>;
  versions: readonly StepVariant[];
}): PlayableStepVariant<TKind> | null {
  const version = versions.find((item) => item.stepId === step.id && item.kind === depth);

  if (!version) {
    return null;
  }

  const parsed = safeParseStepContent(step.kind, version.content);
  return parsed.success ? { content: parsed.data, id: version.id } : null;
}

function withStepDepthVersions<TKind extends DepthStepKind>({
  step,
  versions,
}: {
  step: PlayableTeachingStepOf<TKind>;
  versions: readonly StepVariant[];
}): PlayableTeachingStepOf<TKind> {
  return {
    ...step,
    variants: {
      deeper: getDepthVersion({ depth: "deeper", step, versions }),
      simpler: getDepthVersion({ depth: "simpler", step, versions }),
    },
  };
}

/** One call per kind keeps each screen's content typed to its kind. */
function toStepWithDepthVersions({
  step,
  versions,
}: {
  step: PlayableLibraryStep;
  versions: readonly StepVariant[];
}): PlayableLibraryStep {
  if (step.kind === "explanation") {
    return withStepDepthVersions({ step, versions });
  }

  if (step.kind === "workedExample") {
    return withStepDepthVersions({ step, versions });
  }

  return step;
}

/** The lesson with the depth versions made so far, so switching to one needs no request. */
export function withDepthVersions({
  lesson,
  versions,
}: {
  lesson: PlayableLibraryLesson;
  versions: readonly StepVariant[];
}): PlayableLibraryLesson {
  if (versions.length === 0) {
    return lesson;
  }

  return {
    ...lesson,
    steps: lesson.steps.map((step) => toStepWithDepthVersions({ step, versions })),
  };
}
