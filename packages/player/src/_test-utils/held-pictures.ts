import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    answerPicture: (name: string) => Promise<void>;
  }
}

/** A picture whose file loads only once `answer` is called, so a test sees the screen before it. */
export function heldPicture(name: string) {
  return { answer: () => commands.answerPicture(name), url: `/__held-pictures/${name}` };
}
