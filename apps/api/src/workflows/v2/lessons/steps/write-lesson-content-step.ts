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

export type LessonWriteOutcome =
  | { check: LessonCheckPlan | null; imageScope: ImageScope; status: "published" }
  | { redraft: boolean; status: "heldBack" }
  | { status: "notWritten" };

export type ImageScope = "personal" | "shared" | null;

type WriteResult = Exclude<LessonWriteOutcome, { status: "heldBack" }> | { status: "heldBack" };

type WriteInput = {
  analytics?: ContentAnalytics;
  forExam?: boolean;
  forceReview?: boolean;
  lessonId: string;
  wait?: CallWait;
  workflowRunId: string;
};

type LessonTarget = {
  owner: { isAnonymous: boolean } | null;
  ownerId: string | null;
  spec: unknown;
  targetLanguage: string | null;
};

export function getImageScope(lesson: Pick<LessonTarget, "owner" | "ownerId">): ImageScope {
  if (lesson.owner?.isAnonymous) {
    return null;
  }

  return lesson.ownerId ? "personal" : "shared";
}

function getPublishedImageScope(lesson: LessonTarget): ImageScope {
  return lesson.targetLanguage || parseChallengeLessonSpec(lesson.spec)
    ? null
    : getImageScope(lesson);
}

function toOutcome(status: string): WriteResult {
  return status === "heldBack" ? { status: "heldBack" } : { status: "notWritten" };
}

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

  const result = await writeLessonContent({ ...input, analytics, reuse, serviceTier });

  return result.status === "published"
    ? { check: result.check, imageScope: getImageScope(lesson), status: "published" }
    : toOutcome(result.status);
}

export async function writeLessonContentStep(input: WriteInput): Promise<LessonWriteOutcome> {
  "use step";

  const lesson = await prisma.lesson.findUnique({
    select: {
      contentRunId: true,
      contentStatus: true,
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

  // The runtime runs a step's body again when its result was lost after the body ended, so a lesson
  // this run already published isn't written again.
  if (lesson.contentStatus === "completed" && lesson.contentRunId === input.workflowRunId) {
    return { check: null, imageScope: getPublishedImageScope(lesson), status: "published" };
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
