import { cn } from "@zoonk/ui/lib/utils";
import { ResultKbd } from "./result-kbd";

export function OptionCard({
  children,
  disabled,
  index,
  isSelected,
  onSelect,
  resultState,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  index: number;
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
        resultState === "correct" && "border-l-success border-l-2",
        resultState === "incorrect" && "border-l-destructive border-l-2",
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
