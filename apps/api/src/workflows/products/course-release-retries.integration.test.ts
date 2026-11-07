import { generateCourseOutline } from "@zoonk/ai/tasks/curriculum/course-outline";
import { compareReleaseLessons } from "@zoonk/ai/tasks/products/compare-release-lessons";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NoObjectGeneratedError } from "ai";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { courseReleaseWorkflow } from "./course-release-workflow";

// The release pages keep their stored text when a refresh doesn't answer.
vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetch: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/products/compare-release-lessons", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  compareReleaseLessons: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/curriculum/course-outline", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateCourseOutline: vi.fn(),
}));

/** Calls a model step makes when it uses all 3 of its retries. */
const ATTEMPTS = 4;

const REFUSAL = new NoObjectGeneratedError({
  finishReason: "content-filter",
  response: {} as never,
  text: "",
  usage: {} as never,
});

async function followedCourseBehind() {
  const brand = await brandFixture();
  const page = await sourceFixture({ extractedText: "Version 2 moves export to a panel." });

  const product = await productFixture({
    organizationId: brand.id,
    releasesHash: page.contentHash,
    releasesSourceId: page.id,
  });

  const [first, second] = await Promise.all(
    ["2025-01-10", "2026-01-10"].map((date, index) =>
      productReleaseFixture({
        name: `Test Product ${index + 1}`,
        productId: product.id,
        releasedAt: new Date(date),
      }),
    ),
  );

  const course = await courseFixture({
    organizationId: brand.id,
    productId: product.id,
    productReleaseId: first?.id ?? null,
  });

  const user = await userFixture();
  await goalFixture({ primaryCourseId: course.id, userId: user.id });

  return { course, first, page, second };
}

describe("course release durability", () => {
  it("records a comparison the model can't make after its retries, so the next run doesn't pay for it", async () => {
    const { course, first, page, second } = await followedCourseBehind();

    vi.mocked(compareReleaseLessons).mockRejectedValue(REFUSAL);

    const uncomparable = { releasesApplied: 0, status: "uncomparable" };

    const run = await start(courseReleaseWorkflow, [{ courseId: course.id }]);
    await expect(run.returnValue).resolves.toStrictEqual(uncomparable);

    const next = await start(courseReleaseWorkflow, [{ courseId: course.id }]);
    await expect(next.returnValue).resolves.toStrictEqual(uncomparable);

    expect(compareReleaseLessons).toHaveBeenCalledTimes(ATTEMPTS);

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({
      productReleaseId: first?.id,
      uncomparableNotesHash: page.contentHash,
      uncomparableReleaseId: second?.id,
    });
  });

  it("records nothing when every retry fails for a reason a later run can fix", async () => {
    const { course, first } = await followedCourseBehind();
    vi.mocked(compareReleaseLessons).mockRejectedValue(new Error("Gateway timeout"));

    const run = await start(courseReleaseWorkflow, [{ courseId: course.id }]);
    await expect(run.returnValue).rejects.toThrow();

    expect(compareReleaseLessons).toHaveBeenCalledTimes(ATTEMPTS);

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({
      productReleaseId: first?.id,
      uncomparableNotesHash: null,
      uncomparableReleaseId: null,
    });
  });

  it("moves the course without a What's new chapter the model can't outline after its retries, so the next run doesn't pay for it", async () => {
    const { course, second } = await followedCourseBehind();

    vi.mocked(compareReleaseLessons).mockResolvedValue(
      taskResult({
        changed: [],
        whatsNew: {
          level: "beginner",
          offer: "Learn the new export panel.",
          skills: [{ description: "Export from the new panel.", name: "Export from the panel" }],
          title: "What's new in Test Product 2",
        },
      }) as never,
    );

    vi.mocked(generateCourseOutline).mockRejectedValue(REFUSAL);

    const run = await start(courseReleaseWorkflow, [{ courseId: course.id }]);
    await expect(run.returnValue).resolves.toStrictEqual({ releasesApplied: 1, status: "current" });

    const next = await start(courseReleaseWorkflow, [{ courseId: course.id }]);

    await expect(next.returnValue).resolves.toStrictEqual({
      releasesApplied: 0,
      status: "current",
    });

    expect(compareReleaseLessons).toHaveBeenCalledOnce();
    expect(generateCourseOutline).toHaveBeenCalledTimes(ATTEMPTS);

    await expect(prisma.courseChapter.count({ where: { courseId: course.id } })).resolves.toBe(0);

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ productReleaseId: second?.id });
  });
});
