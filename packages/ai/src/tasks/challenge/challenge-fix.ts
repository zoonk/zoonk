import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { buildProviderOptions } from "../../provider-options";
import { type ChallengeFinding } from "../quality/challenge-quality-check";
import systemPrompt from "./challenge-fix.prompt.md";
import { CHALLENGE_MODELS } from "./challenge-models";
import { type ChallengeCaseParams, type WrittenChallengeCase } from "./challenge-schema";

const schema = z.object({ edits: z.array(z.object({ find: z.string(), replace: z.string() })) });

export type ChallengeEdit = z.infer<typeof schema>["edits"][number];

export type ChallengeFixParams = Pick<
  ChallengeCaseParams,
  "analytics" | "reasoning" | "serviceTier" | "speed" | "useFallback"
> & { findings: ChallengeFinding[]; model: string; written: WrittenChallengeCase };

/**
 * The draft's own writer fixes it, as for lessons. On the drafts the reviewer held (12 Nov 2026),
 * Sol's 15 fixes all passed the re-review; a fix took about 15 to 18 s, cost about half a fresh
 * draft and introduced no error. Across 40 findings, no fixer left one unedited.
 */
export async function fixChallengeCase(params: ChallengeFixParams) {
  const { analytics, findings, model, reasoning, serviceTier, speed, written } = params;

  const userPrompt = `CHALLENGE:
${JSON.stringify(written, null, 1)}

FINDINGS:
${JSON.stringify(findings, null, 1)}
`;

  const providerOptions = buildProviderOptions({
    fallbackModels: CHALLENGE_MODELS.fallbackModels,
    model,
    serviceTier,
    speed,
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
        reasoning,
      }),
    libraryInput: analytics?.contentScope !== "personal",
    systemPrompt,
    task: "challenge-fix",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
