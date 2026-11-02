import { type GenerateImageResult } from "ai";
import { getModelFamily } from "../_utils/model-family";
import { type PromptTrainingInput, runUnderPromptTrainingRule } from "../data-protection";
import { computeCallCostUsd } from "../pricing/call-cost";
import { readGatewayMetadata } from "./gateway-metadata";
import { type TaskGenerationInput, type TaskRunDetails, startTaskRun } from "./run-task-generation";
import { type TaskProvenance, sumKnown } from "./task-provenance";

type ImageGeneration = Pick<GenerateImageResult, "calls" | "images" | "usage">;

/**
 * The last provider call's image is the one kept; the gateway's routing metadata names the model
 * that drew it, which differs from the requested one after a fallback.
 */
function buildImageTaskProvenance({
  generation,
  requestedModel,
  ...details
}: TaskRunDetails & { generation: ImageGeneration; requestedModel: string }): TaskProvenance {
  const lastCall = generation.calls.at(-1);
  const gateway = readGatewayMetadata(lastCall?.providerMetadata);
  const model = gateway.servedModel ?? lastCall?.response.modelId ?? requestedModel;

  const usage = {
    images: generation.images.length,
    inputTokens: generation.usage.inputTokens,
    outputTokens: generation.usage.outputTokens,
    totalTokens: generation.usage.totalTokens,
  };

  return {
    ...details,
    costUsd: computeCallCostUsd({ model, usage }),
    credential: gateway.credential,
    gatewayCostUsd: sumKnown(
      generation.calls.map((call) => readGatewayMetadata(call.providerMetadata).costUsd),
    ),
    model,
    provider: gateway.servedProvider ?? getModelFamily(requestedModel),
    requestedModel,
    usage,
  };
}

export async function runImageTaskGeneration<TGeneration extends ImageGeneration>({
  generate,
  libraryInput,
  requestedModel,
  ...input
}: TaskGenerationInput &
  PromptTrainingInput & {
    generate: (rule: { promptTraining: boolean }) => Promise<TGeneration>;
    requestedModel: string;
  }): Promise<{ provenance: TaskProvenance; result: TGeneration }> {
  const run = startTaskRun(input);

  const result = await runUnderPromptTrainingRule({
    contentScope: input.analytics?.contentScope,
    generate,
    libraryInput,
  });

  const provenance = await run.finish((details) =>
    buildImageTaskProvenance({ ...details, generation: result, requestedModel }),
  );

  return { provenance, result };
}
