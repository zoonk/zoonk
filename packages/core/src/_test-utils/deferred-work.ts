import { after } from "next/server";
import { vi } from "vitest";

export function runDeferredWork(): () => Promise<void> {
  const pending: Promise<unknown>[] = [];

  vi.mocked(after).mockImplementation((task) => {
    pending.push(typeof task === "function" ? Promise.resolve(task()) : task);
  });

  return async () => {
    await Promise.all(pending.splice(0));
  };
}
