import { getAiTask } from "@/lib/ai-tasks";

/** An AI task wherever it's listed: its name in words, and under it what the task does. */
export function AiTaskName({ task }: { task: string }) {
  const { description, name } = getAiTask(task);

  return (
    <>
      <span className="text-foreground block truncate font-medium">{name}</span>
      {description ? (
        <span className="text-muted-foreground block truncate text-xs">{description}</span>
      ) : null}
    </>
  );
}
