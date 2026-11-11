import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  holdPlanLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { toTextSearch } from "../library/identity/_utils/text-search-sql";
import { getChapterIdentitySearch } from "../library/identity/kinds/chapter-identity";
import { planLibraryFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import { saveAnswerInputs } from "../view-models/onboarding/_utils/save-onboarding-answer";
import { getMissingQuestions } from "../view-models/onboarding/onboarding-steps";
import { createGoals } from "./create-goals";
import { readSavedGoalOpening } from "./goal-opening";
import { finishGoalRebuild } from "./goal-rebuild-follow-up";
import { updateGoal } from "./update-goal";

describe("country boundaries for reused chapters", () => {
  it("excludes a Brazilian home chapter from a Portugal course's ranked candidates", async () => {
    const organization = await aiOrganizationFixture();
    const title = `Orcamento pessoal ${crypto.randomUUID().replaceAll("-", "")}`;

    const [br, pt] = await Promise.all([
      courseFixture({ language: "pt", organizationId: organization.id }),
      courseFixture({ country: "PT", language: "pt", organizationId: organization.id }),
    ]);

    const brChapter = await libraryChapterFixture({ homeCourseId: br.id, language: "pt", title });
    await courseChapterFixture({ chapterId: brChapter.id, courseId: br.id });

    const search = toTextSearch({ language: "pt", terms: [title] });

    if (!search) {
      throw new Error("no search");
    }

    const offered = await getChapterIdentitySearch({
      country: "PT",
      course: { id: pt.id, title: pt.title },
      description: "Budget",
      kind: "chapter",
      language: "pt",
      level: "beginner",
      objectives: [],
      ownerId: null,
      targetLanguage: null,
      title,
    }).findCandidateIds(search);

    expect(offered).not.toContain(brChapter.id);
  });

  it("excludes a Portugal home chapter from a Brazilian course's ranked candidates", async () => {
    const organization = await aiOrganizationFixture();
    const title = `IRS e escaloes ${crypto.randomUUID().replaceAll("-", "")}`;

    const [br, pt] = await Promise.all([
      courseFixture({ language: "pt", organizationId: organization.id }),
      courseFixture({ country: "PT", language: "pt", organizationId: organization.id }),
    ]);

    const ptChapter = await libraryChapterFixture({ homeCourseId: pt.id, language: "pt", title });
    await courseChapterFixture({ chapterId: ptChapter.id, courseId: pt.id });

    const search = toTextSearch({ language: "pt", terms: [title] });

    if (!search) {
      throw new Error("no search");
    }

    const offered = await getChapterIdentitySearch({
      course: { id: br.id, title: br.title },
      description: "Tax",
      kind: "chapter",
      language: "pt",
      level: "beginner",
      objectives: [],
      ownerId: null,
      targetLanguage: null,
      title,
    }).findCandidateIds(search);

    expect(offered).not.toContain(ptChapter.id);
  });
});

describe("country onboarding lifecycle", () => {
  it("Skip after the run stopped waiting owes the initial build", async () => {
    const user = await userFixture();

    const current = await goalFixture({
      curriculumQuestions: ["contentCountry"],
      details: { answered: [], contentCountrySource: "default", countryDependent: true },
      language: "pt",
      planRevealedAt: null,
      userId: user.id,
    });

    const plan = await planFixture({ buildFailedAt: new Date(), goalId: current.id });

    const holder = holdPlanLock({ planId: plan.id });
    const pid = await holder.pid;

    const answers = Array.from({ length: 2 }, () =>
      saveAnswerInputs({ goal: current, input: { country: null, question: "contentCountry" } }),
    );

    try {
      await waitForBlockedStatement(pid, /FOR UPDATE OF plan/u, 2);
    } finally {
      holder.release();
      await holder.done;
    }

    await expect(Promise.all(answers)).resolves.toMatchObject([
      { status: "saved" },
      { status: "saved" },
    ]);

    await saveAnswerInputs({ goal: current, input: { country: null, question: "contentCountry" } });

    await expect(
      prisma.followUp.count({ where: { key: current.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toBe(1);

    await expect(
      prisma.followUp.findFirstOrThrow({
        where: { key: current.id, kind: "rebuildGoalCurriculum" },
      }),
    ).resolves.toMatchObject({ revision: 0 });
  });

  it("a general goal refuses a forged country answer after reveal without writing", async () => {
    const user = await userFixture();

    const general = await goalFixture({
      details: { countryDependent: false },
      language: "pt",
      userId: user.id,
    });

    await planFixture({ goalId: general.id });
    const library = await planLibraryFixture({ skills: [{ lessons: 1 }] });
    await createGoalPlan({ goalId: general.id, graph: library.graph });
    const current = await prisma.goal.findUniqueOrThrow({ where: { id: general.id } });

    await expect(
      saveAnswerInputs({ goal: current, input: { country: "PT", question: "contentCountry" } }),
    ).resolves.toMatchObject({ status: "invalid" });

    await expect(
      prisma.followUp.count({ where: { key: general.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toBe(0);

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: general.id } }),
    ).resolves.toMatchObject({ contentCountry: null, details: { countryDependent: false } });
  });

  it.each([true, undefined])(
    "routes parallel revealed country answers through metadata with reading %s",
    async (countryDependent) => {
      const user = await userFixture();
      mockSession(user.id);

      const goal = await goalFixture({
        details: countryDependent === undefined ? {} : { countryDependent },
        language: "pt",
        planRevealedAt: new Date(),
        userId: user.id,
      });

      const holder = holdLearnerLock({ userId: user.id });
      const pid = await holder.pid;

      const answers = [
        saveAnswerInputs({ goal, input: { country: "PT", question: "contentCountry" } }),
        updateGoal({ goalId: goal.id, input: { contentCountry: "PT" } }),
      ];

      try {
        await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
      } finally {
        holder.release();
        await holder.done;
      }

      await Promise.all(answers);
      await saveAnswerInputs({ goal, input: { country: "PT", question: "contentCountry" } });

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toMatchObject({
        contentCountry: "PT",
        details: {
          answered: expect.arrayContaining(["contentCountry"]),
          contentCountrySource: "picked",
          countryDependent: true,
        },
      });

      await expect(
        prisma.followUp.findMany({ where: { key: goal.id, kind: "rebuildGoalCurriculum" } }),
      ).resolves.toMatchObject([{ revision: 0 }]);
    },
  );

  it.each([false, true])(
    "keeps the reviewed own country when the request omits it: %s",
    async (omitted) => {
      const user = await userFixture();
      await learningProfileFixture({ homeCountry: "PT", userId: user.id });
      const title = "Financas pessoais";

      const card = await onboardingDraftFixture({
        understanding: {
          goals: [
            {
              contentCountry: { code: "BR", source: "picked" },
              countryDependent: true,
              draft: { contentCountry: null, kind: "learn", title },
            },
          ],
          status: "goals",
        },
        userId: user.id,
      });

      const draft = {
        ...(!omitted && { contentCountry: null }),
        details: { onboardingId: card.id },
        kind: "learn" as const,
        language: "pt",
        prompt: title,
        title,
      };

      mockSession(user.id);

      const created = await createGoals({ dailyMinutes: 15, goals: [draft] });

      if (created.status !== "created" || !created.goals[0]) {
        throw new Error("Expected the reviewed goal to start");
      }

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: created.goals[0].id } }),
      ).resolves.toMatchObject({
        contentCountry: null,
        details: { contentCountrySource: "picked" },
      });

      expect(
        getMissingQuestions({ details: created.goals[0].details, kind: "learn", targetDate: null }),
      ).not.toContain("contentCountry");
    },
  );
});

describe("country rebuild continuity", () => {
  it("a Portugal goal keeps its saved opening when the opening course is general", async () => {
    const user = await userFixture();

    const [course, lesson] = await Promise.all([
      courseFixture({ language: "pt" }),
      libraryLessonFixture({ language: "pt" }),
    ]);

    const goal = await goalFixture({
      contentCountry: "PT",
      details: { countryDependent: true },
      language: "pt",
      openingLessonId: lesson.id,
      openingSkill: {
        course: { countrySpecific: false, id: course.id, key: "math", title: course.title },
        skill: {
          area: "a",
          description: "d",
          estimatedLessons: 1,
          id: crypto.randomUUID(),
          key: "k",
          level: "beginner",
          name: "n",
        },
      },
      userId: user.id,
    });

    await expect(readSavedGoalOpening(goal.id)).resolves.not.toBeNull();

    await expect(readSavedGoalOpening(goal.id, "PT")).resolves.not.toBeNull();
  });

  it("a failed rebuild after reveal leaves the old plan ready", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: { countryDependent: true },
      generationRunId: "run-1",
      language: "pt",
      planRevealedAt: new Date(),
      userId: user.id,
    });

    await planFixture({ goalId: goal.id });
    const library = await planLibraryFixture({ skills: [{ lessons: 2 }] });
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const ready = await getGoalPlan(goal.id);
    expect(ready).toMatchObject({ plan: { ready: true }, status: "ready" });

    await updateGoal({ goalId: goal.id, input: { contentCountry: "PT" } });

    const during = await getGoalPlan(goal.id);
    expect(during).toMatchObject({ plan: { ready: true }, status: "ready" });

    const owed = await prisma.followUp.findFirstOrThrow({
      where: { key: goal.id, kind: "rebuildGoalCurriculum" },
    });

    await prisma.goal.update({ data: { generationRunId: "run-2" }, where: { id: goal.id } });

    await finishGoalRebuild({
      failed: true,
      followUp: { id: owed.id, revision: owed.revision },
      generationId: "run-2",
      goalId: goal.id,
    });

    const after = await getGoalPlan(goal.id);

    expect(after).toMatchObject({ plan: { ready: true }, status: "ready" });
  });
});
