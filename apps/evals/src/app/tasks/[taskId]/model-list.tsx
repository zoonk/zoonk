import { Fold } from "@/components/fold";
import { StatusBadge } from "@/components/model-status-badge";
import { type ModelConfig, getModelDisplayName } from "@/lib/models";
import { type ModelStatus } from "@/lib/utils";
import { type ModelPricing } from "@zoonk/ai/pricing/gateway-prices";
import Link from "next/link";

const TOKENS_PER_MILLION = 1_000_000;

function formatPrice(price: number): string {
  return `$${Number((price * TOKENS_PER_MILLION).toFixed(3))}`;
}

export function ModelList({
  hasResults,
  models,
  taskId,
}: {
  hasResults: boolean;
  models: { model: ModelConfig; pricing?: ModelPricing; status: ModelStatus }[];
  taskId: string;
}) {
  if (models.length === 0) {
    return null;
  }

  return (
    <Fold
      className="pt-4"
      isOpen={!hasResults}
      title={hasResults ? "Run another model" : "Run a model"}
    >
      <p className="text-muted-foreground text-xs">Price per million tokens: input / output.</p>

      <ul className="grid gap-x-10 pt-1 sm:grid-cols-2 lg:grid-cols-3">
        {models.map(({ model, pricing, status }) => (
          <li key={model.id}>
            <Link
              className="hover:bg-muted -mx-2.5 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2.5 text-sm"
              href={`/tasks/${taskId}/${encodeURIComponent(model.id)}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{getModelDisplayName(model)}</span>
                {status !== "notStarted" && <StatusBadge status={status} />}
              </span>

              {pricing && (
                <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                  {formatPrice(pricing.input)} / {formatPrice(pricing.output)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Fold>
  );
}
