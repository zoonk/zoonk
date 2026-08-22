import { cn } from "@zoonk/ui/lib/utils";
import { AnswerExplanationAction } from "./lesson-question-actions";
import { StepActionButton } from "./step-action-button";

/** Keeps the secondary explanation action aligned with the primary step action. */
export function StepActionGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex w-full gap-2", className)} {...props}>
      <AnswerExplanationAction />
      <StepActionButton className="min-w-0 flex-1" />
    </div>
  );
}
