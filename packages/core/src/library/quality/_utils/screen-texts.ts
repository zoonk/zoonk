import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type TextLayout } from "@zoonk/utils/text-flaws";

/**
 * A piece of learner-facing text. `prose` is running text a learner reads, so
 * reading-level rules apply; labels, options and formulas aren't prose. Prose
 * shows as blocks (lines, lists, tables of data), a label as one line, and a
 * formula is LaTeX, never Markdown (`layout` null).
 */
type ScreenText = { layout: TextLayout | null; prose: boolean; text: string };

const PROSE = { layout: "blocks", prose: true } as const;
const LABEL = { layout: "inline", prose: false } as const;
const FORMULA = { layout: null, prose: false } as const;

type TextKind = typeof FORMULA | typeof LABEL | typeof PROSE;
type TextMap = (entry: ScreenText) => string;

function mapOptional(text: string | null, rewrite: (text: string) => string): string | null {
  return text === null ? null : rewrite(text);
}

/**
 * Every text a learner reads on a written screen, each rewritten by `map` with how it shows, in
 * the order learners read the kinds of text: prose, then labels (a title comes first). Empty texts
 * are never mapped. Calculations as data keep their placeholders and activities are JSON, so only
 * their prompts count.
 */
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

/** Every text a learner reads on a written screen, with how it shows (see `mapScreenTexts`). */
export function getScreenTexts(screen: WrittenScreen): ScreenText[] {
  const texts: ScreenText[] = [];

  mapScreenTexts(screen, (entry) => {
    texts.push(entry);
    return entry.text;
  });

  return texts;
}
