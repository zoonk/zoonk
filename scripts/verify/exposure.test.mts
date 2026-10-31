import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { exposureFindings } from "./exposure.mts";

const learner = { email: "v2-stocks@zoonk.test", id: "01J9Z7Q4M3", name: "Pedro Lima" };

describe("whether someone else received the learner's page", () => {
  it("finds a name the page escaped, in its HTML or its data", () => {
    const named = { ...learner, name: "Alice & Bob" };
    const html = exposureFindings({ body: "<p>Alice &amp; Bob</p>", learner: named, viewer: "x" });

    const data = exposureFindings({
      body: String.raw`{"name":"Alice "Al" Bob"}`,
      learner: { ...named, name: 'Alice "Al" Bob' },
      viewer: "x",
    });

    assert.equal(html.length + data.length, 2);
  });

  it("doesn't take a first name in public content for the learner's", () => {
    const body = "<p>Ana paid $15.40 for two notebooks.</p>";

    assert.deepEqual(
      exposureFindings({ body, learner: { ...learner, name: "Ana" }, viewer: "x" }),
      [],
    );
  });

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
