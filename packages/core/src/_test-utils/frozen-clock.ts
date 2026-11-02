import { onTestFinished, vi } from "vitest";

export function freezeClock(): void {
  vi.useFakeTimers({ toFake: ["Date"] });

  onTestFinished(() => {
    vi.useRealTimers();
  });
}
