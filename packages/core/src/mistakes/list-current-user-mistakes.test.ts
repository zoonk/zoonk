import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { mistakeListInputSchema } from "./contract";
import { countGoalMistakes } from "./count-goal-mistakes";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

const query = (input: object = {}) => mistakeListInputSchema.parse(input);

describe(listCurrentUserMistakes, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(listCurrentUserMistakes(query())).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("lists only the learner's own mistakes, newest first, with their snapshots", async () => {
    const [user, other, skill] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture({ name: "Percentages" }),
    ]);

    mockSession(user.id);

    const [older, newer] = await Promise.all([
      mistakeFixture({
        cause: "trap",
        createdAt: new Date("2026-09-01"),
        skillId: skill.id,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: new Date("2026-09-05"),
        snapshot: { answer: "20", question: "Half of 10?" },
        userId: user.id,
      }),
      mistakeFixture({ userId: other.id }),
    ]);

    const result = await listCurrentUserMistakes(query());

    expect(result.status === "ready" && result.mistakes.map((mistake) => mistake.id)).toStrictEqual(
      [newer.id, older.id],
    );

    expect(result.status === "ready" && result.mistakes[0]?.snapshot).toStrictEqual({
      answer: "20",
      question: "Half of 10?",
    });

    expect(result.status === "ready" && result.mistakes[1]?.skill).toStrictEqual({
      id: skill.id,
      name: "Percentages",
    });
  });

  it("publishes mistakes from mock grading after the sitting finishes", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const [sitting, item] = await Promise.all([
      prisma.mockExam.create({
        data: { conditions: {}, sectionStartedAt: new Date(), userId: user.id },
      }),
      itemFixture({ mockOnly: true, skillId: skill.id }),
    ]);

    const attempt = await attemptFixture({
      itemId: item.id,
      mockExamId: sitting.id,
      userId: user.id,
    });

    const mistake = await mistakeFixture({
      attemptId: attempt.id,
      itemId: item.id,
      userId: user.id,
    });

    mockSession(user.id);

    await expect(listCurrentUserMistakes(query())).resolves.toMatchObject({
      counts: { open: 0 },
      mistakes: [],
    });

    await prisma.mockExam.update({
      data: { finishedAt: new Date(), status: "finished" },
      where: { id: sitting.id },
    });

    await expect(listCurrentUserMistakes(query())).resolves.toMatchObject({
      counts: { open: 1 },
      mistakes: [{ id: mistake.id }],
    });
  });

  it("filters by cause and status and counts every chip", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all([
      mistakeFixture({ cause: "trap", userId: user.id }),
      mistakeFixture({ cause: "trap", status: "fixed", userId: user.id }),
      mistakeFixture({ cause: "gap", userId: user.id }),
      mistakeFixture({ userId: user.id }),
    ]);

    const result = await listCurrentUserMistakes(query({ cause: "trap", status: "open" }));

    expect(result.status === "ready" && result.mistakes).toHaveLength(1);

    expect(result.status === "ready" && result.counts).toStrictEqual({
      byCause: { gap: 1, guess: 0, misread: 0, time: 0, trap: 2, unsorted: 1 },
      fixed: 1,
      open: 3,
    });
  });

  it("scopes the notebook to one goal's skills", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const elsewhere = await skillFixture();
    mockSession(user.id);

    const [inGoal] = await Promise.all([
      mistakeFixture({ skillId: skills[0]?.id, userId: user.id }),
      mistakeFixture({ skillId: elsewhere.id, userId: user.id }),
    ]);

    const result = await listCurrentUserMistakes(query({ goalId: goal.id }));

    expect(result.status === "ready" && result.mistakes.map((mistake) => mistake.id)).toStrictEqual(
      [inGoal.id],
    );
  });

  it("lists and counts a miss on a finer skill that one of the goal's lessons teaches", async () => {
    const user = await userFixture();

    const { goal, planItems } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const [finer, lesson] = await Promise.all([skillFixture(), libraryLessonFixture()]);

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: finer.id }),
      prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: planItems[0]?.id } }),
    ]);

    mockSession(user.id);
    const miss = await mistakeFixture({ skillId: finer.id, userId: user.id });

    const result = await listCurrentUserMistakes(query({ goalId: goal.id }));

    expect(result.status === "ready" && result.mistakes.map((mistake) => mistake.id)).toStrictEqual(
      [miss.id],
    );

    expect(result.status === "ready" && result.counts.open).toBe(1);
  });

  it("leaves out a subject the learner took out of the plan until it's back", async () => {
    const user = await userFixture();

    const { goal, plan, planItems, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1, 1],
      userId: user.id,
    });

    const [removed, kept] = skills;
    const finer = await skillFixture();

    const setRemovedAreas = (skippedAreas: string[]) =>
      prisma.plan.update({ data: { settings: { skippedAreas } }, where: { id: plan.id } });

    await Promise.all([
      lessonSkillFixture({ lessonId: planItems[0]?.lessonId ?? "", skillId: finer.id }),
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ name: "Removed" }, { name: "Kept" }],
            skills: [removed, kept].map((skill, phase) => ({
              lessons: 1,
              name: skill?.name,
              phase,
              skillId: skill?.id,
            })),
          },
        },
        where: { id: plan.id },
      }),
    ]);

    await setRemovedAreas(["Removed"]);
    mockSession(user.id);

    const [inKept, ...inRemoved] = await Promise.all([
      mistakeFixture({ skillId: kept?.id, userId: user.id }),
      mistakeFixture({ skillId: removed?.id, userId: user.id }),
      mistakeFixture({ skillId: finer.id, status: "fixed", userId: user.id }),
    ]);

    const [withoutSubject, countWithout] = await Promise.all([
      listCurrentUserMistakes(query({ goalId: goal.id })),
      countGoalMistakes({ goalId: goal.id }),
    ]);

    expect(withoutSubject).toMatchObject({
      counts: { fixed: 0, open: 1 },
      mistakes: [{ id: inKept?.id }],
    });

    expect(countWithout).toStrictEqual({ fixed: 0, open: 1, status: "ready" });

    await expect(
      listCurrentUserMistakes(query({ goalId: goal.id, skillId: removed?.id })),
    ).resolves.toMatchObject({ counts: { open: 0 }, mistakes: [] });

    await setRemovedAreas([]);

    const withSubject = await listCurrentUserMistakes(query({ goalId: goal.id }));

    expect(
      withSubject.status === "ready" &&
        withSubject.mistakes.map((mistake) => mistake.id).toSorted(),
    ).toStrictEqual([inKept, ...inRemoved].map((mistake) => mistake?.id).toSorted());
  });

  it("keeps a skill a kept subject teaches too, whichever lesson comes first", async () => {
    const user = await userFixture();

    const { goal, plan, planItems, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1, 1],
      userId: user.id,
    });

    const [shared, onlyRemoved] = await Promise.all([skillFixture(), skillFixture()]);

    await Promise.all([
      ...planItems.map((item) =>
        lessonSkillFixture({ lessonId: item.lessonId ?? "", skillId: shared.id }),
      ),
      lessonSkillFixture({ lessonId: planItems[0]?.lessonId ?? "", skillId: onlyRemoved.id }),
      prisma.planItem.updateMany({ data: { skillId: null }, where: { planId: plan.id } }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ name: "Removed" }, { name: "Kept" }],
            skills: skills.map((skill, phase) => ({
              lessons: 1,
              name: skill.name,
              phase,
              skillId: skill.id,
            })),
          },
          settings: { skippedAreas: ["Removed"] },
        },
        where: { id: plan.id },
      }),
    ]);

    mockSession(user.id);

    const [kept] = await Promise.all([
      mistakeFixture({ skillId: shared.id, userId: user.id }),
      mistakeFixture({ skillId: onlyRemoved.id, userId: user.id }),
    ]);

    const result = await listCurrentUserMistakes(query({ goalId: goal.id }));

    expect(result.status === "ready" && result.mistakes.map((mistake) => mistake.id)).toStrictEqual(
      [kept.id],
    );
  });

  it("names the lesson each mistake opens: where it was made, else one teaching its skill", async () => {
    const [user, owner, skill, untaught] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const [madeIn, teaching, hidden] = await Promise.all([
      libraryLessonFixture({ title: "Discounts" }),
      libraryLessonFixture({ title: "Percentages" }),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    const step = await libraryStepFixture({ lessonId: madeIn.id, skillId: skill.id });

    await Promise.all([
      lessonSkillFixture({ lessonId: hidden.id, skillId: skill.id }),
      lessonSkillFixture({ lessonId: teaching.id, skillId: skill.id }),
    ]);

    mockSession(user.id);

    const [onScreen, inPractice, withoutLesson] = await Promise.all([
      mistakeFixture({ skillId: skill.id, stepId: step.id, userId: user.id }),
      mistakeFixture({ skillId: skill.id, userId: user.id }),
      mistakeFixture({ skillId: untaught.id, userId: user.id }),
    ]);

    const result = await listCurrentUserMistakes(query());

    const lessons = new Map(
      result.status === "ready"
        ? result.mistakes.map((mistake) => [mistake.id, mistake.lesson])
        : [],
    );

    expect(lessons).toStrictEqual(
      new Map([
        [onScreen.id, { id: madeIn.id, title: "Discounts" }],
        [inPractice.id, { id: teaching.id, title: "Percentages" }],
        [withoutLesson.id, null],
      ]),
    );
  });

  it("pages through the notebook", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        mistakeFixture({ createdAt: new Date(Date.UTC(2026, 8, index + 1)), userId: user.id }),
      ),
    );

    const first = await listCurrentUserMistakes(query({ limit: 2 }));
    const second = await listCurrentUserMistakes(query({ limit: 2, offset: 2 }));

    expect(first.status === "ready" && [first.mistakes.length, first.hasMore]).toStrictEqual([
      2,
      true,
    ]);

    expect(second.status === "ready" && [second.mistakes.length, second.hasMore]).toStrictEqual([
      1,
      false,
    ]);
  });
});
