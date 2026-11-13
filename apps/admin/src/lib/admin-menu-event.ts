const OPEN_ADMIN_MENU_EVENT = "zoonk:open-admin-menu";

/** A page's bar asks for the menu; the layout, which holds the account and the counts, opens it. */
export function openAdminMenu() {
  globalThis.dispatchEvent(new Event(OPEN_ADMIN_MENU_EVENT));
}

export function listenForAdminMenuOpen(open: () => void): () => void {
  globalThis.addEventListener(OPEN_ADMIN_MENU_EVENT, open);
  return () => globalThis.removeEventListener(OPEN_ADMIN_MENU_EVENT, open);
}
