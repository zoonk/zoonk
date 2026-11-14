import { tabStorage } from "../_utils/device-storage";

/*
 * "Back" uses the Navigation API, so the page returns as the learner left it; browsers without it
 * follow the back link's address.
 */

/** Tab-scoped marks survive the router's history.replaceState and a reload. */
const APP_ENTRIES_KEY = "zoonk-app-entries";

const markReaders = new Set<() => void>();

function getMarks(): Record<string, unknown> {
  const marks = tabStorage.getJson(APP_ENTRIES_KEY);

  return typeof marks === "object" && marks !== null
    ? Object.fromEntries(Object.entries(marks))
    : {};
}

function getAppMark(entry: NavigationHistoryEntry | null) {
  const mark = entry ? getMarks()[entry.key] : null;

  if (
    !entry?.url ||
    typeof mark !== "object" ||
    mark === null ||
    !("path" in mark) ||
    mark.path !== getPathname(entry.url)
  ) {
    return null;
  }

  return mark;
}

function getNavigation(): Navigation | null {
  const { navigation } = globalThis as Partial<Pick<Window, "navigation">>;
  return navigation?.currentEntry ? navigation : null;
}

function isAppEntry(entry: NavigationHistoryEntry): boolean {
  return getAppMark(entry) !== null;
}

function getPathAndSearch(url: string): string {
  const { pathname, search } = new URL(url, globalThis.location.href);
  return `${pathname}${search}`;
}

function getPathname(url: string): string {
  return new URL(url, globalThis.location.href).pathname;
}

function getAppSection(entry: NavigationHistoryEntry | null): string | undefined {
  const mark = getAppMark(entry);
  return mark && "section" in mark && typeof mark.section === "string" ? mark.section : undefined;
}

function isOtherAppPage({
  entry,
  here,
  section,
}: {
  entry: NavigationHistoryEntry;
  here: string;
  section?: string;
}): boolean {
  return (
    entry.url !== null &&
    isAppEntry(entry) &&
    getPathname(entry.url) !== here &&
    !(section !== undefined && getAppSection(entry) === section)
  );
}

function writeCurrentMark(fields: { name?: string; section?: string }): void {
  const navigation = getNavigation();
  const entry = navigation?.currentEntry;

  if (!(navigation && entry?.url)) {
    return;
  }

  const kept = new Set(navigation.entries().map((item) => item.key));
  const marks = Object.fromEntries(Object.entries(getMarks()).filter(([key]) => kept.has(key)));
  const path = getPathname(entry.url);
  const current = getAppMark(entry) ?? {};

  tabStorage.set(
    APP_ENTRIES_KEY,
    JSON.stringify({ ...marks, [entry.key]: { ...current, ...fields, path } }),
  );

  for (const read of markReaders) {
    read();
  }
}

/**
 * The page marks its section after the bars first read history, so until then nothing can tell
 * which earlier pages share it: the readers keep the server's answer.
 */
function getMarkedEntry(navigation: Navigation | null): NavigationHistoryEntry | null {
  const entry = navigation?.currentEntry ?? null;
  return entry && isAppEntry(entry) ? entry : null;
}

/** The host calls it on each app page, grouping a section's pages by `section`. */
export function markAppEntry(section?: string): void {
  writeCurrentMark({ section });
}

/** A page's bar names its entry, so a back link that returns to it can say where it goes. */
export function nameAppEntry(name: string): void {
  writeCurrentMark({ name });
}

/** Returns whether it went back; otherwise the link navigates. */
export function goBackTo(href: string): boolean {
  const navigation = getNavigation();
  const index = navigation?.currentEntry?.index ?? 0;
  const previous = index > 0 ? navigation?.entries()[index - 1] : null;

  if (!previous?.url || getPathAndSearch(previous.url) !== getPathAndSearch(href)) {
    return false;
  }

  globalThis.history.back();
  return true;
}

/** False without the Navigation API. */
export function cameFromApp(): boolean {
  const navigation = getNavigation();
  const current = getMarkedEntry(navigation);
  const index = current?.index ?? 0;
  const previous = index > 0 ? navigation?.entries()[index - 1] : null;
  const section = getAppSection(current);

  return previous
    ? isAppEntry(previous) && !(section !== undefined && getAppSection(previous) === section)
    : false;
}

export function subscribeToHistory(onChange: () => void): () => void {
  const navigation = getNavigation();
  const controller = new AbortController();

  const notify = () => {
    /** Next writes history during an insertion effect; notify React after that commit. */
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        onChange();
      }
    });
  };

  navigation?.addEventListener("currententrychange", notify, { signal: controller.signal });
  markReaders.add(notify);
  controller.signal.addEventListener("abort", () => markReaders.delete(notify));
  return () => controller.abort();
}

function findAppEntryBehind(navigation: Navigation | null): NavigationHistoryEntry | undefined {
  const index = navigation?.currentEntry?.index ?? 0;
  const entries = navigation?.entries().slice(0, index) ?? [];
  const here = getPathname(globalThis.location.href);
  const section = getAppSection(navigation?.currentEntry ?? null);

  return entries.findLast((candidate) => isOtherAppPage({ entry: candidate, here, section }));
}

/**
 * The name of the page `goBackToApp` returns to: null when it returns to none (the link goes to
 * its own page), and an empty string when that page's bar gave no name, so the link never shows
 * another page's.
 */
export function appBackName(): string | null {
  const navigation = getNavigation();

  if (!getMarkedEntry(navigation)) {
    return null;
  }

  const mark = getAppMark(findAppEntryBehind(navigation) ?? null);

  if (!mark) {
    return null;
  }

  return "name" in mark && typeof mark.name === "string" ? mark.name : "";
}

/** Returns whether it found an app page; otherwise the link goes to its default. */
export function goBackToApp(): boolean {
  const navigation = getNavigation();
  const entry = findAppEntryBehind(navigation);

  if (!(navigation && entry)) {
    return false;
  }

  // A traversal the router cuts short has nothing left to do: the page it lands on is current.
  const traversal = navigation.traverseTo(entry.key);
  traversal.committed?.catch(() => null);
  traversal.finished?.catch(() => null);
  return true;
}
