import { fitOptions } from "../_utils/fit-options";
import { MAX_CHECK_OPTIONS, MAX_GUESS_OPTIONS } from "./written-lesson-schema";

/** The app lays picture options out two by two. */
const MAX_PICTURE_OPTIONS = 4;

const MAX_OPTIONS_BY_KIND: Readonly<Partial<Record<string, number>>> = {
  check: MAX_CHECK_OPTIONS,
  hookGuess: MAX_GUESS_OPTIONS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fitScreen(screen: unknown): unknown {
  if (!isRecord(screen)) {
    return screen;
  }

  const options: unknown[] | undefined = Array.isArray(screen.options) ? screen.options : undefined;
  const pictured = options?.some((option) => isRecord(option) && isRecord(option.picture));
  const kindMax = typeof screen.kind === "string" ? MAX_OPTIONS_BY_KIND[screen.kind] : undefined;
  const max = pictured ? MAX_PICTURE_OPTIONS : kindMax;
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
