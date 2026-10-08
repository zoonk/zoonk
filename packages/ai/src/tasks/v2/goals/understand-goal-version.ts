import { getPromptVersion } from "@zoonk/utils/prompt-version";
import systemPrompt from "./understand-goal.prompt.md";

/**
 * The prompt version every reading of a goal records (`understandGoal`'s provenance), on its own
 * so a stored reading can be checked against it without loading the task: one from an older
 * prompt (a longer title, say) is read again instead of reused.
 */
export const UNDERSTAND_GOAL_PROMPT_VERSION = getPromptVersion({ systemPrompt });
