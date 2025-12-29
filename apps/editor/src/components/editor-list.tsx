"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { toast } from "@zoonk/ui/components/sonner";
import { cn } from "@zoonk/ui/lib/utils";
import { GripVerticalIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
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

function useEditorSortable() {
  const context = useContext(EditorSortableContext);
  if (!context) {
    throw new Error(
      "EditorSortable components must be used within an EditorSortableList.",
    );
  }
  return context;
}

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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
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

  return (
    <div
      className={cn(isDragging && "opacity-50")}
      data-dragging={isDragging}
      data-slot="editor-sortable-item"
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <EditorSortableItemContext.Provider value={listeners}>
        {children}
      </EditorSortableItemContext.Provider>
    </div>
  );
}

const EditorSortableItemContext = createContext<
  ReturnType<typeof useSortable>["listeners"] | undefined
>(undefined);

function EditorSortableItemRow({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-4 py-3 transition-colors hover:bg-muted/50",
        className,
      )}
      data-slot="editor-sortable-item-row"
      {...props}
    />
  );
}

function EditorDragHandle({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const listeners = useContext(EditorSortableItemContext);

  if (!listeners) {
    throw new Error(
      "EditorDragHandle must be used within an EditorSortableItem.",
    );
  }

  return (
    <button
      className={cn(
        "mt-1 flex shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none active:cursor-grabbing",
        className,
      )}
      data-slot="editor-drag-handle"
      type="button"
      {...listeners}
      {...props}
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );
}

export {
  EditorDragHandle,
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListInsertLine,
  EditorListItem,
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemPosition,
  EditorListItemTitle,
  EditorListProvider,
  EditorListSpinner,
  EditorSortableItem,
  EditorSortableItemRow,
  EditorSortableList,
  useEditorList,
  useEditorSortable,
};
