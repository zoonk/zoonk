import { MAX_IMAGE_ALT_LENGTH, MAX_IMAGE_PROMPT_LENGTH } from "../images/image-request-schema";
import { MAX_CHECK_OPTIONS, MAX_GUESS_OPTIONS } from "./written-lesson-schema";

const ELLIPSIS = "…";

const MAX_OPTIONS_BY_KIND: Readonly<Partial<Record<string, number>>> = {
  check: MAX_CHECK_OPTIONS,
  hookGuess: MAX_GUESS_OPTIONS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Ends at the last whole word that fits, so a description loses its tail, never half a word. */
function shortenAtWord(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }

  const head = text.slice(0, max - ELLIPSIS.length);
  const lastSpace = head.lastIndexOf(" ");
  const words = lastSpace > 0 ? head.slice(0, lastSpace) : head;

  return `${words.replace(/[\s,;:.-]+$/u, "")}${ELLIPSIS}`;
}

function fitPicture(picture: unknown): unknown {
  if (!isRecord(picture)) {
    return picture;
  }

  return {
    ...picture,
    ...(typeof picture.alt === "string" && {
      alt: shortenAtWord(picture.alt, MAX_IMAGE_ALT_LENGTH),
    }),
    ...(typeof picture.prompt === "string" && {
      prompt: shortenAtWord(picture.prompt, MAX_IMAGE_PROMPT_LENGTH),
    }),
  };
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

  return {
    ...screen,
    ...("image" in screen && { image: fitPicture(screen.image) }),
    ...(fitted && {
      options: fitted.map((option): unknown =>
        isRecord(option) && "picture" in option
          ? { ...option, picture: fitPicture(option.picture) }
          : option,
      ),
    }),
  };
}

/**
 * Brings the flaws code can repair within the written lesson's bounds before it's validated, so a
 * lesson isn't written again over an `alt` one word too long or a fifth option on a guess (Terra
 * wrote both in 40 lessons, 3 Nov 2026). Anything else out of bounds still fails.
 */
export function fitWrittenBounds(answer: unknown): unknown {
  if (!isRecord(answer) || !Array.isArray(answer.screens)) {
    return answer;
  }

  return { ...answer, screens: answer.screens.map((screen) => fitScreen(screen)) };
}
