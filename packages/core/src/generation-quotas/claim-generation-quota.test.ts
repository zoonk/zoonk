import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { claimGenerationQuotaIfNeeded } from "./claim-generation-quota";
import { type GenerationQuotaResource } from "./contract";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

async function useLearner(subscriber = false) {
  const user = await userFixture();
  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

  if (subscriber) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  return user;
}

function claim(resource: GenerationQuotaResource, targetId: string) {
  return claimGenerationQuotaIfNeeded({ resource, shouldClaimQuota: true, targetId });
}

async function chapterTargets(count: number) {
  const course = await courseFixture();

  return Promise.all(
    Array.from({ length: count }, (_, position) =>
      chapterFixture({ courseId: course.id, position }),
    ),
  );
}

describe("generation allowances", () => {
  beforeEach(() => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-vercel-forwarded-for": `2001:db8:${randomUUID().slice(0, 4)}::1` }),
    );

    vi.mocked(getSession).mockResolvedValue(null);
  });

  it.each(["course", "chapter", "lesson", "lessonQuestion"] as const)(
    "never grants guests new %s generation",
    async (resource) => {
      await expect(claim(resource, randomUUID())).resolves.toMatchObject({
        limit: { resource, viewer: "guest" },
        status: "limitReached",
      });
    },
  );

  it("does not charge status-only resumes", async () => {
    const targetId = randomUUID();

    await expect(
      claimGenerationQuotaIfNeeded({ resource: "course", shouldClaimQuota: false, targetId }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(prisma.generationQuotaClaim.count({ where: { targetId } })).resolves.toBe(0);
  });

  it("atomically limits free learners to three chapters at any positions", async () => {
    const user = await useLearner();
    const chapters = await chapterTargets(4);
    const results = await Promise.all(chapters.map((chapter) => claim("chapter", chapter.id)));
    expect(results.filter((result) => result.status === "ready")).toHaveLength(3);

    expect(results.filter((result) => result.status === "limitReached")).toMatchObject([
      { limit: { period: "month", resource: "chapter", viewer: "authenticated" } },
    ]);

    await expect(prisma.chapterGenerationGrant.count({ where: { userId: user.id } })).resolves.toBe(
      3,
    );

    await expect(
      prisma.generationQuotaClaim.count({
        where: { actorKey: `user:${user.id}`, resource: "chapter" },
      }),
    ).resolves.toBe(3);
  });

  it("funds every missing lesson in an already granted chapter without another chapter allowance", async () => {
    const user = await useLearner();
    const chapters = await chapterTargets(4);
    await Promise.all(chapters.slice(0, 3).map((chapter) => claim("chapter", chapter.id)));

    const lessons = await Promise.all(
      Array.from({ length: 4 }, (_, position) =>
        lessonFixture({ chapterId: chapters[2]!.id, position }),
      ),
    );

    const results = await Promise.all(lessons.map((lesson) => claim("lesson", lesson.id)));
    expect(results.every((result) => result.status === "ready")).toBe(true);

    const counter = await prisma.generationQuotaCounter.findFirstOrThrow({
      where: { actorKey: `user:${user.id}`, period: "month", resource: "chapter" },
    });

    expect(counter.count).toBe(3);
    const unfunded = await lessonFixture({ chapterId: chapters[3]!.id });

    await expect(claim("lesson", unfunded.id)).resolves.toMatchObject({
      limit: { resource: "chapter" },
      status: "limitReached",
    });

    await expect(
      prisma.generationQuotaClaim.count({ where: { targetId: unfunded.id } }),
    ).resolves.toBe(0);
  });

  it("acquires one chapter grant when concurrent first requests generate different missing lessons", async () => {
    const user = await useLearner();
    const [chapter] = await chapterTargets(1);

    const lessons = await Promise.all(
      [0, 1, 2].map((position) => lessonFixture({ chapterId: chapter!.id, position })),
    );

    const results = await Promise.all(lessons.map((lesson) => claim("lesson", lesson.id)));
    expect(results.every((result) => result.status === "ready")).toBe(true);

    await expect(prisma.chapterGenerationGrant.count({ where: { userId: user.id } })).resolves.toBe(
      1,
    );

    const counter = await prisma.generationQuotaCounter.findFirstOrThrow({
      where: { actorKey: `user:${user.id}`, resource: "chapter" },
    });

    expect(counter.count).toBe(1);
  });

  it("does not charge another learner for joining the same funded target", async () => {
    await useLearner();
    const [chapter] = await chapterTargets(1);
    const lesson = await lessonFixture({ chapterId: chapter!.id });
    await expect(claim("lesson", lesson.id)).resolves.toStrictEqual({ status: "ready" });
    const second = await useLearner();
    await expect(claim("lesson", lesson.id)).resolves.toStrictEqual({ status: "ready" });

    await expect(
      prisma.chapterGenerationGrant.count({ where: { userId: second.id } }),
    ).resolves.toBe(0);

    const missingLesson = await lessonFixture({ chapterId: chapter!.id, position: 1 });
    await expect(claim("lesson", missingLesson.id)).resolves.toStrictEqual({ status: "ready" });

    await expect(
      prisma.chapterGenerationGrant.count({ where: { userId: second.id } }),
    ).resolves.toBe(1);
  });

  it("continues a permanently granted chapter in a later month without consuming the new allowance", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      vi.setSystemTime(new Date("2030-09-12T12:00:00Z"));
      const user = await useLearner();
      const [chapter] = await chapterTargets(1);
      await claim("chapter", chapter!.id);

      vi.setSystemTime(new Date("2030-10-12T12:00:00Z"));
      const lesson = await lessonFixture({ chapterId: chapter!.id });
      await expect(claim("lesson", lesson.id)).resolves.toStrictEqual({ status: "ready" });

      const counters = await prisma.generationQuotaCounter.findMany({
        where: { actorKey: `user:${user.id}`, resource: "chapter" },
      });

      expect(counters).toMatchObject([
        { count: 1, period: "month", periodStart: new Date("2030-09-01T00:00:00Z") },
      ]);

      expect(counters).toHaveLength(1);

      await expect(
        prisma.chapterGenerationGrant.count({ where: { userId: user.id } }),
      ).resolves.toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { limit: 1, subscriber: false },
    { limit: 2, subscriber: true },
  ])(
    "limits new outlines for subscriber=$subscriber and resets only in the next month",
    async ({ subscriber, limit }) => {
      vi.useFakeTimers({ toFake: ["Date"] });

      try {
        vi.setSystemTime(new Date("2030-09-12T12:00:00Z"));
        const user = await useLearner(subscriber);
        const targets = Array.from({ length: limit }, () => randomUUID());
        const accepted = await Promise.all(targets.map((target) => claim("course", target)));
        expect(accepted.every((result) => result.status === "ready")).toBe(true);

        await expect(claim("course", randomUUID())).resolves.toMatchObject({
          limit: { period: "month", resource: "course" },
          status: "limitReached",
        });

        vi.setSystemTime(new Date("2030-09-13T12:00:00Z"));

        await expect(claim("course", randomUUID())).resolves.toMatchObject({
          limit: { period: "month", resource: "course" },
          status: "limitReached",
        });

        vi.setSystemTime(new Date("2030-10-01T12:00:00Z"));
        await expect(claim("course", randomUUID())).resolves.toStrictEqual({ status: "ready" });
        await expect(claim("course", targets[0]!)).resolves.toStrictEqual({ status: "ready" });

        const counters = await prisma.generationQuotaCounter.findMany({
          orderBy: { periodStart: "asc" },
          where: { actorKey: `user:${user.id}`, period: "month", resource: "course" },
        });

        expect(counters.map((counter) => counter.count)).toStrictEqual([limit, 1]);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("reports the daily boundary when only the daily outline allowance is exhausted", async () => {
    const user = await useLearner();
    const now = new Date();

    await prisma.generationQuotaCounter.create({
      data: {
        actorKey: `user:${user.id}`,
        count: 1,
        period: "day",
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        resource: "course",
      },
    });

    await expect(claim("course", randomUUID())).resolves.toMatchObject({
      limit: { period: "day", resource: "course" },
      status: "limitReached",
    });

    await expect(
      prisma.generationQuotaCounter.count({
        where: { actorKey: `user:${user.id}`, period: "month", resource: "course" },
      }),
    ).resolves.toBe(0);
  });

  it("charges duplicate target submissions only once", async () => {
    const user = await useLearner();
    const targetId = randomUUID();
    const results = await Promise.all([claim("course", targetId), claim("course", targetId)]);
    expect(results).toStrictEqual([{ status: "ready" }, { status: "ready" }]);

    await expect(
      prisma.generationQuotaCounter.findMany({ where: { actorKey: `user:${user.id}`, count: 1 } }),
    ).resolves.toHaveLength(2);
  });
});
