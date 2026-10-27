import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noteAppWrite, noteAppWritesSent, takeSettledAppWrites } from "./app-write-ledger";

const PAGE = "https://zoonk.test/en/learn/lesson-1";

function heldWrite() {
  const { promise, reject, resolve } = Promise.withResolvers<null>();
  void noteAppWrite(promise);
  return { fail: () => reject(new Error("The connection dropped")), save: () => resolve(null) };
}

describe("app write ledger", () => {
  beforeEach(async () => {
    // The page the writes are sent from, which a browser always has.
    vi.stubGlobal("location", new URL(PAGE));
    await takeSettledAppWrites();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for a write still on its way, then takes it once", async () => {
    const write = heldWrite();
    const taken = takeSettledAppWrites();

    write.save();

    await expect(taken).resolves.toBe(true);
    await expect(takeSettledAppWrites()).resolves.toBe(false);
  });

  it("counts a write whose response never arrived, since it may have been saved", async () => {
    const write = heldWrite();
    write.fail();

    await expect(takeSettledAppWrites()).resolves.toBe(true);
  });

  it("leaves a write the next screen sent while the last one's refresh waited, for its own refresh", async () => {
    const left = heldWrite();
    const leftScreenRefresh = takeSettledAppWrites();
    const next = heldWrite();

    left.save();
    await expect(leftScreenRefresh).resolves.toBe(true);

    const nextScreenRefresh = takeSettledAppWrites();
    next.save();
    await expect(nextScreenRefresh).resolves.toBe(true);
  });

  it("takes only the writes sent from the page the learner leaves", async () => {
    heldWrite().save();
    vi.stubGlobal("location", new URL("https://zoonk.test/en/today"));
    heldWrite().save();

    await expect(takeSettledAppWrites("/en/learn/lesson-1")).resolves.toBe(true);
    await expect(takeSettledAppWrites("/en/learn/lesson-1")).resolves.toBe(false);
    await expect(takeSettledAppWrites()).resolves.toBe(true);
  });

  describe("requests the page sends", () => {
    beforeEach(() => {
      // The network is outside the test: every request answers at once.
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(new Response(null))),
      );

      noteAppWritesSent();
    });

    it("counts a post to the public API, such as a spoken answer, whatever code sends it", async () => {
      const form = new FormData();
      form.set("durationMs", "1200");

      await fetch(`${getBrowserApiUrl()}/v1/steps/step-1/spoken-answers`, {
        body: form,
        method: "POST",
      });

      await expect(takeSettledAppWrites()).resolves.toBe(true);
    });

    it("counts a post to the app's own routes, such as a lesson's start", async () => {
      await fetch(
        new Request(new URL("/api/library/lessons/lesson-1/starts", PAGE), { method: "POST" }),
      );

      await expect(takeSettledAppWrites()).resolves.toBe(true);
    });

    it("leaves reads, Server Actions and other sites' requests alone", async () => {
      await Promise.all([
        fetch("/api/learner/summary"),
        fetch(`${getBrowserApiUrl()}/v1/generations/run-1`),
        fetch(PAGE, { headers: { "next-action": "abc" }, method: "POST" }),
        fetch("/_vercel/insights/view", { method: "POST" }),
        fetch("https://us.i.posthog.com/e/", { method: "POST" }),
      ]);

      await expect(takeSettledAppWrites()).resolves.toBe(false);
    });
  });
});
