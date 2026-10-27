import { tabStorage } from "../_utils/device-storage";

/**
 * "Back" uses the browser's own history (the Navigation API), so it returns where the learner
 * came from with the page as they left it, instead of adding another entry. Browsers without the
 * API follow the back link's address instead.
 */

/** Tab-scoped marks survive the router's history.replaceState and a reload. */
const APP_ENTRIES_KEY = "zoonk-app-entries";

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

/** One of the app's pages outside this section or page, whose own views (tabs) don't count. */
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

/** Called by the host on each app page; the host groups pages that belong to one section. */
export function markAppEntry(section?: string): void {
  const navigation = getNavigation();
  const entry = navigation?.currentEntry;

  if (!(navigation && entry?.url)) {
    return;
  }

  const kept = new Set(navigation.entries().map((item) => item.key));
  const marks = Object.fromEntries(Object.entries(getMarks()).filter(([key]) => kept.has(key)));

  tabStorage.set(
    APP_ENTRIES_KEY,
    JSON.stringify({ ...marks, [entry.key]: { path: getPathname(entry.url), section } }),
  );
}

/**
 * Goes back one entry when it's the page a back link leads to (`href`, as the link resolved it),
 * so the page comes back as it was. Returns whether it did; otherwise the link navigates.
 */
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

/**
 * Whether the page before this one is one of the app's, not another page of the section: a page
 * under a section's hub opened straight from the app (Plus from a locked exam task) goes back
 * there. False without the Navigation API.
 */
export function cameFromApp(): boolean {
  const navigation = getNavigation();
  const index = navigation?.currentEntry?.index ?? 0;
  const previous = index > 0 ? navigation?.entries()[index - 1] : null;
  const section = getAppSection(navigation?.currentEntry ?? null);

  return previous
    ? isAppEntry(previous) && !(section !== undefined && getAppSection(previous) === section)
    : false;
}

/** Calls `onChange` when the current history entry changes, for a bar that reads `cameFromApp`. */
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
  return () => controller.abort();
}

/**
 * Leaves a section (settings, statistics, the catalog), or a page the sidebar lists (the mistakes
 * notebook), for the last app page the learner was on before it, however many of the section's
 * pages or of the page's own views (the notebook's tabs) they went through. Returns whether it
 * found one; otherwise the link goes to its default.
 */
export function goBackToApp(): boolean {
  const navigation = getNavigation();
  const index = navigation?.currentEntry?.index ?? 0;
  const entries = navigation?.entries().slice(0, index) ?? [];
  const here = getPathname(globalThis.location.href);
  const section = getAppSection(navigation?.currentEntry ?? null);

  const entry = entries.findLast((candidate) =>
    isOtherAppPage({ entry: candidate, here, section }),
  );

  if (!(navigation && entry)) {
    return false;
  }

  // A traversal the router cuts short has nothing left to do: the page it lands on is current.
  const traversal = navigation.traverseTo(entry.key);
  traversal.committed?.catch(() => null);
  traversal.finished?.catch(() => null);
  return true;
}
