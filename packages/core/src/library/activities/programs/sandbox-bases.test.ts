import { describe, expect, it, vi } from "vitest";
import { SANDBOX_LANGUAGE_IDS } from "./program-languages";
import { sandboxBaseName } from "./sandbox-bases";
import type * as Wrapper from "./sandbox-wrapper";

describe(sandboxBaseName, () => {
  it("names each language's base by a hash of what the build puts in it", () => {
    const names = SANDBOX_LANGUAGE_IDS.map((language) => sandboxBaseName(language));

    expect(names.every((name) => /^code-[a-z]+-[0-9a-f]{12}$/u.test(name))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("builds a new base when the wrapper changes", async () => {
    vi.resetModules();

    vi.doMock("./sandbox-wrapper", async (original) => ({
      ...(await original<typeof Wrapper>()),
      SANDBOX_WRAPPER: "#!/bin/bash\nexit 0\n",
    }));

    const changed = await import("./sandbox-bases");

    expect(changed.sandboxBaseName("cpp")).not.toBe(sandboxBaseName("cpp"));
    vi.doUnmock("./sandbox-wrapper");
  });
});
