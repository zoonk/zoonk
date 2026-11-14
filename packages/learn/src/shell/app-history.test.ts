import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appBackName,
  cameFromApp,
  goBackToApp,
  markAppEntry,
  nameAppEntry,
  subscribeToHistory,
} from "./app-history";

/** Only the browser boundary is faked: Next's replace clears an entry's Navigation API state. */
function browserHistory() {
  const entries: NavigationHistoryEntry[] = [];
  const states = new Map<string, unknown>();
  const events = new EventTarget();
  const traverseTo = vi.fn(() => ({ committed: Promise.resolve(), finished: Promise.resolve() }));

  const navigation = {
    addEventListener: events.addEventListener.bind(events),
    currentEntry: null as NavigationHistoryEntry | null,
    entries: () => entries,
    traverseTo,
    updateCurrentEntry: ({ state }: { state: unknown }) => {
      states.set(navigation.currentEntry!.key, state);
      events.dispatchEvent(new Event("currententrychange"));
    },
  };

  vi.stubGlobal("navigation", navigation);

  function open(path: string) {
    const url = new URL(path, "https://zoonk.test");
    const key = `${entries.length}`;
    const entry = { getState: () => states.get(key), index: entries.length, key, url: url.href };
    entries.push(entry as NavigationHistoryEntry);
    navigation.currentEntry = entry as NavigationHistoryEntry;
    vi.stubGlobal("location", url);
    events.dispatchEvent(new Event("currententrychange"));
    return entry;
  }

  function refresh() {
    states.delete(navigation.currentEntry!.key);
    events.dispatchEvent(new Event("currententrychange"));
  }

  return { open, refresh, traverseTo };
}

describe("app history", () => {
  beforeEach(() => {
    const values = new Map<string, string>();

    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("returns from Settings to Plan after Plan refreshed its history entry", () => {
    const history = browserHistory();
    history.open("/today");
    markAppEntry();
    const plan = history.open("/plan");
    markAppEntry();
    history.refresh();
    history.open("/settings");
    markAppEntry("(settings)");

    expect(goBackToApp()).toBe(true);
    expect(history.traverseTo).toHaveBeenCalledWith(plan.key);
  });

  it("keeps Plan's mark across a reload before opening Settings", async () => {
    const history = browserHistory();
    history.open("/today");
    markAppEntry();
    const plan = history.open("/plan");
    markAppEntry();
    history.refresh();

    vi.resetModules();
    const reloaded = await import("./app-history");
    history.open("/settings");
    reloaded.markAppEntry("(settings)");

    expect(reloaded.goBackToApp()).toBe(true);
    expect(history.traverseTo).toHaveBeenCalledWith(plan.key);
  });

  it("skips Settings' own pages when leaving the section", () => {
    const history = browserHistory();
    const plan = history.open("/plan");
    markAppEntry();
    history.open("/settings");
    markAppEntry("(settings)");
    history.refresh();
    history.open("/settings/appearance");
    markAppEntry("(settings)");

    expect(goBackToApp()).toBe(true);
    expect(history.traverseTo).toHaveBeenCalledWith(plan.key);
  });

  it("names the page leaving Settings returns to, whichever marks it first", () => {
    const history = browserHistory();
    history.open("/today");
    nameAppEntry("Today");
    markAppEntry();
    history.open("/plan");
    nameAppEntry("Plan");
    markAppEntry();
    history.open("/settings");
    markAppEntry("(settings)");
    nameAppEntry("Settings");
    history.open("/settings/appearance");
    markAppEntry("(settings)");

    expect(appBackName()).toBe("Plan");
  });

  it("keeps the server's answer until the page marks its own section, then tells its readers", async () => {
    const history = browserHistory();
    history.open("/profile");
    markAppEntry("(settings)");
    history.open("/settings/memory");
    const onChange = vi.fn();
    const unsubscribe = subscribeToHistory(onChange);
    await Promise.resolve();
    onChange.mockClear();

    expect(cameFromApp()).toBe(false);
    expect(appBackName()).toBeNull();

    markAppEntry("(settings)");
    await Promise.resolve();

    expect(onChange).toHaveBeenCalledWith();
    expect(cameFromApp()).toBe(false);
    unsubscribe();
  });

  it("says an earlier page has no name rather than giving it the link's own", () => {
    const history = browserHistory();
    history.open("/today");
    markAppEntry();
    nameAppEntry("Today");
    const privacy = history.open("/settings/privacy");
    markAppEntry("(settings)");
    history.open("/mistakes");
    markAppEntry();
    nameAppEntry("Mistakes notebook");

    expect(appBackName()).toBe("");
    expect(goBackToApp()).toBe(true);
    expect(history.traverseTo).toHaveBeenCalledWith(privacy.key);
  });

  it("has no name to give when nothing in the app came before", () => {
    const history = browserHistory();
    history.open("/settings");
    markAppEntry("(settings)");

    expect(appBackName()).toBeNull();
  });
});
