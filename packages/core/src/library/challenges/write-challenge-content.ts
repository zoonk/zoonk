import "server-only";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/v2/challenge/case";
import { prisma } from "@zoonk/db";
import { finishLibraryGeneration } from "../claims/generation-claim";
import { saveLessonContent } from "../lessons/_utils/save-lesson-content";
import {
  type ChallengeCaseInputs,
  draftChallengeCase,
  toChallengeCaseInputs,
} from "./_utils/draft-challenge";
import { parseChallengeLessonSpec } from "./challenge-lesson-spec";

type WriteChallengeResult =
  | { status: "heldBack"; problems: string[] }
  | { status: "missingSpec" }
  | { status: "notClaimed" }
  | { status: "published" };

async function loadChallengeInputs({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<
  { inputs: ChallengeCaseInputs; status: "ready" } | { status: "missingSpec" | "notClaimed" }
> {
  const lesson = await prisma.lesson.findUnique({
    include: { homeChapter: { include: { homeCourse: true } } },
    omit: { summary: true },
    where: { id: lessonId },
  });

  if (lesson?.contentStatus !== "running" || lesson.contentRunId !== workflowRunId) {
    return { status: "notClaimed" };
  }

  const spec = parseChallengeLessonSpec(lesson.spec);

  if (!spec) {
    return { status: "missingSpec" };
  }

  return { inputs: toChallengeCaseInputs({ lesson, spec }), status: "ready" };
}

/**
 * Writes a chapter's challenge for the workflow run that holds its content claim
 * (`draftChallengeCase`). A case that passes is published as the lesson's one screen, with its
 * summary card; one that still fails is held back and the claim ends as failed, so a later run can
 * try again.
 *
 * This is an internal workflow bridge: Library content is shared and no learner's data is written.
 */
export async function writeChallengeLessonContent({
  analytics,
  lessonId,
  model,
  priority = false,
  workflowRunId,
}: {
  analytics?: ChallengeCaseParams["analytics"];
  lessonId: string;
  /** The writer model, when not the task's default: private courses use a cheaper one. */
  model?: string;
  /** A learner is waiting on this lesson: the case is written at the priority tier. */
  priority?: boolean;
  workflowRunId: string;
}): Promise<WriteChallengeResult> {
  const state = await loadChallengeInputs({ lessonId, workflowRunId });

  if (state.status !== "ready") {
    return state;
  }

  const result = await draftChallengeCase({
    analytics: { contentScope: "shared", traceId: workflowRunId, ...analytics },
    inputs: state.inputs,
    model,
    serviceTier: priority ? "priority" : undefined,
  });

  if (!result.content) {
    await finishLibraryGeneration({
      id: lessonId,
      status: "failed",
      target: "lessonContent",
      workflowRunId,
    });

    return { problems: result.problems, status: "heldBack" };
  }

  const saved = await saveLessonContent({
    language: state.inputs.language,
    lessonId,
    screens: [
      {
        content: result.content,
        kind: "challenge",
        mathItem: null,
        provenance: result.provenance,
        skillId: null,
      },
    ],
    summary: result.summary,
    workflowRunId,
  });

  return saved ? { status: "published" } : { status: "notClaimed" };
}
