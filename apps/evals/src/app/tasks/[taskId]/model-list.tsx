import { StatusBadge } from "@/components/model-status-badge";
import { type ModelConfig, getModelDisplayName } from "@/lib/models";
import { type ModelStatus } from "@/lib/utils";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

export function ModelList({
  models,
  open,
  taskId,
}: {
  models: { model: ModelConfig; status: ModelStatus }[];
  open: boolean;
  taskId: string;
}) {
  if (models.length === 0) {
    return null;
  }

  return (
    <details className="group border-t pt-2" open={open}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 transition-transform group-open:rotate-90"
        />
        Run another model
        <span className="text-muted-foreground font-mono text-xs font-normal">{models.length}</span>
      </summary>

      <ul className="grid gap-x-10 pt-1 sm:grid-cols-2 lg:grid-cols-4">
        {models.map(({ model, status }) => (
          <li key={model.id}>
            <Link
              className="hover:bg-muted -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-sm"
              href={`/tasks/${taskId}/${encodeURIComponent(model.id)}`}
            >
              <span className="truncate">{getModelDisplayName(model)}</span>
              {status !== "notStarted" && <StatusBadge status={status} />}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ModelListSkeleton() {
  return (
    <div aria-hidden="true" className="border-t pt-2">
      <div className="flex min-h-11 items-center">
        <Skeleton className="h-5 w-40 rounded" />
      </div>
    </div>
  );
}
