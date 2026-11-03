import { cn } from "@zoonk/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { useActivityDraggable } from "../_components/activity-drag-drop";

function CategorizeCardFace({
  isHeld,
  item,
}: {
  isHeld: boolean;
  item: { id: string; text: string };
}) {
  const { dragProps, isDragging } = useActivityDraggable({ disabled: !isHeld, id: item.id });

  return (
    <p
      {...dragProps}
      className={cn(
        "bg-background ring-input flex items-center gap-2.5 rounded-xl py-4 ps-3 pe-4 text-[1.0625rem] leading-snug font-medium ring-1 [grid-area:1/1] ring-inset",
        isHeld ? "cursor-grab touch-manipulation select-none active:cursor-grabbing" : "invisible",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      <GripVertical aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />

      <span className="min-w-0">
        <LessonRichText text={item.text} />
      </span>
    </p>
  );
}

/** Every card shares one grid cell so the box keeps the tallest card's height and the groups never move. */
export function CategorizeCard({
  cardId,
  items,
}: {
  cardId: string;
  items: readonly { id: string; text: string }[];
}) {
  return (
    <div className="grid" data-slot="categorize-card">
      {items.map((item) => (
        <CategorizeCardFace isHeld={item.id === cardId} item={item} key={item.id} />
      ))}
    </div>
  );
}
