import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateLessonSpec } from "@zoonk/ai/tasks/lesson-spec";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { readsNoviceRules } from "@zoonk/ai/tasks/novice-rules";
import { type VisualFloor, getVisualFloor } from "@zoonk/ai/tasks/visual-floor";
import {
  type CourseContentWrite,
  collectCourseContentTags,
} from "@zoonk/core/cache/course-content";
import { claimLibraryGeneration } from "@zoonk/core/library/claims/generation";
import {
  type JudgedPicture,
  type PlannedPicture,
  dropDecorativePictures,
  judgePlannedPicture,
  listPlannedPictures,
} from "@zoonk/core/library/curriculum/lesson-pictures";
import {
  type LessonSpecInputs,
  loadLessonSpecInputs,
} from "@zoonk/core/library/curriculum/lesson-spec-inputs";
import { saveLessonSpecs } from "@zoonk/core/library/curriculum/save-lesson-specs";
import { getLessonSpecModel } from "@zoonk/core/library/curriculum/scope";
import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";
import { prisma } from "@zoonk/db";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { isRunActive } from "../../_shared/run-activity";
import { type LessonStreamStep } from "./lesson-progress-step";

export type LessonSpecOutcome = "missing" | "ready" | "waiting";

type SpecInput = {
  analytics?: ContentAnalytics;
  lessonId: string;
  wait?: CallWait;
  workflowRunId: string;
};

type SpecAnalytics = ReturnType<typeof toContentAnalytics>;

type PlannedLessonSpecs = {
  analytics: SpecAnalytics;
  homeChapterId: LessonSpecInputs["homeChapterId"];
  lessonId: string;
  novice: boolean;
  pictures: PlannedPicture[];
  provenance: Parameters<typeof saveLessonSpecs>[0]["provenance"];
  scope: LessonSpecInputs["scope"];
  specs: LessonSpec[];
  visualFloor: VisualFloor;
  workflowRunId: string;
};

type PlanResult = { status: LessonSpecOutcome } | ({ status: "planned" } & PlannedLessonSpecs);

async function claimSpec({ lessonId, workflowRunId }: SpecInput) {
  const claim = await claimLibraryGeneration({ id: lessonId, target: "lessonSpec", workflowRunId });

  if (claim !== "running") {
    return claim;
  }

  const lesson = await prisma.lesson.findUnique({
    select: { specRunId: true },
    where: { id: lessonId },
  });

  const ownerId = lesson?.specRunId;

  if (!ownerId || (await isRunActive(ownerId))) {
    return claim;
  }

  await releaseStaleLessonClaims({ lessonId, staleRunId: ownerId });

  return claimLibraryGeneration({ id: lessonId, target: "lessonSpec", workflowRunId });
}

async function planLesson({
  analytics,
  lessonId,
  wait = "soon",
  workflowRunId,
}: SpecInput): Promise<PlanResult> {
  const inputs = await loadLessonSpecInputs(lessonId);

  if (!inputs) {
    return { status: "missing" };
  }

  const context = toContentAnalytics({ analytics, scope: inputs.scope, workflowRunId });

  const { data, provenance } = await generateLessonSpec({
    ...inputs.prompt,
    analytics: context,
    model: getLessonSpecModel(inputs.scope),
    serviceTier: chooseServiceTier({ wait }),
  });

  const novice = readsNoviceRules(inputs.prompt);
  const visualFloor = getVisualFloor(inputs.prompt);

  return {
    analytics: context,
    homeChapterId: inputs.homeChapterId,
    lessonId,
    novice,
    pictures: listPlannedPictures({ specs: data.lessons, visualFloor }),
    provenance,
    scope: inputs.scope,
    specs: data.lessons,
    status: "planned",
    visualFloor,
    workflowRunId,
  };
}

async function writeLessonPlan(input: SpecInput): Promise<PlanResult> {
  const claim = await claimSpec(input);

  if (claim === "completed") {
    return { status: "ready" };
  }

  if (claim === "running") {
    return { status: "waiting" };
  }

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: input.lessonId, status: "started", step: "planLesson" });

  const planned = await planLesson(input);

  if (planned.status !== "planned") {
    await stream.status({ entityId: input.lessonId, status: "completed", step: "planLesson" });
  }

  return planned;
}

/** Plans the lesson without saving it, so each planned picture can be judged in its own step. */
export async function planLessonSpecStep(
  input: SpecInput,
): Promise<CourseContentWrite<PlanResult>> {
  "use step";

  return collectCourseContentTags(() => writeLessonPlan(input));
}

export async function judgeLessonPictureStep({
  analytics,
  novice,
  picture,
}: {
  analytics: SpecAnalytics;
  novice: boolean;
  picture: PlannedPicture;
}): Promise<JudgedPicture> {
  "use step";

  return judgePlannedPicture({ analytics, novice, picture });
}

async function saveLessonPlan({
  judged,
  planned,
}: {
  judged: readonly JudgedPicture[];
  planned: PlannedLessonSpecs;
}): Promise<LessonSpecOutcome> {
  const lesson = await prisma.lesson.findUnique({
    select: { specRunId: true, specStatus: true },
    where: { id: planned.lessonId },
  });

  // The runtime runs a step's body again when its result was lost after the body ended.
  if (lesson?.specStatus === "completed" && lesson.specRunId === planned.workflowRunId) {
    return "ready";
  }

  const saved = await saveLessonSpecs({
    analytics: planned.analytics,
    homeChapterId: planned.homeChapterId,
    lessonId: planned.lessonId,
    provenance: planned.provenance,
    scope: planned.scope,
    specs: dropDecorativePictures({
      judged,
      specs: planned.specs,
      visualFloor: planned.visualFloor,
    }),
    workflowRunId: planned.workflowRunId,
  });

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: planned.lessonId, status: "completed", step: "planLesson" });

  return saved.status === "saved" ? "ready" : "missing";
}

export async function saveLessonSpecStep(input: {
  judged: readonly JudgedPicture[];
  planned: PlannedLessonSpecs;
}): Promise<CourseContentWrite<LessonSpecOutcome>> {
  "use step";

  return collectCourseContentTags(() => saveLessonPlan(input));
}
