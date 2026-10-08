import { type PlayableLibraryStep } from "../contract";

function joinContext(context: string | undefined, question: string): string {
  return context ? `${context}\n\n${question}` : question;
}

function getExerciseQuestion(content: object): string | null {
  const question = "question" in content ? content.question : null;
  const template = "template" in content ? content.template : null;
  const context = "context" in content ? content.context : null;

  const text = [context, question ?? template].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );

  return text.length > 0 ? text.join("\n\n") : null;
}

/**
 * The question a screen asked, as the mistakes notebook keeps it, so an entry stays readable
 * after the lesson is regenerated.
 */
export function getStepQuestion(step: PlayableLibraryStep): string | null {
  if ("exercise" in step) {
    return getExerciseQuestion(step.exercise.content);
  }

  switch (step.kind) {
    case "check":
      return joinContext(step.content.context, step.content.question);
    case "typedAnswer":
      return joinContext(step.content.context, step.content.question);
    case "spokenAnswer":
      return `${step.content.prompt}\n\n${step.content.targetText}`;
    case "activity":
      return step.content.check.kind === "interaction"
        ? step.content.prompt
        : step.content.check.question;
    // A case is played through, not asked again, so it never goes to the mistakes notebook.
    case "challenge":
    case "explanation":
    case "hook":
    case "summary":
    case "workedExample":
      return null;
    default:
      return null;
  }
}
