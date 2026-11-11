import { MAX_CHECK_OPTIONS, MAX_GUESS_OPTIONS } from "./written-lesson-schema";

const MAX_OPTIONS_BY_KIND: Readonly<Partial<Record<string, number>>> = {
  check: MAX_CHECK_OPTIONS,
  hookGuess: MAX_GUESS_OPTIONS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Drops wrong options from the end until the screen holds as many as it may. Which options are
 * right is the model's call, so with too many right ones nothing is dropped and the answer fails.
 */
function fitOptions(options: unknown[], max: number): unknown[] {
  const surplus = options.length - max;

  if (surplus <= 0) {
    return options;
  }

  const dropped = new Set(
    options
      .flatMap((option, index) => (isRecord(option) && option.isCorrect === false ? [index] : []))
      .slice(-surplus),
  );

  return dropped.size === surplus ? options.filter((_, index) => !dropped.has(index)) : options;
}

function fitScreen(screen: unknown): unknown {
  if (!isRecord(screen)) {
    return screen;
  }

  const max = typeof screen.kind === "string" ? MAX_OPTIONS_BY_KIND[screen.kind] : undefined;
  const options: unknown[] | undefined = Array.isArray(screen.options) ? screen.options : undefined;
  const fitted = options && max !== undefined ? fitOptions(options, max) : options;

  return fitted ? { ...screen, options: fitted } : screen;
}

/**
 * Brings the flaws code can repair within the written lesson's bounds before it's validated, so a
 * lesson isn't written again over a fifth option on a guess (Terra wrote it in 40 lessons, 3 Nov
 * 2026). Anything else out of bounds still fails.
 */
export function fitWrittenBounds(answer: unknown): unknown {
  if (!isRecord(answer) || !Array.isArray(answer.screens)) {
    return answer;
  }

  return { ...answer, screens: answer.screens.map((screen) => fitScreen(screen)) };
}
