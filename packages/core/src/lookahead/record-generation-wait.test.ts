import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { recordGenerationWait } from "./record-generation-wait";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

describe(recordGenerationWait, () => {
  it("records the wait for the signed-in learner, as the client reported it", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(
      recordGenerationWait({
        contentKind: "lesson",
        locale: "pt",
        milliseconds: 1850,
        platform: "android",
      }),
    ).resolves.toStrictEqual({ status: "recorded" });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Generation Waited",
        properties: { content_kind: "lesson", milliseconds: 1850 },
        shared: expect.objectContaining({ locale: "pt", platform: "android" }),
      }),
    );
  });

  it("records nothing without a session", async () => {
    mockSession(null);

    await expect(
      recordGenerationWait({ contentKind: "curriculum", milliseconds: 40_000 }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});
