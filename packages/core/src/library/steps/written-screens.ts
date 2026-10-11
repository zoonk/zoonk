import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type StepKind } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getOptionId, shuffleAnswerOptions } from "../_utils/answer-options";
import { validateActivity, validateExploreActivity } from "../activities/validate-activity";
import { type MathCheckInput, toMathCheckContent } from "./_utils/math-check-content";
import { optionTextSchema } from "./contract/content-schemas";
import { describeContentIssues, safeParseStepContent } from "./contract/step-contract";

/** The math behind a check, stored as a numeric item so reviews can use new numbers. */
export type ScreenMathItem = Omit<MathCheckInput, "correctReason">;

/** A written screen as a stored step, or the problems that keep it from being one. */
export type ConvertedScreen =
  | { ok: true; kind: StepKind; content: object; mathItem: ScreenMathItem | null }
  | { ok: false; problems: string[] };

type ConvertOptions = {
  language: string;
  /** Pictures go where the lesson spec asked for one, or on a question about one. */
  allowImage: boolean;
};

/** Optional contract fields are left out instead of stored as null or empty text. */
function optional(key: string, value: string | null | undefined): Record<string, string> {
  const cleaned = value?.trim();
  return cleaned ? { [key]: cleaned } : {};
}

/** A screen's picture, with the parts its numbers mark when a question asks where one sits. */
function imageField(
  screen: { image: { alt: string; parts?: string[] | null; prompt: string } | null },
  allowImage: boolean,
) {
  if (!allowImage || !screen.image) {
    return {};
  }

  const { alt, parts, prompt } = screen.image;

  return {
    image: {
      alt: alt.trim(),
      ...(parts ? { parts: parts.map((part) => part.trim()) } : {}),
      prompt: prompt.trim(),
    },
  };
}

/** A picture option's own picture: drawn alone, like a screen's (see `imageField`). */
function pictureField(
  option: { picture?: { alt: string; prompt: string } | null },
  allowImage: boolean,
) {
  return allowImage && option.picture
    ? { picture: { alt: option.picture.alt.trim(), prompt: option.picture.prompt.trim() } }
    : {};
}

/** A chart or timeline is drawn by code from its data, so any screen may carry one. */
function visualField(screen: { visual: LessonVisual | null }) {
  return screen.visual ? { visual: screen.visual } : {};
}

/**
 * The template an explanation shows to explore, when its JSON is valid and passes the same rules
 * as an activity's. One that doesn't is left out: the screen still teaches with its words, so it's
 * never a reason to hold the lesson back.
 */
function exploreField(explore: { content: string; template: string } | null) {
  const parsed = explore ? parseActivityJson(explore.content) : null;

  if (!explore || !parsed?.ok) {
    return {};
  }

  // Only the fields and data matter here: a prompt or check written out of habit is left out.
  const value = isJsonObject(parsed.value) ? parsed.value : {};

  const validated = validateExploreActivity({
    data: value.data,
    fields: value.fields,
    template: explore.template,
  });

  return validated.ok ? { explore: validated.content } : {};
}

/** Writer fields map one to one onto the contract, except for ids, nulls and empty lists. */
function toTeachingContent(
  screen: Exclude<WrittenScreen, { kind: "activity" | "mathCheck" }>,
  allowImage: boolean,
): { kind: StepKind; content: object } {
  switch (screen.kind) {
    case "hookGuess":
      return {
        content: {
          ...imageField(screen, allowImage),
          options: shuffleAnswerOptions(screen.options).map((option, index) => ({
            id: getOptionId(index),
            isCorrect: option.isCorrect,
            text: option.text.trim(),
          })),
          question: screen.question.trim(),
          reveal: screen.reveal.trim(),
          variant: "guess",
          ...visualField(screen),
        },
        kind: "hook",
      };
    case "hookText":
      return {
        content: {
          ...imageField(screen, allowImage),
          text: screen.text.trim(),
          variant: "text",
          ...visualField(screen),
        },
        kind: "hook",
      };
    case "explanation":
      return {
        content: {
          ...imageField(screen, allowImage),
          ...(screen.exampleLineIdea?.trim()
            ? { exampleLineSlot: { idea: screen.exampleLineIdea.trim() } }
            : {}),
          ...exploreField(screen.explore),
          text: screen.text.trim(),
          ...optional("title", screen.title),
          ...visualField(screen),
        },
        kind: "explanation",
      };
    case "workedExample":
      return {
        content: {
          ...imageField(screen, allowImage),
          problem: screen.problem.trim(),
          result: screen.result.trim(),
          steps: screen.steps.map((step) => ({
            ...optional("math", step.math),
            text: step.text.trim(),
          })),
          ...optional("title", screen.title),
          ...visualField(screen),
        },
        kind: "workedExample",
      };
    case "check":
      return {
        content: {
          ...optional("context", screen.context),
          ...imageField(screen, allowImage),
          options: shuffleAnswerOptions(screen.options).map((option, index) => ({
            id: getOptionId(index),
            isCorrect: option.isCorrect,
            ...pictureField(option, allowImage),
            reason: option.reason.trim(),
            text: option.text.trim(),
          })),
          question: screen.question.trim(),
          ...visualField(screen),
        },
        kind: "check",
      };
    case "typedAnswer": {
      // Accepted answers are short wordings code can match; a sentence-long one is graded by its
      // key points anyway, so it's left out instead of failing the lesson.
      const acceptedAnswers = screen.acceptedAnswers
        .map((answer) => answer.trim())
        .filter((answer) => optionTextSchema.safeParse(answer).success);

      return {
        content: {
          ...(acceptedAnswers.length > 0 ? { acceptedAnswers } : {}),
          ...optional("context", screen.context),
          keyPoints: screen.keyPoints.map((point) => point.trim()),
          question: screen.question.trim(),
          sampleAnswer: screen.sampleAnswer.trim(),
          ...visualField(screen),
        },
        kind: "typedAnswer",
      };
    }
    default:
      throw new Error("Unknown written screen kind.");
  }
}

function parseActivityJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ok: false };
  }
}

function toActivityStep(screen: Extract<WrittenScreen, { kind: "activity" }>): ConvertedScreen {
  const parsed = parseActivityJson(screen.content);

  if (!parsed.ok) {
    return { ok: false, problems: [`The activity content isn't valid JSON: ${parsed.error}.`] };
  }

  const value = typeof parsed.value === "object" && parsed.value !== null ? parsed.value : {};
  const validated = validateActivity({ ...value, template: screen.template });

  return validated.ok
    ? { content: validated.content, kind: "activity", mathItem: null, ok: true }
    : {
        ok: false,
        problems: validated.issues.map((issue) =>
          issue.path ? `${issue.path}: ${issue.message}` : issue.message,
        ),
      };
}

function toValidatedStep({
  content,
  kind,
  mathItem,
}: {
  content: object;
  kind: StepKind;
  mathItem: ScreenMathItem | null;
}): ConvertedScreen {
  const parsed = safeParseStepContent(kind, content);

  return parsed.success
    ? { content: parsed.data, kind, mathItem, ok: true }
    : { ok: false, problems: describeContentIssues(parsed.error) };
}

/**
 * Turns one screen as the lesson writer (or a variant) wrote it into stored
 * step content that passes the versioned step contract: activities through the
 * activity validator, calculations into checks whose numbers code computed,
 * charts and timelines as drawn data, and pictures only where they're allowed.
 * Problems are written for the writer's fix pass.
 */
export function toStepContent(screen: WrittenScreen, options: ConvertOptions): ConvertedScreen {
  if (screen.kind === "activity") {
    return toActivityStep(screen);
  }

  if (screen.kind === "mathCheck") {
    const converted = toMathCheckContent({ input: screen, language: options.language });

    return converted.ok
      ? toValidatedStep({ content: converted.content, kind: "check", mathItem: converted.item })
      : converted;
  }

  return toValidatedStep({ ...toTeachingContent(screen, options.allowImage), mathItem: null });
}
