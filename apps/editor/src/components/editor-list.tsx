"use client";

import { Button } from "@zoonk/ui/components/button";
import { toast } from "@zoonk/ui/components/sonner";
import { cn } from "@zoonk/ui/lib/utils";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from "react";

type EditorListContextValue = {
  pending: boolean;
  handleInsert: (position: number) => void;
};

const EditorListContext = createContext<EditorListContextValue | undefined>(
  undefined,
);

function useEditorList() {
  const context = useContext(EditorListContext);
  if (!context) {
    throw new Error(
      "EditorList components must be used within an EditorListProvider.",
    );
  }
  return context;
}

function EditorListProvider({
  children,
  onInsert,
}: {
  children: React.ReactNode;
  onInsert: (position: number) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  const handleInsert = useCallback(
    (position: number) => {
      startTransition(async () => {
        try {
          await onInsert(position);
        } catch (error) {
          console.error(
            `Failed to insert item at position ${position}:`,
            error,
          );
          toast.error(error instanceof Error ? error.message : String(error));
        }
      });
    },
    [onInsert],
  );

  const value = useMemo<EditorListContextValue>(
    () => ({
      handleInsert,
      pending,
    }),
    [handleInsert, pending],
  );

  return (
    <EditorListContext.Provider value={value}>
      <div className="relative" data-slot="editor-list">
        {children}
      </div>
    </EditorListContext.Provider>
  );
}

function EditorListSpinner({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { pending } = useEditorList();

  if (!pending) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center bg-background/60",
        className,
      )}
      data-slot="editor-list-spinner"
      {...props}
    >
      <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EditorListHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 px-4 pb-2", className)}
      data-slot="editor-list-header"
      {...props}
    />
  );
}

function EditorListAddButton({
  children,
  className,
  position,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  position: number;
}) {
  const { pending, handleInsert } = useEditorList();

  return (
    <Button
      className={className}
      data-slot="editor-list-add-button"
      disabled={pending}
      onClick={() => handleInsert(position)}
      size="sm"
      variant="outline"
      {...props}
    >
      <PlusIcon />
      {children}
    </Button>
  );
}

function EditorListContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul className={cn(className)} data-slot="editor-list-content" {...props} />
  );
}

function EditorListInsertLine({
  position,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onClick"> & {
  position: number;
}) {
  const { pending, handleInsert } = useEditorList();

  return (
    <div
      className={cn("group relative h-0", className)}
      data-slot="editor-list-insert-line"
      {...props}
    >
      <div className="absolute inset-x-4 -top-px z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <div className="h-px flex-1 bg-primary/30" />

        <button
          className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={pending}
          onClick={() => handleInsert(position)}
          type="button"
        >
          <PlusIcon className="size-3" />
        </button>

        <div className="h-px flex-1 bg-primary/30" />
      </div>
    </div>
  );
}

function EditorListItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li className={cn(className)} data-slot="editor-list-item" {...props} />
  );
}

function EditorListItemLink({
  className,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a
      className={cn(
        "flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/50",
        className,
      )}
      data-slot="editor-list-item-link"
      {...props}
    />
  );
}

function EditorListItemPosition({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "mt-0.5 font-mono text-muted-foreground text-sm tabular-nums",
        className,
      )}
      data-slot="editor-list-item-position"
      {...props}
    >
      {typeof children === "number"
        ? String(children).padStart(2, "0")
        : children}
    </span>
  );
}

function EditorListItemContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-w-0 flex-1", className)}
      data-slot="editor-list-item-content"
      {...props}
    />
  );
}

function EditorListItemTitle({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("truncate font-medium", className)}
      data-slot="editor-list-item-title"
      {...props}
    />
  );
}

function EditorListItemDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "mt-0.5 line-clamp-2 text-muted-foreground text-sm",
        className,
      )}
      data-slot="editor-list-item-description"
      {...props}
    />
  );
}

export {
  EditorListProvider,
  EditorListSpinner,
  EditorListHeader,
  EditorListAddButton,
  EditorListContent,
  EditorListInsertLine,
  EditorListItem,
  EditorListItemLink,
  EditorListItemPosition,
  EditorListItemContent,
  EditorListItemTitle,
  EditorListItemDescription,
  useEditorList,
};
