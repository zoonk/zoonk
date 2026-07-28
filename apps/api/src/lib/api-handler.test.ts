import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withApiErrorBoundary } from "./api-handler";

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

describe(withApiErrorBoundary, () => {
  beforeEach(() => {
    vi.mocked(unstable_rethrow).mockReset();
  });

  it("preserves successful handler responses and arguments", async () => {
    const handler = vi.fn((value: string) => Response.json({ value }, { status: 202 }));
    const wrappedHandler = withApiErrorBoundary(handler);

    const response = await wrappedHandler("accepted");

    expect(handler).toHaveBeenCalledExactlyOnceWith("accepted");
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toStrictEqual({ value: "accepted" });
  });

  it("logs unexpected failures and returns the standard internal error", async () => {
    const failure = new Error("Database unavailable");

    const wrappedHandler = withApiErrorBoundary(async () => {
      throw failure;
    });

    const response = await wrappedHandler();

    expect(unstable_rethrow).toHaveBeenCalledExactlyOnceWith(failure);
    expect(logError).toHaveBeenCalledExactlyOnceWith("[Public API Error]", failure);
    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toStrictEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  });

  it("rethrows Next.js control-flow errors before logging or serializing them", async () => {
    const interruption = new Error("Prerender interrupted");

    vi.mocked(unstable_rethrow).mockImplementation(() => {
      throw interruption;
    });

    const wrappedHandler = withApiErrorBoundary(async () => {
      throw interruption;
    });

    await expect(wrappedHandler()).rejects.toBe(interruption);
    expect(logError).not.toHaveBeenCalled();
  });
});
