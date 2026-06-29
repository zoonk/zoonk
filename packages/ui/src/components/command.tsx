"use client";

import {
  Autocomplete,
  type AutocompleteCollectionProps,
  type AutocompleteEmptyProps,
  type AutocompleteGroupLabelProps,
  type AutocompleteGroupProps,
  type AutocompleteInputProps,
  type AutocompleteItemProps,
  type AutocompleteListProps,
} from "@base-ui/react/autocomplete";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@zoonk/ui/components/dialog";
import {
  ScrollAreaContent,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@zoonk/ui/components/scroll-area";
import { cn } from "@zoonk/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import type * as React from "react";

const Command = Autocomplete.Root;

/**
 * CommandDialog provides the Base UI dialog structure used by command palettes:
 * backdrop, visual viewport positioning, and a popup that keeps scrolling inside
 * the palette on iOS.
 */
function CommandDialog({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Dialog> & { className?: string; children: React.ReactNode }) {
  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50" />
        <DialogViewport className="flex items-start justify-center px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-fine:pt-[20vh]">
          <DialogPopup
            className={cn(
              "ring-foreground/5 bg-popover text-popover-foreground w-full max-w-xl overflow-hidden rounded-4xl p-1 shadow-lg ring-1 pointer-fine:max-h-[calc(100dvh-20vh-2rem)]",
              className,
            )}
          >
            {children}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * CommandDialogTitle keeps the accessible dialog title in the DOM without
 * adding visible chrome above the command input.
 */
function CommandDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn("sr-only", className)} {...props} />;
}

/**
 * CommandDialogDescription keeps the accessible dialog description in the DOM
 * without adding visible text that duplicates the command input placeholder.
 */
function CommandDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription className={cn("sr-only", className)} {...props} />;
}

/**
 * CommandInput matches the Base UI autocomplete demo: the input is focused when
 * the dialog opens and keeps a 16px mobile font size to avoid iOS Safari zoom.
 */
function CommandInput({ className, ...props }: AutocompleteInputProps) {
  return (
    <div className="p-1 pb-0" data-slot="command-input-wrapper">
      <div className="bg-input/30 flex h-9 items-center gap-2 rounded-full px-3">
        <SearchIcon aria-hidden="true" className="text-muted-foreground size-4" />
        <Autocomplete.Input
          autoFocus
          className={cn(
            "placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
            className,
          )}
          data-slot="command-input"
          {...props}
        />
      </div>
    </div>
  );
}

/**
 * CommandList follows Base UI's ScrollArea structure while overriding the
 * content's fit-content width because command results should only scroll
 * vertically and truncate long labels horizontally.
 */
function CommandList({ children, className, ...props }: Omit<AutocompleteListProps, "render">) {
  return (
    <ScrollAreaRoot
      className="h-[min(var(--total-height,18rem),18rem)] max-h-[calc(100dvh-8rem)]"
      data-slot="command-scroll-area"
    >
      <ScrollAreaViewport>
        <ScrollAreaContent style={{ minWidth: 0 }}>
          <Autocomplete.List
            className={cn("flex flex-col gap-1 p-1 outline-none", className)}
            data-slot="command-list"
            {...props}
          >
            {children}
          </Autocomplete.List>
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar>
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
  );
}

/**
 * CommandEmpty must stay mounted for Base UI's live-region announcements, so
 * the default styles remove it from layout when Base UI renders no children.
 */
function CommandEmpty({ className, ...props }: AutocompleteEmptyProps) {
  return (
    <Autocomplete.Empty
      className={cn("py-6 text-center text-sm empty:sr-only empty:p-0", className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

/**
 * CommandGroup scopes a set of related command items and passes the group's
 * items to Base UI's collection renderer for keyboard navigation order.
 */
function CommandGroup({ className, ...props }: AutocompleteGroupProps) {
  return (
    <Autocomplete.Group
      className={cn("text-foreground w-full max-w-full min-w-0 overflow-hidden p-1", className)}
      data-slot="command-group"
      {...props}
    />
  );
}

/**
 * CommandGroupLabel provides the accessible and visual label for a command
 * group without coupling group layout to a heading prop.
 */
function CommandGroupLabel({ className, ...props }: AutocompleteGroupLabelProps) {
  return (
    <Autocomplete.GroupLabel
      className={cn("text-muted-foreground px-3 py-2 text-xs font-medium", className)}
      data-slot="command-group-label"
      {...props}
    />
  );
}

/**
 * CommandCollection renders the filtered items from the nearest command group
 * or root, letting consumers choose their own item contents.
 */
function CommandCollection({ ...props }: AutocompleteCollectionProps) {
  return <Autocomplete.Collection {...props} />;
}

/**
 * CommandItem delegates pointer and keyboard activation to Base UI while
 * keeping the compact command-row styling shared across apps.
 */
function CommandItem({ className, ...props }: AutocompleteItemProps) {
  return (
    <Autocomplete.Item
      className={cn(
        "group/command-item relative flex w-full max-w-full min-w-0 cursor-default items-center gap-2 overflow-hidden rounded-2xl px-3 py-2 text-sm outline-hidden select-none",
        "data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="command-item"
      {...props}
    />
  );
}

/**
 * CommandShortcut gives command rows a consistent trailing shortcut treatment
 * when an app wants to show keyboard accelerators.
 */
function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

export {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogDescription,
  CommandDialogTitle,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
};
