import {
  generateCourseOutline,
  streamCourseOutline,
} from "@zoonk/ai/tasks/curriculum/course-outline";
import { type generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { createGoalPlan } from "@zoonk/core/plans/create";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { recordedOutput, replayStreamedOutline, taskResult } from "../_test-utils/recorded-outputs";
import { writeOutlineBandStep } from "./steps/course-outline-steps";
import type * as LessonsAsk from "@zoonk/core/lookahead/lessons-ask";

type SkillGraph = Awaited<ReturnType<typeof generateSkillGraph>>["data"];
type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];

// A plan write that lands while the early chapter's day follow runs (the same busy plan
// "keeps a band written when a waiting goal can't take its lessons" simulates for the re-plan).
const busy = vi.hoisted(() => ({ planId: null as string | null }));

vi.mock("@zoonk/core/lookahead/lessons-ask", async (importOriginal) => {
  const actual = await importOriginal<typeof LessonsAsk>();

  return {
    ...actual,
    followWrittenLessons: async (input: Parameters<typeof actual.followWrittenLessons>[0]) => {
      const { planId } = busy;

      if (!planId) {
        await actual.followWrittenLessons(input);
        return;
      }

      const stop = new AbortController();

      const mark = async (): Promise<void> => {
        if (stop.signal.aborted) {
          return;
        }

        await prisma.$executeRaw`UPDATE plans SET input_version = input_version + 1 WHERE id = ${planId}::uuid`;
        return mark();
      };

      const marking = mark();

      try {
        await actual.followWrittenLessons(input);
      } finally {
        stop.abort();
        await marking;
      }
    },
  };
});

describe(writeOutlineBandStep, () => {
  it("keeps a band streaming when a plan write lands during its early chapter's day follow", async () => {
    const graph = recordedOutput<SkillGraph>("skill-graph");
    const testId = crypto.randomUUID();
    const recorded = recordedOutput<CourseOutline>("course-outline");

    const outline = {
      ...recorded,
      chapters: recorded.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((lesson) => ({
          ...lesson,
          skills: lesson.skills.map((name) => `${name} ${testId}`),
        })),
      })),
    };

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
    vi.mocked(generateCourseOutline).mockResolvedValue(taskResult(outline));
    vi.mocked(streamCourseOutline).mockImplementation(replayStreamedOutline(outline) as never);

    const [skills, user, course] = await Promise.all([
      Promise.all(
        graph.skills.map((skill) =>
          skillFixture({ description: skill.description, name: skill.name }),
        ),
      ),
      userFixture(),
      courseFixture({ outlineStatus: "running", title: "Immunology" }),
    ]);

    const idsByKey = Object.fromEntries(
      graph.skills.map((skill, index) => [skill.key, skills[index]?.id ?? ""]),
    );

    const goal = await goalFixture({
      details: { answered: ["purpose", "level", "targetDate", "buddy", "placement", "schedule"] },
      primaryCourseId: course.id,
      timezone: "UTC",
      userId: user.id,
    });

    const plan = await prisma.plan.create({
      data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
    });

    await createGoalPlan({
      goalId: goal.id,
      graph: toGoalPlanGraph({ courseIdsByKey: {}, graph, idsByKey }),
    });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await studySessionFixture({
      goalId: goal.id,
      planVersion: saved.version,
      plannedMinutes: 0,
      userId: goal.userId,
    });

    const bandSkills = graph.skills.map((skill) => ({
      description: skill.description,
      id: idsByKey[skill.key] ?? "",
      key: skill.key,
      name: skill.name,
    }));

    const input = {
      analytics: { distinctId: user.id, goalId: goal.id, platform: "web" as const },
      courseId: course.id,
      plan: {
        courseTitle: course.title,
        extensions: [],
        isNewBand: true,
        level: "overview" as const,
        material: null,
        nextPosition: 0,
        otherChapterTitles: [],
        product: null,
        skills: bandSkills,
        taughtElsewhere: [],
        withoutTools: false,
      },
      scope: {
        generalGoal: "Understand how vaccines work",
        language: "en",
        ownerId: null,
        targetLanguage: null,
      },
      waitedSkillId: bandSkills[0]?.id,
      workflowRunId: "outline-run",
    };

    busy.planId = plan.id;

    // Like the re-plan beside it, a goal that can't take its lessons leaves the band written: a
    // failed step would retry the band with a second outline call.
    await expect(writeOutlineBandStep(input)).resolves.toMatchObject({ early: expect.anything() });
    expect(generateCourseOutline).not.toHaveBeenCalled();
  });
});
