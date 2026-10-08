import { lessonContentWorkflow } from "@/workflows/v2/lessons/lesson-content-workflow";
import { pullLessonsForRegeneration } from "@zoonk/core/library/lessons/regenerate";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { POST as createLessonRegeneration } from "./route";

// Core's integration tests cover which lessons are pulled and who may pull them; this adapter
// test covers the body, the writing runs it starts and how each outcome maps to HTTP.
vi.mock("@zoonk/core/library/lessons/regenerate", () => ({ pullLessonsForRegeneration: vi.fn() }));
vi.mock("workflow/api", () => ({ start: vi.fn() }));

vi.mock("@/workflows/v2/lessons/lesson-content-workflow", () => ({
  lessonContentWorkflow: vi.fn(),
}));

const LESSON_IDS = ["019c9bd7-bf11-73cb-9cc8-fe371298190b", "019c9bd7-bf11-73cb-9cc8-fe371298190c"];

function regenerationRequest(body: unknown) {
  return new NextRequest("http://localhost/v1/library/lessons/regenerations", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

describe("POST /v1/library/lessons/regenerations", () => {
  beforeEach(() => {
    vi.mocked(pullLessonsForRegeneration).mockResolvedValue({
      lessonIds: LESSON_IDS,
      status: "pulled",
    });
  });

  it("starts a reviewed writing run for every pulled lesson", async () => {
    const response = await createLessonRegeneration(
      regenerationRequest({ model: "openai/gpt-6-sol", promptVersion: "2f629e5f4ec1" }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toStrictEqual({ lessonIds: LESSON_IDS });

    expect(pullLessonsForRegeneration).toHaveBeenCalledWith({
      model: "openai/gpt-6-sol",
      promptVersion: "2f629e5f4ec1",
    });

    expect(start).toHaveBeenCalledTimes(LESSON_IDS.length);

    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      { forceReview: true, lessonId: LESSON_IDS[0] },
    ]);
  });

  it("rejects a request without a model or prompt version", async () => {
    const response = await createLessonRegeneration(regenerationRequest({}));

    expect(response.status).toBe(400);
    expect(pullLessonsForRegeneration).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "unauthorized" as const }, 401, "UNAUTHORIZED"],
    [{ status: "forbidden" as const }, 403, "FORBIDDEN"],
    [{ status: "invalid" as const }, 400, "BAD_REQUEST"],
  ])("maps %o to HTTP %i", async (result, status, code) => {
    vi.mocked(pullLessonsForRegeneration).mockResolvedValue(result);

    const response = await createLessonRegeneration(regenerationRequest({ model: "any" }));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
    expect(start).not.toHaveBeenCalled();
  });
});
