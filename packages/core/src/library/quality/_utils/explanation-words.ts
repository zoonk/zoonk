import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { removeMarkdownTables } from "@zoonk/utils/markdown-table";
import { countWords } from "@zoonk/utils/string";

/** The words the writer aims for on an explanation; tables come on top. */
const NOVICE_TARGET = 35;
const TARGET = 45;

/** Only a real outlier is flagged, since the target is an aim, not a limit. */
const OUTLIER = 1.5;

type WordyExplanation = { screen: number; target: number; words: number };

export function findWordyExplanations({
  novice,
  screens,
}: {
  novice: boolean;
  screens: readonly WrittenScreen[];
}): WordyExplanation[] {
  const target = novice ? NOVICE_TARGET : TARGET;

  return screens.flatMap((screen, index) => {
    if (screen.kind !== "explanation") {
      return [];
    }

    const words = countWords(removeMarkdownTables(screen.text));
    return words > target * OUTLIER ? [{ screen: index, target, words }] : [];
  });
}
