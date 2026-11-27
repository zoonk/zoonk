import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    serveLocalRuntimes: () => Promise<void>;
  }
}

export function serveLocalRuntimes() {
  return commands.serveLocalRuntimes();
}
