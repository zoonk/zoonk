import { type Page } from "./fixtures";

type CapturedEvent = { name: string; data: Record<string, unknown> };

declare global {
  function captureClockEvent(event: CapturedEvent): Promise<void>;
}

export async function captureAnalytics(page: Page): Promise<CapturedEvent[]> {
  const events: CapturedEvent[] = [];
  await page.exposeFunction("captureClockEvent", (event: CapturedEvent) => events.push(event));

  await page.addInitScript(() => {
    Object.assign(globalThis, {
      va: (kind: string, event: CapturedEvent) => {
        if (kind === "event") {
          void globalThis.captureClockEvent(event);
        }
      },
    });
  });

  return events;
}
