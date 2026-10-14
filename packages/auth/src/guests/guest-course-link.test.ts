import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { createExistingAccount, signInAsGuest, signInWithPassword } from "./_test-utils/guest-auth";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

describe("guest private course linking", () => {
  it("allocates free destination slugs and keeps course IDs and plan references when both owners use the same slug", async () => {
    const [account, guest] = await Promise.all([
      createExistingAccount({ createdAt: new Date("2026-09-01T00:00:00Z") }),
      signInAsGuest(),
    ]);

    const courseData = {
      language: "en",
      normalizedTitle: "acme approval workflow",
      slug: "acme-approval-workflow",
      title: "Acme approval workflow",
      visibility: "private" as const,
    };

    const [accountCourse, guestCourse, freeCourse] = await Promise.all([
      prisma.course.create({ data: { ...courseData, userId: account.userId } }),
      prisma.course.create({ data: { ...courseData, userId: guest.guestId } }),
      prisma.course.create({
        data: { ...courseData, slug: "acme-approval-workflow-3", userId: guest.guestId },
      }),
      prisma.course.create({
        data: { ...courseData, slug: "acme-approval-workflow-2", userId: account.userId },
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
        ownerId: guest.guestId,
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
        userId: guest.guestId,
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

    await signInWithPassword({ email: account.email, headers: guest.headers });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: guestCourse.id } }),
    ).resolves.toMatchObject({ slug: "acme-approval-workflow-4", userId: account.userId });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: accountCourse.id } }),
    ).resolves.toMatchObject({ slug: courseData.slug, userId: account.userId });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: freeCourse.id } }),
    ).resolves.toMatchObject({ slug: "acme-approval-workflow-3", userId: account.userId });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: guestCourse.id,
      userId: account.userId,
    });

    await expect(
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
    ).resolves.toMatchObject({ homeCourseId: guestCourse.id, ownerId: account.userId });

    await expect(
      prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { id: plan.id } }),
    ).resolves.toMatchObject({
      graph: plan.graph,
      items: [expect.objectContaining({ chapterId: chapter.id, id: plan.items[0]?.id })],
    });

    await expect(prisma.course.count({ where: { userId: account.userId } })).resolves.toBe(4);
    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();
  });

  it("serializes concurrent guest transfers into the same course home", async () => {
    const [account, firstGuest, secondGuest] = await Promise.all([
      createExistingAccount({ createdAt: new Date("2026-09-01T00:00:00Z") }),
      signInAsGuest(),
      signInAsGuest(),
    ]);

    const data = {
      language: "en",
      normalizedTitle: "internal approvals",
      slug: "internal-approvals",
      title: "Internal approvals",
      visibility: "private" as const,
    };

    await Promise.all([
      prisma.course.create({ data: { ...data, userId: account.userId } }),
      prisma.course.create({ data: { ...data, userId: firstGuest.guestId } }),
      prisma.course.create({ data: { ...data, userId: secondGuest.guestId } }),
    ]);

    await Promise.all([
      signInWithPassword({ email: account.email, headers: firstGuest.headers }),
      signInWithPassword({ email: account.email, headers: secondGuest.headers }),
    ]);

    const courses = await prisma.course.findMany({
      orderBy: { slug: "asc" },
      where: { userId: account.userId },
    });

    expect(courses.map((course) => course.slug)).toStrictEqual([
      "internal-approvals",
      "internal-approvals-2",
      "internal-approvals-3",
    ]);

    await expect(
      prisma.user.count({ where: { id: { in: [firstGuest.guestId, secondGuest.guestId] } } }),
    ).resolves.toBe(0);
  });
});
