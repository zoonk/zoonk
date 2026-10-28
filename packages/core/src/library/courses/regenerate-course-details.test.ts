import { randomUUID } from "node:crypto";
import {
  generateCourseDetails,
  getCourseDetailsPromptVersion,
} from "@zoonk/ai/tasks/v2/courses/details";
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
import { details, outlinedCourse, provenance } from "./_test-utils/course-details";
import { writeCourseDetails } from "./course-details";
import {
  getCourseDetailsRegenerationPreview,
  regenerateCourseDetails,
} from "./regenerate-course-details";

const getInFlightCourseIds = async (): Promise<ReadonlySet<string>> => new Set();

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
    detailsModel: null,
    detailsPromptVersion: "old-details",
    landingPage,
    visibility: "public",
    ...attrs,
  });

  const chapter = await libraryChapterFixture();
  await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

  return course;
}

async function otherCoursesInFlight({
  owned,
  inFlight = [],
}: {
  owned: string[];
  inFlight?: string[];
}) {
  const others = await prisma.course.findMany({
    select: { id: true },
    where: { id: { notIn: owned } },
  });

  return new Set([...others.map((course) => course.id), ...inFlight]);
}

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
      courseFixture({
        detailsModel: null,
        detailsPromptVersion: "old-details",
        landingPage,
        visibility: "public",
      }),
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

  it("refreshes unversioned legacy copy while preserving explicit hand-written copy", async () => {
    await adminSession();

    const courses = await Promise.all([
      staleCourse({ detailsPromptVersion: null }),
      staleCourse({ detailsModel: "zoonk/hand-written", detailsPromptVersion: null }),
      staleCourse({ detailsModel: "zoonk/hand-written", detailsPromptVersion: "older-curated" }),
    ]);

    const owned = courses.map((course) => course.id);

    const active = () => otherCoursesInFlight({ owned });
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

    const generatedCourses: string[] = [];

    vi.mocked(generateCourseDetails).mockResolvedValue(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The writer reads the generated data and provenance only.
      { data: details, provenance } as Awaited<ReturnType<typeof generateCourseDetails>>,
    );

    const active = async () => {
      const inFlight = await otherCoursesInFlight({ inFlight: [courses[2]!.id], owned });
      const course = await outlinedCourse();
      generatedCourses.push(course.id);
      await expect(writeCourseDetails({ courseId: course.id })).resolves.toBe("written");
      return inFlight;
    };

    const startCourseDetails = vi.fn().mockResolvedValue(null);

    await active();
    const lateCourse = await staleCourse({ detailsPromptVersion: null });

    try {
      await expect(
        getCourseDetailsRegenerationPreview({ getInFlightCourseIds: active }),
      ).resolves.toMatchObject({ matching: 3 });

      await expect(
        regenerateCourseDetails({
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

      expect(startCourseDetails).not.toHaveBeenCalledWith(lateCourse.id);

      const retained = await prisma.course.findMany({ where: { id: { in: generatedCourses } } });

      expect(retained).toHaveLength(generatedCourses.length);

      for (const course of retained) {
        expect(startCourseDetails).not.toHaveBeenCalledWith(course.id);

        expect(course).toMatchObject({
          detailsModel: provenance.model,
          detailsPromptVersion: getCourseDetailsPromptVersion(),
          landingPage: details.landingPage,
        });
      }
    } finally {
      await removeCourses([...owned, lateCourse.id, ...generatedCourses]);
    }
  });

  it("leaves authored fixtures outside recovery when another suite creates them with an old clock", async () => {
    await adminSession();
    const promptVersion = randomUUID();
    const old = new Date(Date.now() - 65 * 60 * 1000);
    const others = await prisma.course.findMany({ select: { id: true } });
    const active = async () => new Set(others.map((course) => course.id));

    const course = await courseFixture({
      createdAt: old,
      detailsPromptVersion: promptVersion,
      landingPage: DbNull,
      updatedAt: old,
      visibility: "public",
    });

    const chapter = await libraryChapterFixture();

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

    const startCourseDetails = vi.fn().mockResolvedValue(null);

    try {
      await expect(
        regenerateCourseDetails({
          getInFlightCourseIds: active,
          promptVersion,
          startCourseDetails,
        }),
      ).resolves.toMatchObject({ courseIds: [] });

      expect(startCourseDetails).not.toHaveBeenCalled();

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ landingPage: null, updatedAt: old });
    } finally {
      await removeCourses([course.id]);
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
