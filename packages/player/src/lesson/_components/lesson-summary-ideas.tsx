import { cn } from "@zoonk/ui/lib/utils";
import { LessonRichText } from "./lesson-rich-text";

/**
 * The summary card's ideas, numbered, one sentence each: at the end of a lesson, as a card of their
 * own, or from its menu, as flat rows (`variant="flat"`) in the sheet, which is already the panel.
 */
export function LessonSummaryIdeas({
  ideas,
  variant = "card",
}: {
  ideas: string[];
  variant?: "card" | "flat";
}) {
  return (
    <ol
      className={cn(
        "divide-border flex w-full flex-col divide-y",
        variant === "card" && "border-border rounded-xl border",
      )}
    >
      {ideas.map((idea, index) => {
        const key = `idea-${index}`;

        return (
          <li
            className={cn(
              "flex gap-3 text-base leading-relaxed sm:text-lg",
              variant === "card" ? "p-4" : "py-3",
            )}
            key={key}
          >
            <span
              aria-hidden="true"
              className="text-muted-foreground w-5 shrink-0 font-mono tabular-nums"
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <LessonRichText text={idea} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
