"use client";

import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { useCallback, useMemo, useState } from "react";
import { ContentFeedbackContext } from "./feedback-context";
import { type ContentFeedbackAdapters, type FeedbackFormRequest } from "./feedback-contract";
import { useScreenKeysPause } from "./use-screen-keys-pause";

const feedbackForm = createOnDemand(() => import("./feedback-form-dialog"));

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
    if (open) {
      void feedbackForm.load();
    }

    setOpenMenus((current) => {
      const others = current.filter((id) => id !== menuId);
      return open ? [...others, menuId] : others;
    });
  }, []);

  return { anyMenuOpen: openMenus.length > 0, setMenuOpen };
}

/**
 * Keep `adapters` stable. The form lives here, outside any menu, so it stays open after the menu
 * that opened it closes.
 */
export function ContentFeedbackProvider({
  adapters,
  children,
}: {
  adapters: ContentFeedbackAdapters;
  children: React.ReactNode;
}) {
  const [formRequest, setFormRequest] = useState<FeedbackFormRequest | null>(null);
  const opened = useOpenedOnce(formRequest !== null);
  const FeedbackFormDialog = feedbackForm.useModule({ enabled: opened })?.FeedbackFormDialog;
  const { anyMenuOpen, setMenuOpen } = useOpenMenus();

  useScreenKeysPause(anyMenuOpen || formRequest !== null);

  const value = useMemo(
    () => ({
      adapters,
      openFeedbackForm: (request: FeedbackFormRequest) => {
        void feedbackForm.load();
        setFormRequest(request);
      },
      setMenuOpen,
    }),
    [adapters, setMenuOpen],
  );

  return (
    <ContentFeedbackContext value={value}>
      {children}
      {FeedbackFormDialog && (
        // A slow send can finish after its form was closed and another opened: it closes only its own.
        <FeedbackFormDialog
          onClose={(closed) => setFormRequest((current) => (current === closed ? null : current))}
          request={formRequest}
        />
      )}
    </ContentFeedbackContext>
  );
}
