import { cn } from "@zoonk/ui/lib/utils";
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
  resultState?: "correct" | "incorrect";
}) {
  return (
    <button
      aria-checked={isSelected}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
        !disabled && !isSelected && "border-border hover:bg-accent",
        !disabled && isSelected && "border-primary bg-primary/5",
        disabled && "pointer-events-none",
        isDimmed && "opacity-40",
        resultState === "correct" && "bg-success/5 text-success border-transparent opacity-75",
        resultState === "incorrect" &&
          "bg-destructive/5 text-destructive border-transparent opacity-75",
      )}
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <ResultKbd isSelected={isSelected} resultState={resultState}>
        {index + 1}
      </ResultKbd>

      <div className="flex flex-col">{children}</div>
    </button>
  );
}
