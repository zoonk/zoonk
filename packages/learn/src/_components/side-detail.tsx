"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { PageSectionTitle } from "./page";

/**
 * A detail's place from `xl`, for whoever has a session: over the section's aside, as wide as it,
 * its action at the foot level with the page's bar. Anywhere else it is drawn where it stands.
 */
export const SIDE_DETAIL_PLACE_CLASS = cn(
  "contents xl:in-data-signed-in:fixed xl:in-data-signed-in:inset-y-0 xl:in-data-signed-in:right-0 xl:in-data-signed-in:z-40",
  "xl:in-data-signed-in:flex xl:in-data-signed-in:w-[calc(20rem-1px)] xl:in-data-signed-in:flex-col xl:in-data-signed-in:overflow-y-auto",
  "xl:in-data-signed-in:bg-background xl:in-data-signed-in:px-frame xl:in-data-signed-in:pt-3 xl:in-data-signed-in:[--page-bottom:0px] xl:in-data-signed-in:[--page-dock:0px]",
);

/** The aside's own content steps out while a detail is over it (`in-data-side-detail`). */
const OPEN_ATTRIBUTE = "data-side-detail";

const SIDE_COLUMN_QUERY = "(min-width: 80rem)";

function subscribe(callback: () => void) {
  const query = globalThis.matchMedia(SIDE_COLUMN_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Whether a detail has the aside to open over; false on the server, where a detail never opens. */
export function useSideColumn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      globalThis.matchMedia(SIDE_COLUMN_QUERY).matches &&
      Object.hasOwn(document.documentElement.dataset, "signedIn"),
    () => false,
  );
}

/** A small form opened beside the row it changes, where `useSideColumn` says there is room. */
export function SideDetail({
  children,
  footer,
  onClose,
  title,
}: {
  children: React.ReactNode;
  /** Its action, at the column's foot. */
  footer: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  const t = useExtracted();
  const closeRef = useEscapeClick<HTMLButtonElement>();
  const paneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute(OPEN_ATTRIBUTE, true);
    paneRef.current?.focus();

    return () => {
      root.toggleAttribute(OPEN_ATTRIBUTE, false);
    };
  }, []);

  return (
    <section
      aria-label={title}
      className={cn(SIDE_DETAIL_PLACE_CLASS, "outline-none")}
      data-slot="settings-detail"
      ref={paneRef}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-2">
        <PageSectionTitle>{title}</PageSectionTitle>
        <Button
          aria-label={t("Close")}
          className="edge"
          onClick={onClose}
          ref={closeRef}
          size="icon-bar"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-5 pt-3 pb-6">{children}</div>

      <BottomBar>
        <BottomBarActions>{footer}</BottomBarActions>
      </BottomBar>
    </section>
  );
}
