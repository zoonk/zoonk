import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type NavigationMeasurement, judgeNavigation } from "./navigation-checks.mts";
import { type RequestRecord } from "./requests.mts";

const SLOW_RESPONSE_MS = 600;
const SLOW_CONTENT_MS = 1500;

function requestTo(path: string, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    headers: {},
    method: "GET",
    resourceType: "fetch",
    url: `http://localhost:3000${path}`,
    ...overrides,
  };
}

const navigation: NavigationMeasurement = {
  arrived: true,
  blankSeenMs: null,
  commitMs: 40,
  console: [],
  contentMs: 400,
  flashes: 0,
  fullLoad: false,
  linkFound: true,
  mode: "prefetched",
  pageErrors: [],
  production: true,
  requests: [],
  responseMs: 40,
  settled: true,
  shifts: [],
  skeletonSeenMs: null,
  usedPrefetch: true,
};

/** What judging the navigation with these changes finds, as "level check". */
function judged(overrides: Partial<NavigationMeasurement>): string[] {
  return judgeNavigation({ ...navigation, ...overrides }).map(
    (finding) => `${finding.level} ${finding.check}`,
  );
}

describe("judging a navigation", () => {
  it("reports content that never appeared after the URL committed", () => {
    assert.deepEqual(judged({ contentMs: null, skeletonSeenMs: 200 }), ["warn tap content"]);
    assert.deepEqual(judged({ contentMs: null, production: false }), []);
  });

  it("passes a prefetched page that appears at once", () => {
    assert.deepEqual(judgeNavigation(navigation), []);
  });

  it("allows skeletons, fails a slow switch, and asks about a missing link", () => {
    const slow = judgeNavigation({ ...navigation, commitMs: 1500, skeletonSeenMs: 30 });

    assert.deepEqual(
      slow.map((finding) => `${finding.level} ${finding.check}`),
      ["fail navigation"],
    );

    assert.equal(judgeNavigation({ ...navigation, linkFound: false })[0]?.level, "warn");
  });

  it("fails a tap that never reached its page, and errors along the way", () => {
    const lost = judgeNavigation({ ...navigation, arrived: false, commitMs: null });

    assert.deepEqual(
      lost.map((finding) => `${finding.level} ${finding.check}`),
      ["fail navigation"],
    );

    const broken = judgeNavigation({
      ...navigation,
      requests: [requestTo("/plan", { headers: { rsc: "1" }, status: 500 })],
    });

    assert.deepEqual(
      broken.map((finding) => `${finding.level} ${finding.check}`),
      ["fail failed response"],
    );
  });

  it("judges how fast a tap answers and shows its page, and whether its prefetch carried it", () => {
    assert.deepEqual(judged({ responseMs: SLOW_RESPONSE_MS }), ["fail tap response"]);
    assert.deepEqual(judged({ contentMs: SLOW_CONTENT_MS }), ["warn tap content"]);
    assert.deepEqual(judged({ usedPrefetch: false }), ["warn prefetch"]);
    assert.deepEqual(judged({ mode: "noPrefetch", usedPrefetch: false }), []);
    assert.deepEqual(judged({ flashes: 1 }), ["fail flash"]);
  });

  it("fails a missing destination frame", () => {
    assert.equal(judgeNavigation({ ...navigation, commitMs: null })[0]?.check, "navigation");
  });

  it("fails a blank painted frame", () => {
    assert.equal(judgeNavigation({ ...navigation, blankSeenMs: 40 })[0]?.check, "blank frame");
  });

  it("asks about a tap that loaded a whole new document", () => {
    const full = judgeNavigation({ ...navigation, fullLoad: true });

    assert.deepEqual(
      full.map((finding) => finding.check),
      ["full page load"],
    );
  });
});
