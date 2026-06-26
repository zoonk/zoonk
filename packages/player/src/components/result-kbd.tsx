import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * Answer badges reuse keyboard styling for compact numbering and shortcut
 * hints. Callers pass display classes because choice options intentionally show
 * their numbers on every device, while shortcut-only hints are desktop-only.
 */
export function ResultKbd({
  children,
  className,
  isSelected,
  resultState,
}: {
  children: React.ReactNode;
  className?: string;
  isSelected?: boolean;
  resultState?: "correct" | "incorrect";
}) {
  return (
    <Kbd
      aria-hidden="true"
      className={cn(
        isSelected && !resultState && "bg-primary text-primary-foreground",
        resultState === "correct" && "text-success",
        resultState === "incorrect" && "text-destructive",
        className,
      )}
    >
      {children}
    </Kbd>
  );
}
