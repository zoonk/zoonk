import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";

/**
 * A piece of learner-facing text. `prose` is running text a learner reads, so
 * reading-level rules apply; labels, options and formulas aren't prose.
 */
type ScreenText = { prose: boolean; text: string };

function prose(...texts: (string | null | undefined)[]): ScreenText[] {
  return texts.flatMap((text) => (text ? [{ prose: true, text }] : []));
}

function labels(...texts: (string | null | undefined)[]): ScreenText[] {
  return texts.flatMap((text) => (text ? [{ prose: false, text }] : []));
}

/**
 * Every text a learner reads on a written screen. Calculations as data keep
 * their placeholders and activities are JSON, so only their prompts count.
 */
export function getScreenTexts(screen: WrittenScreen): ScreenText[] {
  switch (screen.kind) {
    case "hookGuess":
      return [
        ...prose(screen.question, screen.reveal),
        ...labels(...screen.options.map((option) => option.text)),
      ];
    case "hookText":
      return prose(screen.text);
    case "explanation":
      return [...labels(screen.title), ...prose(screen.text)];
    case "workedExample":
      return [
        ...labels(screen.title, ...screen.steps.map((step) => step.math)),
        ...prose(screen.problem, screen.result, ...screen.steps.map((step) => step.text)),
      ];
    case "check":
      return [
        ...prose(screen.context, screen.question, ...screen.options.map((option) => option.reason)),
        ...labels(...screen.options.map((option) => option.text)),
      ];
    case "mathCheck":
      return prose(screen.context, screen.question, screen.correctReason);
    case "typedAnswer":
      return prose(screen.context, screen.question, screen.sampleAnswer);
    case "activity":
      return [];
    default:
      throw new Error("Unknown written screen kind.");
  }
}
