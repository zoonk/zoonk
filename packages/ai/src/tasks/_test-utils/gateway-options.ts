import { noPromptTrainingMiddleware } from "../../data-protection";

type TransformInput = Parameters<NonNullable<typeof noPromptTrainingMiddleware.transformParams>>[0];

/**
 * What the gateway receives when read inside a mocked model call, where the task's prompt-training
 * rule is set.
 */
export async function readGatewayOptions(): Promise<unknown> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rule reads only the call's provider options; a full model and prompt would bury what the test is about.
  const input = { params: { prompt: [] }, type: "generate" } as unknown as TransformInput;
  const params = await noPromptTrainingMiddleware.transformParams?.(input);

  return params?.providerOptions?.gateway;
}
