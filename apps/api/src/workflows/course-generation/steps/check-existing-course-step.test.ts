import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseAlternativeTitleFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { checkExistingCourseStep } from "./check-existing-course-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(checkExistingCourseStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no matching course exists", async () => {
    const suggestion = await courseSuggestionFixture({
      title: `No Match ${randomUUID()}`,
    });

    const result = await checkExistingCourseStep(suggestion);

    expect(result).toBeNull();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "checkExistingCourse" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "checkExistingCourse" }),
    );
  });

  test("returns existing course when slug matches", async () => {
    const title = `Existing Course ${randomUUID()}`;
    const slug = ensureLocaleSuffix(toSlug(title), "en");

    const course = await courseFixture({
      organizationId,
      slug,
      title,
    });

    const suggestion = await courseSuggestionFixture({ language: "en", slug, title });

    const result = await checkExistingCourseStep(suggestion);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(course.id);
  });

  test("returns existing course when alternative title matches", async () => {
    const title = `Alt Title Course ${randomUUID()}`;
    const altTitle = `Alt Title ${randomUUID()}`;
    const altSlug = toSlug(altTitle);

    const course = await courseFixture({
      organizationId,
      title,
    });

    await courseAlternativeTitleFixture({
      courseId: course.id,
      language: "en",
      slug: altSlug,
    });

    const suggestion = await courseSuggestionFixture({
      language: "en",
      slug: altSlug,
      title: altTitle,
    });

    const result = await checkExistingCourseStep(suggestion);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(course.id);
  });
});
