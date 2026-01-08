"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { toast } from "@zoonk/ui/components/sonner";
import { mergeProps, useRender } from "@zoonk/ui/lib/render";
import { cn } from "@zoonk/ui/lib/utils";
import { isNextRedirectError } from "@zoonk/utils/error";
import { EllipsisIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useOptimistic,
  useState,
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
          if (!isNextRedirectError(error)) {
            console.error(
              `Failed to insert item at position ${position}:`,
              error,
            );

            toast.error(error instanceof Error ? error.message : String(error));
          }
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

function EditorListItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li className={cn(className)} data-slot="editor-list-item" {...props} />
  );
}

function EditorListItemLink({
  className,
  render,
  style,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn("flex min-w-0 flex-1 items-start gap-4", className),
        style: {
          // Prevent iOS context menu on long-press (allows row drag to work)
          WebkitTouchCallout: "none",
          ...style,
        },
      },
      props,
    ),
    render,
    state: {
      slot: "editor-list-item-link",
    },
  });
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
      className={cn("font-medium", className)}
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

type SortableItem = {
  id: number;
  position: number;
};

type EditorSortableContextValue = {
  activeId: number | null;
  isDragging: boolean;
};

const EditorSortableContext = createContext<
  EditorSortableContextValue | undefined
>(undefined);

function EditorSortableList<T extends SortableItem>({
  children,
  items: initialItems,
  onReorder,
  renderOverlay,
}: {
  children: React.ReactNode;
  items: T[];
  onReorder: (
    items: { id: number; position: number }[],
  ) => Promise<{ error: string | null }>;
  renderOverlay?: (activeItem: T) => React.ReactNode;
}) {
  const dndId = useId();
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [optimisticItems, setOptimisticItems] = useOptimistic(initialItems);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 450,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Haptic feedback when drag activates
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    setActiveId(event.active.id as number);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = optimisticItems.findIndex(
        (item) => item.id === active.id,
      );
      const newIndex = optimisticItems.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reorderedItems = arrayMove(optimisticItems, oldIndex, newIndex);
      const newPositions = reorderedItems.map(
        (item: SortableItem, index: number) => ({
          id: item.id,
          position: index,
        }),
      );

      startTransition(async () => {
        setOptimisticItems(reorderedItems);

        const { error } = await onReorder(newPositions);

        if (error) {
          toast.error(error);
        }
      });
    },
    [optimisticItems, onReorder, setOptimisticItems],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeItem = activeId
    ? optimisticItems.find((item) => item.id === activeId)
    : null;

  const contextValue = useMemo<EditorSortableContextValue>(
    () => ({
      activeId,
      isDragging: activeId !== null,
    }),
    [activeId],
  );

  const itemIds = useMemo(
    () => optimisticItems.map((item) => item.id),
    [optimisticItems],
  );

  if (!mounted) {
    return <div data-slot="editor-sortable-list">{children}</div>;
  }

  return (
    <EditorSortableContext.Provider value={contextValue}>
      <DndContext
        collisionDetection={closestCenter}
        id={dndId}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div
            className={cn(pending && "pointer-events-none opacity-60")}
            data-slot="editor-sortable-list"
          >
            {children}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem && renderOverlay ? (
            <div
              className="rounded-md border bg-background shadow-md"
              data-slot="editor-drag-overlay"
            >
              {renderOverlay(activeItem)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </EditorSortableContext.Provider>
  );
}

type SortableItemContextValue = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

const EditorSortableItemContext = createContext<
  SortableItemContextValue | undefined
>(undefined);

function EditorSortableItem({
  children,
  id,
}: {
  children: React.ReactNode;
  id: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const contextValue = useMemo<SortableItemContextValue>(
    () => ({ attributes, listeners }),
    [attributes, listeners],
  );

  return (
    <div
      className={cn(isDragging && "opacity-50")}
      data-dragging={isDragging}
      data-slot="editor-sortable-item"
      ref={setNodeRef}
      style={style}
    >
      <EditorSortableItemContext.Provider value={contextValue}>
        {children}
      </EditorSortableItemContext.Provider>
    </div>
  );
}

function EditorSortableItemRow({
  className,
  style,
  ...props
}: React.ComponentProps<"div">) {
  const context = useContext(EditorSortableItemContext);

  return (
    <div
      className={cn(
        "group/row flex items-start gap-2 px-4 py-3 transition-colors hover:bg-muted/50",
        className,
      )}
      data-slot="editor-sortable-item-row"
      style={{
        // Prevent iOS context menu on long-press
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        ...style,
      }}
      {...context?.listeners}
      {...props}
    />
  );
}

function EditorDragHandle({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  const context = useContext(EditorSortableItemContext);

  if (!context) {
    throw new Error(
      "EditorDragHandle must be used within an EditorSortableItem.",
    );
  }

  return (
    <button
      className={cn(
        "relative flex min-h-11 min-w-11 shrink-0 cursor-grab select-none items-center justify-center rounded-md font-mono text-muted-foreground text-sm tabular-nums transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-full before:min-h-11 before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none active:cursor-grabbing active:bg-muted",
        className,
      )}
      data-slot="editor-drag-handle"
      type="button"
      {...context.attributes}
      {...context.listeners}
      {...props}
    >
      {typeof children === "number"
        ? String(children).padStart(2, "0")
        : children}
    </button>
  );
}

function EditorListItemActions({
  "aria-label": ariaLabel,
  insertAboveLabel,
  insertBelowLabel,
  position,
}: {
  "aria-label": string;
  insertAboveLabel: string;
  insertBelowLabel: string;
  position: number;
}) {
  const { pending, handleInsert } = useEditorList();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
        disabled={pending}
      >
        <EllipsisIcon className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleInsert(position)}>
          <PlusIcon />
          {insertAboveLabel}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleInsert(position + 1)}>
          <PlusIcon />
          {insertBelowLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditorListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div data-slot="editor-list">
      <div className="flex items-center justify-end gap-2 px-4 pb-2">
        <Skeleton className="h-8 w-28" />
      </div>

      <ul>
        {Array.from({ length: count }).map((_, i) => (
          <li
            className="flex items-center gap-2 border-border border-t px-4 py-3"
            key={i}
          >
            <Skeleton className="size-4" />

            <div className="flex min-w-0 flex-1 items-start gap-4">
              <Skeleton className="mt-0.5 h-5 w-6" />

              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export {
  EditorDragHandle,
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListItem,
  EditorListItemActions,
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemTitle,
  EditorListProvider,
  EditorListSkeleton,
  EditorListSpinner,
  EditorSortableItem,
  EditorSortableItemRow,
  EditorSortableList,
};
