import { type SerializedStep } from "../../player/contracts/prepare-lesson-data";
import { type PlayableLibraryStep } from "../playable-lesson";

function joinContext(context: string | undefined, question: string): string {
  return context ? `${context}\n\n${question}` : question;
}

/** Screens built from the lesson's word or sentence show it as the prompt instead of storing one in their content. */
function getExerciseQuestion({ content, kind, sentence, word }: SerializedStep): string | null {
  switch (kind) {
    case "listening":
      return sentence?.sentence ?? null;
    case "reading":
      return sentence?.translation ?? null;
    case "translation":
      return word?.translation ?? null;
    case "alphabet":
    case "fillBlank":
    case "matchColumns":
    case "multipleChoice":
    case "vocabulary":
      return getContentQuestion(content);
    default:
      return null;
  }
}

function getContentQuestion(content: object): string | null {
  const question = "question" in content ? content.question : null;
  const template = "template" in content ? content.template : null;
  const context = "context" in content ? content.context : null;

  const text = [context, question ?? template].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );

  return text.length > 0 ? text.join("\n\n") : null;
}

export function getStepQuestion(step: PlayableLibraryStep): string | null {
  if ("exercise" in step) {
    return getExerciseQuestion(step.exercise);
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
