import { tmpdir } from "node:os";
import { expect, test } from "vitest";
import giveTestRunItsOwnTempFolder from "./test-temp-folder.mts";

test("sets up again after a teardown, as a restarted watch run does", () => {
  const before = tmpdir();

  giveTestRunItsOwnTempFolder()();
  giveTestRunItsOwnTempFolder()();

  expect(tmpdir()).toBe(before);
});
