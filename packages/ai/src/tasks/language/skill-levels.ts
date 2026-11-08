import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./skill-levels.prompt.md";

/**
 * On the skill-levels eval's 102 labeled skills, Luna placed 96% right, as Opus 5.5 did, at about a
 * tenth of Argon's cost (97%); at low reasoning it fell to 90%. Haiku 5.5 and Gemini's Flash Lite
 * models stayed under 89% (8 Nov 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-4-argon"] as const;

const schema = z.object({
  skills: z.array(z.object({ id: z.string(), level: z.enum(["lower", "upper"]) })),
});

type SkillLevelsSkill = {
  id: string;
  name: string;
  description: string;
  /** The band's two levels, such as A1 and A2. */
  band: readonly [CefrLevel, CefrLevel];
};

export type SkillLevelsParams = {
  targetLanguage: string;
  skills: readonly SkillLevelsSkill[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

export type SkillLevel = { id: string; level: CefrLevel };

type Answer = z.infer<typeof schema>["skills"][number];

/** The prompt numbers the skills, so the model copies a short id instead of a UUID. */
function toPromptId(index: number): string {
  return String(index + 1);
}

function formatSkills(skills: readonly SkillLevelsSkill[]): string {
  return skills
    .map(
      (skill, index) =>
        `${toPromptId(index)}. ${skill.band[0]} or ${skill.band[1]} | ${skill.name}: ${skill.description}`,
    )
    .join("\n");
}

/** A skill the model skipped or answered both ways stays untagged. */
function toSkillLevels({
  answers,
  skills,
}: {
  answers: readonly Answer[];
  skills: readonly SkillLevelsSkill[];
}): SkillLevel[] {
  return skills.flatMap((skill, index) => {
    const given = new Set(
      answers.filter((answer) => answer.id === toPromptId(index)).map((answer) => answer.level),
    );

    const [level] = given;

    if (given.size !== 1 || !level) {
      return [];
    }

    return [{ id: skill.id, level: level === "lower" ? skill.band[0] : skill.band[1] }];
  });
}

/** Places each skill at one of its band's two levels, so no answer falls outside the band. */
export async function classifySkillLevels(params: SkillLevelsParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const userPrompt = `TARGET_LANGUAGE: ${getPromptLanguageName({ language: params.targetLanguage })}
SKILLS:
${formatSkills(params.skills)}
`;

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
    libraryInput: true,
    systemPrompt,
    task: "skill-levels",
  });

  return {
    data: { levels: toSkillLevels({ answers: result.output.skills, skills: params.skills }) },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
