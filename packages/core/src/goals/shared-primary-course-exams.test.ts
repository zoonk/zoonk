import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getExamBlueprintCacheTag,
} from "../cache/tags";
import { loadCourseEstimateData } from "../catalog/_utils/course-estimate-data";
import { estimateCoursePlan } from "../catalog/course-estimate";
import { getCourseExamDays } from "../catalog/course-exam-days";
import { getCoursePlanExample } from "../catalog/course-plan-example";
import { MASTERY_LEVELS } from "../library/courses/course-levels";
import { getStartedCourseScope } from "../library/curriculum/course-start-graph";
import { loadGoalCurriculumInputs } from "../library/curriculum/goal-curriculum-inputs";
import { toGoalPlanGraph } from "../library/curriculum/goal-plan-graph";
import { findReusableCurriculum } from "../library/curriculum/reusable-curriculum";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { loadCourseExam } from "./_utils/course-exam";
import { getCourseQuickTestMinutes } from "./course-quick-test";
import { prepareCourseGoalPlan } from "./prepare-course-goal-plan";
import { startCourseGoal } from "./start-course-goal";

const NOW = new Date("2020-09-28T12:00:00Z");
const EXAM_DAYS = ["2020-10-11", "2020-10-18"] as const;

async function sharedCourse({
  attrs = {},
  incomplete = false,
  primary = true,
}: { attrs?: Parameters<typeof courseFixture>[0]; incomplete?: boolean; primary?: boolean } = {}) {
  const [course, missing] = await Promise.all([
    courseFixture({ format: "core", isPublished: true, visibility: "public", ...attrs }),
    skillFixture(),
  ]);

  const bands = await courseBandsFixture({ courseId: course.id, levels: MASTERY_LEVELS });

  const exams = await Promise.all(
    EXAM_DAYS.map(async (date, index) => {
      const blueprint = await examBlueprintFixture({
        edition: {
          check: null,
          citations: [],
          dates: [
            {
              citation: { passage: "Exam day", sourceId: "notice" },
              date,
              kind: "exam",
              label: "Exam",
              startTime: null,
            },
          ],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: "UTC",
          year: 2020,
        },
        examDate: new Date(date),
        name: `Public exam ${index}`,
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: [
            {
              citation: { passage: "Exam subjects", sourceId: "notice" },
              name: course.title,
              questions: 30,
              topics: [`Exam ${index} topic`],
              weight: 1,
            },
          ],
        },
      });

      const graph = {
        phases: [{ milestone: null, name: "Exam subjects" }],
        skills: [...bands.map((band) => band.skill), ...(incomplete ? [missing] : [])].map(
          (skill) => ({
            area: course.title,
            courseIds: [course.id],
            lessons: skill.id === missing.id ? 20 * (index + 1) : 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            topics: [`${skill.name} for exam ${index}`],
            weight: skill.id === missing.id ? index + 1 : 1,
          }),
        ),
      };

      const stored = await prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: NOW,
          graph,
          model: "fixture",
          primaryCourseId: primary ? course.id : null,
          promptVersion: "fixture",
          runId: "fixture",
          updatedAt: new Date(NOW.getTime() + index * 60_000),
        },
      });

      return { blueprint, graph, stored };
    }),
  );

  return { bands, course, exams };
}

async function touchFirstGraph(exams: Awaited<ReturnType<typeof sharedCourse>>["exams"]) {
  await prisma.examSkillGraph.update({
    data: { updatedAt: new Date(NOW.getTime() + 120_000) },
    where: { id: exams[0]!.stored.id },
  });
}

describe("exams sharing a primary course", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([true, false])(
    "keeps several public exam links ambiguous regardless of graph write order (primary: %s)",
    async (primary) => {
      const { course, exams } = await sharedCourse({ primary });
      await expect(loadCourseExam(course.id)).resolves.toBeNull();
      await touchFirstGraph(exams);
      await expect(loadCourseExam(course.id)).resolves.toBeNull();
    },
  );

  it.each([false, true])(
    "starts a shared core course as an undated course goal (rewritten: %s)",
    async (rewrite) => {
      const { course, exams } = await sharedCourse();

      if (rewrite) {
        await touchFirstGraph(exams);
      }

      const user = await userFixture();
      mockSession(user.id);

      await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
        goal: { examBlueprintId: null, kind: "learn", targetDate: null },
        status: "created",
      });

      const saved = await prisma.goal.findFirstOrThrow({ where: { userId: user.id } });
      expect(saved).toMatchObject({ examBlueprintId: null, kind: "learn", targetDate: null });
    },
  );

  it.each([true, false])(
    "shows only the goal's own sitting days (has sitting: %s)",
    async (hasSitting) => {
      const [{ course, exams }, user] = await Promise.all([sharedCourse(), userFixture()]);
      const own = exams[0]!.blueprint;

      if (!hasSitting) {
        await prisma.examBlueprint.update({
          data: { edition: {}, examDate: null },
          where: { id: own.id },
        });
      }

      const goal = await goalFixture({
        details: { answered: [] },
        examBlueprintId: own.id,
        kind: "exam",
        primaryCourseId: course.id,
        userId: user.id,
      });

      mockSession(user.id);

      await expect(getOnboarding({ goalId: goal.id })).resolves.toMatchObject({
        onboarding: { examDays: hasSitting ? { days: [EXAM_DAYS[0]], estimated: false } : null },
        status: "ready",
      });
    },
  );

  it("keeps a dated course estimate independent of the shared exams and their cache tags", async () => {
    const { course, exams } = await sharedCourse({ incomplete: true });

    const input = {
      courseId: course.id,
      dailyMinutes: 15,
      studyDays: [1, 2, 3, 4, 5],
      targetDate: "2020-10-09",
    };

    const before = await estimateCoursePlan(input);
    expect(before).not.toBeNull();
    await touchFirstGraph(exams);
    const after = await estimateCoursePlan(input);
    expect(after).toStrictEqual(before);

    vi.mocked(cacheTag).mockClear();

    await expect(loadCourseEstimateData(course.id, "2020-09-28")).resolves.toMatchObject({
      kind: "learn",
    });

    const tags = vi.mocked(cacheTag).mock.calls.flat();

    expect(tags).toStrictEqual(
      expect.arrayContaining([
        getCourseCacheTag(course.id),
        getCourseCurriculumCacheTag(course.id),
      ]),
    );

    for (const exam of exams) {
      expect(tags).not.toContain(getExamBlueprintCacheTag(exam.blueprint.id));
    }

    await prisma.examSkillGraph.deleteMany({ where: { primaryCourseId: course.id } });
    await expect(estimateCoursePlan(input)).resolves.toStrictEqual(before);
  });

  it("does not give a shared exam course a sitting or a dated plan example", async () => {
    const { course } = await sharedCourse({ attrs: { format: "exam" } });
    await expect(getCourseExamDays(course.id)).resolves.toBeNull();
    await expect(getCoursePlanExample(course)).resolves.toMatchObject({ exam: null });
  });

  it("times a shared language course as a language level test", async () => {
    const { course } = await sharedCourse({ attrs: { format: "language", targetLanguage: "es" } });
    await expect(getCourseQuickTestMinutes(course)).resolves.toBe(3);
  });

  it("prepares a course-start plan with the goal's exam graph", async () => {
    const [{ course, exams }, user] = await Promise.all([sharedCourse(), userFixture()]);

    const goal = await goalFixture({
      details: { courseStart: { chapterId: null } },
      examBlueprintId: exams[0]!.blueprint.id,
      kind: "exam",
      primaryCourseId: course.id,
      userId: user.id,
    });

    await planFixture({ goalId: goal.id, graph: {} });

    await prepareCourseGoalPlan({ goalId: goal.id });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanGraph(plan.graph).skills.map((skill) => skill.topics)).toStrictEqual(
      exams[0]!.graph.skills.map((skill) => skill.topics),
    );
  });

  it("reuses the goal's own exam curriculum when its started course is shared", async () => {
    const [{ course, exams }, user] = await Promise.all([sharedCourse(), userFixture()]);

    const goal = await goalFixture({
      details: { courseStart: { chapterId: null } },
      examBlueprintId: exams[0]!.blueprint.id,
      kind: "exam",
      primaryCourseId: course.id,
      userId: user.id,
    });

    const inputs = await loadGoalCurriculumInputs(goal.id);

    if (!inputs?.startedCourse) {
      throw new Error("Expected course-start curriculum inputs");
    }

    const reused = await findReusableCurriculum({
      inputs,
      scope: getStartedCourseScope({ course: inputs.startedCourse, goal: inputs.goal }),
    });

    expect(reused).not.toBeNull();

    expect(reused && toGoalPlanGraph(reused).skills.map((skill) => skill.topics)).toStrictEqual(
      exams[0]!.graph.skills.map((skill) => skill.topics),
    );
  });
});
