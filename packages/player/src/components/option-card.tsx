import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getNumberKeyShortcut } from "../player-shortcuts";
import { ResultKbd } from "./result-kbd";

export function OptionCard({
  children,
  disabled,
  index,
  isDimmed,
  isSelected,
  onSelect,
  resultState,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  index: number;
  isDimmed?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  resultState: "correct" | "incorrect" | null;
}) {
  return (
    <button
      aria-checked={isSelected}
      aria-keyshortcuts={getNumberKeyShortcut(index) ?? undefined}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 outline-none focus-visible:ring-[3px]",
        !disabled && !isSelected && "border-border hover:bg-accent",
        !disabled && isSelected && "border-primary bg-primary/5",
        disabled && "pointer-events-none",
        isDimmed && "opacity-50",
        // Full strength: the pick and the right answer are what the result is about, and faded
        // colored text falls below AA contrast, in dark mode most of all.
        resultState === "correct" && "bg-success/5 text-success border-transparent",
        resultState === "incorrect" && "bg-destructive/5 text-destructive border-transparent",
      )}
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      {/* One option line tall, so the number sits on the first line when the text wraps. */}
      <LineMarker className="text-base leading-6">
        <ResultKbd isSelected={isSelected} resultState={resultState ?? undefined}>
          {index + 1}
        </ResultKbd>
      </LineMarker>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </button>
  );
}
