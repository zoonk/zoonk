import { RowChevron } from "@zoonk/ui/components/row-chevron";
import Link from "next/link";
import { getTaskComparisons } from "./comparisons/_utils/comparison-route";
import { formatDate } from "./comparisons/_utils/labels";
import { comparisonPath } from "./comparisons/_utils/paths";
import { comparisonTitle, outcomeText } from "./comparisons/_utils/titles";

/** A task's comparisons, newest first, each with its outcome as it stands now. */
export async function ComparisonList({ taskId }: { taskId: string }) {
  const routes = await getTaskComparisons(taskId);

  if (routes.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 pb-6">
      <h2 className="text-lg font-semibold tracking-tight">Comparisons</h2>

      <ul className="flex flex-col">
        {routes.map(({ comparison, decision, id }) => (
          <li className="border-t first:border-t-0" key={id}>
            <Link
              className="hover:bg-muted -mx-2.5 flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2"
              href={comparisonPath(taskId, id)}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium wrap-break-word">
                  {comparisonTitle(comparison.manifest)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {outcomeText(comparison, decision)} · {formatDate(comparison.manifest.date)}
                </span>
              </span>
              <RowChevron />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
