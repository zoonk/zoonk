import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import {
  MAX_SCREEN_CHARACTERS,
  countScreenCharacters,
} from "@zoonk/ai/tasks/lesson-writer/screen-length";
import { removeMarkdownTables } from "@zoonk/utils/markdown-table";

type ReadingPiece = { part: string | null; text: string };

/**
 * What the learner reads at once: a worked example shows its problem, then one step at a time.
 * Tables are left out, since detail belongs in them; options and reasons have their own limits.
 */
function getReadingPieces(screen: WrittenScreen): ReadingPiece[] {
  if (screen.kind === "hookText" || screen.kind === "explanation") {
    return [{ part: null, text: screen.text }];
  }

  if (screen.kind === "hookGuess") {
    return [{ part: null, text: screen.question }];
  }

  if (screen.kind === "workedExample") {
    return [
      { part: "problem", text: screen.problem },
      ...screen.steps.map((step, index) => ({ part: `step ${index + 1}`, text: step.text })),
      { part: "result", text: screen.result },
    ];
  }

  if (screen.kind === "activity") {
    return [];
  }

  return [{ part: null, text: [screen.context, screen.question].filter(Boolean).join("\n") }];
}

type LongScreen = { characters: number; part: string | null; screen: number };

export function findLongScreens(screens: readonly WrittenScreen[]): LongScreen[] {
  return screens.flatMap((screen, index) =>
    getReadingPieces(screen).flatMap(({ part, text }) => {
      const characters = countScreenCharacters(removeMarkdownTables(text));
      return characters > MAX_SCREEN_CHARACTERS ? [{ characters, part, screen: index }] : [];
    }),
  );
}
