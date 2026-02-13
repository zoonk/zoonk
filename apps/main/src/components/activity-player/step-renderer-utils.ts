import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SelectedAnswer } from "./player-reducer";

function getMultipleChoiceSummary(step: SerializedStep): string {
  const content = parseStepContent("multipleChoice", step.content);

  if (content.kind === "language") {
    return content.context;
  }

  return content.question ?? "";
}

function getStaticContent(step: SerializedStep): { heading: string; body: string } {
  const content = parseStepContent("static", step.content);

  if (content.variant === "grammarExample") {
    return { body: content.translation, heading: content.sentence };
  }

  if (content.variant === "grammarRule") {
    return { body: content.ruleSummary, heading: content.ruleName };
  }

  return { body: content.text, heading: content.title };
}

export function getStepSummary(step: SerializedStep): string {
  switch (step.kind) {
    case "multipleChoice":
      return getMultipleChoiceSummary(step);

    case "fillBlank":
      return parseStepContent("fillBlank", step.content).template;

    case "matchColumns":
      return parseStepContent("matchColumns", step.content).question;

    case "sortOrder":
      return parseStepContent("sortOrder", step.content).question;

    case "selectImage":
      return parseStepContent("selectImage", step.content).question;

    case "static":
      return getStaticContent(step).heading;

    case "vocabulary":
      return step.word?.word ?? "";

    case "reading":
    case "listening":
      return step.sentence?.sentence ?? "";

    default:
      return "";
  }
}

function getMultipleChoiceMockAnswer(step: SerializedStep): SelectedAnswer {
  const content = parseStepContent("multipleChoice", step.content);

  if (content.kind === "challenge") {
    return { kind: "multipleChoice", selectedIndex: 0 };
  }

  const correctIndex = content.options.findIndex((option) => option.isCorrect);
  return { kind: "multipleChoice", selectedIndex: Math.max(0, correctIndex) };
}

function getSelectImageMockAnswer(step: SerializedStep): SelectedAnswer {
  const content = parseStepContent("selectImage", step.content);
  const correctIndex = content.options.findIndex((option) => option.isCorrect);
  return { kind: "selectImage", selectedIndex: Math.max(0, correctIndex) };
}

export function getMockAnswer(step: SerializedStep): SelectedAnswer | null {
  switch (step.kind) {
    case "multipleChoice":
      return getMultipleChoiceMockAnswer(step);

    case "fillBlank":
      return {
        kind: "fillBlank",
        userAnswers: parseStepContent("fillBlank", step.content).answers,
      };

    case "matchColumns":
      return {
        kind: "matchColumns",
        userPairs: parseStepContent("matchColumns", step.content).pairs,
      };

    case "sortOrder":
      return { kind: "sortOrder", userOrder: parseStepContent("sortOrder", step.content).items };

    case "selectImage":
      return getSelectImageMockAnswer(step);

    case "vocabulary":
      return { kind: "vocabulary", selectedWordId: step.word?.id ?? "" };

    case "reading":
      return { arrangedWords: step.sentence?.sentence.split(" ") ?? [], kind: "reading" };

    case "listening":
      return { arrangedWords: step.sentence?.sentence.split(" ") ?? [], kind: "listening" };

    case "static":
      return null;

    default:
      return null;
  }
}
