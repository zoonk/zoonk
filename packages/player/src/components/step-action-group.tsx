import { cn } from "@zoonk/ui/lib/utils";
import { usePlayerRuntime } from "../player-context";
import { CompletionSaveControl } from "./completion-save-control";
import { ContextualQuestionAction } from "./lesson-question-actions";
import { StepActionButton } from "./step-action-button";

/** Keeps contextual question help aligned with the primary step action. */
export function StepActionGroup({ className, ...props }: React.ComponentProps<"div">) {
  const { completionPersistence } = usePlayerRuntime();

  if (completionPersistence !== "idle") {
    return <CompletionSaveControl />;
  }

  return (
    <div className={cn("flex w-full gap-2", className)} {...props}>
      <StepActionButton className="min-w-0 flex-1" />
      <ContextualQuestionAction />
    </div>
  );
}
