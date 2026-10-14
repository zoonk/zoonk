import { randomUUID } from "node:crypto";
import { getCourseDetailsPromptVersion } from "@zoonk/ai/tasks/v2/courses/details";
import { DbNull, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import {
  getCourseDetailsRegenerationPreview,
  regenerateCourseDetails,
  sweepCourseDetails,
} from "./regenerate-course-details";

const getInFlightCourseIds = async (): Promise<ReadonlySet<string>> => new Set();

const MAX_DAILY_COURSE_COPY_REWRITES = 500;

const landingPage = {
  audience: ["Readers"],
  outcomes: ["Read graphs"],
  valueProposition: "Read graphs.",
};

async function adminSession() {
  const admin = await userFixture({ role: "admin" });

  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The boundary reads identity and role only.
    { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

async function staleCourse(attrs?: Parameters<typeof courseFixture>[0]) {
  const course = await courseFixture({
    detailsPromptVersion: "old-details",
    landingPage,
    visibility: "public",
    ...attrs,
  });

  const chapter = await libraryChapterFixture();
  await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

  return course;
}

/** These tests share a DB with other files: remove only their unique course rows. */
async function removeCourses(ids: string[]) {
  await prisma.course.deleteMany({ where: { id: { in: ids } } });
}

describe(regenerateCourseDetails, () => {
  it("requires admin access for preview and dispatch", async () => {
    const promptVersion = randomUUID();
    const startCourseDetails = vi.fn();
    mockSession(null);

    await expect(
      getCourseDetailsRegenerationPreview({ getInFlightCourseIds }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(
      regenerateCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    const learner = await userFixture();
    mockSession(learner.id);

    await expect(
      getCourseDetailsRegenerationPreview({ getInFlightCourseIds }),
    ).resolves.toStrictEqual({ status: "forbidden" });

    await expect(
      regenerateCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
    ).resolves.toStrictEqual({ status: "forbidden" });

    expect(startCourseDetails).not.toHaveBeenCalled();
  });

  it("selects only stale public AI copy with an outline and preserves other fields", async () => {
    await adminSession();
    const promptVersion = randomUUID();

    const baseline = await getCourseDetailsRegenerationPreview({
      getInFlightCourseIds,
      promptVersion,
    });

    const courses = await Promise.all([
      staleCourse({ detailsPromptVersion: promptVersion }),
      staleCourse({ detailsPromptVersion: getCourseDetailsPromptVersion() }),
      staleCourse({ visibility: "private" }),
      staleCourse({ detailsPromptVersion: null }),
      staleCourse({ landingPage: DbNull }),
      courseFixture({ detailsPromptVersion: "old-details", landingPage, visibility: "public" }),
    ]);

    try {
      const preview = await getCourseDetailsRegenerationPreview({
        getInFlightCourseIds,
        promptVersion,
      });

      expect(
        preview.status === "ready" &&
          baseline.status === "ready" &&
          preview.matching - baseline.matching,
      ).toBe(1);

      expect(preview.status === "ready" && preview.estimatedCost).toBeCloseTo(
        preview.status === "ready" ? preview.matching * 0.0006 : 0,
      );

      const startCourseDetails = vi.fn().mockResolvedValue(null);

      const result = await regenerateCourseDetails({
        getInFlightCourseIds,
        promptVersion,
        startCourseDetails,
      });

      expect(result.status).toBe("started");
      expect(startCourseDetails).toHaveBeenCalledWith(courses[0]!.id);

      for (const course of courses.slice(1)) {
        expect(startCourseDetails).not.toHaveBeenCalledWith(course.id);
      }

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: courses[0]!.id } }),
      ).resolves.toMatchObject({
        description: courses[0]!.description,
        detailsPromptVersion: promptVersion,
        landingPage: null,
      });
    } finally {
      await removeCourses(courses.map((course) => course.id));
    }
  });

  it("claims each course once across simultaneous and repeated clicks", async () => {
    await adminSession();
    const promptVersion = randomUUID();
    const course = await staleCourse({ detailsPromptVersion: promptVersion });
    const startCourseDetails = vi.fn().mockResolvedValue(null);

    try {
      await Promise.all([
        regenerateCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
        regenerateCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
      ]);

      await regenerateCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails });
      expect(startCourseDetails.mock.calls.filter(([id]) => id === course.id)).toHaveLength(1);
    } finally {
      await removeCourses([course.id]);
    }
  });

  it("restores copy after rejected dispatch so it can be retried", async () => {
    await adminSession();
    const promptVersion = randomUUID();
    const course = await staleCourse({ detailsPromptVersion: promptVersion });

    try {
      const result = await regenerateCourseDetails({
        getInFlightCourseIds,
        promptVersion,
        startCourseDetails: async () => {
          throw new Error("queue unavailable");
        },
      });

      expect(result.status === "started" && result.failed).toBeGreaterThan(0);

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ landingPage });

      const startCourseDetails = vi.fn().mockResolvedValue(null);
      await regenerateCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails });
      expect(startCourseDetails).toHaveBeenCalledWith(course.id);
    } finally {
      await removeCourses([course.id]);
    }
  });

  it("bounds each click and takes the oldest copy first", async () => {
    await adminSession();

    const promptVersion = randomUUID();

    const courses = await Promise.all(
      Array.from({ length: 26 }, (_, index) =>
        staleCourse({
          detailsGeneratedAt: new Date(1000 + index),
          detailsPromptVersion: promptVersion,
        }),
      ),
    );

    const startCourseDetails = vi.fn().mockResolvedValue(null);

    try {
      const result = await regenerateCourseDetails({
        getInFlightCourseIds,
        promptVersion,
        startCourseDetails,
      });

      expect(result.status === "started" && result.courseIds).toHaveLength(25);
      expect(startCourseDetails).not.toHaveBeenCalledWith(courses[25]!.id);

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: courses[25]!.id } }),
      ).resolves.toMatchObject({ landingPage });
    } finally {
      await removeCourses(courses.map((course) => course.id));
    }
  });

  it("does not restore obsolete copy over a concurrent writer after dispatch fails", async () => {
    await adminSession();
    const promptVersion = randomUUID();
    const course = await staleCourse({ detailsPromptVersion: promptVersion });
    const replacement = { ...landingPage, valueProposition: "Updated by a writer" };

    try {
      await regenerateCourseDetails({
        getInFlightCourseIds,
        promptVersion,
        startCourseDetails: async (courseId) => {
          if (courseId === course.id) {
            await prisma.course.update({
              data: { landingPage: replacement },
              where: { id: courseId },
            });
          }

          throw new Error("dispatch failed");
        },
      });

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ landingPage: replacement });
    } finally {
      await removeCourses([course.id]);
    }
  });

  it("caps automatic daily claims across overlapping sweeps and repeated runs", async () => {
    const promptVersion = randomUUID();

    const courses = await Promise.all(
      Array.from({ length: MAX_DAILY_COURSE_COPY_REWRITES + 1 }, (_, index) =>
        staleCourse({
          detailsGeneratedAt: new Date(index + 1),
          detailsPromptVersion: promptVersion,
        }),
      ),
    );

    const startCourseDetails = vi.fn().mockResolvedValue(null);
    mockSession(null);

    try {
      const results = await Promise.all([
        sweepCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
        sweepCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
      ]);

      const started = results.flatMap((result) => result.courseIds);
      expect(started.length).toBeGreaterThan(0);
      expect(started.length).toBeLessThanOrEqual(MAX_DAILY_COURSE_COPY_REWRITES);
      expect(new Set(started).size).toBe(started.length);
      expect(startCourseDetails).toHaveBeenCalledWith(courses[0]!.id);

      expect(startCourseDetails).not.toHaveBeenCalledWith(
        courses[MAX_DAILY_COURSE_COPY_REWRITES]!.id,
      );

      await expect(
        sweepCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
      ).resolves.toMatchObject({ courseIds: [], failed: 0 });
    } finally {
      await removeCourses(courses.map((course) => course.id));
    }
  });

  it("refreshes unversioned legacy copy while preserving explicit hand-written copy", async () => {
    await adminSession();

    const courses = await Promise.all([
      staleCourse({ detailsPromptVersion: null }),
      staleCourse({ detailsModel: "zoonk/hand-written", detailsPromptVersion: null }),
      staleCourse({ detailsModel: "zoonk/hand-written", detailsPromptVersion: "older-curated" }),
    ]);

    const owned = courses.map((course) => course.id);

    const otherCourses = await prisma.course.findMany({
      select: { id: true },
      where: { id: { notIn: owned } },
    });
    // Workflow activity is the external boundary; other suites' courses stay protected.
    const active = async () => new Set(otherCourses.map((course) => course.id));
    const startCourseDetails = vi.fn().mockResolvedValue(null);

    try {
      await expect(
        getCourseDetailsRegenerationPreview({ getInFlightCourseIds: active }),
      ).resolves.toMatchObject({ matching: 1 });

      await expect(
        regenerateCourseDetails({ getInFlightCourseIds: active, startCourseDetails }),
      ).resolves.toMatchObject({ courseIds: [courses[0]!.id] });

      expect(startCourseDetails).toHaveBeenCalledOnce();

      const retained = await prisma.course.findMany({
        where: { id: { in: courses.slice(1).map((course) => course.id) } },
      });

      expect(retained.map((course) => course.landingPage)).toStrictEqual([
        landingPage,
        landingPage,
      ]);
    } finally {
      await removeCourses(owned);
    }
  });

  it("recovers aged empty copy with no active run, even on the current prompt, and respects the grace period", async () => {
    await adminSession();
    const version = randomUUID();
    const old = new Date(Date.now() - 65 * 60 * 1000);

    const courses = await Promise.all([
      staleCourse({ detailsPromptVersion: version, landingPage: DbNull, updatedAt: old }),
      staleCourse({
        detailsPromptVersion: version,
        landingPage: DbNull,
        updatedAt: new Date(Date.now() - 55 * 60 * 1000),
      }),
      staleCourse({ detailsPromptVersion: version, landingPage: DbNull, updatedAt: old }),
      staleCourse({
        detailsPromptVersion: getCourseDetailsPromptVersion(),
        landingPage: DbNull,
        updatedAt: old,
      }),
      staleCourse({ detailsPromptVersion: null, landingPage: DbNull, updatedAt: old }),
      staleCourse({ detailsModel: "zoonk/hand-written", landingPage: DbNull, updatedAt: old }),
    ]);

    const owned = courses.map((course) => course.id);

    const others = await prisma.course.findMany({
      select: { id: true },
      where: { id: { notIn: owned } },
    });

    const active = async () => new Set([...others.map((course) => course.id), courses[2]!.id]);
    const startCourseDetails = vi.fn().mockResolvedValue(null);

    try {
      await expect(
        getCourseDetailsRegenerationPreview({ getInFlightCourseIds: active }),
      ).resolves.toMatchObject({ matching: 3 });

      await expect(
        sweepCourseDetails({
          getInFlightCourseIds: active,
          promptVersion: version,
          startCourseDetails,
        }),
      ).resolves.toMatchObject({ courseIds: [courses[0]!.id] });

      await expect(
        getCourseDetailsRegenerationPreview({ getInFlightCourseIds: active }),
      ).resolves.toMatchObject({ matching: 2 });

      const results = await Promise.all([
        regenerateCourseDetails({ getInFlightCourseIds: active, startCourseDetails }),
        regenerateCourseDetails({ getInFlightCourseIds: active, startCourseDetails }),
      ]);

      const ids = results.flatMap((result) =>
        result.status === "started" ? result.courseIds : [],
      );

      expect(ids.toSorted()).toStrictEqual([courses[3]!.id, courses[4]!.id].toSorted());
      expect(startCourseDetails).not.toHaveBeenCalledWith(courses[1]!.id);
      expect(startCourseDetails).not.toHaveBeenCalledWith(courses[2]!.id);

      await expect(
        regenerateCourseDetails({ getInFlightCourseIds: active, startCourseDetails }),
      ).resolves.toMatchObject({ courseIds: [] });
    } finally {
      await removeCourses(owned);
    }
  });

  it("does not let private, outline-free or hand-written empty courses consume the automatic allowance", async () => {
    const promptVersion = randomUUID();

    const [course, curated, outlineFree, privateCourses] = await Promise.all([
      staleCourse({ detailsGeneratedAt: new Date(1), detailsPromptVersion: promptVersion }),
      staleCourse({ detailsModel: "zoonk/hand-written", landingPage: DbNull }),
      courseFixture({ landingPage: DbNull, visibility: "public" }),
      Promise.all(
        Array.from({ length: MAX_DAILY_COURSE_COPY_REWRITES }, () =>
          courseFixture({ landingPage: DbNull, visibility: "private" }),
        ),
      ),
    ]);

    const ids = [course.id, curated.id, outlineFree.id, ...privateCourses.map((row) => row.id)];
    const startCourseDetails = vi.fn().mockResolvedValue(null);

    try {
      await expect(
        sweepCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
      ).resolves.toMatchObject({ courseIds: [course.id] });
    } finally {
      await removeCourses(ids);
    }
  });

  it("keeps aged missing copy eligible immediately after dispatch rejection", async () => {
    await adminSession();
    const promptVersion = randomUUID();
    const updatedAt = new Date(Date.now() - 65 * 60 * 1000);

    const course = await staleCourse({
      detailsPromptVersion: promptVersion,
      landingPage: DbNull,
      updatedAt,
    });

    try {
      await expect(
        regenerateCourseDetails({
          getInFlightCourseIds,
          promptVersion,
          startCourseDetails: async () => {
            throw new Error("queue unavailable");
          },
        }),
      ).resolves.toMatchObject({ failed: 1 });

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ landingPage: null, updatedAt });

      await expect(
        getCourseDetailsRegenerationPreview({ getInFlightCourseIds, promptVersion }),
      ).resolves.toMatchObject({ matching: 1 });

      const startCourseDetails = vi.fn().mockResolvedValue(null);

      await expect(
        regenerateCourseDetails({ getInFlightCourseIds, promptVersion, startCourseDetails }),
      ).resolves.toMatchObject({ courseIds: [course.id] });
    } finally {
      await removeCourses([course.id]);
    }
  });
});
