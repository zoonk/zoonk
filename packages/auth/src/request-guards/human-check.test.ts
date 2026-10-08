import { checkBotId } from "botid/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isHumanRequest } from "./human-check";

/** BotID verdicts require Vercel's request context, so tests supply that platform boundary. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));

describe(isHumanRequest, () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TESTING", "false");
    vi.stubEnv("VERCEL_ENV", "");
    vi.mocked(checkBotId).mockReset();

    vi.mocked(checkBotId).mockResolvedValue({
      bypassed: false,
      isBot: true,
      isHuman: false,
      isVerifiedBot: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows local development without calling BotID", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(isHumanRequest()).resolves.toBe(true);
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("allows E2E outside Vercel without calling BotID", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TESTING", "true");

    await expect(isHumanRequest()).resolves.toBe(true);
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it.each(["preview", "production"])("rejects bots in deployed %s", async (environment) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", environment);

    await expect(isHumanRequest()).resolves.toBe(false);
    expect(checkBotId).toHaveBeenCalledExactlyOnceWith();
  });

  it("accepts a verified human in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    vi.mocked(checkBotId).mockResolvedValue({
      bypassed: false,
      isBot: false,
      isHuman: true,
      isVerifiedBot: false,
    });

    await expect(isHumanRequest()).resolves.toBe(true);
    expect(checkBotId).toHaveBeenCalledExactlyOnceWith();
  });

  it("propagates a failed deployed BotID check", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = new Error("BotID unavailable");
    vi.mocked(checkBotId).mockRejectedValue(error);

    await expect(isHumanRequest()).rejects.toBe(error);
  });
});
