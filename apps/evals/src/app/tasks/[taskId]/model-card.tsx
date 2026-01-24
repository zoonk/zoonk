import { ModelStatusBadge } from "@/components/model-status-badge";
import { type ModelConfig, getModelDisplayName } from "@/lib/models";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@zoonk/ui/components/item";
import Link from "next/link";

type ModelCardProps = {
  model: ModelConfig;
  taskId: string;
};

export function ModelCard({ model, taskId }: ModelCardProps) {
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>
          {getModelDisplayName(model)}
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
