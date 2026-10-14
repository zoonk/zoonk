import { courseDetailsWorkflow } from "@/workflows/v2/courses/course-details-workflow";
import {
  getCourseDetailsRegenerationPreview,
  regenerateCourseDetails,
} from "@zoonk/core/library/courses/regenerate-details";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import {
  POST as createCourseDetailsRegeneration,
  GET as previewCourseDetailsRegeneration,
} from "./route";

// The core DB suite owns authorization and claims; here only transport is replaced.
vi.mock("@zoonk/core/library/courses/regenerate-details", () => ({
  getCourseDetailsRegenerationPreview: vi.fn(),
  regenerateCourseDetails: vi.fn(),
}));

vi.mock("@/workflows/v2/courses/course-details-workflow", () => ({
  courseDetailsWorkflow: vi.fn(),
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/v1/library/courses/details/regenerations", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

describe("POST course details regenerations", () => {
  it("dispatches copy-only workflows through the authenticated core operation", async () => {
    vi.mocked(regenerateCourseDetails).mockImplementation(async ({ startCourseDetails }) => {
      await startCourseDetails("019c9bd7-bf11-73cb-9cc8-fe371298190b");
      return { courseIds: ["019c9bd7-bf11-73cb-9cc8-fe371298190b"], failed: 0, status: "started" };
    });

    const response = await createCourseDetailsRegeneration(request({}));
    expect(response.status).toBe(202);

    await expect(response.json()).resolves.toStrictEqual({
      courseIds: ["019c9bd7-bf11-73cb-9cc8-fe371298190b"],
      failed: 0,
    });

    expect(start).toHaveBeenCalledWith(
      courseDetailsWorkflow,
      [{ copyOnly: true, courseId: "019c9bd7-bf11-73cb-9cc8-fe371298190b" }],
      { attributes: { courseId: "019c9bd7-bf11-73cb-9cc8-fe371298190b" } },
    );
  });

  it.each([
    ["unauthorized", 401],
    ["forbidden", 403],
  ] as const)("maps %s access to HTTP", async (status, code) => {
    vi.mocked(regenerateCourseDetails).mockResolvedValue({ status });
    const response = await createCourseDetailsRegeneration(request({}));
    expect(response.status).toBe(code);
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects an empty source prompt version before claiming any courses", async () => {
    const response = await createCourseDetailsRegeneration(request({ promptVersion: "" }));
    expect(response.status).toBe(400);
    expect(regenerateCourseDetails).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});

describe("GET course details regeneration preview", () => {
  it("returns a read-only count and estimate without dispatch", async () => {
    vi.mocked(getCourseDetailsRegenerationPreview).mockResolvedValue({
      batchSize: 25,
      estimatedCost: 0.006,
      matching: 10,
      status: "ready",
    });

    const response = await previewCourseDetailsRegeneration();

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      batchSize: 25,
      estimatedCost: 0.006,
      matching: 10,
    });

    expect(regenerateCourseDetails).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthorized", 401],
    ["forbidden", 403],
  ] as const)("guards a %s preview", async (status, code) => {
    vi.mocked(getCourseDetailsRegenerationPreview).mockResolvedValue({ status });

    const response = await previewCourseDetailsRegeneration();

    expect(response.status).toBe(code);
    expect(start).not.toHaveBeenCalled();
  });
});
