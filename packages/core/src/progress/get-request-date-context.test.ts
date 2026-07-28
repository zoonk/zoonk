import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestProgressDateContext } from "./get-request-date-context";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

describe(getRequestProgressDateContext, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a validated Vercel timezone for the local date", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-vercel-ip-timezone": "Pacific/Kiritimati" }),
    );

    await expect(getRequestProgressDateContext()).resolves.toStrictEqual({
      currentDate: new Date("2026-07-13T00:00:00Z"),
      currentInstant: new Date("2026-07-12T12:00:00Z"),
      timeZone: "Pacific/Kiritimati",
    });
  });

  it("falls back to UTC for an invalid Vercel timezone", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-vercel-ip-timezone": "also/not-a-timezone" }),
    );

    await expect(getRequestProgressDateContext()).resolves.toStrictEqual({
      currentDate: new Date("2026-07-12T00:00:00Z"),
      currentInstant: new Date("2026-07-12T12:00:00Z"),
      timeZone: "UTC",
    });
  });
});
