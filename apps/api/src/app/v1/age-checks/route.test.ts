import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST as checkAge } from "./route";

function check({ birthYear, country }: { birthYear: unknown; country: string }) {
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-vercel-ip-country": country }));

  return checkAge(
    new NextRequest("http://localhost/v1/age-checks", {
      body: JSON.stringify({ birthYear }),
      method: "POST",
    }),
  );
}

describe("POST /v1/age-checks", () => {
  const thisYear = new Date().getUTCFullYear();

  it("lets a visitor old enough where they are start, without an account", async () => {
    const response = await check({ birthYear: thisYear - 14, country: "BR" });

    expect(response.status).toBe(204);
  });

  it("stops a visitor below the minimum age where they are and says it", async () => {
    const response = await check({ birthYear: thisYear - 14, country: "KR" });

    expect(response.status).toBe(422);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BELOW_MINIMUM_AGE", details: { minimumAge: 14 } },
    });
  });
});
