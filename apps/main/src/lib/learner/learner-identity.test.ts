import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerFor,
  fakeCover,
  loadPage,
  resetCall,
  settle,
  stubPage,
  stubReads,
  summaryOf,
  tagOf,
} from "./_test-utils/learner-page";

/** How long this tab's own check of who holds the session may take. */
const CHECK_MS = 8000;

const first = tagOf("first");
const second = tagOf("second");
const guest = tagOf("guest");

/** What the hint said when the page was parsed, by the bootstrap's grammar. */
function seenOf(hint: string | null): string | null | undefined {
  if (hint === "0") {
    return null;
  }

  return hint?.startsWith("t1.") ? hint : undefined;
}

/**
 * A page parsed with the hint `seen` and the private witnesses `witnesses`, in a browser whose hint
 * is now `hint`, with its cover module registered. What registration drew is left out of `calls`.
 */
async function openPage({
  hint,
  seen = seenOf(hint),
  witnesses = [],
}: {
  hint: string | null;
  seen?: string | null;
  witnesses?: string[];
}) {
  const browser = stubPage({ hint, seeded: false });
  const reads = stubReads();
  const page = await loadPage();
  const cover = fakeCover();

  page.identity.registerIdentityCover({ cover, handoff: { seen, witnesses } });
  const registered = [...cover.calls];
  cover.calls.length = 0;

  return { ...page, browser, cover, reads, registered };
}

describe("the page's identity", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("a page drawn for a learner", () => {
    it("reloads at once, with nothing read, when another tab signs in as someone else", async () => {
      const { browser, cover, identity, reads } = await openPage({ hint: first });

      browser.setHint(second);
      browser.cookieChange();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
      expect(identity.checkIdentity()).toBe(false);
      expect(reads.sessions).toHaveLength(0);
      expect(reads.summaries).toHaveLength(0);
    });

    it("reloads when another tab signs the learner out", async () => {
      const { browser, cover } = await openPage({ hint: first });

      browser.setHint("0");
      browser.focus();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: null })]);
    });

    it("never comes back once it saw another learner, even when the first one is back", async () => {
      const { browser, cover, identity } = await openPage({ hint: first });

      browser.setHint(second);
      browser.wake();
      browser.setHint(first);
      browser.show();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
      expect(identity.checkIdentity()).toBe(false);
    });

    it("goes on when the same learner signs in again", async () => {
      const { browser, cover, identity } = await openPage({ hint: first });

      browser.setHint(first);
      browser.cookieChange();
      browser.focus();

      expect(cover.calls).toStrictEqual([]);
      expect(identity.checkIdentity()).toBe(true);
    });

    it("leaves on its return when the server ended the session a late renewal put back", async () => {
      const { browser, cover, identity, reads } = await openPage({ hint: first });

      // Signed out elsewhere, then an old response renewed the learner's cookies and hint together,
      // before this tab heard of either.
      browser.setHint("0");
      browser.setHint(first);
      browser.show();

      // The return check doesn't cover: the page goes on while it's out.
      expect(reads.sessions).toHaveLength(1);
      expect(identity.checkIdentity()).toBe(true);

      reads.sessions[0]?.resolve(null);
      await settle();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: null })]);
    });

    it("leaves when only the window regains focus after the server ended the session", async () => {
      const { browser, cover, reads } = await openPage({ hint: first });

      browser.focus();
      expect(reads.sessions).toHaveLength(1);

      reads.sessions[0]?.resolve(null);
      await settle();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: null })]);
    });

    it("checks the session once for a return's focus, show and restore together", async () => {
      const { browser, reads } = await openPage({ hint: first });

      browser.focus();
      browser.show();
      browser.restore();

      expect(reads.sessions).toHaveLength(1);
    });

    it("checks once per return, and a check that fails changes nothing", async () => {
      const { browser, cover, identity, reads } = await openPage({ hint: first });

      browser.show();
      browser.restore();
      expect(reads.sessions).toHaveLength(1);

      reads.sessions[0]?.reject(new Error("offline"));
      await settle();

      expect(cover.calls).toStrictEqual([]);
      expect(identity.checkIdentity()).toBe(true);
    });

    it("asks nothing on the return of a page drawn for nobody", async () => {
      const { browser, reads } = await openPage({ hint: "0" });

      browser.show();

      expect(reads.sessions).toHaveLength(0);
    });
  });

  describe("output revealed or shown again later", () => {
    it("reloads before a late private part rendered for someone else paints", async () => {
      const { browser, cover, identity } = await openPage({ hint: first });

      // Another tab switched to second; this tab heard nothing yet when second's part arrives.
      browser.setHint(second);
      identity.noteWitness(second);

      expect(cover.calls).toStrictEqual([
        resetCall({ contaminated: true, from: first, to: second }),
      ]);
    });

    it("reloads before a late part rendered for the learner paints once the session is someone else's", async () => {
      const { browser, cover, identity } = await openPage({ hint: first });

      browser.setHint(second);
      identity.noteWitness(first);

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
    });

    it("reloads a page the router kept for the learner when it's shown again for someone else", async () => {
      const { browser, cover, identity } = await openPage({ hint: first, witnesses: [first] });

      browser.hide();
      browser.setHint(second);

      // The kept page becomes active again: its witness speaks before it paints.
      identity.noteWitness(first);

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
    });

    it("never draws a summary read that found someone else: the page leaves", async () => {
      const { cover, reads, store } = await openPage({ hint: first });

      store.ensureLearnerSummary();
      reads.summaries[0]?.resolve(answerFor(summaryOf("second")));
      await settle();

      expect(cover.calls).toStrictEqual([
        resetCall({ contaminated: true, from: first, to: first }),
      ]);

      expect(store.getHeldLearnerId()).toBeUndefined();
    });

    it("asks the server, without covering, when a summary read found nobody", async () => {
      const { cover, reads, store } = await openPage({ hint: first });

      store.ensureLearnerSummary();
      reads.summaries[0]?.resolve({ readAt: Date.now(), status: "visitor" });
      await settle();

      expect(cover.calls).toStrictEqual([]);
      expect(reads.sessions).toHaveLength(1);

      reads.sessions[0]?.resolve(null);
      await settle();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: null })]);
    });

    it("asks the server once, never leaving, when a page held for nobody keeps a session hint the summary denies", async () => {
      const { cover, reads, store } = await openPage({ hint: "1" });

      store.ensureLearnerSummary();
      reads.summaries[0]?.resolve({ readAt: Date.now(), status: "visitor" });
      await settle();

      // Only Better Auth's own answer can clear a hint left without a session.
      expect(reads.sessions).toHaveLength(1);

      reads.sessions[0]?.resolve(null);
      await settle();

      expect(cover.calls).toStrictEqual([]);
      expect(store.getHeldLearnerId()).toBeNull();
    });
  });

  describe("a hint that stops naming the page's learner", () => {
    it("covers while the server says who holds the session, and uncovers for the learner", async () => {
      const { browser, cover, identity, reads } = await openPage({ hint: first });

      browser.setHint(null);
      browser.focus();

      expect(cover.calls).toStrictEqual(["cover"]);
      expect(identity.checkIdentity()).toBe(false);
      expect(reads.sessions).toHaveLength(1);

      reads.sessions[0]?.resolve(first);
      await settle();

      expect(cover.calls).toStrictEqual(["cover", "uncover"]);
      expect(identity.checkIdentity()).toBe(true);
      expect(reads.sessions).toHaveLength(1);
    });

    it("leaves when the server names someone else", async () => {
      const { browser, cover, reads } = await openPage({ hint: first });

      browser.setHint(null);
      browser.focus();
      reads.sessions[0]?.resolve(second);
      await settle();

      expect(cover.calls).toStrictEqual(["cover", resetCall({ from: first, to: second })]);
    });

    it("says it couldn't check after ≈8 s, and shows the check again before Try again asks", async () => {
      const { browser, cover, reads } = await openPage({ hint: first });

      browser.setHint(null);
      browser.focus();
      vi.advanceTimersByTime(CHECK_MS);

      expect(cover.calls).toStrictEqual(["cover", "coverFailed"]);

      cover.retry();

      expect(cover.calls).toStrictEqual(["cover", "coverFailed", "cover"]);
      expect(reads.sessions).toHaveLength(2);

      reads.sessions[1]?.resolve(first);
      await settle();

      expect(cover.calls.at(-1)).toBe("uncover");
    });

    it("asks again when the browser is back online after a failed check", async () => {
      const { browser, cover, reads } = await openPage({ hint: first });

      browser.setHint(null);
      browser.focus();
      reads.sessions[0]?.reject(new Error("offline"));
      await settle();
      vi.advanceTimersByTime(CHECK_MS);

      browser.online();

      expect(cover.calls).toStrictEqual(["cover", "coverFailed", "cover"]);
      expect(reads.sessions).toHaveLength(2);
    });

    it("covers nothing for a hint from before tags, and asks on the page's return", async () => {
      const { browser, cover, identity, reads, registered } = await openPage({
        hint: "1",
        witnesses: [first],
      });

      expect(registered).toStrictEqual(["uncover"]);
      expect(identity.checkIdentity()).toBe(true);

      browser.show();
      reads.sessions[0]?.resolve(second);
      await settle();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
    });
  });

  describe("this tab's own auth change", () => {
    it("leaves the page as it was when its sign-out fails", async () => {
      const { browser, cover, identity } = await openPage({ hint: first });
      const told = browser.posted.length;

      const change = identity.beginLocalAuthChange();
      change.release();

      expect(cover.calls).toStrictEqual([]);
      expect(browser.posted).toHaveLength(told);
      expect(identity.checkIdentity()).toBe(true);
    });

    it("covers a page it signed out of and tells the other tabs, never reloading on the way out", async () => {
      const { browser, cover, identity } = await openPage({ hint: first });
      const told = browser.posted.length;

      const change = identity.beginLocalAuthChange();
      browser.setHint("0");

      expect(change.complete({ actor: null, tag: null })).toBe(true);
      expect(cover.calls).toStrictEqual(["cover"]);
      expect(browser.posted).toHaveLength(told + 1);

      change.release();

      // The hint's own change event arrives while the page leaves: still no reload.
      browser.cookieChange();
      expect(cover.calls).toStrictEqual(["cover"]);

      // Still here once the check's time is up (central sign-out failed): it says so, and Try
      // again shows the check before the page reloads signed out.
      vi.advanceTimersByTime(CHECK_MS);
      cover.retry();

      expect(cover.calls).toStrictEqual([
        "cover",
        "coverFailed",
        "cover",
        resetCall({ from: first, to: null }),
      ]);
    });

    it("doesn't go on as its guest when another learner signed in before the guest's answer", async () => {
      const { browser, identity } = await openPage({ hint: "0" });
      const redraw = vi.fn();
      identity.onLearnerIdentityChange(redraw);

      const change = identity.beginLocalAuthChange();
      browser.setHint(second);

      // The other tab's sign-in is heard while the guest's own is out: no alarm yet.
      browser.cookieChange();

      expect(change.complete({ actor: "guest", tag: guest })).toBe(false);

      change.release();

      // The page drew nobody: it reads itself again, softly, for the learner who signed in.
      expect(redraw).toHaveBeenCalledOnce();
      expect(identity.checkIdentity()).toBe(true);
    });

    it("goes on as its own guest without reading the page again, then reads the next page once", async () => {
      const { browser, identity } = await openPage({ hint: "0" });
      const redraw = vi.fn();
      identity.onLearnerIdentityChange(redraw);

      const change = identity.beginLocalAuthChange();
      browser.setHint(guest);

      expect(change.complete({ actor: "guest", tag: guest })).toBe(true);

      change.release();

      expect(redraw).not.toHaveBeenCalled();
      expect(identity.takeOwnGuestPageRead()).toBe(false);

      browser.goTo("/start/goal");

      expect(identity.takeOwnGuestPageRead()).toBe(true);
      expect(identity.takeOwnGuestPageRead()).toBe(false);
    });

    it("leaves a guest's page when another learner signs in after it", async () => {
      const { browser, cover, identity } = await openPage({ hint: "0" });

      const change = identity.beginLocalAuthChange();
      browser.setHint(guest);
      change.complete({ actor: "guest", tag: guest });
      change.release();

      browser.setHint(second);
      browser.cookieChange();

      expect(cover.calls).toStrictEqual([resetCall({ from: guest, to: second })]);
    });

    it("leaves when someone else's private part arrives during its guest sign-in", async () => {
      const { browser, cover, identity } = await openPage({ hint: "0" });

      const change = identity.beginLocalAuthChange();
      identity.noteWitness(second);
      browser.setHint(guest);

      expect(change.complete({ actor: "guest", tag: guest })).toBe(false);

      change.release();

      expect(cover.calls).toStrictEqual([resetCall({ from: second, to: guest })]);
    });
  });

  describe("this tab's own auth change, still out", () => {
    it("refuses input, moves and writes once another tab changed the session, and leaves at release", async () => {
      const { browser, cover, identity, views } = await openPage({ hint: first });
      const change = identity.beginLocalAuthChange();
      const write = vi.fn(async () => "saved");

      expect(identity.checkIdentity()).toBe(true);

      // The sign-out is still out when another tab signs in as someone else.
      browser.setHint(second);
      browser.cookieChange();

      expect(identity.checkIdentity()).toBe(false);
      await expect(views.withLearnerWrite(write)).rejects.toThrow();
      expect(write).not.toHaveBeenCalled();
      expect(cover.calls).toStrictEqual([]);

      // The sign-out failed: the page drew the first learner and the browser holds the second.
      change.release();

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
    });

    it("says it couldn't check when the central sign-out hangs after the app's succeeded", async () => {
      const { browser, cover, identity } = await openPage({ hint: first });
      const change = identity.beginLocalAuthChange();

      browser.setHint("0");
      change.complete({ actor: null, tag: null });
      vi.advanceTimersByTime(CHECK_MS);

      expect(cover.calls).toStrictEqual(["cover", "coverFailed"]);
    });
  });

  describe("answers arriving after the session changed", () => {
    it("never takes a goal switch's summary once the session changed while it was out", async () => {
      const { browser, cover, reads, store } = await openPage({ hint: first });

      store.ensureLearnerSummary();
      reads.summaries[0]?.resolve(answerFor(summaryOf("first", "old-goal")));
      await settle();

      const generation = store.getLearnerGeneration();
      browser.setHint(second);
      store.mergeLearnerSummary({ generation, summary: summaryOf("first", "new-goal") });

      expect(store.getLearnerSummaryState()).toMatchObject({
        summary: { activeGoalId: "old-goal" },
      });

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
    });

    it("never delivers a write's answer once the session changed while it was out", async () => {
      const { browser, cover, views } = await openPage({ hint: first });
      const answer = Promise.withResolvers<string>();
      const written = views.withLearnerWrite(() => answer.promise);

      browser.setHint(second);
      answer.resolve("saved");

      await expect(written).rejects.toThrow();
      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
    });
  });

  describe("writes", () => {
    it("sends nothing once the session changed while the caller awaited", async () => {
      const { browser, cover, views } = await openPage({ hint: first });
      const write = vi.fn(async () => "saved");

      // The action's adapter awaited something; another tab switched to second meanwhile.
      browser.setHint(second);

      await expect(views.withLearnerWrite(write)).rejects.toThrow();
      expect(write).not.toHaveBeenCalled();
      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
    });
  });

  describe("the cover module's registration", () => {
    it("takes the page's parse-time witnesses for two learners as a page drawn for two", async () => {
      const { registered } = await openPage({ hint: first, witnesses: [first, second] });

      expect(registered).toStrictEqual([resetCall({ contaminated: true, from: first, to: first })]);
    });

    it("takes the cover off a page whose parse-time witnesses agree with the hint", async () => {
      const { registered } = await openPage({ hint: first, witnesses: [first] });

      expect(registered).toStrictEqual(["uncover"]);
    });

    it("draws a departure decided before the cover module registered", async () => {
      const browser = stubPage({ hint: second, seeded: false });
      stubReads();
      const { identity } = await loadPage();
      const cover = fakeCover();

      identity.noteWitness(first);
      identity.registerIdentityCover({ cover, handoff: { seen: second, witnesses: [] } });

      expect(cover.calls).toStrictEqual([resetCall({ from: first, to: second })]);
      expect(browser.posted).toContainEqual({ channel: "zoonk-learner", data: { check: true } });
    });
  });
});
