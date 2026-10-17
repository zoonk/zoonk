import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeCover, loadPage, settle, stubPage, tagOf } from "./_test-utils/learner-page";

const first = tagOf("first");
const second = tagOf("second");

/** A page drawn for the first learner, in a browser holding their session. */
async function openPage() {
  const browser = stubPage({ hint: first, seeded: false });

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Promise<never>(() => {})),
  );

  const page = await loadPage();

  page.identity.registerIdentityCover({
    cover: fakeCover(),
    handoff: { seen: first, witnesses: [first] },
  });

  const { deliveredForThisLearner } = await import("./delivered-for-this-learner");
  return { browser, deliveredForThisLearner };
}

describe("a request's answer delivered to the page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the learner who asked", async () => {
    const { deliveredForThisLearner } = await openPage();

    await expect(
      deliveredForThisLearner(Promise.resolve(["Order a coffee"])),
    ).resolves.toStrictEqual(["Order a coffee"]);
  });

  it("reaches nothing when another learner's session lands before it arrives", async () => {
    const { browser, deliveredForThisLearner } = await openPage();
    const answer = Promise.withResolvers<string[]>();

    const delivered = deliveredForThisLearner(answer.promise);

    // Another tab signs in while the answer is on its way: the cookie changes with no event
    // delivered to this page.
    await settle();
    browser.setHint(second);
    answer.resolve(["Order a coffee"]);

    await expect(delivered).resolves.toBeNull();
  });
});
