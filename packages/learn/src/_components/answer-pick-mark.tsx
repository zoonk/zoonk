import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleIcon } from "lucide-react";

export type PickMarkKind = "check" | "radio";

/**
 * Says before any tap whether the question takes one answer (a radio) or several (a checkbox), and
 * which rows are picked, also after the verdict, as the kit's `RadioGroupItem` and `Checkbox` draw
 * them. The row is the control, so the mark is only drawn. Its room is there from the start.
 */
export function PickMark({
  kind,
  layout,
  picked,
}: {
  kind: PickMarkKind;
  layout: "row" | "stacked";
  picked: boolean;
}) {
  const Icon = kind === "radio" ? CircleIcon : CheckIcon;

  return (
    <LineMarker
      aria-hidden="true"
      className={cn(
        layout === "stacked" &&
          "bg-background absolute inset-e-3 top-3 z-10 size-6 justify-center rounded-full",
      )}
      data-slot="answer-option-mark"
    >
      <span
        className={cn(
          "border-input dark:bg-input/30 text-selected-foreground flex size-4 items-center justify-center border",
          kind === "radio" ? "rounded-full" : "rounded-sm",
          "in-data-held:border-selected in-data-held:bg-selected in-data-[held=unchecked]:border-input! in-data-[held=unchecked]:bg-transparent!",
          picked && "border-selected bg-selected dark:bg-selected",
        )}
      >
        <Icon
          className={cn(
            kind === "radio" ? "size-2 fill-current" : "size-3.5",
            !picked && "invisible",
            "in-data-held:visible in-data-[held=unchecked]:invisible!",
          )}
        />
      </span>
    </LineMarker>
  );
}

/** A row the learner picks on draws the mark its role says; one that acts at once or only shows an answer has none. */
export function getPickMark({
  hasAction,
  picks,
  role,
}: {
  hasAction: boolean;
  picks: boolean;
  role: React.AriaRole | undefined;
}): PickMarkKind | null {
  if (!picks || !hasAction) {
    return null;
  }

  if (role === "checkbox") {
    return "check";
  }

  return role === undefined || role === "radio" ? "radio" : null;
}
