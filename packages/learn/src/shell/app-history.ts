/**
 * "Back" uses the browser's own history (the Navigation API), so it returns where the learner
 * came from with the page as they left it, instead of adding another entry. Browsers without the
 * API follow the back link's address instead.
 */

/** Marks a history entry as one of the app's pages (a tab or a page pushed from one). */
const APP_ENTRY_STATE = { zoonkAppPage: true } as const;

function getNavigation(): Navigation | null {
  const { navigation } = globalThis as Partial<Pick<Window, "navigation">>;
  return navigation?.currentEntry ? navigation : null;
}

function isAppEntry(entry: NavigationHistoryEntry): boolean {
  const state: unknown = entry.getState();
  return typeof state === "object" && state !== null && "zoonkAppPage" in state;
}

function getPathAndSearch(url: string): string {
  const { pathname, search } = new URL(url, globalThis.location.href);
  return `${pathname}${search}`;
}

function getPathname(url: string): string {
  return new URL(url, globalThis.location.href).pathname;
}

function getAppSection(entry: NavigationHistoryEntry | null): string | undefined {
  const state: unknown = entry?.getState();

  if (typeof state !== "object" || state === null || !("zoonkAppSection" in state)) {
    return undefined;
  }

  return typeof state.zoonkAppSection === "string" ? state.zoonkAppSection : undefined;
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

type AppEntryMark = { path: string; state: typeof APP_ENTRY_STATE & { zoonkAppSection?: string } };

/**
 * The host's marks by history entry. The router writes each render of a page (a refresh, a Server
 * Action's answer) into its entry with `history.replaceState`, which clears the entry's Navigation
 * API state: a Plan that read itself again on the way back was no longer a page to go back to. An
 * entry keeps its key through those writes, so its mark goes back on as each write happens, before
 * anything reads it, while the entry is still at the page it marked.
 */
const marks = new Map<string, AppEntryMark>();
let keepingMarks = false;

function keepMarks(navigation: Navigation): void {
  if (keepingMarks) {
    return;
  }

  keepingMarks = true;

  navigation.addEventListener("currententrychange", () => {
    const entry = navigation.currentEntry;
    const mark = entry ? marks.get(entry.key) : undefined;

    if (entry?.url && mark && !isAppEntry(entry) && getPathname(entry.url) === mark.path) {
      navigation.updateCurrentEntry({ state: mark.state });
    }
  });
}

/** Called by the host on each app page; the host groups pages that belong to one section. */
export function markAppEntry(section?: string): void {
  const navigation = getNavigation();
  const entry = navigation?.currentEntry;

  if (!(navigation && entry?.url)) {
    return;
  }

  const state = { ...APP_ENTRY_STATE, ...(section !== undefined && { zoonkAppSection: section }) };
  const kept = new Set(navigation.entries().map((item) => item.key));

  // A new page drops the entries ahead of it from the history, so their marks go too.
  for (const key of marks.keys()) {
    if (!kept.has(key)) {
      marks.delete(key);
    }
  }

  marks.set(entry.key, { path: getPathname(entry.url), state });
  keepMarks(navigation);
  navigation.updateCurrentEntry({ state });
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
