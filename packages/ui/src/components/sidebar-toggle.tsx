"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { ShortcutKbd, TooltipKbd } from "@zoonk/ui/components/kbd";
import { ShortcutTooltip } from "@zoonk/ui/components/shortcut-tooltip";
import { TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { isApplePlatform } from "@zoonk/ui/hooks/shortcut-label";
import { SHORTCUTS, shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { PanelLeftIcon, PanelRightIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { POPUP_SELECTOR } from "../hooks/_utils/screen-shortcut";
import { buttonVariants } from "./button";
import {
  SIDEBAR_ICON_ONLY_CLASS,
  SIDEBAR_ITEM_CLASS,
  SIDEBAR_STATE,
  type SidebarSide,
} from "./sidebar";

/** Tailwind's `lg`, where a sidebar on either side shows. */
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

function isCollapsed(side: SidebarSide) {
  return document.documentElement.hasAttribute(SIDEBAR_STATE[side].attribute);
}

/** True while that side's sidebar shows, collapsed. */
function useSidebarCollapsed(side: SidebarSide): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isSidebarShown() && isCollapsed(side),
    () => false,
  );
}

/**
 * True while that side's sidebar shows, open. False on the server and while hydrating, so layout
 * stays in CSS (`sidebar-collapsed`, `with-aside`); use it only for behavior.
 */
export function useSidebarOpen(side: SidebarSide): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isSidebarShown() && !isCollapsed(side),
    () => false,
  );
}

function toggleSidebar(side: SidebarSide) {
  const { attribute, key } = SIDEBAR_STATE[side];
  const collapsed = document.documentElement.toggleAttribute(attribute);

  try {
    localStorage.setItem(key, String(collapsed));
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
  const collapsed = useSidebarCollapsed("start");

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
    !(SHORTCUTS.sidebar.keys as readonly string[]).includes(event.key.toLowerCase()) ||
    !(event.metaKey || event.ctrlKey) ||
    event.shiftKey ||
    event.altKey ||
    event.isComposing ||
    event.defaultPrevented ||
    target?.isContentEditable ||
    target?.closest(POPUP_SELECTOR)
  ) {
    return false;
  }

  const inField = target?.matches("input, textarea, select") ?? false;

  return !(inField && event.ctrlKey && isApplePlatform());
}

/** The toggles on the page, the start side's first: with one on each side, ⌘B is the start's. */
const toggles: { button: HTMLButtonElement; side: SidebarSide }[] = [];

function isDrawn(button: HTMLButtonElement): boolean {
  return button.getClientRects().length > 0;
}

// Held down, the key toggles once and its repeats don't reach the browser's own Ctrl+B.
function onToggleKey(event: KeyboardEvent) {
  const toggle = toggles.find(({ button }) => isDrawn(button));

  if (!toggle || !isToggleShortcut(event)) {
    return;
  }

  event.preventDefault();

  if (!event.repeat) {
    toggleSidebar(toggle.side);
  }
}

function registerToggle(button: HTMLButtonElement, side: SidebarSide) {
  const toggle = { button, side };

  if (toggles.length === 0) {
    globalThis.addEventListener("keydown", onToggleKey);
  }

  toggles.push(toggle);
  toggles.sort((a, b) => Number(a.side === "end") - Number(b.side === "end"));

  return () => {
    toggles.splice(toggles.indexOf(toggle), 1);

    if (toggles.length === 0) {
      globalThis.removeEventListener("keydown", onToggleKey);
    }
  };
}

const TOGGLE = {
  // Its glyph's ink ends on the bar's edge.
  end: {
    Icon: PanelRightIcon,
    className: cn(
      buttonVariants({ edge: "end", size: "icon", variant: "ghost" }),
      "shrink-0 [--glyph-blank:2] [--icon-size:--spacing(5)]",
    ),
    tooltipSide: "bottom",
  },
  // A sidebar item's square: its glyph ends where the items' counts and keycaps end.
  start: {
    Icon: PanelLeftIcon,
    className: cn(SIDEBAR_ITEM_CLASS, "w-8 shrink-0 justify-center px-0"),
    tooltipSide: "right",
  },
} as const;

/**
 * Collapses and expands the sidebar on its side, and answers ⌘B and Ctrl+B while it's drawn, so a
 * screen gets the shortcut by drawing the toggle. Its box follows its bar (a sidebar item at the
 * start, a header's icon button at the end); the glyph, the name, the keycap and the saved state
 * are the same.
 */
export function SidebarToggle({
  className,
  collapseLabel,
  expandLabel,
  side = "start",
}: {
  className?: string;
  collapseLabel: string;
  expandLabel: string;
  side?: SidebarSide;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const label = useSidebarCollapsed(side) ? expandLabel : collapseLabel;
  const { Icon, className: sideClass, tooltipSide } = TOGGLE[side];

  useEffect(() => (ref.current ? registerToggle(ref.current, side) : undefined), [side]);

  return (
    <ShortcutTooltip
      align={side === "end" ? "end" : "center"}
      label={label}
      shortcut="sidebar"
      side={tooltipSide}
    >
      <button
        aria-keyshortcuts={shortcutKeys("sidebar")}
        className={cn(sideClass, className)}
        data-side={side}
        data-slot="sidebar-toggle"
        onClick={() => toggleSidebar(side)}
        ref={ref}
        type="button"
      >
        <Icon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
    </ShortcutTooltip>
  );
}

const SEARCH_CLASS = {
  bar: "h-11 rounded-lg px-3 text-sm hover:bg-muted/60",
  sidebar: cn(
    "sidebar-collapsed:text-muted-foreground sidebar-collapsed:ring-0 hover:bg-muted/60 text-compact h-9 gap-2.5 rounded-lg px-2",
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
  const button = (
    <button
      aria-keyshortcuts={shortcutKeys("search")}
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
      <ShortcutKbd shortcut="search" />
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
          <TooltipKbd shortcut="search" />
        </>
      }
    >
      {button}
    </SidebarTooltip>
  );
}
