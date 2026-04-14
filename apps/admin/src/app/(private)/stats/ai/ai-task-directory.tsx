import { AI_TASK_CATALOG } from "@/data/stats/ai/ai-task-catalog";
import { buildAiTaskReportHref } from "@/data/stats/ai/ai-task-hrefs";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Separator } from "@zoonk/ui/components/separator";
import Link from "next/link";
import { Fragment } from "react";

/**
 * The task page is now a directory first. Grouping the known AI tasks by the
 * part of the product they support gives admins a calmer starting point than a
 * giant always-live table while still keeping one-click access to each report.
 */
export function AiTaskDirectory({ endDate, startDate }: { endDate: string; startDate: string }) {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex max-w-3xl flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">Task Directory</h2>
        <p className="text-muted-foreground text-sm">
          Each link opens the selected task with the date range above, so you can go straight to the
          one report you need instead of loading everything up front.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {AI_TASK_CATALOG.map((group, index) => (
          <Fragment key={group.title}>
            {index === 0 ? null : <Separator />}
            <AiTaskDirectoryGroup endDate={endDate} group={group} startDate={startDate} />
          </Fragment>
        ))}
      </div>
    </section>
  );
}

/**
 * Each group combines a short explanation with direct links so admins can scan
 * the catalog quickly without expanding nested menus or accordion state.
 */
function AiTaskDirectoryGroup({
  endDate,
  group,
  startDate,
}: {
  endDate: string;
  group: (typeof AI_TASK_CATALOG)[number];
  startDate: string;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[16rem_1fr] lg:gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight">{group.title}</h3>
        <p className="text-muted-foreground text-sm">{group.description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {group.tasks.map((task) => (
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={buildAiTaskReportHref({
              endDate,
              startDate,
              taskName: task.taskName,
            })}
            key={task.taskName}
          >
            {task.taskLabel}
          </Link>
        ))}
      </div>
    </section>
  );
}
