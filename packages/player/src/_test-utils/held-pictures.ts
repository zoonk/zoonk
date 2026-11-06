import { expect } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    answerPicture: (path: string) => Promise<void>;
    holdPictures: () => Promise<void>;
  }
}

const PROBE_ANSWERED = 204;

async function isHeld(path: string): Promise<boolean> {
  const response = await fetch(`${path}?probe`, { cache: "no-store" });
  return response.status === PROBE_ANSWERED;
}

/** A picture whose file loads only once `answer` is called, so a test sees the screen before it. */
export async function heldPicture() {
  const path = `/held-pictures/${crypto.randomUUID()}.png`;
  await commands.holdPictures();

  // A new route isn't always active at once (vitest-dev/vitest#8339).
  await expect.poll(() => isHeld(path)).toBe(true);

  return { answer: () => commands.answerPicture(path), url: path };
}
