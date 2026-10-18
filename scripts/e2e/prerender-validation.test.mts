import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findPrerenderErrors } from "./prerender-errors.mts";
import { waitForPrerenderValidation } from "./prerender-validation.mts";

const state = { directory: "", logPath: "" };
const requestId = "last-learner-get";

function marker(type: string, id = requestId, responseFinished = true) {
  return `<VALIDATION_MESSAGE>${JSON.stringify({ requestId: id, responseFinished, type, url: "/en/today" })}</VALIDATION_MESSAGE>\n`;
}

beforeEach(async () => {
  state.directory = await mkdtemp(join(tmpdir(), "zoonk-prerender-validation-"));
  state.logPath = join(state.directory, "dev.log");
  await writeFile(state.logPath, "");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.spyOn(performance, "now").mockReturnValue(0);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await rm(state.directory, { force: true, recursive: true });
});

describe("detached prerender completion", () => {
  it("captures a delayed final diagnostic after HTTP 200 before allowing shutdown", async () => {
    await writeFile(state.logPath, `GET /en/today 200\n${marker("validation_start")}`);
    const completion = waitForPrerenderValidation({ logPath: state.logPath, requestId });
    const settled = { value: false };

    void completion.then(() => {
      settled.value = true;
    });

    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1));
    expect(settled.value).toBe(false);

    await appendFile(
      state.logPath,
      `Error: Route "/[lang]/today": Unexpected cache miss after cache warming phase during prerendering.\n${marker("validation_end")}`,
    );

    await vi.advanceTimersByTimeAsync(100);
    await completion;
    expect(findPrerenderErrors(await readFile(state.logPath, "utf8"))).toHaveLength(1);
  });

  it("does not mistake another request's end for completion", async () => {
    await writeFile(state.logPath, marker("validation_start") + marker("validation_end", "other"));

    const pending = waitForPrerenderValidation({
      logPath: state.logPath,
      requestId,
      timeoutMs: 1000,
    });

    const rejected = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1));
    vi.spyOn(performance, "now").mockReturnValue(1000);
    await vi.advanceTimersByTimeAsync(100);
    const error = await rejected;

    if (!(error instanceof Error)) {
      throw new Error("Expected an incomplete-validation error.");
    }

    expect(error.message).toContain("did not complete");
  });

  it.each(["no events", "end without start"])("fails closed for %s", async (kind) => {
    await writeFile(state.logPath, kind === "no events" ? "" : marker("validation_end"));

    const pending = waitForPrerenderValidation({
      logPath: state.logPath,
      requestId,
      timeoutMs: 1000,
    });

    const rejected = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1));
    vi.spyOn(performance, "now").mockReturnValue(1000);
    await vi.advanceTimersByTimeAsync(100);
    const error = await rejected;

    if (!(error instanceof Error)) {
      throw new Error("Expected an incomplete-validation error.");
    }

    expect(error.message).toContain("did not complete");
  });

  it("fails an aborted validation rather than silently retrying the route", async () => {
    await writeFile(state.logPath, marker("validation_aborted"));

    await expect(waitForPrerenderValidation({ logPath: state.logPath, requestId })).rejects.toThrow(
      "aborted",
    );
  });

  it("rejects the installed skipped-validation marker pair", async () => {
    await writeFile(
      state.logPath,
      marker("validation_start", requestId, false) + marker("validation_end"),
    );

    await expect(waitForPrerenderValidation({ logPath: state.logPath, requestId })).rejects.toThrow(
      "skipped",
    );
  });
});
