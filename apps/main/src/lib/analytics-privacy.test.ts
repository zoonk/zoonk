import { afterEach, describe, expect, it, vi } from "vitest";
import {
  filterPostHogEvent,
  filterPrivateTelemetryEvent,
  filterVercelEvent,
  hasPrivateLearningUrl,
} from "./analytics-privacy";

function page(url: string) {
  vi.stubGlobal("location", { href: url });
}

describe("private learning analytics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "/b/me/c/a-private-brief/ch/a/lesson",
    "/pt/b/me/c/a-private-brief",
    "/pt-BR/start/discovery/request-id",
    "/start/learn/a%20personal%20request",
    "/tracks/private-track",
    "/my",
    "/profile/interests",
    "/b/zoonk/c/physics/start",
    "/b/zoonk/c/physics/preferences",
    "/generate/curriculum/private-course-id",
    "/login?next=%2Fpt%2Fb%2Fme%2Fc%2Fprivate",
    "/login?next=%252Fstart%252Fdiscovery%252Fprivate",
    "/login?next=%2Fb%2Fme%2Fc%2Fprivate%25",
  ])("recognizes private URLs including localized and nested return paths: %s", (url) => {
    expect(hasPrivateLearningUrl(`https://zoonk.com${url}`)).toBe(true);
  });

  it("keeps public catalog and explicit lesson events measurable", () => {
    const event = {
      event: "Lesson Completed",
      properties: { $current_url: "https://zoonk.com/b/zoonk/c/physics", courseSlug: "physics" },
      uuid: "12345678-1234-1234-1234-123456789012",
    };

    expect(filterPostHogEvent(event)).toStrictEqual(event);

    expect(
      filterVercelEvent({ type: "pageview", url: event.properties.$current_url }),
    ).not.toBeNull();
  });

  it("drops private page events even when their explicit properties omit the route", () => {
    page("https://zoonk.com/start/discovery/private");

    expect(
      filterPostHogEvent({
        event: "Clicked",
        properties: { answer: "private answer" },
        uuid: "12345678-1234-1234-1234-123456789012",
      }),
    ).toBeNull();

    expect(filterVercelEvent({ type: "event", url: "https://zoonk.com/" })).toBeNull();
  });

  it("redacts private attribution carried into subsequent public PostHog events", () => {
    page("https://zoonk.com/b/zoonk/c/physics");

    const result = filterPostHogEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://zoonk.com/b/zoonk/c/physics",
        $referrer: "https://zoonk.com/b/me/c/private-title",
        $set_once: { $initial_current_url: "https://zoonk.com/start/discovery/private" },
      },
      uuid: "12345678-1234-1234-1234-123456789012",
    });

    expect(JSON.stringify(result)).not.toContain("private-title");
    expect(result?.properties.$set_once).toStrictEqual({ $initial_current_url: "[private]" });
  });

  it("drops Vercel events with a private document referrer, which its callback cannot rewrite", () => {
    vi.stubGlobal("document", { referrer: "https://zoonk.com/b/me/c/private-title" });
    expect(filterVercelEvent({ type: "pageview", url: "https://zoonk.com/" })).toBeNull();
  });

  it("drops private traces and breadcrumbs while preserving unrelated diagnostics", () => {
    expect(
      filterPrivateTelemetryEvent({ breadcrumbs: [{ data: { url: "/b/me/c/private" } }] }),
    ).toBeNull();

    expect(
      filterPrivateTelemetryEvent({ request: { url: "https://zoonk.com/b/zoonk/c/physics" } }),
    ).not.toBeNull();

    page("https://zoonk.com/start/discovery/private");
    expect(filterPrivateTelemetryEvent({ message: "private answer" })).toBeNull();
  });
});
