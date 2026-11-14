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
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react";
import { useRef } from "react";
import type * as React from "react";

const Command = Autocomplete.Root;

/**
 * `suggestionsFirst` is for a list whose rows are the likely answer: on touch screens the popup
 * takes focus instead of the search field, so the keyboard doesn't cover them. Its `CommandInput`
 * then needs `autoFocus={false}`.
 */
function CommandDialog({
  children,
  className,
  finalFocus,
  suggestionsFirst,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  className?: string;
  children: React.ReactNode;
  finalFocus?: React.ComponentProps<typeof DialogPopup>["finalFocus"];
  suggestionsFirst?: boolean;
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay />
        <DialogViewport className="flex items-start justify-center sm:px-4 sm:pt-[12vh] sm:pb-4">
          <DialogPopup
            finalFocus={finalFocus}
            initialFocus={
              suggestionsFirst
                ? () => globalThis.matchMedia("(pointer: fine)").matches || popupRef.current
                : undefined
            }
            ref={popupRef}
            className={cn(
              "flex h-dvh w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)]",
              "sm:bg-popover sm:text-popover-foreground sm:ring-input sm:max-w-column sm:h-auto sm:max-h-[calc(100dvh-12vh-1rem)] sm:rounded-xl sm:pt-0 sm:ring-1 sm:ring-inset",
              "sm:dark:ring-foreground/20",
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

function CommandDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn("sr-only", className)} {...props} />;
}

function CommandDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription className={cn("sr-only", className)} {...props} />;
}

/**
 * The search field over a list: its glass, the field's ring and the text, at every width. Its text
 * stays 16px on phones so iOS Safari doesn't zoom in. `className` is the field's box, and `children`
 * sit at its end.
 */
function CommandSearchField({
  children,
  className,
  ...props
}: Omit<AutocompleteInputProps, "children"> & { children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "ring-input focus-within:ring-foreground flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 ring-[1.5px] ring-inset",
        className,
      )}
      data-slot="command-search-field"
    >
      <SearchIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      <Autocomplete.Input
        className="placeholder:text-muted-foreground sm:text-reading h-full min-w-0 flex-1 bg-transparent text-base outline-none disabled:cursor-not-allowed disabled:opacity-50"
        data-slot="command-input"
        {...props}
      />
      {children}
    </div>
  );
}

/**
 * The palette's field. `cancelLabel` closes the palette: the word after the field on a phone, and
 * from `sm` the field's "Esc" keycap as a button, where the field fills the palette's top edge.
 */
function CommandInput({
  cancelLabel,
  ...props
}: Omit<AutocompleteInputProps, "children" | "className"> & { cancelLabel: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 pt-2.5 pb-2 sm:border-b sm:p-0"
      data-slot="command-input-wrapper"
    >
      <CommandSearchField
        autoFocus
        className="sm:h-13 sm:gap-3 sm:rounded-none sm:px-5 sm:ring-0 sm:focus-within:ring-0"
        {...props}
      >
        <DialogClose
          aria-keyshortcuts="Escape"
          className="hit-area focus-visible:ring-ring/50 hover:[&>kbd]:text-foreground hover:[&>kbd]:ring-foreground/25 relative hidden shrink-0 rounded-sm outline-none focus-visible:ring-[3px] sm:inline-flex"
        >
          <span className="sr-only">{cancelLabel}</span>
          <Kbd>Esc</Kbd>
        </DialogClose>
      </CommandSearchField>

      <DialogClose className="hit-area focus-visible:ring-ring/50 relative shrink-0 rounded-md text-sm font-medium outline-none focus-visible:ring-[3px] sm:hidden">
        {cancelLabel}
      </DialogClose>
    </div>
  );
}

/** `after` scrolls with the list, outside it, for what isn't an option: a loading or failed state. */
function CommandList({
  after,
  children,
  className,
  ...props
}: Omit<AutocompleteListProps, "render"> & { after?: React.ReactNode }) {
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
          {after}
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar>
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
  );
}

function CommandGroup({ className, ...props }: AutocompleteGroupProps) {
  return (
    <Autocomplete.Group
      className={cn("text-foreground w-full max-w-full min-w-0 overflow-hidden sm:p-1", className)}
      data-slot="command-group"
      {...props}
    />
  );
}

const COMMAND_GROUP_LABEL_CLASS =
  "text-label pt-3.5 pb-1.5 sm:px-2.5 sm:pt-2 sm:pb-1";

function CommandGroupLabel({ className, ...props }: AutocompleteGroupLabelProps) {
  return (
    <Autocomplete.GroupLabel
      className={cn(COMMAND_GROUP_LABEL_CLASS, className)}
      data-slot="command-group-label"
      {...props}
    />
  );
}

function CommandCollection({ ...props }: AutocompleteCollectionProps) {
  return <Autocomplete.Collection {...props} />;
}

function CommandItem({ className, ...props }: AutocompleteItemProps) {
  return (
    <Autocomplete.Item
      className={cn(
        "group/command-item relative flex min-h-11 w-full max-w-full min-w-0 cursor-default items-center gap-3 overflow-hidden py-2 text-sm outline-hidden select-none sm:rounded-lg sm:px-2.5",
        "sm:data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        "pointer-fine:data-highlighted:after:ring-input pointer-fine:data-highlighted:after:text-muted-foreground pointer-fine:data-highlighted:after:text-2xs max-sm:after:hidden pointer-fine:data-highlighted:after:ml-auto pointer-fine:data-highlighted:after:rounded-sm pointer-fine:data-highlighted:after:px-1 pointer-fine:data-highlighted:after:font-mono pointer-fine:data-highlighted:after:ring-1 pointer-fine:data-highlighted:after:content-['⏎']",
        "[&>svg]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="command-item"
      {...props}
    />
  );
}

/** The keys every palette answers, in its footer. The app passes the words in its own language. */
function CommandKeyHints({ close, move, open }: { close: string; move: string; open: string }) {
  return (
    <div
      aria-hidden="true"
      className="text-faint text-2xs hidden h-9 shrink-0 items-center gap-3.5 border-t px-5 sm:pointer-fine:flex [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1"
      data-slot="command-footer"
    >
      <span>
        <Kbd>
          <ArrowUpIcon />
        </Kbd>
        <Kbd>
          <ArrowDownIcon />
        </Kbd>
        {move}
      </span>
      <span>
        <Kbd>⏎</Kbd>
        {open}
      </span>
      <span>
        <Kbd>Esc</Kbd>
        {close}
      </span>
    </div>
  );
}

export {
  COMMAND_GROUP_LABEL_CLASS,
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogDescription,
  CommandDialogTitle,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandKeyHints,
  CommandList,
  CommandSearchField,
};
