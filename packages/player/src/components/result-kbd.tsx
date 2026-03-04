import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";

export function ResultKbd({
  children,
  isSelected,
  resultState,
}: {
  children: React.ReactNode;
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
      )}
    >
      {children}
    </Kbd>
  );
}
