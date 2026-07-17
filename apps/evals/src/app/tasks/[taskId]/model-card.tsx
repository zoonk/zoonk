import { ModelStatusBadge, ModelStatusBadgeSkeleton } from "@/components/model-status-badge";
import { type ModelConfig, getModelDisplayName } from "@/lib/models";
import { ButtonSkeleton, buttonVariants } from "@zoonk/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";

export function ModelCard({ model, taskId }: { model: ModelConfig; taskId: string }) {
  return (
    <Item variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <span className="truncate">{getModelDisplayName(model)}</span>
          <ModelStatusBadge modelId={model.id} taskId={taskId} />
        </ItemTitle>
        <ItemDescription>
          ${model.inputCost}/M input · ${model.outputCost}/M output
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/tasks/${taskId}/${encodeURIComponent(model.id)}`}
        >
          See Evals
        </Link>
      </ItemActions>
    </Item>
  );
}

/**
 * Keeps the model grid stable while fresh output and result files determine
 * each model's order and status.
 */
export function ModelCardSkeleton() {
  return (
    <Item aria-hidden="true" variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <Skeleton className="h-5 w-32 rounded" />
          <ModelStatusBadgeSkeleton />
        </ItemTitle>
        <Skeleton className="h-5 w-44 rounded" />
      </ItemContent>

      <ItemActions>
        <ButtonSkeleton variant="outline">See Evals</ButtonSkeleton>
      </ItemActions>
    </Item>
  );
}
