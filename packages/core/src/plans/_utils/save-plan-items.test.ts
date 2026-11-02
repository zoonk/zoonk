import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { savePlanItems } from "./save-plan-items";

describe(savePlanItems, () => {
  it("saves the skill a kept lesson counts for now", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, before, after, lesson] = await Promise.all([
      planFixture({ goalId: goal.id }),
      skillFixture(),
      skillFixture(),
      libraryLessonFixture(),
    ]);

    const item = await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: new Date("2026-10-13T00:00:00Z"),
      skillId: before.id,
    });

    await prisma.$transaction((tx) =>
      savePlanItems({
        existing: [item],
        items: [{ ...item, scheduledFor: new Date("2026-10-14T00:00:00Z"), skillId: after.id }],
        planId: plan.id,
        standInLessons: new Map(),
        tx,
      }),
    );

    const saved = await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } });

    expect(saved).toMatchObject({
      scheduledFor: new Date("2026-10-14T00:00:00Z"),
      skillId: after.id,
    });
  });

  it("sets aside a lesson still to do the run sets aside, never one already finished", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, skill, left, finished] = await Promise.all([
      planFixture({ goalId: goal.id }),
      skillFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    const scheduledFor = new Date("2026-10-13T00:00:00Z");

    const [leftItem, finishedItem] = await Promise.all([
      planItemFixture({
        lessonId: left.id,
        planId: plan.id,
        position: 0,
        scheduledFor,
        skillId: skill.id,
      }),
      planItemFixture({
        lessonId: finished.id,
        planId: plan.id,
        position: 1,
        scheduledFor,
        skillId: skill.id,
        status: "done",
      }),
    ]);

    await prisma.$transaction((tx) =>
      savePlanItems({
        existing: [leftItem, { ...finishedItem, status: "todo" }],
        items: [leftItem, { ...finishedItem, status: "todo" }].map((item) => ({
          ...item,
          status: "skipped" as const,
        })),
        planId: plan.id,
        standInLessons: new Map(),
        tx,
      }),
    );

    const saved = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    expect(saved.map((item) => item.status)).toStrictEqual(["skipped", "done"]);
  });

  it("keeps every position in order when a lesson the run leaves out was finished meanwhile", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, skill, first, finished, last] = await Promise.all([
      planFixture({ goalId: goal.id }),
      skillFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    const scheduledFor = new Date("2026-10-13T00:00:00Z");

    const [firstItem, finishedItem, lastItem] = await Promise.all([
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0, scheduledFor }),
      planItemFixture({ lessonId: finished.id, planId: plan.id, position: 1, scheduledFor }),
      planItemFixture({ lessonId: last.id, planId: plan.id, position: 2, scheduledFor }),
    ]);

    await prisma.planItem.update({ data: { status: "done" }, where: { id: finishedItem.id } });

    const save = () =>
      prisma.$transaction((tx) =>
        savePlanItems({
          existing: [firstItem, finishedItem, lastItem],
          items: [lastItem, firstItem].map((item) => ({ ...item, skillId: skill.id })),
          planId: plan.id,
          standInLessons: new Map(),
          tx,
        }),
      );

    await save();
    await save();

    const saved = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    expect(saved.map((item) => [item.id, item.position])).toStrictEqual([
      [lastItem.id, 0],
      [firstItem.id, 1],
      [finishedItem.id, 2],
    ]);
  });

  it("saves a plan holding a row left past the others", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, first, second, stray] = await Promise.all([
      planFixture({ goalId: goal.id }),
      libraryLessonFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    const firstItem = await planItemFixture({ lessonId: first.id, planId: plan.id, position: 0 });
    const secondItem = await planItemFixture({ lessonId: second.id, planId: plan.id, position: 1 });

    const strayItem = await planItemFixture({
      lessonId: stray.id,
      planId: plan.id,
      position: 1_000_001,
    });

    const items = [firstItem, secondItem, strayItem];

    await prisma.$transaction((tx) =>
      savePlanItems({ existing: items, items, planId: plan.id, standInLessons: new Map(), tx }),
    );

    const saved = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    expect(saved.map((item) => [item.id, item.position])).toStrictEqual([
      [firstItem.id, 0],
      [secondItem.id, 1],
      [strayItem.id, 2],
    ]);
  });

  it("writes only the rows a save changes", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, first, second, third] = await Promise.all([
      planFixture({ goalId: goal.id }),
      libraryLessonFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    const [firstItem, secondItem, thirdItem] = await Promise.all([
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0 }),
      planItemFixture({ lessonId: second.id, planId: plan.id, position: 1 }),
      planItemFixture({ lessonId: third.id, planId: plan.id, position: 2 }),
    ]);

    const readVersions = async () => {
      const rows = await prisma.$queryRaw<{ id: string; version: string }[]>`
        SELECT id, xmin::text AS version FROM plan_items WHERE plan_id = ${plan.id}::uuid`;

      return new Map(rows.map((row) => [row.id, row.version]));
    };

    const save = (items: (typeof firstItem)[]) =>
      prisma.$transaction((tx) =>
        savePlanItems({
          existing: [firstItem, secondItem, thirdItem],
          items,
          planId: plan.id,
          standInLessons: new Map(),
          tx,
        }),
      );

    const before = await readVersions();
    await save([firstItem, thirdItem, secondItem]);
    const swapped = await readVersions();

    const saved = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    expect(saved.map((item) => item.id)).toStrictEqual([firstItem.id, thirdItem.id, secondItem.id]);
    expect(swapped.get(firstItem.id)).toBe(before.get(firstItem.id));
    expect(swapped.get(secondItem.id)).not.toBe(before.get(secondItem.id));

    await save([firstItem, thirdItem, secondItem]);

    await expect(readVersions()).resolves.toStrictEqual(swapped);
  });
});
