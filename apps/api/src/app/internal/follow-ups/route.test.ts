import { followUpsWorkflow } from "@/workflows/follow-ups/follow-ups-workflow";
import { FOLLOW_UP_SECRET_HEADER } from "@zoonk/core/follow-ups/contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { POST as startFollowUps } from "./route";

const USER_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";

function askToStart({ body = { userId: USER_ID }, secret }: { body?: unknown; secret?: string }) {
  return startFollowUps(
    new Request("http://localhost/internal/follow-ups", {
      body: JSON.stringify(body),
      headers: secret ? { [FOLLOW_UP_SECRET_HEADER]: secret } : {},
      method: "POST",
    }),
  );
}

describe("POST /internal/follow-ups", () => {
  beforeEach(() => {
    vi.stubEnv("APP_FOLLOW_UP_SECRET", "expected");

    vi.mocked(start).mockResolvedValue({ runId: "wrun_follow_ups" } as Awaited<
      ReturnType<typeof start>
    >);
  });

  it.each([
    ["no secret", undefined],
    ["a wrong secret", "wrong"],
    ["a longer secret", "expected-and-more"],
  ])("refuses %s and starts nothing", async (_case, secret) => {
    const response = await askToStart({ secret });

    expect(response.status).toBe(401);
    expect(start).not.toHaveBeenCalled();
  });

  it("refuses everything while the API has no secret", async () => {
    vi.stubEnv("APP_FOLLOW_UP_SECRET", "");

    const response = await askToStart({ secret: "" });

    expect(response.status).toBe(401);
    expect(start).not.toHaveBeenCalled();
  });

  it("starts the learner's follow-ups run", async () => {
    const response = await askToStart({ secret: "expected" });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toStrictEqual({ runId: "wrun_follow_ups" });
    expect(start).toHaveBeenCalledExactlyOnceWith(followUpsWorkflow, [{ userId: USER_ID }]);
  });

  it("refuses a learner id that isn't one", async () => {
    const response = await askToStart({ body: { userId: "me" }, secret: "expected" });

    expect(response.status).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });
});
