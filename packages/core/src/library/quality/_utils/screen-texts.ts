import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type TextLayout } from "@zoonk/utils/text-flaws";

type ScreenText = { layout: TextLayout | null; prose: boolean; text: string };

const PROSE = { layout: "blocks", prose: true } as const;
const LABEL = { layout: "inline", prose: false } as const;
const FORMULA = { layout: null, prose: false } as const;

type TextKind = typeof FORMULA | typeof LABEL | typeof PROSE;
type TextMap = (entry: ScreenText) => string;

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
