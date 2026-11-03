import { cn } from "@zoonk/ui/lib/utils";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

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
        <p
          className={cn(
            "bg-background ring-input flex items-center rounded-xl p-4 text-[1.0625rem] leading-snug font-medium ring-1 [grid-area:1/1] ring-inset",
            item.id !== cardId && "invisible",
          )}
          key={item.id}
        >
          <LessonRichText text={item.text} />
        </p>
      ))}
    </div>
  );
}
