import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isBlockedFrameProbe } from "./frame-console.mts";

const NATIVE_BLOCK = {
  argumentsCount: 0,
  text: "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.",
  url: "about:srcdoc",
};

describe("script-disabled preview diagnostics", () => {
  it("omits the browser's rejection of init probes in a script-disabled srcdoc", () => {
    assert.equal(isBlockedFrameProbe(NATIVE_BLOCK), true);
  });

  it("keeps errors from the parent and console calls that imitate the native diagnostic", () => {
    assert.equal(isBlockedFrameProbe({ ...NATIVE_BLOCK, url: "http://localhost/mailbox" }), false);
    assert.equal(isBlockedFrameProbe({ ...NATIVE_BLOCK, argumentsCount: 1 }), false);
    assert.equal(isBlockedFrameProbe({ ...NATIVE_BLOCK, text: "Uncaught TypeError" }), false);
  });
});
