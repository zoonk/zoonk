import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { AI_ORG_ID } from "@zoonk/utils/constants";
import { toSlug } from "@zoonk/utils/string";
import { describe, expect, test } from "vitest";
import { createAICourse } from "./create-ai-course";

describe("createAICourse", () => {
  test("creates a course with running status", async () => {
    const title = `Test Course ${randomUUID()}`;
    const runId = randomUUID();

    const result = await createAICourse({
      generationRunId: runId,
      language: "en",
      title,
    });

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.slug).toBe(toSlug(title));

    const course = await prisma.course.findUnique({
      where: { id: result.data?.id },
    });

    expect(course?.organizationId).toBe(AI_ORG_ID);
    expect(course?.generationStatus).toBe("running");
    expect(course?.generationRunId).toBe(runId);
    expect(course?.isPublished).toBe(true);
    expect(course?.title).toBe(title);
  });

  test("returns error for duplicate slug", async () => {
    const title = `Duplicate Course ${randomUUID()}`;
    const runId = randomUUID();

    await createAICourse({
      generationRunId: runId,
      language: "en",
      title,
    });

    const result = await createAICourse({
      generationRunId: randomUUID(),
      language: "en",
      title,
    });

    expect(result.error).not.toBeNull();
  });
});
