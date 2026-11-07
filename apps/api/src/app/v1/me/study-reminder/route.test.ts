import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../../../../../../packages/core/src/_test-utils/mock-session";
import { PATCH as updateReminder } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

function patch(body: unknown) {
  return updateReminder(
    new NextRequest("http://localhost/v1/me/study-reminder", {
      body: JSON.stringify(body),
      method: "PATCH",
    }),
  );
}

describe("PATCH /v1/me/study-reminder", () => {
  it("answers push without a phone with PHONE_REQUIRED", async () => {
    mockAccountSession({ user: await userFixture() });

    const response = await patch({ locale: "en", pushOn: true });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "PHONE_REQUIRED" } });
  });

  it("saves the time and returns every setting", async () => {
    const user = await userFixture();
    mockAccountSession({ user });

    const response = await patch({ locale: "en", time: "06:45" });

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      reminder: { email: { address: user.email, on: false }, time: "06:45" },
    });
  });
});
