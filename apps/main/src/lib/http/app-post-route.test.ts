import { getLearnerRevision } from "@zoonk/core/learner/revision";
import { updateLearningProfile } from "@zoonk/core/profile/update";
import { getSession } from "@zoonk/core/users/session";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { appPostRoute } from "./app-post-route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

function request(origin = "http://localhost:9000") {
  return new Request("http://localhost:9000/api/revision-test", {
    headers: { Host: "localhost:9000", Origin: origin },
    method: "POST",
  });
}

describe("the app POST's committed learner revision", () => {
  it("returns the revision after the last committed writer and preserves its outcome", async () => {
    const learner = await userFixture();
    vi.mocked(getSession).mockResolvedValue({ user: { id: learner.id } } as never);

    const post = appPostRoute("revision-test", async () => {
      await updateLearningProfile({ soundsEnabled: false });
      return updateLearningProfile({ soundsEnabled: true });
    });

    const response = await post(request(), { params: Promise.resolve({}) });
    const stamp = await getLearnerRevision();

    expect(response.status).toBe(200);
    expect(response.headers.get("Learner-Revision")).toBe(stamp?.revision);
    expect(BigInt(response.headers.get("Learner-Revision") ?? "0")).toBeGreaterThanOrEqual(2n);
    await expect(response.json()).resolves.toMatchObject({ status: "updated" });
  });

  it("reports the same revision after a refused or unchanged write", async () => {
    const learner = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: learner.id } });
    vi.mocked(getSession).mockResolvedValue({ user: { id: learner.id } } as never);
    await updateLearningProfile({ soundsEnabled: false });
    const before = await getLearnerRevision();

    const post = appPostRoute("revision-test", async () => {
      await updateLearningProfile({ soundsEnabled: false });
      return updateLearningProfile({ activeGoalId: crypto.randomUUID() });
    });

    const response = await post(request(), { params: Promise.resolve({}) });

    expect(response.headers.get("Learner-Revision")).toBe(before?.revision);
    await expect(getLearnerRevision()).resolves.toStrictEqual(before);
    await expect(response.json()).resolves.toMatchObject({ status: "goalNotFound" });
  });

  it("does not read a revision or run a writer for a foreign origin", async () => {
    const write = vi.fn();
    const post = appPostRoute("revision-test", write);

    const response = await post(request("https://foreign.example"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    expect(response.headers.has("Learner-Revision")).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });
});
