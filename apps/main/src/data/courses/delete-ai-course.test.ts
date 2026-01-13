import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { beforeAll, describe, expect, test } from "vitest";
import { deleteAICourse } from "./delete-ai-course";

describe("deleteAICourse", () => {
  let organizationId: number;

  beforeAll(async () => {
    const org = await organizationFixture();
    organizationId = org.id;
  });

  test("deletes a course successfully", async () => {
    const title = `delete-test-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        language: "en",
        normalizedTitle: normalizeString(title),
        organizationId,
        slug: toSlug(title),
        title,
      },
    });

    const result = await deleteAICourse(course.id);

    expect(result.error).toBeNull();

    const deleted = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(deleted).toBeNull();
  });

  test("returns error for non-existent course", async () => {
    const result = await deleteAICourse(999_999);

    expect(result.error).not.toBeNull();
  });
});
