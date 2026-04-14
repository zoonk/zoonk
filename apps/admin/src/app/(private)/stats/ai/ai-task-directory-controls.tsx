import { buildAiEstimateHref, buildAiTaskIndexHref } from "@/data/stats/ai/ai-task-hrefs";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import Link from "next/link";
import { AiFilterField } from "./ai-filter-field";

type AiTaskPageView = "fallbacks" | "summary";

/**
 * The task index should stay passive until the admin explicitly asks for a
 * billed Custom Reporting snapshot. This header explains that behavior and
 * keeps the date-range controls close to the two actions users actually need.
 */
export function AiTaskDirectoryControls({
  activeView,
  endDate,
  startDate,
}: {
  activeView?: AiTaskPageView;
  endDate: string;
  startDate: string;
}) {
  const estimateHref = buildAiEstimateHref({ endDate, startDate });
  const hideReportHref = buildAiTaskIndexHref({ endDate, startDate });
  const resetHref = "/stats/ai";
  const showHideReport = activeView !== undefined;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex max-w-3xl flex-col gap-2">
        <p className="text-sm font-medium tracking-tight">
          Open a task when you need its report. We only run the expensive Vercel queries after you
          explicitly ask for a summary.
        </p>
        <p className="text-muted-foreground text-sm">
          The directory below stays lightweight, keeps the page easier to scan, and still preserves
          your selected date range when you jump into a task or the estimates view.
        </p>
      </div>

      <form action="/stats/ai" className="flex flex-wrap items-end gap-3">
        <AiFilterField htmlFor="from" label="From">
          <Input defaultValue={startDate} id="from" name="from" type="date" />
        </AiFilterField>

        <AiFilterField htmlFor="to" label="To">
          <Input defaultValue={endDate} id="to" name="to" type="date" />
        </AiFilterField>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            name="view"
            type="submit"
            value="summary"
            variant={activeView === "summary" ? "secondary" : "outline"}
          >
            Load Live Summary
          </Button>

          <Button
            name="view"
            type="submit"
            value="fallbacks"
            variant={activeView === "fallbacks" ? "secondary" : "outline"}
          >
            Load Fallback Tasks
          </Button>

          <Link className={buttonVariants({ variant: "outline" })} href={estimateHref}>
            Cost Estimates
          </Link>

          <Link
            className={buttonVariants({ variant: "ghost" })}
            href={showHideReport ? hideReportHref : resetHref}
          >
            {showHideReport ? "Hide Report" : "Reset"}
          </Link>
        </div>
      </form>
    </section>
  );
}
