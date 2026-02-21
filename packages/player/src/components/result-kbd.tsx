import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";

export function ResultKbd({
  children,
  isSelected,
  resultState,
}: {
  children: React.ReactNode;
  isSelected?: boolean;
  resultState?: "correct" | "incorrect";
}) {
  if (resultState === "correct") {
    return (
      <Kbd aria-hidden="true" className="bg-success text-white">
        <CheckIcon aria-hidden="true" className="size-3" />
      </Kbd>
    );
  }

  if (resultState === "incorrect") {
    return (
      <Kbd aria-hidden="true" className="bg-destructive text-white">
        <XIcon aria-hidden="true" className="size-3" />
      </Kbd>
    );
  }

  return (
    <Kbd aria-hidden="true" className={cn(isSelected && "bg-primary text-primary-foreground")}>
      {children}
    </Kbd>
  );
}
