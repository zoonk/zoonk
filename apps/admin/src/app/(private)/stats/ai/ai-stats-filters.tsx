import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import Link from "next/link";
import { AiFilterField } from "./ai-filter-field";

/**
 * The AI stats pages are fully server-rendered, so the filters use a plain GET
 * form. That keeps the selected reporting window shareable in the URL without
 * introducing client-side state just to update analytics parameters.
 */
export function AiStatsFilters({
  actionHref,
  endDate,
  runCount,
  startDate,
}: {
  actionHref: string;
  endDate: string;
  runCount?: number;
  startDate: string;
}) {
  return (
    <form action={actionHref} className="flex flex-wrap items-end gap-3">
      <AiFilterField htmlFor="from" label="From">
        <Input defaultValue={startDate} id="from" name="from" type="date" />
      </AiFilterField>

      <AiFilterField htmlFor="to" label="To">
        <Input defaultValue={endDate} id="to" name="to" type="date" />
      </AiFilterField>

      {runCount === undefined ? null : (
        <AiFilterField htmlFor="runs" label="Estimate Runs">
          <Input defaultValue={String(runCount)} id="runs" min={1} name="runs" type="number" />
        </AiFilterField>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline">
          Apply
        </Button>

        <Link className={buttonVariants({ variant: "ghost" })} href={actionHref}>
          Reset
        </Link>
      </div>
    </form>
  );
}
