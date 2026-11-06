import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { parseChallengeLessonSpec } from "@zoonk/core/library/challenges/lesson-spec";
import { writeChallengeLessonContent } from "@zoonk/core/library/challenges/write";
import { getScopeModel } from "@zoonk/core/library/curriculum/scope";
import {
  canRedraftLesson,
  getLessonGenerationState,
  isLessonSavedByRun,
} from "@zoonk/core/library/generation/state";
import { writeLanguageLessonContent } from "@zoonk/core/library/language/write-lesson-content";
import { loadLessonReuse } from "@zoonk/core/library/lessons/reuse";
import {
  type LessonCheckPlan,
  type LessonDraftState,
  type LessonDraftToFix,
  checkLessonContent,
  fixLessonContent,
  writeLessonContent,
} from "@zoonk/core/library/lessons/write-content";
import { prisma } from "@zoonk/db";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { type LessonStreamStep } from "./lesson-progress-step";

export type LessonWriteOutcome =
  | { check: LessonCheckPlan | null; imageScope: ImageScope; status: "published" }
  | { redraft: boolean; status: "heldBack" }
  | { status: "notWritten" };

export type ImageScope = "personal" | "shared" | null;

type WriteResult =
  | Exclude<LessonWriteOutcome, { status: "heldBack" }>
  | { status: "heldBack" }
  | { draft: LessonDraftState; imageScope: ImageScope; status: "drafted" };
export type LessonWriteStage = LessonWriteOutcome | Extract<WriteResult, { status: "drafted" }>;

export type WriteInput = {
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
  const serviceTier = chooseServiceTier({ wait: input.wait ?? "soon" });

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

  const reuse = await loadLessonReuse({ forExam: input.forExam, lessonId: input.lessonId });
  const result = await writeLessonContent({ ...input, analytics, reuse, serviceTier });

  if (result.status === "drafted") {
    return { ...result, imageScope: getImageScope(lesson) };
  }

  return toOutcome(result.status);
}

export async function writeLessonContentStep(input: WriteInput): Promise<LessonWriteStage> {
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

  // The runtime runs a step's body again when its result was lost after the body ended, so a lesson
  // this run already saved isn't written again.
  if (await isLessonSavedByRun(input)) {
    return { check: null, imageScope: getPublishedImageScope(lesson), status: "published" };
  }

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: input.lessonId, status: "started", step: "writeLesson" });

  const written = await write({ input, lesson });

  if (written.status === "drafted") {
    return written;
  }

  await stream.status({ entityId: input.lessonId, status: "completed", step: "writeLesson" });

  if (written.status !== "heldBack") {
    return written;
  }

  return {
    redraft: canRedraftLesson(await getLessonGenerationState(input.lessonId)),
    status: "heldBack",
  };
}

export async function fixLessonContentStep(draft: LessonDraftToFix): Promise<LessonDraftState> {
  "use step";
  return fixLessonContent(draft);
}

export async function checkLessonContentStep({
  draft,
  imageScope,
  input,
}: {
  draft: LessonDraftState;
  imageScope: ImageScope;
  input: WriteInput;
}): Promise<LessonWriteOutcome | LessonDraftToFix> {
  "use step";

  if (await isLessonSavedByRun(input)) {
    return { check: null, imageScope, status: "published" };
  }

  const checked = await checkLessonContent({ ...input, draft });

  if (checked.status === "needsFix") {
    return checked;
  }

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: input.lessonId, status: "completed", step: "writeLesson" });

  if (checked.status === "published") {
    return { check: checked.check, imageScope, status: "published" };
  }

  return checked.status === "heldBack"
    ? {
        redraft: canRedraftLesson(await getLessonGenerationState(input.lessonId)),
        status: "heldBack",
      }
    : { status: "notWritten" };
}
