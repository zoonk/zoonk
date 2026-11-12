import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { buildProviderOptions } from "../../provider-options";
import { type ChallengeCaseParams } from "../challenge/challenge-schema";
import systemPrompt from "./challenge-quality-check.prompt.md";
import { getLessonCheckModels } from "./lesson-check-models";

const findingSchema = z.object({
  error: z.string(),
  evidence: z.string(),
  location: z.string(),
  path: z.string(),
});

const schema = z.object({ findings: z.array(findingSchema) });

export type ChallengeFinding = z.infer<typeof findingSchema>;

export async function checkChallengeQuality(
  params: Pick<
    ChallengeCaseParams,
    | "analytics"
    | "language"
    | "level"
    | "skills"
    | "field"
    | "serviceTier"
    | "model"
    | "useFallback"
    | "reasoning"
  > & { renderedCase: string; writerModels: string[] },
) {
  const { analytics, serviceTier } = params;
  const selected = getLessonCheckModels({ writerModels: params.writerModels });
  const model = params.model ?? selected.model;
  const fallbackModels = selected.fallbackModels;

  const userPrompt = [
    `LANGUAGE: ${params.language}`,
    `LEVEL: ${params.level}`,
    params.field && `FIELD: ${params.field}`,
    `REQUIRED SKILLS: ${JSON.stringify(params.skills)}`,
    `CHALLENGE:\n${params.renderedCase}`,
  ]
    .filter(Boolean)
    .join("\n");

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier,
    useFallback: params.useFallback ?? true,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning: params.reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "challenge-quality-check",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
