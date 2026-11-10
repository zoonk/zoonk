import { updateLessonClock } from "@zoonk/core/lesson-player/clock";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as updateClock } from "./route";

vi.mock("@zoonk/core/lesson-player/clock", () => ({ updateLessonClock: vi.fn() }));

const LESSON = "019c9bd7-bf11-73cb-9cc8-fe371298190b";

const INPUT = {
  clockId: "019c9bd7-bf11-73cb-9cc8-fe371298190c",
  runId: "019c9bd7-bf11-73cb-9cc8-fe371298190d",
  sequence: 1,
  state: "paused",
};

function post(body: unknown, lessonId = LESSON) {
  return updateClock(
    new NextRequest(`http://localhost/v1/library/lessons/${lessonId}/clock`, {
      body: JSON.stringify(body),
      method: "POST",
    }),
    { params: Promise.resolve({ lessonId }) },
  );
}

describe("POST /v1/library/lessons/{lessonId}/clock", () => {
  beforeEach(() => {
    vi.mocked(updateLessonClock).mockResolvedValue({ status: "updated" });
  });

  it.each(["updated", "ignored"] as const)("returns the %s domain result", async (status) => {
    vi.mocked(updateLessonClock).mockResolvedValue({ status });
    const response = await post(INPUT);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ status });
    expect(updateLessonClock).toHaveBeenCalledWith({ input: INPUT, lessonId: LESSON });
  });

  it.each([
    ["unauthorized", 401, "UNAUTHORIZED"],
    ["notFound", 404, "NOT_FOUND"],
  ] as const)("maps %s to HTTP %i", async (status, code, error) => {
    vi.mocked(updateLessonClock).mockResolvedValue({ status });
    const response = await post(INPUT);
    expect(response.status).toBe(code);
    await expect(response.json()).resolves.toMatchObject({ error: { code: error } });
  });

  it.each([
    { ...INPUT, sequence: 0 },
    { ...INPUT, sequence: 1.5 },
    { ...INPUT, sequence: Number.MAX_SAFE_INTEGER + 1 },
    { ...INPUT, userId: LESSON },
    { ...INPUT, clockId: "forged" },
    { ...INPUT, state: "hidden" },
  ])("rejects malformed input %o", async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(updateLessonClock).not.toHaveBeenCalled();
  });

  it("rejects a malformed lesson id before core", async () => {
    const response = await post(INPUT, "forged");
    expect(response.status).toBe(400);
    expect(updateLessonClock).not.toHaveBeenCalled();
  });
});
