import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type StepKind } from "@zoonk/db";
import { getOptionId, shuffleAnswerOptions } from "../_utils/answer-options";
import { validateActivity } from "../activities/validate-activity";
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
  /** Pictures only go where the lesson spec asked for one. */
  allowImage: boolean;
};

/** Optional contract fields are left out instead of stored as null or empty text. */
function optional(key: string, value: string | null | undefined): Record<string, string> {
  const cleaned = value?.trim();
  return cleaned ? { [key]: cleaned } : {};
}

function imageField(
  screen: { image: { alt: string; prompt: string } | null },
  allowImage: boolean,
) {
  return allowImage && screen.image
    ? { image: { alt: screen.image.alt.trim(), prompt: screen.image.prompt.trim() } }
    : {};
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
        },
        kind: "hook",
      };
    case "hookText":
      return {
        content: { ...imageField(screen, allowImage), text: screen.text.trim(), variant: "text" },
        kind: "hook",
      };
    case "explanation":
      return {
        content: {
          ...imageField(screen, allowImage),
          ...(screen.exampleLineIdea?.trim()
            ? { exampleLineSlot: { idea: screen.exampleLineIdea.trim() } }
            : {}),
          text: screen.text.trim(),
          ...optional("title", screen.title),
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
            reason: option.reason.trim(),
            text: option.text.trim(),
          })),
          question: screen.question.trim(),
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
 * and pictures only where they were planned. Problems are written for the
 * writer's fix pass.
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
