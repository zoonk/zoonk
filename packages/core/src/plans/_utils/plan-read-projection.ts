import "server-only";
import { type ExistingPlanItem, getItemKey } from "../planner/plan-items";
import { type PlanContext } from "./plan-context";

/** Read-only selection: unsaved items cannot be passed as persisted mutation preconditions. */
export type PlanReadItem = Omit<ExistingPlanItem, "id"> & {
  facts?: unknown;
  id: string | null;
  key?: string;
  minutes?: number | null;
};

export type PlanReadContext = Omit<PlanContext, "items"> & { items: PlanReadItem[] };

/** Internal grouping identity only; public IDs and action URLs always use the untouched item.id. */
export function getPlanReadItemKey(item: PlanReadItem): string {
  return item.key ?? getItemKey(item);
}
