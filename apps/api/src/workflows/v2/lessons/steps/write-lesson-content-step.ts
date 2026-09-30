import { createStepStream } from "@/workflows/_shared/stream-status";
import { parseChallengeLessonSpec } from "@zoonk/core/library/challenges/lesson-spec";
import { writeChallengeLessonContent } from "@zoonk/core/library/challenges/write";
import { getScopeModel } from "@zoonk/core/library/curriculum/scope";
import { canRedraftLesson, getLessonGenerationState } from "@zoonk/core/library/generation/state";
import { writeLanguageLessonContent } from "@zoonk/core/library/language/write-lesson-content";
import { writeLessonContent } from "@zoonk/core/library/lessons/write-content";
import { prisma } from "@zoonk/db";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { type LessonStreamStep } from "./lesson-progress-step";

/**
 * `published`: the lesson passed its checks and can be played. `heldBack`: it failed them twice
 * and its claim ended as failed; `redraft` says whether it has drafts left, so this run drafts it
 * again at once. `notWritten`: this run lost its claim or the lesson has no spec.
 */
export type LessonWriteOutcome =
  | { imageScope: "personal" | "shared" | null; status: "published" }
  | { redraft: boolean; status: "heldBack" }
  | { status: "notWritten" };

type WriteResult = Exclude<LessonWriteOutcome, { status: "heldBack" }> | { status: "heldBack" };

type WriteInput = {
  analytics?: ContentAnalytics;
  forExam?: boolean;
  forceReview?: boolean;
  lessonId: string;
  priority?: boolean;
  workflowRunId: string;
};

type LessonTarget = {
  owner: { isAnonymous: boolean } | null;
  ownerId: string | null;
  spec: unknown;
  targetLanguage: string | null;
};

/**
 * A lesson's pictures are drawn after it's published. A guest's own lesson gets none, so a
 * guest's goal never costs more than its share of the guests' daily budget.
 */
function getImageScope({
  contentScope,
  lesson,
}: {
  contentScope: ReturnType<typeof toContentAnalytics>["contentScope"];
  lesson: LessonTarget;
}): "personal" | "shared" | null {
  return lesson.owner?.isAnonymous ? null : (contentScope ?? "shared");
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

  if (lesson.targetLanguage) {
    const result = await writeLanguageLessonContent({
      analytics,
      lessonId: input.lessonId,
      priority: input.priority,
      workflowRunId: input.workflowRunId,
    });

    return result.status === "published"
      ? { imageScope: null, status: "published" }
      : toOutcome(result.status);
  }

  if (parseChallengeLessonSpec(lesson.spec)) {
    const challenge = await writeChallengeLessonContent({
      analytics,
      lessonId: input.lessonId,
      model: getScopeModel(lesson),
      priority: input.priority,
      workflowRunId: input.workflowRunId,
    });

    return challenge.status === "published"
      ? { imageScope: null, status: "published" }
      : toOutcome(challenge.status);
  }

  const result = await writeLessonContent({ ...input, analytics, model: getScopeModel(lesson) });

  return result.status === "published"
    ? {
        imageScope: getImageScope({ contentScope: analytics.contentScope, lesson }),
        status: "published",
      }
    : toOutcome(result.status);
}

/**
 * Writes the lesson's screens for the run that holds its content claim: the writer drafts them,
 * the quality gate checks them (code checks always, the cross-family reasoning check on advanced,
 * exam and high-stakes lessons and a sample of the rest), one fix pass repairs what failed, and
 * the lesson is published in one transaction. A draft still held back says whether the lesson
 * has drafts left. A rate limit is retried after a minute.
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
