import { beforeAll, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { openActivity } from "../_test-utils/activity-player";
import { serveLocalRuntimes } from "../_test-utils/local-runtimes";

describe("runtime startup", () => {
  beforeAll(serveLocalRuntimes);

  it("retries Python after its worker stalls during startup", async () => {
    const terminate = vi.spyOn(Worker.prototype, "terminate");

    class StalledWorker extends Worker {
      constructor() {
        super("data:text/javascript,");
      }
    }

    vi.stubGlobal("Worker", StalledWorker);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    try {
      openActivity({ template: "codeRunner" });
      await expect.element(page.getByText(/Getting Python ready/u)).toBeVisible();
      await page.getByRole("button", { name: "Run" }).click();
      await vi.advanceTimersByTimeAsync(180_000);
      vi.useRealTimers();

      await expect
        .element(page.getByRole("button", { name: "Try again" }), { timeout: 1000 })
        .toBeVisible();

      expect(terminate).toHaveBeenCalledOnce();
      vi.unstubAllGlobals();
      await page.getByRole("button", { name: "Try again" }).click();
      await page.getByRole("button", { name: "Run" }).click();
      await expect.element(page.getByText("range stops before its end.")).toBeVisible();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      terminate.mockRestore();
    }
  });
});
