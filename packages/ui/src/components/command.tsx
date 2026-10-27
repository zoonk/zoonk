"use client";

import {
  Autocomplete,
  type AutocompleteCollectionProps,
  type AutocompleteGroupLabelProps,
  type AutocompleteGroupProps,
  type AutocompleteInputProps,
  type AutocompleteItemProps,
  type AutocompleteListProps,
} from "@base-ui/react/autocomplete";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@zoonk/ui/components/dialog";
import { Kbd } from "@zoonk/ui/components/kbd";
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
 * CommandDialog provides the Base UI dialog structure used by command palettes. On a phone it's
 * the whole screen, from the top, with the keyboard up; from `sm` it's a card high on the page,
 * over a light dim (a darker one in dark mode, where a light one doesn't read), casting the one
 * soft shadow overlays have.
 */
function CommandDialog({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Dialog> & { className?: string; children: React.ReactNode }) {
  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay className="bg-black/15 supports-backdrop-filter:backdrop-blur-none dark:bg-black/50" />
        <DialogViewport className="flex items-start justify-center sm:px-4 sm:pt-[12vh] sm:pb-4">
          <DialogPopup
            className={cn(
              "flex h-dvh w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)]",
              "sm:bg-popover sm:text-popover-foreground sm:ring-input sm:max-w-column sm:h-auto sm:max-h-[calc(100dvh-12vh-1rem)] sm:rounded-xl sm:pt-0 sm:shadow-[0_16px_48px_-12px_rgb(0_0_0/0.35)] sm:ring-1 sm:ring-inset",
              // On the dark dim the panel's edge carries its lift: a brighter hairline and a deeper
              // shadow. Its surface stays the popover's, a step under the highlighted row's.
              "sm:dark:ring-foreground/20 sm:dark:shadow-[0_24px_64px_-12px_rgb(0_0_0/0.8)]",
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
 * The field, focused when the dialog opens. On a phone it's a 44px field where the search field the
 * learner tapped was, with the way out beside it (`cancelLabel`, the caller's translated "Cancel");
 * from `sm` it's the card's 52px top row, with Escape's keycap where there's a keyboard. Its text
 * stays 16px on phones so iOS Safari doesn't zoom in.
 */
function CommandInput({
  cancelLabel,
  className,
  ...props
}: AutocompleteInputProps & { cancelLabel?: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 pt-2.5 pb-2 sm:border-b sm:p-0"
      data-slot="command-input-wrapper"
    >
      <div className="ring-input focus-within:ring-foreground flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[0.625rem] px-3 ring-[1.5px] ring-inset sm:h-13 sm:rounded-none sm:px-4 sm:ring-0 sm:focus-within:ring-0">
        <SearchIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        <Autocomplete.Input
          autoFocus
          className={cn(
            "placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[0.9375rem]",
            className,
          )}
          data-slot="command-input"
          {...props}
        />
        <Kbd aria-hidden="true" className="hidden sm:pointer-fine:inline-flex">
          Esc
        </Kbd>
      </div>

      {cancelLabel && (
        <DialogClose className="hit-area focus-visible:ring-ring/50 relative shrink-0 rounded-md text-sm font-medium outline-none focus-visible:ring-[3px] sm:hidden">
          {cancelLabel}
        </DialogClose>
      )}
    </div>
  );
}

/**
 * The results, scrolling vertically only (long labels truncate). From `sm` the list is as tall as
 * its results, up to `min(60vh, 28rem)`, so one result doesn't sit in an empty box; on a phone it
 * takes the rest of the screen.
 */
function CommandList({ children, className, ...props }: Omit<AutocompleteListProps, "render">) {
  return (
    <ScrollAreaRoot
      className="flex min-h-0 flex-1 flex-col sm:flex-none"
      data-slot="command-scroll-area"
    >
      <ScrollAreaViewport className="sm:max-h-[min(60vh,28rem)]">
        <ScrollAreaContent style={{ minWidth: 0 }}>
          <Autocomplete.List
            className={cn(
              "flex flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] outline-none sm:gap-1 sm:p-1.5",
              className,
            )}
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
 * CommandGroup scopes a set of related command items and passes the group's
 * items to Base UI's collection renderer for keyboard navigation order.
 */
function CommandGroup({ className, ...props }: AutocompleteGroupProps) {
  return (
    <Autocomplete.Group
      className={cn("text-foreground w-full max-w-full min-w-0 overflow-hidden sm:p-1", className)}
      data-slot="command-group"
      {...props}
    />
  );
}

/**
 * A group's name: a section label over hairline rows on a phone, a quiet line from `sm`.
 */
function CommandGroupLabel({ className, ...props }: AutocompleteGroupLabelProps) {
  return (
    <Autocomplete.GroupLabel
      className={cn(
        "text-faint pt-3.5 pb-1.5 text-[0.71875rem] font-[550] tracking-[0.04em] uppercase sm:px-2.5 sm:pt-2 sm:pb-1 sm:tracking-normal sm:normal-case",
        className,
      )}
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
 * One row: a 44px row with a hairline above it on a phone, a quiet rounded row from `sm`. Base UI owns
 * pointer and keyboard activation. With a keyboard at hand, the highlighted row ends with ⏎, the
 * key that runs it; a row's label takes the room (`flex-1`), so what ends a row sits at its end.
 */
function CommandItem({ className, ...props }: AutocompleteItemProps) {
  return (
    <Autocomplete.Item
      className={cn(
        "group/command-item border-border relative flex min-h-11 w-full max-w-full min-w-0 cursor-default items-center gap-3 overflow-hidden border-t py-2 text-sm outline-hidden select-none sm:rounded-lg sm:border-t-0 sm:px-2.5",
        "sm:data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        "pointer-fine:data-highlighted:after:ring-input pointer-fine:data-highlighted:after:text-muted-foreground max-sm:after:hidden pointer-fine:data-highlighted:after:ml-auto pointer-fine:data-highlighted:after:rounded-[0.3125rem] pointer-fine:data-highlighted:after:px-1 pointer-fine:data-highlighted:after:font-mono pointer-fine:data-highlighted:after:text-[0.6875rem] pointer-fine:data-highlighted:after:ring-1 pointer-fine:data-highlighted:after:content-['⏎']",
        "[&>svg]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="command-item"
      {...props}
    />
  );
}

/**
 * The keys the palette answers to, under its list where there's a keyboard: the caller lays out
 * its translated hints ("↑ ↓ move · ⏎ open · Esc close") with `Kbd`.
 */
function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "text-faint hidden h-9 shrink-0 items-center gap-3.5 border-t px-3.5 text-[0.71875rem] sm:pointer-fine:flex [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1",
        className,
      )}
      data-slot="command-footer"
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
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
};
