import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { addDays } from "../plans/planner/plan-calendar";
import { listPlanOutlineNeeds, listPlanSkillIdsWithin } from "./plan-outline-needs";

describe(listPlanOutlineNeeds, () => {
  it("lists the bands a copied plan's courses still need, the course reached first first", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ title: "Learn statistics", userId: user.id });

    const [shared, own] = await Promise.all([
      courseFixture({ language: "pt" }),
      courseFixture({ userId: user.id, visibility: "private" }),
    ]);

    const [written, basics, advanced, notes] = await Promise.all([
      skillFixture({ level: "beginner" }),
      skillFixture({ level: "beginner" }),
      skillFixture({ level: "advanced" }),
      skillFixture({ level: null }),
    ]);

    const courseOf = new Map([
      [written.id, shared.id],
      [basics.id, shared.id],
      [advanced.id, shared.id],
      [notes.id, own.id],
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "One" }],
        skills: [notes, written, basics, advanced].map((skill) => ({
          area: null,
          courseIds: [courseOf.get(skill.id) ?? ""],
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    const lesson = await libraryLessonFixture();

    await Promise.all([
      planItemFixture({ planId: plan.id, position: 0, skillId: notes.id }),
      planItemFixture({ lessonId: lesson.id, planId: plan.id, position: 1, skillId: written.id }),
      planItemFixture({ planId: plan.id, position: 2, skillId: basics.id }),
      planItemFixture({ planId: plan.id, position: 3, skillId: advanced.id }),
      planItemFixture({ planId: plan.id, position: 4, skillId: basics.id, status: "done" }),
    ]);

    const toRef = (skill: typeof basics) => ({
      description: skill.description,
      id: skill.id,
      key: skill.id,
      name: skill.name,
    });

    await expect(listPlanOutlineNeeds({ days: null, goalId: goal.id })).resolves.toStrictEqual([
      {
        bands: [{ level: "beginner", skills: [toRef(notes)], withToolChapters: true }],
        courseId: own.id,
        scope: {
          exams: [],
          generalGoal: null,
          language: "en",
          ownerId: user.id,
          targetLanguage: null,
        },
      },
      {
        bands: [
          { level: "beginner", skills: [toRef(basics)], withToolChapters: true },
          { level: "advanced", skills: [toRef(advanced)], withToolChapters: true },
        ],
        courseId: shared.id,
        scope: {
          exams: [],
          generalGoal: "Learn statistics",
          language: "pt",
          ownerId: null,
          targetLanguage: null,
        },
      },
    ]);
  });

  it("outlines a skill a change added without a course in the goal's own course", async () => {
    const user = await userFixture();
    const course = await courseFixture({ language: "pt", targetLanguage: "en" });

    const [goal, topic] = await Promise.all([
      goalFixture({
        kind: "language",
        primaryCourseId: course.id,
        title: "Inglês para entrevista",
        userId: user.id,
      }),
      skillFixture({ level: "intermediate" }),
    ]);

    // A topic the learner asked their buddy to add: the planner learns it from the goal's course.
    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "One" }],
        skills: [
          {
            area: "Inglês",
            lessons: 8,
            name: topic.name,
            phase: 0,
            skillId: topic.id,
            weight: null,
          },
        ],
      },
    });

    await planItemFixture({ planId: plan.id, position: 0, skillId: topic.id });

    await expect(listPlanOutlineNeeds({ days: null, goalId: goal.id })).resolves.toMatchObject([
      { bands: [{ level: "intermediate", skills: [{ id: topic.id }] }], courseId: course.id },
    ]);
  });

  it("asks an exam answered without tools for chapters without tools, written for its candidates", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ name: "OAB Exame de Ordem", role: "1ª fase" }),
    ]);

    const [goal, course, skill] = await Promise.all([
      goalFixture({
        examBlueprintId: blueprint.id,
        kind: "exam",
        title: "Pass the exam",
        userId: user.id,
      }),
      courseFixture({ language: "pt" }),
      skillFixture({ level: "intermediate" }),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "One" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 4,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: 3,
          },
        ],
      },
    });

    await planItemFixture({ planId: plan.id, position: 0, skillId: skill.id });

    const [need] = await listPlanOutlineNeeds({ days: null, goalId: goal.id });

    expect(need?.bands.map((band) => [band.level, band.withToolChapters])).toStrictEqual([
      ["intermediate", false],
    ]);

    // Its outlines are written for that exam's candidates, without naming it.
    expect(need?.scope.exams?.map((exam) => exam.name)).toStrictEqual([
      "OAB Exame de Ordem, 1ª fase",
    ]);
  });

  it("lists only the stand-ins due within the window when one is given", async () => {
    const user = await userFixture();

    const [goal, course, soon, later] = await Promise.all([
      goalFixture({ timezone: "UTC", userId: user.id }),
      courseFixture({ language: "pt" }),
      skillFixture(),
      skillFixture(),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "One" }],
        skills: [soon, later].map((skill) => ({
          area: null,
          courseIds: [course.id],
          lessons: 4,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    const today = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });

    await Promise.all([
      planItemFixture({
        planId: plan.id,
        position: 0,
        scheduledFor: addDays(today, 3),
        skillId: soon.id,
      }),
      planItemFixture({
        planId: plan.id,
        position: 1,
        scheduledFor: addDays(today, 30),
        skillId: later.id,
      }),
    ]);

    const [need] = await listPlanOutlineNeeds({ days: 14, goalId: goal.id });

    expect(need?.bands.flatMap((band) => band.skills.map((skill) => skill.id))).toStrictEqual([
      soon.id,
    ]);

    const [all] = await listPlanOutlineNeeds({ days: null, goalId: goal.id });

    expect(all?.bands.flatMap((band) => band.skills.map((skill) => skill.id))).toStrictEqual([
      soon.id,
      later.id,
    ]);
  });

  it("needs nothing when every lesson of the plan is in its courses already", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    const lesson = await libraryLessonFixture();

    await planItemFixture({ lessonId: lesson.id, planId: plan.id, position: 0 });

    await expect(listPlanOutlineNeeds({ days: null, goalId: goal.id })).resolves.toStrictEqual([]);
  });
});

describe(listPlanSkillIdsWithin, () => {
  it("lists the skills the plan reaches within the window, written or not", async () => {
    const user = await userFixture();

    const [goal, written, standIn, later] = await Promise.all([
      goalFixture({ timezone: "UTC", userId: user.id }),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const [plan, lesson] = await Promise.all([
      planFixture({ goalId: goal.id }),
      libraryLessonFixture(),
    ]);

    const today = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });

    await Promise.all([
      planItemFixture({
        lessonId: lesson.id,
        planId: plan.id,
        position: 0,
        scheduledFor: today,
        skillId: written.id,
      }),
      planItemFixture({
        planId: plan.id,
        position: 1,
        scheduledFor: addDays(today, 7),
        skillId: standIn.id,
      }),
      planItemFixture({
        planId: plan.id,
        position: 2,
        scheduledFor: addDays(today, 20),
        skillId: later.id,
      }),
    ]);

    const within = await listPlanSkillIdsWithin({ days: 14, goalId: goal.id });

    expect(within.toSorted()).toStrictEqual([written.id, standIn.id].toSorted());
  });
});
