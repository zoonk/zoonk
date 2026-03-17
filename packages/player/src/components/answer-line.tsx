import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";

const variantStyles = {
  correct: { background: "bg-success/10", color: "text-success" },
  incorrect: { background: "bg-destructive/10", color: "text-destructive" },
} as const;

const variantIcons = {
  correct: CircleCheck,
  incorrect: CircleX,
} as const;

export function AnswerLine({
  action,
  children,
  label,
  text,
  variant,
}: {
  action?: React.ReactNode;
  children?: React.ReactNode;
  label: string;
  text: string;
  variant: "correct" | "incorrect";
}) {
  const styles = variantStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <div className={cn("rounded-lg px-3 py-2 text-sm", styles.background)}>
      <div className="flex items-center gap-2">
        <span className={cn("shrink-0", styles.color)}>
          <Icon aria-hidden="true" className="size-4" />
        </span>

        <div className="min-w-0">
          <span className="text-muted-foreground">{label}</span>{" "}
          <span className="font-medium">{text}</span>
        </div>

        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>

      {children && <div className="pl-6">{children}</div>}
    </div>
  );
}
