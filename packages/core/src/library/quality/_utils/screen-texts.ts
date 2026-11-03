import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
import { type TextLayout } from "@zoonk/utils/text-flaws";

type ScreenText = { layout: TextLayout | null; prose: boolean; text: string };

const PROSE = { layout: "blocks", prose: true } as const;
const LABEL = { layout: "inline", prose: false } as const;
const FORMULA = { layout: null, prose: false } as const;

type TextKind = typeof FORMULA | typeof LABEL | typeof PROSE;
type TextMap = (entry: ScreenText) => string;
type TextRewrite = (text: string) => string;

function mapOptional(text: string | null, rewrite: (text: string) => string): string | null {
  return text === null ? null : rewrite(text);
}

export function mapScreenTexts(screen: WrittenScreen, map: TextMap): WrittenScreen {
  const as = (kind: TextKind) => (text: string) => (text ? map({ ...kind, text }) : text);
  const [prose, label, formula] = [as(PROSE), as(LABEL), as(FORMULA)];

  switch (screen.kind) {
    case "hookGuess": {
      const [question, reveal] = [prose(screen.question), prose(screen.reveal)];
      const options = screen.options.map((option) => ({ ...option, text: label(option.text) }));
      return { ...screen, options, question, reveal };
    }
    case "hookText":
      return { ...screen, text: prose(screen.text) };
    case "explanation": {
      const title = label(screen.title);
      return { ...screen, text: prose(screen.text), title };
    }
    case "workedExample": {
      const title = label(screen.title);
      const maths = screen.steps.map((step) => mapOptional(step.math, formula));
      const [problem, result] = [prose(screen.problem), prose(screen.result)];

      const steps = screen.steps.map((step, index) => ({
        math: maths[index] ?? step.math,
        text: prose(step.text),
      }));

      return { ...screen, problem, result, steps, title };
    }
    case "check": {
      const [context, question] = [mapOptional(screen.context, prose), prose(screen.question)];
      const reasons = screen.options.map((option) => prose(option.reason));

      const options = screen.options.map((option, index) => ({
        ...option,
        reason: reasons[index] ?? option.reason,
        text: label(option.text),
      }));

      return { ...screen, context, options, question };
    }
    case "mathCheck": {
      const [context, question] = [mapOptional(screen.context, prose), prose(screen.question)];
      return { ...screen, context, correctReason: prose(screen.correctReason), question };
    }
    case "typedAnswer": {
      const [context, question] = [mapOptional(screen.context, prose), prose(screen.question)];
      return { ...screen, context, question, sampleAnswer: prose(screen.sampleAnswer) };
    }
    case "activity":
      return screen;
    default:
      throw new Error("Unknown written screen kind.");
  }
}

export function getScreenTexts(screen: WrittenScreen): ScreenText[] {
  const texts: ScreenText[] = [];

  mapScreenTexts(screen, (entry) => {
    texts.push(entry);
    return entry.text;
  });

  return texts;
}

const CHECK_PROSE = ["question", "explanation"];
const OPTION_PROSE = ["text", "reason"];

function mapProse(value: JsonObject, keys: readonly string[], rewrite: TextRewrite): JsonObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      keys.includes(key) && typeof entry === "string" ? rewrite(entry) : entry,
    ]),
  );
}

function mapCheckProse(check: JsonObject, rewrite: TextRewrite): JsonObject {
  const { options } = check;

  return {
    ...mapProse(check, CHECK_PROSE, rewrite),
    ...(Array.isArray(options) && {
      options: options.map((option) =>
        isJsonObject(option) ? mapProse(option, OPTION_PROSE, rewrite) : option,
      ),
    }),
  };
}

function parseObject(content: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Only an activity's prompt and check are prose every template shares. Its fields hold code,
 * expected output, trace values, data and labels other fields refer to, which code runs or
 * compares character for character, so they never change.
 */
export function mapActivityProse(content: string, rewrite: TextRewrite): string {
  const parsed = parseObject(content);

  if (!parsed) {
    return content;
  }

  const { check } = parsed;

  const prose = {
    ...mapProse(parsed, ["prompt"], rewrite),
    ...(isJsonObject(check) && { check: mapCheckProse(check, rewrite) }),
  };

  const written = JSON.stringify(prose);
  return written === JSON.stringify(parsed) ? content : written;
}

export function getActivityProse(content: string): string[] {
  const texts: string[] = [];

  mapActivityProse(content, (text) => {
    texts.push(text);
    return text;
  });

  return texts;
}
