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
import { Button, buttonVariants } from "./button";
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

// Its glyph's ink ends on the bar's edge.
const END_TOGGLE_CLASS = cn(
  buttonVariants({ edge: "end", size: "icon-bar", variant: "ghost" }),
  "shrink-0 [--glyph-blank:2]",
);

type SidebarToggleProps = { className?: string; collapseLabel: string; expandLabel: string } & (
  | { side: "end" }
  /** The row's visible words while the sidebar is open. */
  | { children: React.ReactNode; side?: "start" }
);

/** What the toggle is on either side: its name, its key and the state it saves. */
function useSidebarToggle({
  collapseLabel,
  expandLabel,
  side,
}: Pick<SidebarToggleProps, "collapseLabel" | "expandLabel"> & { side: SidebarSide }) {
  const ref = useRef<HTMLButtonElement>(null);
  const collapsed = useSidebarCollapsed(side);

  useEffect(() => (ref.current ? registerToggle(ref.current, side) : undefined), [side]);

  return {
    collapsed,
    label: collapsed ? expandLabel : collapseLabel,
    toggleProps: {
      "aria-keyshortcuts": shortcutKeys("sidebar"),
      "data-side": side,
      "data-slot": "sidebar-toggle",
      onClick: () => toggleSidebar(side),
      ref,
    },
  };
}

/**
 * Collapses and expands the sidebar on its side, and answers ⌘B and Ctrl+B while it's drawn, so a
 * screen gets the shortcut by drawing the toggle. The glyph, the name, the keycap on hover and the
 * saved state are the same on both sides; its box follows where it sits:
 * - `start`: a row of the sidebar's footer, like the items beside it, so its glyph holds one spot
 *   at both widths. Open, it shows its words; collapsed, its icon.
 * - `end`: a header's icon button.
 */
export function SidebarToggle(props: SidebarToggleProps) {
  const side = props.side ?? "start";
  const { className, collapseLabel, expandLabel } = props;

  const { collapsed, label, toggleProps } = useSidebarToggle({ collapseLabel, expandLabel, side });

  if (props.side === "end") {
    return (
      <ShortcutTooltip align="end" label={label} shortcut="sidebar" side="bottom">
        <button className={cn(END_TOGGLE_CLASS, className)} type="button" {...toggleProps}>
          <PanelRightIcon aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      </ShortcutTooltip>
    );
  }

  // Open, the name sits over the row's start, by the pointer; collapsed, beside the icon like the others.
  return (
    <ShortcutTooltip
      align={collapsed ? "center" : "start"}
      label={label}
      shortcut="sidebar"
      side={collapsed ? "right" : "top"}
    >
      <button
        aria-label={label}
        className={cn(SIDEBAR_ITEM_CLASS, className)}
        type="button"
        {...toggleProps}
      >
        <PanelLeftIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{props.children}</span>
      </button>
    </ShortcutTooltip>
  );
}

/**
 * The end toggle's box, kept in a bar that draws the toggle elsewhere; with `children` (a loading
 * placeholder) it shows them in that box.
 */
export function SidebarToggleRoom({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(END_TOGGLE_CLASS, !children && "invisible", className)}
      data-slot="sidebar-toggle-room"
    >
      {children}
    </span>
  );
}

/** Opens the app's command palette, which answers ⌘K and Ctrl+K itself. */
export function SidebarSearch({
  className,
  label,
  onClick,
}: {
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <SidebarTooltip
      label={
        <>
          {label}
          <TooltipKbd shortcut="search" />
        </>
      }
    >
      <button
        aria-haspopup="dialog"
        aria-keyshortcuts={shortcutKeys("search")}
        className={cn(
          "text-faint ring-input hover:text-foreground focus-visible:ring-ring/50 hit-area relative flex w-full items-center gap-2 ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px]",
          "sidebar-collapsed:text-muted-foreground sidebar-collapsed:ring-0 hover:bg-muted/60 text-compact h-9 gap-2.5 rounded-lg px-2",
          SIDEBAR_ICON_ONLY_CLASS,
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
    </SidebarTooltip>
  );
}

/**
 * The bar's search icon where there is no sidebar: it opens the same palette as `SidebarSearch`.
 * Beside a tab bar's tabs it is `outline`, so it never reads as the current tab's soft fill.
 */
export function BarSearch({
  className,
  edge,
  label,
  onClick,
  variant = "ghost",
}: {
  className?: string;
  edge?: "start" | "end";
  label: string;
  onClick: () => void;
  variant?: "ghost" | "outline";
}) {
  return (
    <Button
      aria-haspopup="dialog"
      aria-keyshortcuts={shortcutKeys("search")}
      className={className}
      edge={edge}
      onClick={onClick}
      size="icon-bar"
      variant={variant}
    >
      <SearchIcon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
