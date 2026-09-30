import { type GenerateImageResult } from "ai";
import { getModelFamily } from "../_utils/model-family";
import { readGatewayMetadata } from "./gateway-metadata";
import { type TaskGenerationInput, type TaskRunDetails, startTaskRun } from "./run-task-generation";
import { type TaskProvenance, sumKnown } from "./task-provenance";

type ImageGeneration = Pick<GenerateImageResult, "calls" | "usage">;

/**
 * Image results carry one entry per provider call. The last call is the one
 * whose image the task keeps; AI Gateway's routing metadata names the model
 * that drew it, which differs from the requested one after a fallback.
 */
function buildImageTaskProvenance({
  generation,
  requestedModel,
  ...details
}: TaskRunDetails & { generation: ImageGeneration; requestedModel: string }): TaskProvenance {
  const lastCall = generation.calls.at(-1);
  const gateway = readGatewayMetadata(lastCall?.providerMetadata);

  return {
    ...details,
    costUsd: sumKnown(
      generation.calls.map((call) => readGatewayMetadata(call.providerMetadata).costUsd),
    ),
    model: gateway.servedModel ?? lastCall?.response.modelId ?? requestedModel,
    provider: gateway.servedProvider ?? getModelFamily(requestedModel),
    requestedModel,
    usage: {
      inputTokens: generation.usage.inputTokens,
      outputTokens: generation.usage.outputTokens,
      totalTokens: generation.usage.totalTokens,
    },
  };
}

/**
 * The image counterpart of `runTaskGeneration`: the same run id, prompt
 * version, latency and `$ai_generation` event, built from an image result.
 */
export async function runImageTaskGeneration<TGeneration extends ImageGeneration>({
  generate,
  requestedModel,
  ...input
}: TaskGenerationInput & {
  generate: () => Promise<TGeneration>;
  requestedModel: string;
}): Promise<{ provenance: TaskProvenance; result: TGeneration }> {
  const run = startTaskRun(input);
  const result = await generate();

  const provenance = await run.finish((details) =>
    buildImageTaskProvenance({ ...details, generation: result, requestedModel }),
  );

  return { provenance, result };
}
