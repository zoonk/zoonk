import { saveBirthYear } from "@zoonk/core/profile/save-birth-year";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { PUT as putBirthYear } from "./route";

vi.mock("@zoonk/core/profile/save-birth-year", () => ({ saveBirthYear: vi.fn() }));

function send(body: unknown) {
  return putBirthYear(
    new NextRequest("http://localhost/v1/me/birth-year", {
      body: JSON.stringify(body),
      method: "PUT",
    }),
  );
}

describe("PUT /v1/me/birth-year", () => {
  it("says the minimum age when the learner is below it, so the app can say it too", async () => {
    vi.mocked(saveBirthYear).mockResolvedValue({
      certain: false,
      minimumAge: 14,
      status: "belowMinimumAge",
    });

    const response = await send({ birthYear: 2012 });

    expect(response.status).toBe(422);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BELOW_MINIMUM_AGE", details: { accountClosed: false, minimumAge: 14 } },
    });
  });

  it("says when the account was closed for being certainly below it", async () => {
    vi.mocked(saveBirthYear).mockResolvedValue({ minimumAge: 13, status: "accountClosed" });

    const response = await send({ birthYear: 2015 });

    expect(response.status).toBe(422);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BELOW_MINIMUM_AGE", details: { accountClosed: true, minimumAge: 13 } },
    });
  });

  it("refuses a year no one could be born in", async () => {
    vi.mocked(saveBirthYear).mockResolvedValue({ status: "invalidBirthYear" });

    const response = await send({ birthYear: 3000 });

    expect(response.status).toBe(422);

    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_BIRTH_YEAR" } });
  });

  it("rejects a body without a whole year before saving anything", async () => {
    const response = await send({ birthYear: "1990" });

    expect(response.status).toBe(400);
    expect(saveBirthYear).not.toHaveBeenCalled();
  });
});
