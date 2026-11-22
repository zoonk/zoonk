import {
  finishProfileToolSuggestions,
  writeProfileToolSuggestions,
} from "@zoonk/core/profile/questions/suggest-tools";

export async function writeProfileToolSuggestionsStep(
  task: Parameters<typeof writeProfileToolSuggestions>[0],
) {
  "use step";
  return writeProfileToolSuggestions(task);
}

export async function finishProfileToolSuggestionsStep(
  input: Parameters<typeof finishProfileToolSuggestions>[0],
) {
  "use step";
  await finishProfileToolSuggestions(input);
}
