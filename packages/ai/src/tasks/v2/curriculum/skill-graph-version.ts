import { getPromptVersion } from "@zoonk/utils/prompt-version";
import systemPrompt from "./skill-graph.prompt.md";

/**
 * The prompt version every skill graph records (`generateSkillGraph`'s provenance, stored on the
 * plan built from it), on its own so a stored plan can be checked against it without loading the
 * task: only a graph written with these instructions is reused for another goal.
 */
export const SKILL_GRAPH_PROMPT_VERSION = getPromptVersion({ systemPrompt });
