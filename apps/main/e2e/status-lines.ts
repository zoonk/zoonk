import { type Page } from "@playwright/test";

/** The first Enter press and each change of the status lines, on the page's own clock. */
export type StatusLog = { enterAt: number; lines: { at: number; text: string }[] };

declare global {
  /** What `logStatusLines` records in the page. */
  var zoonkStatusLog: StatusLog | undefined;
}

/**
 * Logs, on the page's own clock, the first Enter press and every change to the status lines shown
 * in its main region (all of them joined, empty once none speaks).
 */
export async function logStatusLines(page: Page) {
  await page.addInitScript(() => {
    const log: StatusLog = { enterAt: -1, lines: [] };
    globalThis.zoonkStatusLog = log;

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter" && log.enterAt < 0) {
          log.enterAt = performance.now();
        }
      },
      { capture: true },
    );

    new MutationObserver(() => {
      const text = [...document.querySelectorAll('main [role="status"]')]
        .filter((status) => status.checkVisibility())
        .map((status) => status.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" | ");

      if (log.lines.at(-1)?.text !== text && (text || log.lines.length > 0)) {
        log.lines.push({ at: performance.now(), text });
      }
    }).observe(document, { characterData: true, childList: true, subtree: true });
  });
}

/** What `logStatusLines` recorded so far. */
export async function readStatusLog(page: Page): Promise<StatusLog> {
  const log = await page.evaluate(() => globalThis.zoonkStatusLog);
  return log ?? { enterAt: -1, lines: [] };
}
