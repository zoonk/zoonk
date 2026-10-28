import { describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { runProgram } from "../activities/_sandbox/run-program";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    sandboxSession: (action: "start" | "stop") => Promise<string>;
  }
}

describe("sandbox session isolation", () => {
  it("learner JavaScript cannot import the page's cookie-protected session", async () => {
    const url = await commands.sandboxSession("start");

    try {
      const response = await fetch(url);
      await expect(response.json()).resolves.toStrictEqual({ token: "private-session-token" });

      const run = await runProgram({
        code: `
        try {
          const session = await import(${JSON.stringify(url)}, { with: { type: "json" } });
          console.log(session.default.token);
        } catch {
          console.log("session isolated");
        }
      `,
        language: "javascript",
      });

      expect(run.stop).toBe("done");
      expect(run.output).toBe("session isolated\n");
    } finally {
      await commands.sandboxSession("stop");
    }
  });
});
