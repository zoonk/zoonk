import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { InvalidRequestError, readBody, readPathParams, readQueryParams } from "./request-input";

const goalId = randomUUID();
const chapterId = randomUUID();

describe("request ids", () => {
  it("reads path ids lowercase, however the request capitalized them", async () => {
    const schema = z.object({ chapterId: z.uuid(), goalId: z.uuid() });

    const params = Promise.resolve({ chapterId: chapterId.toUpperCase(), goalId });

    await expect(readPathParams({ params }, schema)).resolves.toStrictEqual({ chapterId, goalId });
  });

  it("reads query ids lowercase", () => {
    const request = new Request(`http://localhost/v1/sources?goalId=${goalId.toUpperCase()}`);

    expect(readQueryParams(request, z.object({ goalId: z.uuid() }))).toStrictEqual({ goalId });
  });

  it("reads body ids lowercase at any depth and leaves other text as sent", async () => {
    const note = `Chapter ${chapterId.toUpperCase()} again`;

    const request = new Request("http://localhost/v1/answers", {
      body: JSON.stringify({
        answers: [{ itemId: chapterId.toUpperCase(), text: "ABC" }],
        goalIds: [goalId.toUpperCase()],
        note,
      }),
      method: "POST",
    });

    const schema = z.object({
      answers: z.array(z.object({ itemId: z.uuid(), text: z.string() })),
      goalIds: z.array(z.uuid()),
      note: z.string(),
    });

    await expect(readBody(request, schema)).resolves.toStrictEqual({
      answers: [{ itemId: chapterId, text: "ABC" }],
      goalIds: [goalId],
      note,
    });
  });

  it("refuses a body nested far deeper than any request as invalid", async () => {
    const depth = 100_000;

    const request = new Request("http://localhost/v1/answers", {
      body: `${"[".repeat(depth)}${"]".repeat(depth)}`,
      method: "POST",
    });

    await expect(readBody(request, z.object({ goalId: z.uuid() }))).rejects.toBeInstanceOf(
      InvalidRequestError,
    );
  });
});
