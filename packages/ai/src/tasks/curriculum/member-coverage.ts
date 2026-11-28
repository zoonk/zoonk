import "server-only";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { getVerbForm } from "../_utils/verb-form";
import { toSkillNameKey } from "./_utils/skill-graph-checks";
import systemPrompt from "./member-coverage.prompt.md";

/**
 * On 8 cases × 5 runs (27 Nov 2026), Haiku 5.5 scored 10.00 at $1.79/1k and 27.4 s p95 (the
 * 114-surah lists; 2 s for a goal that names no list). GPT-6 Luna scored 9.90 at $1.01/1k but once
 * wrote 113 surahs, renumbering past the one the graph dropped, the failure this check exists for.
 * Gemini 3.8 Flash (2 runs) scored 9.75 at $15.78/1k and 75.7 s p95, flagging a book the graph
 * taught.
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["openai/gpt-6-luna"] as const;

const schema = z.object({
  members: z.array(z.object({ name: z.string(), number: z.number(), skills: z.array(z.string()) })),
  missing: z.array(z.object({ description: z.string(), name: z.string(), number: z.number() })),
  reason: z.string(),
  set: z.string().nullable(),
});

type RawMemberCoverage = z.infer<typeof schema>;

export type MemberCoverageParams = {
  language: string;
  goal: string;
  skills: { key: string; name: string }[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

export type SetMember = { number: number; name: string; skills: string[] };

/** A member no skill teaches, with the skill that would teach it. */
export type UncoveredMember = { number: number; member: string; name: string; description: string };

export type MemberCoverage = {
  /** The complete list the goal names; null when the goal isn't to learn every member of one. */
  set: string | null;
  /** In the list's order; `skills` holds only keys from the graph. */
  members: SetMember[];
  uncovered: UncoveredMember[];
  /** Why the plan needs them, in the learner's language; null when nothing is missing. */
  reason: string | null;
};

const NO_SET: MemberCoverage = { members: [], reason: null, set: null, uncovered: [] };

function toMembers({
  members,
  skillKeys,
}: {
  members: RawMemberCoverage["members"];
  skillKeys: ReadonlySet<string>;
}): SetMember[] {
  const numbers = new Set<number>();

  return members.flatMap((member) => {
    const name = toPlainLine(member.name);

    if (!name || numbers.has(member.number)) {
      return [];
    }

    numbers.add(member.number);
    const skills = [...new Set(member.skills.filter((key) => skillKeys.has(key)))];
    return [{ name, number: member.number, skills }];
  });
}

/**
 * Code decides which members are uncovered, from the keys the model mapped; a `missing` entry only
 * names the skill, and a member without one is named after itself.
 */
function toUncovered({
  graphNames,
  members,
  missing,
}: {
  graphNames: ReadonlySet<string>;
  members: readonly SetMember[];
  missing: RawMemberCoverage["missing"];
}): UncoveredMember[] {
  return members.flatMap((member) => {
    if (member.skills.length > 0) {
      return [];
    }

    const entry = missing.find((item) => item.number === member.number);
    const name = toPlainLine(entry?.name ?? "") || member.name;
    const description = toPlainLine(entry?.description ?? "") || member.name;

    // The graph already has this skill under its own key, so the model only failed to map it.
    if (graphNames.has(toSkillNameKey(name))) {
      return [];
    }

    return [{ description, member: member.name, name, number: member.number }];
  });
}

export function normalizeMemberCoverage({
  output,
  skills,
}: {
  output: RawMemberCoverage;
  skills: readonly { key: string; name: string }[];
}): MemberCoverage {
  const set = output.set === null ? "" : toPlainLine(output.set);

  if (!set) {
    return NO_SET;
  }

  const members = toMembers({
    members: output.members,
    skillKeys: new Set(skills.map((skill) => skill.key)),
  });

  const uncovered = toUncovered({
    graphNames: new Set(skills.map((skill) => toSkillNameKey(skill.name))),
    members,
    missing: output.missing,
  });

  const reason = toPlainLine(output.reason);

  return { members, reason: uncovered.length > 0 && reason ? reason : null, set, uncovered };
}

function buildUserPrompt(params: MemberCoverageParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    VERB_FORM: ${getVerbForm(params.language)}
    SKILLS:
${params.skills.map((skill) => `- ${skill.key}: ${skill.name}`).join("\n")}

${formatUntrustedInput({ GOAL: params.goal })}
  `;
}

/** Finds the members of a complete list that a goal's skill graph doesn't teach. */
export async function checkMemberCoverage(params: MemberCoverageParams) {
  const { analytics, model = defaultModel, serviceTier, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
      }),
    libraryInput: true,
    systemPrompt,
    task: "member-coverage",
  });

  const data = normalizeMemberCoverage({ output: result.output, skills: params.skills });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
