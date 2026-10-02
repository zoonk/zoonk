import { ModelStatusBadge, ModelStatusBadgeSkeleton } from "@/components/model-status-badge";
import { type ModelPricing } from "@/lib/gateway-prices";
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

const TOKENS_PER_MILLION = 1_000_000;

/** Gateway prices are per token; people compare them per million tokens. */
function formatPricing(pricing?: ModelPricing): string {
  if (!pricing) {
    return "No gateway price";
  }

  const input = pricing.input * TOKENS_PER_MILLION;
  const output = pricing.output * TOKENS_PER_MILLION;

  return `$${Number(input.toFixed(3))}/M input · $${Number(output.toFixed(3))}/M output`;
}

export function ModelCard({
  model,
  pricing,
  taskId,
}: {
  model: ModelConfig;
  pricing?: ModelPricing;
  taskId: string;
}) {
  return (
    <Item variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <span className="truncate">{getModelDisplayName(model)}</span>
          <ModelStatusBadge modelId={model.id} taskId={taskId} />
        </ItemTitle>
        <ItemDescription>
          {model.kind === "evaluation" && "Evaluation · "}
          {formatPricing(pricing)}
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
