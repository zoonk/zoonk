import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { createLearner } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

describe("guest private course linking", () => {
  it("allocates free destination slugs and keeps course IDs and plan references when both owners use the same slug", async () => {
    const [accountId, guestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    const courseData = {
      language: "en",
      normalizedTitle: "acme approval workflow",
      slug: "acme-approval-workflow",
      title: "Acme approval workflow",
      visibility: "private" as const,
    };

    const [accountCourse, guestCourse, freeCourse] = await Promise.all([
      prisma.course.create({ data: { ...courseData, userId: accountId } }),
      prisma.course.create({ data: { ...courseData, userId: guestId } }),
      prisma.course.create({
        data: { ...courseData, slug: "acme-approval-workflow-3", userId: guestId },
      }),
      prisma.course.create({
        data: { ...courseData, slug: "acme-approval-workflow-2", userId: accountId },
      }),
    ]);

    const chapter = await prisma.chapter.create({
      data: {
        description: "One internal approval process",
        homeCourseId: guestCourse.id,
        identityKey: `guest-course-${randomUUID()}`,
        language: "en",
        level: "beginner",
        model: "test",
        normalizedTitle: "approval",
        ownerId: guestId,
        promptVersion: "test",
        runId: "test",
        slug: "approval",
        title: "Approval",
        visibility: "private",
      },
    });

    const goal = await prisma.goal.create({
      data: {
        dailyMinutes: 20,
        kind: "learn",
        language: "en",
        primaryCourseId: guestCourse.id,
        prompt: "Learn our approval process",
        title: "Internal approvals",
        userId: guestId,
      },
    });

    const plan = await prisma.plan.create({
      data: {
        goalId: goal.id,
        graph: { courseId: guestCourse.id },
        items: {
          create: {
            chapterId: chapter.id,
            kind: "checkpoint",
            phase: 0,
            position: 0,
            titleSnapshot: "Approval",
          },
        },
      },
      include: { items: true },
    });

    await linkGuestAccount({ account: { id: accountId }, guestUserId: guestId });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: guestCourse.id } }),
    ).resolves.toMatchObject({ slug: "acme-approval-workflow-4", userId: accountId });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: accountCourse.id } }),
    ).resolves.toMatchObject({ slug: courseData.slug, userId: accountId });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: freeCourse.id } }),
    ).resolves.toMatchObject({ slug: "acme-approval-workflow-3", userId: accountId });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: guestCourse.id,
      userId: accountId,
    });

    await expect(
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
    ).resolves.toMatchObject({ homeCourseId: guestCourse.id, ownerId: accountId });

    await expect(
      prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { id: plan.id } }),
    ).resolves.toMatchObject({
      graph: plan.graph,
      items: [expect.objectContaining({ chapterId: chapter.id, id: plan.items[0]?.id })],
    });

    await expect(prisma.course.count({ where: { userId: accountId } })).resolves.toBe(4);
    await expect(prisma.user.findUnique({ where: { id: guestId } })).resolves.toBeNull();
  });

  it("serializes concurrent guest transfers into the same course home", async () => {
    const [accountId, firstGuestId, secondGuestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
      createLearner({ isAnonymous: true }),
    ]);

    const data = {
      language: "en",
      normalizedTitle: "internal approvals",
      slug: "internal-approvals",
      title: "Internal approvals",
      visibility: "private" as const,
    };

    await Promise.all([
      prisma.course.create({ data: { ...data, userId: accountId } }),
      prisma.course.create({ data: { ...data, userId: firstGuestId } }),
      prisma.course.create({ data: { ...data, userId: secondGuestId } }),
    ]);

    await Promise.all([
      linkGuestAccount({ account: { id: accountId }, guestUserId: firstGuestId }),
      linkGuestAccount({ account: { id: accountId }, guestUserId: secondGuestId }),
    ]);

    const courses = await prisma.course.findMany({
      orderBy: { slug: "asc" },
      where: { userId: accountId },
    });

    expect(courses.map((course) => course.slug)).toStrictEqual([
      "internal-approvals",
      "internal-approvals-2",
      "internal-approvals-3",
    ]);

    await expect(
      prisma.user.count({ where: { id: { in: [firstGuestId, secondGuestId] } } }),
    ).resolves.toBe(0);
  });
});
