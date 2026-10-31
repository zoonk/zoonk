"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { Kbd } from "@zoonk/ui/components/kbd";
import { TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { isApplePlatform, useShortcutLabel } from "@zoonk/ui/hooks/shortcut-label";
import { cn } from "@zoonk/ui/lib/utils";
import { PanelLeftIcon, SearchIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { POPUP_SELECTOR } from "../hooks/_utils/screen-shortcut";
import {
  SIDEBAR_COLLAPSED_ATTRIBUTE,
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_ICON_ONLY_CLASS,
  SIDEBAR_ITEM_CLASS,
} from "./sidebar";

/** Tailwind's `lg`, where `Sidebar` shows. */
const SIDEBAR_SHOWN_QUERY = "(min-width: 64rem)";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  const shown = globalThis.matchMedia(SIDEBAR_SHOWN_QUERY);
  listeners.add(listener);
  shown.addEventListener("change", listener);

  return () => {
    listeners.delete(listener);
    shown.removeEventListener("change", listener);
  };
}

function isSidebarShown() {
  return globalThis.matchMedia(SIDEBAR_SHOWN_QUERY).matches;
}

function isCollapsed() {
  return document.documentElement.hasAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE) && isSidebarShown();
}

/** True while the sidebar shows, collapsed to icons. */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, isCollapsed, () => false);
}

function toggleSidebar() {
  const collapsed = document.documentElement.toggleAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE);

  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Blocked storage (a private window) keeps the choice until the page reloads.
  }

  for (const listener of listeners) {
    listener();
  }
}

/**
 * Names an item beside it while the sidebar shows only icons. It shares `Sidebar`'s delay, so
 * passing over the column shows nothing and the next icon's name follows at once.
 */
export function SidebarTooltip({
  children,
  label,
}: {
  children: React.ReactElement;
  label: React.ReactNode;
}) {
  const collapsed = useSidebarCollapsed();

  return (
    <TooltipPrimitive.Root disabled={!collapsed}>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </TooltipPrimitive.Root>
  );
}

/**
 * Taken by an editor, inside a menu or dialog, mid-composition, or Ctrl+B in a field on an Apple
 * keyboard (where it moves the caret back), it isn't the sidebar's.
 */
function isToggleShortcut(event: KeyboardEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null;

  if (
    event.key.toLowerCase() !== "b" ||
    !(event.metaKey || event.ctrlKey) ||
    event.shiftKey ||
    event.altKey ||
    event.isComposing ||
    event.defaultPrevented ||
    target?.isContentEditable ||
    target?.closest(POPUP_SELECTOR) ||
    !isSidebarShown()
  ) {
    return false;
  }

  const inField = target?.matches("input, textarea, select") ?? false;

  return !(inField && event.ctrlKey && isApplePlatform());
}

/** Place one per page, inside `Sidebar`: it also answers ⌘B and Ctrl+B. */
export function SidebarToggle({
  collapseLabel,
  expandLabel,
}: {
  collapseLabel: string;
  expandLabel: string;
}) {
  const shortcut = useShortcutLabel("B");
  const label = useSidebarCollapsed() ? expandLabel : collapseLabel;

  useEffect(() => {
    // Held down, the key toggles once and its repeats don't reach the browser's own Ctrl+B.
    function onKeyDown(event: KeyboardEvent) {
      if (!isToggleShortcut(event)) {
        return;
      }

      event.preventDefault();

      if (!event.repeat) {
        toggleSidebar();
      }
    }

    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <TooltipPrimitive.Root>
      <TooltipTrigger
        aria-keyshortcuts="Meta+B Control+B"
        className={cn(SIDEBAR_ITEM_CLASS, "w-8 shrink-0 justify-center px-0")}
        onClick={toggleSidebar}
        type="button"
      >
        <PanelLeftIcon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>

      <TooltipContent side="right">
        {label}
        <Kbd className="ml-2">{shortcut}</Kbd>
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}

const SEARCH_CLASS = {
  bar: "h-10 rounded-[0.625rem] px-3 text-sm hover:bg-muted/60",
  sidebar: cn(
    "sidebar-collapsed:text-muted-foreground sidebar-collapsed:ring-0 hover:bg-muted/60 h-8 rounded-lg px-2.5 text-[0.8125rem]",
    SIDEBAR_ICON_ONLY_CLASS,
  ),
} as const;

/** Opens the app's command palette, which answers ⌘K and Ctrl+K itself. */
export function SidebarSearch({
  className,
  label,
  onClick,
  placement = "sidebar",
}: {
  className?: string;
  label: string;
  onClick: () => void;
  placement?: keyof typeof SEARCH_CLASS;
}) {
  const shortcut = useShortcutLabel("K");

  const button = (
    <button
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "text-faint ring-input hover:text-foreground focus-visible:ring-ring/50 hit-area relative flex w-full items-center gap-2 ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px]",
        SEARCH_CLASS[placement],
        className,
      )}
      onClick={(event) => {
        event.currentTarget.focus();
        onClick();
      }}
      type="button"
    >
      <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      <Kbd aria-hidden="true" className="hidden pointer-fine:inline-flex">
        {shortcut}
      </Kbd>
    </button>
  );

  if (placement === "bar") {
    return button;
  }

  return (
    <SidebarTooltip
      label={
        <>
          {label}
          <Kbd className="ml-2">{shortcut}</Kbd>
        </>
      }
    >
      {button}
    </SidebarTooltip>
  );
}
