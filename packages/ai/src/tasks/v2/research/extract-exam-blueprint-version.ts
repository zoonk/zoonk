import { getPromptVersion } from "@zoonk/utils/prompt-version";
import systemPrompt from "./extract-exam-blueprint.prompt.md";

/**
 * The prompt version every reading of an exam's documents records (`extractExamBlueprint`'s
 * provenance), on its own so a stored blueprint can be checked against it without loading the
 * task: a notice already read with these instructions isn't read again.
 */
export const EXAM_BLUEPRINT_PROMPT_VERSION = getPromptVersion({ systemPrompt });
