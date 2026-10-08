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

/** Called by the host on each of the app's pages, so a section knows where to go back to. */
export function markAppEntry(): void {
  getNavigation()?.updateCurrentEntry({ state: APP_ENTRY_STATE });
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
 * Leaves a section (settings, statistics, the catalog) for the last app page the learner was on
 * before it, however many of the section's pages they went through. Returns whether it found one;
 * otherwise the link goes to its default.
 */
export function goBackToApp(): boolean {
  const navigation = getNavigation();
  const index = navigation?.currentEntry?.index ?? 0;
  const entries = navigation?.entries().slice(0, index) ?? [];
  const entry = entries.findLast((candidate) => isAppEntry(candidate));

  if (!(navigation && entry)) {
    return false;
  }

  // A traversal the router cuts short has nothing left to do: the page it lands on is current.
  const traversal = navigation.traverseTo(entry.key);
  traversal.committed?.catch(() => null);
  traversal.finished?.catch(() => null);
  return true;
}
