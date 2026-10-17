import { getLearnerRevision } from "@zoonk/core/learner/revision";
import { updateLearningProfile } from "@zoonk/core/profile/update";
import { getSession } from "@zoonk/core/users/session";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { withApiErrorBoundary } from "./api-handler";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

function request(method = "POST") {
  return new Request("http://localhost:9002/v1/me/profile", { method });
}

describe("the public API's committed learner revision", () => {
  it("reads after all writer commits, preserving response status, body and headers", async () => {
    const learner = await userFixture();
    vi.mocked(getSession).mockResolvedValue({ user: { id: learner.id } } as never);

    const handle = withApiErrorBoundary(async (_request: Request) => {
      await updateLearningProfile({ soundsEnabled: false });
      await updateLearningProfile({ soundsEnabled: true });
      return Response.json({ status: "updated" }, { headers: { "X-Test": "kept" }, status: 201 });
    });

    const response = await handle(request());
    const stamp = await getLearnerRevision();

    expect(response.headers.get("Learner-Revision")).toBe(stamp?.revision);
    expect(BigInt(response.headers.get("Learner-Revision") ?? "0")).toBeGreaterThanOrEqual(2n);
    expect(response.headers.get("X-Test")).toBe("kept");
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({ status: "updated" });
  });

  it("does not advance a guest's revision for unchanged or refused writes", async () => {
    const learner = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: learner.id } });
    vi.mocked(getSession).mockResolvedValue({ user: { id: learner.id } } as never);
    await updateLearningProfile({ soundsEnabled: false });
    const before = await getLearnerRevision();

    const handle = withApiErrorBoundary(async (_request: Request) => {
      await updateLearningProfile({ soundsEnabled: false });
      await updateLearningProfile({ activeGoalId: crypto.randomUUID() });
      return new Response(null, { status: 204 });
    });

    const response = await handle(request());

    expect(response.headers.get("Learner-Revision")).toBe(before?.revision);
    await expect(getLearnerRevision()).resolves.toStrictEqual(before);
    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });

  it.each(["GET", "HEAD", "OPTIONS"])(
    "leaves %s reads outside the write boundary",
    async (method) => {
      const handle = withApiErrorBoundary(async (_request: Request) => new Response(null));
      const response = await handle(request(method));

      expect(response.headers.has("Learner-Revision")).toBe(false);
      expect(getSession).not.toHaveBeenCalled();
    },
  );

  it("does not expose a revision on a refused HTTP response", async () => {
    const handle = withApiErrorBoundary(
      async (_request: Request) => new Response(null, { status: 403 }),
    );

    const response = await handle(request());

    expect(response.headers.has("Learner-Revision")).toBe(false);
    expect(getSession).not.toHaveBeenCalled();
  });
});
