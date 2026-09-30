import { prisma } from "@zoonk/db";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import { mergeSkillForAdmin } from "./merge-skill";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

async function signInAdmin() {
  const admin = await userFixture({ role: "admin" });

  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Merges only read the identity and role.
    { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

describe(mergeSkillForAdmin, () => {
  it("moves learners' mastery, answers and the lessons that teach it to the surviving skill", async () => {
    const [duplicate, survivor, prerequisite, dependent, onlyDuplicate, both, lesson] =
      await Promise.all([
        skillFixture(),
        skillFixture(),
        skillFixture(),
        skillFixture(),
        userFixture(),
        userFixture(),
        libraryLessonFixture(),
      ]);

    const [item] = await Promise.all([
      itemFixture({ skillId: duplicate.id }),
      learnerSkillFixture({
        reps: 4,
        skillId: duplicate.id,
        state: "solid",
        userId: onlyDuplicate.id,
      }),
      learnerSkillFixture({ reps: 6, skillId: duplicate.id, state: "solid", userId: both.id }),
      learnerSkillFixture({ reps: 1, skillId: survivor.id, state: "learning", userId: both.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: duplicate.id }),
      skillPrerequisiteFixture({ prerequisiteId: prerequisite.id, skillId: duplicate.id }),
      skillPrerequisiteFixture({ prerequisiteId: duplicate.id, skillId: dependent.id }),
      skillPrerequisiteFixture({ prerequisiteId: survivor.id, skillId: duplicate.id }),
    ]);

    const attempt = await attemptFixture({ skillId: duplicate.id, userId: onlyDuplicate.id });

    await mistakeFixture({
      attemptId: attempt.id,
      skillId: duplicate.id,
      userId: onlyDuplicate.id,
    });

    await signInAdmin();

    await expect(
      mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id }),
    ).resolves.toStrictEqual({ learners: 2, status: "merged", survivorId: survivor.id });

    const [merged, learnerSkills, movedAttempt, mistakes, movedItem, lessonSkills, edges] =
      await Promise.all([
        prisma.skill.findUniqueOrThrow({ where: { id: duplicate.id } }),
        prisma.learnerSkill.findMany({
          orderBy: { reps: "asc" },
          where: { userId: { in: [onlyDuplicate.id, both.id] } },
        }),
        prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } }),
        prisma.mistake.findMany({ where: { userId: onlyDuplicate.id } }),
        prisma.item.findUniqueOrThrow({ where: { id: item.id } }),
        prisma.lessonSkill.findMany({ where: { lessonId: lesson.id } }),
        prisma.skillPrerequisite.findMany({
          where: { OR: [{ skillId: survivor.id }, { prerequisiteId: survivor.id }] },
        }),
      ]);

    expect(merged.mergedIntoId).toBe(survivor.id);

    expect(learnerSkills).toMatchObject([
      { reps: 4, skillId: survivor.id, userId: onlyDuplicate.id },
      { reps: 6, skillId: survivor.id, userId: both.id },
    ]);

    expect(movedAttempt.skillId).toBe(survivor.id);
    expect(mistakes).toMatchObject([{ skillId: survivor.id }]);
    expect(movedItem.skillId).toBe(survivor.id);
    expect(lessonSkills).toMatchObject([{ skillId: survivor.id }]);

    expect(edges).toHaveLength(2);

    expect(edges).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ prerequisiteId: prerequisite.id, skillId: survivor.id }),
        expect.objectContaining({ prerequisiteId: survivor.id, skillId: dependent.id }),
      ]),
    );

    await expect(prisma.learnerSkill.count({ where: { skillId: duplicate.id } })).resolves.toBe(0);
  });

  it("keeps the survivor's row when the learner reviewed it more", async () => {
    const [duplicate, survivor, user] = await Promise.all([
      skillFixture(),
      skillFixture(),
      userFixture(),
    ]);

    await Promise.all([
      learnerSkillFixture({ reps: 1, skillId: duplicate.id, userId: user.id }),
      learnerSkillFixture({ reps: 5, skillId: survivor.id, state: "mastered", userId: user.id }),
    ]);

    await signInAdmin();
    await mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id });

    await expect(
      prisma.learnerSkill.findMany({ where: { userId: user.id } }),
    ).resolves.toMatchObject([{ reps: 5, skillId: survivor.id, state: "mastered" }]);
  });

  it("merges into the skill a merged survivor points at, and repoints earlier merges", async () => {
    const [duplicate, earlier, survivor, root] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await Promise.all([
      prisma.skill.update({ data: { mergedIntoId: root.id }, where: { id: survivor.id } }),
      prisma.skill.update({ data: { mergedIntoId: duplicate.id }, where: { id: earlier.id } }),
    ]);

    await signInAdmin();

    await expect(
      mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id }),
    ).resolves.toMatchObject({ status: "merged", survivorId: root.id });

    await expect(
      prisma.skill.findMany({ where: { id: { in: [duplicate.id, earlier.id] } } }),
    ).resolves.toStrictEqual([
      expect.objectContaining({ mergedIntoId: root.id }),
      expect.objectContaining({ mergedIntoId: root.id }),
    ]);
  });

  it("refuses merges that would mix audiences, languages or loop", async () => {
    const owner = await userFixture();

    const [english, portuguese, privateSkill, looped] = await Promise.all([
      skillFixture(),
      skillFixture({ language: "pt" }),
      skillFixture({ ownerId: owner.id, visibility: "private" }),
      skillFixture(),
    ]);

    await prisma.skill.update({ data: { mergedIntoId: english.id }, where: { id: looped.id } });
    await signInAdmin();

    const results = await Promise.all([
      mergeSkillForAdmin({ duplicateId: english.id, survivorId: english.id }),
      mergeSkillForAdmin({ duplicateId: english.id, survivorId: portuguese.id }),
      mergeSkillForAdmin({ duplicateId: english.id, survivorId: privateSkill.id }),
      mergeSkillForAdmin({ duplicateId: english.id, survivorId: looped.id }),
      mergeSkillForAdmin({ duplicateId: looped.id, survivorId: portuguese.id }),
    ]);

    expect(results).toStrictEqual(Array.from({ length: 5 }, () => ({ status: "invalid" })));

    await expect(
      prisma.skill.findUniqueOrThrow({ where: { id: english.id } }),
    ).resolves.toMatchObject({ mergedIntoId: null });
  });

  it("is only for admins", async () => {
    const [duplicate, survivor, learner] = await Promise.all([
      skillFixture(),
      skillFixture(),
      userFixture(),
    ]);

    const merge = () => mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id });

    mockSession(null);
    await expect(merge()).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(learner.id);
    await expect(merge()).resolves.toStrictEqual({ status: "forbidden" });

    await expect(
      prisma.skill.findUniqueOrThrow({ where: { id: duplicate.id } }),
    ).resolves.toMatchObject({ mergedIntoId: null });
  });
});
