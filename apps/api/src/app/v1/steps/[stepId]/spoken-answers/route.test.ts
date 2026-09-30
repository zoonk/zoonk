import { gradeSpokenAnswer } from "@zoonk/core/library/language/grade-spoken-answer";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createSpokenAnswer } from "./route";

// Core's integration tests cover grading, explanations and attempts; this adapter test
// covers the multipart body and how each outcome maps to HTTP.
vi.mock("@zoonk/core/library/language/grade-spoken-answer", () => ({ gradeSpokenAnswer: vi.fn() }));

const STEP_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";

const GRADE = {
  attemptId: "019c9bd7-bf11-73cb-9cc8-fe371298190c",
  explanation: null,
  isCorrect: true,
  score: 1,
  transcript: "How much is the rent",
  words: [{ heard: null, status: "correct" as const, text: "How" }],
  wordsToPractice: [],
};

function spokenAnswerRequest(fields: Record<string, string>, audio?: File) {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }

  if (audio) {
    form.append("audio", audio);
  }

  return new NextRequest(`http://localhost/v1/steps/${STEP_ID}/spoken-answers`, {
    body: form,
    method: "POST",
  });
}

function post(request: NextRequest, stepId = STEP_ID) {
  return createSpokenAnswer(request, { params: Promise.resolve({ stepId }) });
}

const recording = () =>
  new File([new Uint8Array([1, 2, 3])], "answer.webm", { type: "audio/webm" });

/** Today's small AI help is used up: guests sign up, free learners see Plus, Plus waits a day. */
function limitReached({
  resource,
  tier,
}: {
  resource: "aiSpend" | "assist";
  tier: "free" | "guest" | "plus";
}) {
  return {
    limit: { limit: 40, period: "day" as const, resource, tier },
    status: "limitReached" as const,
  };
}

describe("POST /v1/steps/{stepId}/spoken-answers", () => {
  beforeEach(() => {
    vi.mocked(gradeSpokenAnswer).mockResolvedValue({ grade: GRADE, status: "graded" });
  });

  it("passes the recording and its fields to grading and returns the grade", async () => {
    const response = await post(
      spokenAnswerRequest({ durationMs: "2400", timeZone: "America/Sao_Paulo" }, recording()),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual(GRADE);

    expect(gradeSpokenAnswer).toHaveBeenCalledWith({
      audio: { bytes: new Uint8Array([1, 2, 3]), mediaType: "audio/webm" },
      fields: { durationMs: 2400, timeZone: "America/Sao_Paulo" },
      stepId: STEP_ID,
    });
  });

  it.each([
    ["no recording", spokenAnswerRequest({ durationMs: "1800" })],
    ["no duration", spokenAnswerRequest({}, recording())],
    [
      "an unknown field",
      spokenAnswerRequest({ durationMs: "1800", userId: "someone" }, recording()),
    ],
    [
      "a request to keep the recording, which is never kept",
      spokenAnswerRequest({ durationMs: "1800", keepRecording: "true" }, recording()),
    ],
  ])("rejects a form with %s", async (_, request) => {
    const response = await post(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(gradeSpokenAnswer).not.toHaveBeenCalled();
  });

  it("rejects a step id that isn't a uuid", async () => {
    const response = await post(spokenAnswerRequest({ durationMs: "1800" }, recording()), "step-1");

    expect(response.status).toBe(400);
    expect(gradeSpokenAnswer).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "unauthorized" as const }, 401, "UNAUTHORIZED"],
    [{ status: "notFound" as const }, 404, "NOT_FOUND"],
    [{ status: "invalidAudio" as const }, 400, "INVALID_AUDIO"],
    [{ status: "noSpeech" as const }, 422, "NO_SPEECH"],
    [{ retryAfterSeconds: 60, status: "slowDown" as const }, 429, "SLOW_DOWN"],
    [limitReached({ resource: "assist", tier: "guest" }), 403, "USAGE_LIMIT_REACHED"],
    [limitReached({ resource: "aiSpend", tier: "free" }), 402, "USAGE_LIMIT_REACHED"],
    [limitReached({ resource: "aiSpend", tier: "plus" }), 429, "USAGE_LIMIT_REACHED"],
  ])("maps %o to HTTP %i", async (result, status, code) => {
    vi.mocked(gradeSpokenAnswer).mockResolvedValue(result);

    const response = await post(spokenAnswerRequest({ durationMs: "1800" }, recording()));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });
});
