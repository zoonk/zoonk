import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { exposureFindings } from "./exposure.mts";

const learner = { email: "v2-stocks@zoonk.test", name: "Pedro Lima" };

describe("whether someone else received the learner's page", () => {
  it("passes a login page or another learner's own page", () => {
    const body = String.raw`<h1>Sign in</h1><script>self.__next_f.push([1,"{\"name\":\"Ana Souza\"}"])</script>`;

    assert.deepEqual(exposureFindings({ body, learner, viewer: "a signed-out visitor" }), []);
  });

  it("fails when the learner's name or email arrives, even only in the page's data", () => {
    const body = String.raw`<main></main><script>self.__next_f.push([1,"{\"email\":\"v2-stocks@zoonk.test\"}"])</script>`;

    const [finding] = exposureFindings({ body, learner, viewer: "another learner" });

    assert.equal(finding?.level, "fail");
    assert.equal(finding?.message, "another learner got the learner's v2-stocks@zoonk.test");
  });
});
