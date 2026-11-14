import "../styles/globals.css";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    emulateMedia: (media: { colorScheme: "dark" | "light" }) => Promise<void>;
  }
}

afterEach(async () => {
  cleanup();
  await commands.emulateMedia({ colorScheme: "light" });
});
