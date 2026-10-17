import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Watches a Start from before its tap: whether it went busy, and whether a ready Start (`label`, on
 * an enabled button) or the failure line (`failure`, in an alert) showed again after it. A screen
 * kept hidden after leaving doesn't count: only what's visible does. It returns once the watch has
 * seen Start ready, before the tap, and gives the reader of what it saw.
 */
export async function watchStart(
  page: Page,
  start: Locator,
  { failure, label }: { failure: string; label: RegExp },
) {
  await start.evaluate(
    (button, watched) => {
      if (!(button instanceof HTMLButtonElement)) {
        throw new TypeError("Start is not a button");
      }

      const ready = new RegExp(watched.label.source, watched.label.flags);
      const seen = { busy: false, control: 0, failure: 0, readyAgain: 0, tapped: false };

      const readyStarts = () =>
        [button, ...document.querySelectorAll("button")].filter(
          (candidate) =>
            candidate instanceof HTMLButtonElement &&
            candidate.isConnected &&
            ready.test(candidate.textContent.trim()) &&
            !candidate.disabled &&
            candidate.checkVisibility(),
        ).length;

      const look = () => {
        const shown = readyStarts() > 0;

        if (!seen.tapped) {
          seen.control += shown ? 1 : 0;
        } else if (!seen.busy) {
          seen.busy = !shown;
        } else if (shown) {
          seen.readyAgain += 1;
        }

        const shownFailures = [...document.querySelectorAll('[role="alert"]')].filter(
          (alert) => alert.textContent.includes(watched.failure) && alert.checkVisibility(),
        );

        seen.failure += shownFailures.length;
      };

      button.addEventListener("click", () => {
        seen.tapped = true;
      });

      new MutationObserver(look).observe(document.body, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });

      Object.assign(globalThis, { e2eStartSeen: seen });
    },
    { failure, label: { flags: label.flags, source: label.source } },
  );

  const readSeen = () =>
    page.evaluate(() => {
      const read: unknown = Reflect.get(globalThis, "e2eStartSeen");
      return read;
    });

  // The watch sees a ready Start: any change on the page while it's ready counts it.
  await page.evaluate(() => {
    document.body.dataset.e2eStartWatch = "on";
  });

  await expect
    .poll(async () => {
      const seen = await readSeen();
      return typeof seen === "object" && seen !== null && Number(Reflect.get(seen, "control")) > 0;
    })
    .toBe(true);

  return readSeen;
}
