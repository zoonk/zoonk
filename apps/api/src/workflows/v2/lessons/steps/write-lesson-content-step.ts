import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { parseChallengeLessonSpec } from "@zoonk/core/library/challenges/lesson-spec";
import { writeChallengeLessonContent } from "@zoonk/core/library/challenges/write";
import { getScopeModel } from "@zoonk/core/library/curriculum/scope";
import { canRedraftLesson, getLessonGenerationState } from "@zoonk/core/library/generation/state";
import { writeLanguageLessonContent } from "@zoonk/core/library/language/write-lesson-content";
import { loadLessonReuse } from "@zoonk/core/library/lessons/reuse";
import {
  type LessonCheckPlan,
  writeLessonContent,
} from "@zoonk/core/library/lessons/write-content";
import { prisma } from "@zoonk/db";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { type LessonStreamStep } from "./lesson-progress-step";

/**
 * `published`: the lesson passed its code checks and can be played; `check` is what its model
 * checks read after publishing (null for language lessons and challenges, which have none).
 * `heldBack`: it failed them twice and its claim ended as failed; `redraft` says whether it has
 * drafts left, so this run drafts it again at once. `notWritten`: this run lost its claim or the
 * lesson has no spec.
 */
export type LessonWriteOutcome =
  | { check: LessonCheckPlan | null; imageScope: ImageScope; status: "published" }
  | { redraft: boolean; status: "heldBack" }
  | { status: "notWritten" };

/** Whose pictures a published lesson gets: shared, a private course's, or none (a guest's own). */
export type ImageScope = "personal" | "shared" | null;

type WriteResult = Exclude<LessonWriteOutcome, { status: "heldBack" }> | { status: "heldBack" };

type WriteInput = {
  analytics?: ContentAnalytics;
  forExam?: boolean;
  forceReview?: boolean;
  lessonId: string;
  /** When a learner reaches the lesson (see `LessonContentInput`). */
  wait?: CallWait;
  workflowRunId: string;
};

type LessonTarget = {
  owner: { isAnonymous: boolean } | null;
  ownerId: string | null;
  spec: unknown;
  targetLanguage: string | null;
};

/**
 * A lesson's pictures are drawn after it's published: shared ones for a Library lesson, its
 * owner's for a private course's. A guest's own lesson gets none, so a guest's goal never costs
 * more than its share of the guests' daily budget.
 */
export function getImageScope(lesson: Pick<LessonTarget, "owner" | "ownerId">): ImageScope {
  if (lesson.owner?.isAnonymous) {
    return null;
  }

  return lesson.ownerId ? "personal" : "shared";
}

function toOutcome(status: string): WriteResult {
  return status === "heldBack" ? { status: "heldBack" } : { status: "notWritten" };
}

/**
 * Language lessons are written per language pair and have no pictures; a chapter's challenge is
 * written by the case writer, also without pictures; everything else uses the lesson writer.
 */
async function write({
  input,
  lesson,
}: {
  input: WriteInput;
  lesson: LessonTarget;
}): Promise<WriteResult> {
  const analytics = toContentAnalytics({ ...input, scope: lesson });
  const reuse = await loadLessonReuse({ forExam: input.forExam, lessonId: input.lessonId });
  const serviceTier = chooseServiceTier({ reuse, wait: input.wait ?? "soon" });

  if (lesson.targetLanguage) {
    const result = await writeLanguageLessonContent({
      analytics,
      lessonId: input.lessonId,
      serviceTier,
      workflowRunId: input.workflowRunId,
    });

    return result.status === "published"
      ? { check: null, imageScope: null, status: "published" }
      : toOutcome(result.status);
  }

  if (parseChallengeLessonSpec(lesson.spec)) {
    const challenge = await writeChallengeLessonContent({
      analytics,
      lessonId: input.lessonId,
      model: getScopeModel(lesson),
      serviceTier,
      workflowRunId: input.workflowRunId,
    });

    return challenge.status === "published"
      ? { check: null, imageScope: null, status: "published" }
      : toOutcome(challenge.status);
  }

  const result = await writeLessonContent({
    ...input,
    analytics,
    model: getScopeModel(lesson),
    reuse,
    serviceTier,
  });

  return result.status === "published"
    ? { check: result.check, imageScope: getImageScope(lesson), status: "published" }
    : toOutcome(result.status);
}

/**
 * Writes the lesson's screens for the run that holds its content claim: the writer drafts them,
 * the code checks read them, one fix pass repairs what failed, and the lesson is published in one
 * transaction, so a learner waiting on it never waits on a model check: those follow publishing
 * (the returned `check`, see `lessonCheckWorkflow`). A draft still held back says whether the
 * lesson has drafts left. A rate limit is retried after a minute.
 */
export async function writeLessonContentStep(input: WriteInput): Promise<LessonWriteOutcome> {
  "use step";

  const lesson = await prisma.lesson.findUnique({
    select: {
      owner: { select: { isAnonymous: true } },
      ownerId: true,
      spec: true,
      targetLanguage: true,
    },
    where: { id: input.lessonId },
  });

  if (!lesson) {
    return { status: "notWritten" };
  }

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: input.lessonId, status: "started", step: "writeLesson" });

  const written = await withAiRetry(() => write({ input, lesson }));

  await stream.status({ entityId: input.lessonId, status: "completed", step: "writeLesson" });

  if (written.status !== "heldBack") {
    return written;
  }

  return {
    redraft: canRedraftLesson(await getLessonGenerationState(input.lessonId)),
    status: "heldBack",
  };
}

writeLessonContentStep.maxRetries = 1;
