import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseStartRequestStep } from "./get-course-start-request-step";

describe(getCourseStartRequestStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the course start request by ID", async () => {
    const request = await courseStartRequestFixture({
      canonicalTitle: `Start Request ${randomUUID()}`,
    });

    const result = await getCourseStartRequestStep(request.id);

    expect(result.id).toBe(request.id);
    expect(result.canonicalTitle).toBe(request.canonicalTitle);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getCourseStartRequest" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getCourseStartRequest" }),
    );
  });

  it("throws FatalError when request does not exist", async () => {
    await expect(getCourseStartRequestStep(randomUUID())).rejects.toThrow(
      "Course start request not found",
    );

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "getCourseStartRequest" }),
    );
  });
});
