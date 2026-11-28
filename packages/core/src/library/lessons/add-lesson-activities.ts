import "server-only";
import {
  type PlannedActivityChange,
  type PublishedLessonScreen,
  planLessonActivities,
} from "@zoonk/ai/tasks/lesson-spec/activity-plan";
import {
  type LessonScreen,
  type LessonSpec,
  estimateLessonMinutes,
} from "@zoonk/ai/tasks/lesson-spec/rules";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { describeActivityTemplates, listPlannerTemplates } from "../activities/writer-templates";
import { readSavedStepMarks } from "../marks/step-marks";
import { toReviewProblems } from "../quality/lesson-review-problems";
import { loadPublishedLessonInputs, toWritingContext } from "./_utils/lesson-writing-inputs";
import { ACTIVITY_SERVICE_TIER, writeCheckedActivities } from "./_utils/written-activities";
import { readLessonMap } from "./lesson-map";
import { CURRENT_STEPS, readStagedLessonVersion } from "./lesson-versions";

type Analytics = Parameters<typeof planLessonActivities>[0]["analytics"];

/** `stepId` is the published screen a problem names, or null for the whole lesson. */
type Finding = { problem: string; stepId: string | null };

type ScreenEntry =
  | { id: string }
  | { content: object; idea: number | null; kind: "activity"; skillId?: string };

export type LessonActivitiesDraft =
  | { lessonId: string; status: "skipped"; reason: string }
  | {
      lessonId: string;
      status: "drafted";
      /** Each added activity: its screen number, from 1, and template. */
      added: { screen: number; template: string }[];
      dropped: string[];
      /** What the check found on the lesson's other screens, which this fix leaves as they are. */
      findings: Finding[];
      setPlan: LessonSpec;
      setScreens: { screens: ScreenEntry[]; version: number };
      reason: string;
    };

async function findLesson(lessonId: string) {
  return prisma.lesson.findUnique({
    select: {
      contentStatus: true,
      ownerId: true,
      steps: {
        orderBy: { position: "asc" },
        select: { content: true, id: true, kind: true, marks: true, skillId: true, version: true },
        where: CURRENT_STEPS,
      },
      summary: true,
      targetLanguage: true,
      visibility: true,
    },
    where: { id: lessonId },
  });
}

type StoredLesson = NonNullable<Awaited<ReturnType<typeof findLesson>>>;
type StoredStep = StoredLesson["steps"][number];

async function findSkipReason(lessonId: string, lesson: StoredLesson | null) {
  if (!lesson || lesson.ownerId || lesson.visibility === "private") {
    return "Not a Library lesson.";
  }

  if (lesson.targetLanguage) {
    return "A language lesson: its dialogue and pattern table are added separately.";
  }

  if (lesson.contentStatus !== "completed" || lesson.steps.length === 0) {
    return "Not written yet.";
  }

  return (await readStagedLessonVersion(lessonId))
    ? "A new version is waiting to replace it."
    : null;
}

function toReviewScreens({
  activities,
  steps,
}: {
  activities: ReadonlyMap<number, object>;
  steps: readonly StoredStep[];
}): PublishedLessonScreen[] {
  return steps.map((step, index) => {
    const content = activities.get(index);
    return content ? { content, kind: "activity" } : { content: step.content, kind: step.kind };
  });
}

function readReviewSummary(summary: unknown) {
  const map = readLessonMap(summary);

  return map
    ? { ideas: map.ideas.map(({ label, text }) => ({ label, text })), shape: map.shape }
    : null;
}

function keepChanges({
  original,
  revised,
  kept,
}: {
  original: LessonSpec;
  revised: LessonSpec;
  kept: ReadonlySet<number>;
}): LessonSpec {
  const screens = revised.screens.map((screen, index): LessonScreen =>
    kept.has(index) ? screen : (original.screens[index] ?? screen),
  );

  return {
    ...revised,
    estimatedMinutes: estimateLessonMinutes(screens.map((screen) => screen.kind)),
    screens,
  };
}

/**
 * The lesson check reads the lesson with its new activities. An activity it flags is left out; what
 * it finds on other screens is reported, since this fix keeps those as they are.
 */
async function reviewActivities({
  analytics,
  context,
  steps,
  summary,
  valid,
  writerModel,
}: {
  analytics?: Analytics;
  context: ReturnType<typeof toWritingContext>;
  steps: readonly StoredStep[];
  summary: unknown;
  valid: ReadonlyMap<number, object>;
  writerModel: string;
}) {
  const { data } = await checkLessonQuality({
    ...context,
    analytics,
    lesson: {
      screens: toReviewScreens({ activities: valid, steps }),
      summary: readReviewSummary(summary),
    },
    serviceTier: ACTIVITY_SERVICE_TIER,
    writerModel,
  });

  const problems = toReviewProblems(data.issues);
  const onActivity = (screen: number | null) => screen !== null && valid.has(screen);
  const flagged = new Set(problems.flatMap(({ screen }) => (onActivity(screen) ? [screen] : [])));

  return {
    dropped: problems.flatMap(({ problem, screen }) =>
      onActivity(screen) && screen !== null
        ? [`The check flagged screen ${screen + 1}: ${problem}`]
        : [],
    ),
    findings: problems.flatMap(({ problem, screen }): Finding[] =>
      onActivity(screen)
        ? []
        : [{ problem, stepId: screen === null ? null : (steps[screen]?.id ?? null) }],
    ),
    kept: new Map([...valid].filter(([index]) => !flagged.has(index))),
  };
}

function toFixScreens({
  kept,
  steps,
}: {
  kept: ReadonlyMap<number, object>;
  steps: readonly StoredStep[];
}): ScreenEntry[] {
  return steps.map((step, index) => {
    const content = kept.get(index);

    return content
      ? {
          content,
          idea: readSavedStepMarks(step.marks)?.ideaIndex ?? null,
          kind: "activity",
          ...(step.skillId ? { skillId: step.skillId } : {}),
        }
      : { id: step.id };
  });
}

function describeReason(added: readonly { template: string }[]): string {
  const templates = [...new Set(added.map(({ template }) => template))].join(" and ");

  return `Lets the learner do the lesson's skill in ${templates}, as lessons written since activities became common do, keeping every other screen.`;
}

function skipped(lessonId: string, reason: string): LessonActivitiesDraft {
  return { lessonId, reason, status: "skipped" };
}

/**
 * For a Library lesson written before lessons practised a skill by doing it: the planner picks which
 * of its practice screens become the activity built for the skill, the writer writes only those,
 * core validates them and runs their programs, and the lesson check reviews the result. Returns the
 * `setPlan` and `setScreens` fix that adds them, keeping every other screen. Nothing is saved: a
 * staff person proposes the fix and another approves it.
 */
export async function draftLessonActivities({
  analytics,
  lessonId,
}: {
  analytics?: Analytics;
  lessonId: string;
}): Promise<LessonActivitiesDraft> {
  const lesson = await findLesson(lessonId);
  const skip = await findSkipReason(lessonId, lesson);

  if (!lesson || skip) {
    return skipped(lessonId, skip ?? "Not a Library lesson.");
  }

  const inputs = await loadPublishedLessonInputs(lessonId);

  if (!inputs) {
    return skipped(lessonId, "Has no lesson plan, as a challenge lesson.");
  }

  if (inputs.spec.screens.length !== lesson.steps.length) {
    return skipped(lessonId, "Its screens no longer follow its plan one to one.");
  }

  const { steps } = lesson;
  const screens = steps.map((step) => ({ content: step.content, kind: step.kind }));

  const plan = await planLessonActivities({
    activityTemplates: listPlannerTemplates(),
    analytics,
    chapterTitle: inputs.chapterTitle,
    courseTitle: inputs.courseTitle,
    exams: inputs.exams,
    language: inputs.language,
    level: inputs.level,
    screens,
    serviceTier: ACTIVITY_SERVICE_TIER,
    spec: inputs.spec,
  });

  const { changes } = plan.data;

  if (changes.length === 0) {
    return skipped(lessonId, "No practice screen fits an activity: its skills aren't done in one.");
  }

  const context = toWritingContext({
    ...inputs,
    activityTemplates: describeActivityTemplates(
      plan.data.spec.screens.flatMap((screen) => screen.activityTemplate ?? []),
    ),
    spec: plan.data.spec,
  });

  const { activities, writerModel } = await writeCheckedActivities({
    analytics,
    context,
    indexes: changes.map(({ index }) => index),
    screens,
  });

  const valid = new Map(
    activities.flatMap(({ converted, index, problems }) =>
      problems.length === 0 && converted.ok ? [[index, converted.content] as const] : [],
    ),
  );

  const codeDropped = activities.flatMap(({ index, problems }) =>
    problems.length > 0 ? [`Screen ${index + 1} was left out: ${problems.join("; ")}`] : [],
  );

  if (valid.size === 0) {
    return skipped(lessonId, codeDropped.join(" "));
  }

  const review = await reviewActivities({
    analytics,
    context: {
      ...context,
      spec: keepChanges({
        kept: new Set(valid.keys()),
        original: inputs.spec,
        revised: plan.data.spec,
      }),
    },
    steps,
    summary: lesson.summary,
    valid,
    writerModel,
  });

  const { findings, kept } = review;
  const dropped = [...codeDropped, ...review.dropped];

  if (kept.size === 0) {
    return skipped(lessonId, dropped.join(" "));
  }

  const added = changes
    .filter(({ index }) => kept.has(index))
    .map(({ activityTemplate, index }: PlannedActivityChange) => ({
      screen: index + 1,
      template: activityTemplate,
    }));

  return {
    added,
    dropped,
    findings,
    lessonId,
    reason: describeReason(added),
    setPlan: keepChanges({
      kept: new Set(kept.keys()),
      original: inputs.spec,
      revised: plan.data.spec,
    }),
    setScreens: { screens: toFixScreens({ kept, steps }), version: steps[0]?.version ?? 1 },
    status: "drafted",
  };
}
