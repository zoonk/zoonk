import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import Link from "next/link";

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
      <FilterField htmlFor="from" label="From">
        <Input defaultValue={startDate} id="from" name="from" type="date" />
      </FilterField>

      <FilterField htmlFor="to" label="To">
        <Input defaultValue={endDate} id="to" name="to" type="date" />
      </FilterField>

      {runCount === undefined ? null : (
        <FilterField htmlFor="runs" label="Estimate Runs">
          <Input defaultValue={String(runCount)} id="runs" min={1} name="runs" type="number" />
        </FilterField>
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

/**
 * The date range and optional run-count controls repeat the same label-plus-
 * input structure. This wrapper keeps the form readable and ensures each input
 * stays properly labeled for semantic queries and keyboard users.
 */
function FilterField({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex min-w-32 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
