import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { beforeAll, describe, expect, test } from "vitest";
import { updateAICourse } from "./update-ai-course";

describe("updateAICourse", () => {
  let organizationId: number;

  beforeAll(async () => {
    const org = await organizationFixture();
    organizationId = org.id;
  });

  test("updates description", async () => {
    const title = `update-test-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        language: "en",
        normalizedTitle: normalizeString(title),
        organizationId,
        slug: toSlug(title),
        title,
      },
    });

    const result = await updateAICourse({
      courseId: course.id,
      description: "New description",
    });

    expect(result.error).toBeNull();
    expect(result.data?.description).toBe("New description");

    const updated = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(updated?.description).toBe("New description");
  });

  test("updates imageUrl", async () => {
    const title = `update-image-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        language: "en",
        normalizedTitle: normalizeString(title),
        organizationId,
        slug: toSlug(title),
        title,
      },
    });

    const result = await updateAICourse({
      courseId: course.id,
      imageUrl: "https://example.com/image.jpg",
    });

    expect(result.error).toBeNull();
    expect(result.data?.imageUrl).toBe("https://example.com/image.jpg");

    const updated = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(updated?.imageUrl).toBe("https://example.com/image.jpg");
  });

  test("updates generationStatus", async () => {
    const title = `update-status-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        generationStatus: "pending",
        language: "en",
        normalizedTitle: normalizeString(title),
        organizationId,
        slug: toSlug(title),
        title,
      },
    });

    const result = await updateAICourse({
      courseId: course.id,
      generationStatus: "completed",
    });

    expect(result.error).toBeNull();
    expect(result.data?.generationStatus).toBe("completed");

    const updated = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(updated?.generationStatus).toBe("completed");
  });

  test("updates multiple fields at once", async () => {
    const title = `update-multiple-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        generationStatus: "pending",
        language: "en",
        normalizedTitle: normalizeString(title),
        organizationId,
        slug: toSlug(title),
        title,
      },
    });

    const result = await updateAICourse({
      courseId: course.id,
      description: "Updated description",
      generationStatus: "running",
      imageUrl: "https://example.com/new.jpg",
    });

    expect(result.error).toBeNull();
    expect(result.data?.description).toBe("Updated description");
    expect(result.data?.generationStatus).toBe("running");
    expect(result.data?.imageUrl).toBe("https://example.com/new.jpg");
  });

  test("returns error for non-existent course", async () => {
    const result = await updateAICourse({
      courseId: 999_999,
      description: "Test",
    });

    expect(result.error).not.toBeNull();
  });
});
