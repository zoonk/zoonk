import { heldJsonAnswer } from "@/lib/api/_test-utils/held-answer";
import {
  fakeCover,
  loadPage,
  settle,
  stubPage,
  tagOf,
} from "@/lib/learner/_test-utils/learner-page";
import { afterEach, describe, expect, it, vi } from "vitest";

const first = tagOf("first");
const second = tagOf("second");

const URL = "/api/learner/courses/course/progress";
const KEY = `first signed-in ${URL}`;
const PROGRESS = { followsCourse: true, lessonStarted: true };

/**
 * A catalog page the first learner's summary keyed, in a browser holding their session, whose
 * progress read answers with `answer`. The app's other reads stay out.
 */
async function openCatalogPage(answer: Response) {
  const browser = stubPage({ hint: first, seeded: false });

  const fetched = vi.fn(async (url: string) =>
    url === URL ? answer : new Promise<never>(() => {}),
  );

  vi.stubGlobal("fetch", fetched);
  const page = await loadPage();

  page.identity.registerIdentityCover({
    cover: fakeCover(),
    handoff: { seen: first, witnesses: [first] },
  });

  const reads = await import("./course-progress-reads");
  const changed = vi.fn();
  reads.subscribeToCourseProgress(changed);

  return { browser, changed, fetched, reads };
}

describe("a catalog page's own progress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the learner who asked", async () => {
    const { changed, reads } = await openCatalogPage(Response.json(PROGRESS));

    await reads.readCourseProgress({ key: KEY, url: URL });

    expect(reads.getCourseProgress(KEY)).toStrictEqual(PROGRESS);
    expect(changed).toHaveBeenCalledOnce();
  });

  it("keeps nothing when another learner's session lands while its body is read", async () => {
    const answer = heldJsonAnswer(PROGRESS);
    const { browser, changed, fetched, reads } = await openCatalogPage(answer.response);

    const read = reads.readCourseProgress({ key: KEY, url: URL });

    // The answer is in and its body is being read when another tab signs in: the cookie changes
    // with no event delivered to this page.
    await vi.waitFor(() => {
      expect(fetched).toHaveBeenCalledWith(URL, expect.anything());
    });

    await settle();
    browser.setHint(second);
    answer.finish();
    await read;

    expect(reads.getCourseProgress(KEY)).toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });

  it("sends nothing once the browser holds someone else, so their answer isn't kept as this learner's", async () => {
    const { browser, fetched, reads } = await openCatalogPage(Response.json(PROGRESS));

    browser.setHint(second);
    await reads.readCourseProgress({ key: KEY, url: URL });

    expect(fetched).not.toHaveBeenCalledWith(URL, expect.anything());
    expect(reads.getCourseProgress(KEY)).toBeNull();
  });
});
