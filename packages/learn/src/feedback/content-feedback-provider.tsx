"use client";

import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { ContentFeedbackContext } from "./feedback-context";
import { type ContentFeedbackAdapters, type FeedbackFormRequest } from "./feedback-contract";
import { useScreenKeysPause } from "./use-screen-keys-pause";

const FeedbackFormDialog = lazy(() =>
  import("./feedback-form-dialog").then((module) => ({ default: module.FeedbackFormDialog })),
);

export type { ContentFeedbackAdapters } from "./feedback-contract";
export { useContentFeedback } from "./feedback-context";

function useOpenedOnce(isOpen: boolean): boolean {
  const [opened, setOpened] = useState(isOpen);

  if (isOpen && !opened) {
    setOpened(true);
  }

  return opened || isOpen;
}

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

/** Keep `adapters` stable. The form lives here, outside any menu, so it stays open after the menu that opened it closes. */
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
