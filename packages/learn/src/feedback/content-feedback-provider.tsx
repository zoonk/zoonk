"use client";

import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { ContentFeedbackContext } from "./feedback-context";
import { type ContentFeedbackAdapters, type FeedbackFormRequest } from "./feedback-contract";
import { useScreenKeysPause } from "./use-screen-keys-pause";

/** The form loads the first time someone opens it, so pages where nobody writes don't ship its code. */
const FeedbackFormDialog = lazy(() =>
  import("./feedback-form-dialog").then((module) => ({ default: module.FeedbackFormDialog })),
);

export type { ContentFeedbackAdapters } from "./feedback-contract";
export { useContentFeedback } from "./feedback-context";

/** True from the first time `isOpen` is true, so a lazy part stays mounted and can animate closed. */
function useOpenedOnce(isOpen: boolean): boolean {
  const [opened, setOpened] = useState(isOpen);

  if (isOpen && !opened) {
    setOpened(true);
  }

  return opened || isOpen;
}

/** Which report menus are open, so the screen under them can pause its keys. */
function useOpenMenus() {
  const [openMenus, setOpenMenus] = useState<readonly string[]>([]);

  const setMenuOpen = useCallback(({ menuId, open }: { menuId: string; open: boolean }) => {
    setOpenMenus((current) => {
      const others = current.filter((id) => id !== menuId);
      return open ? [...others, menuId] : others;
    });
  }, []);

  return { anyMenuOpen: openMenus.length > 0, setMenuOpen };
}

/**
 * Makes feedback available to every screen below it: "Report a problem" in screen menus and the
 * message form. The form lives here, outside any menu, so it stays open after the menu that opened
 * it closes. While a report menu or the form is open, the screen's own keys pause. Keep `adapters`
 * stable.
 */
export function ContentFeedbackProvider({
  adapters,
  children,
}: {
  adapters: ContentFeedbackAdapters;
  children: React.ReactNode;
}) {
  const [formRequest, setFormRequest] = useState<FeedbackFormRequest | null>(null);
  const showFeedbackForm = useOpenedOnce(formRequest !== null);
  const { anyMenuOpen, setMenuOpen } = useOpenMenus();

  useScreenKeysPause(anyMenuOpen || formRequest !== null);

  const value = useMemo(
    () => ({ adapters, openFeedbackForm: setFormRequest, setMenuOpen }),
    [adapters, setMenuOpen],
  );

  return (
    <ContentFeedbackContext value={value}>
      {children}
      {showFeedbackForm && (
        <Suspense fallback={null}>
          <FeedbackFormDialog onClose={() => setFormRequest(null)} request={formRequest} />
        </Suspense>
      )}
    </ContentFeedbackContext>
  );
}
