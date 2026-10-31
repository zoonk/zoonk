import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCKED_TEST_CALL } from "./blocked-test-call";
import { logError } from "./logger";

describe(logError, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reports a failure on an E2E server but not a model call the test kill switch stopped", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const refused = new Error("Provider refused");

    logError("Could not voice a clip:", new Error(BLOCKED_TEST_CALL));
    logError("Could not voice a clip:", refused);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Could not voice a clip:", refused);
  });
});
