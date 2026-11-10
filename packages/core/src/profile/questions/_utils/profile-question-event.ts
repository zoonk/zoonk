import { type ProfileQuestion } from "@zoonk/db/enums";
import { type ServerAnalyticsEvent } from "../../../analytics/events";
import { type ProfileAnswerInput } from "../profile-question-contract";

function answerMetrics(input: ProfileAnswerInput) {
  switch (input.question) {
    case "work":
      return {
        options: [],
        picks: input.answer.status ? 1 : 0,
        typedText: Boolean(input.answer.job),
      };
    case "studies":
      return {
        options: input.answer.studies.map((study) => study.field),
        picks: input.answer.studies.length,
        typedText: input.answer.studies.some((study) => Boolean(study.subject)),
      };
    case "activities":
    case "listen":
    case "play":
    case "read":
    case "tools":
    case "watch":
      return {
        options: input.answer.picks,
        picks: input.answer.picks.length,
        typedText: Boolean(input.answer.favorites),
      };
    case "conditions":
    case "learningSupport":
      return { options: [], picks: 0, typedText: false };
    default:
      return input satisfies never;
  }
}

export function toProfileQuestionSavedEvent({
  input,
  from,
}: {
  input: ProfileAnswerInput | { question: ProfileQuestion; answer: null };
  from: "onboarding" | "settings";
}): Extract<ServerAnalyticsEvent, { name: "Profile Question Saved" }> {
  let outcome: "answered" | "declined" | "skipped" = "skipped";

  if (input.answer) {
    outcome = input.answer.declined ? "declined" : "answered";
  }

  const name = "Profile Question Saved";

  if (input.question === "conditions") {
    return { name, properties: { from, question: input.question } };
  }

  if (input.question === "learningSupport") {
    return { name, properties: { from, outcome, question: input.question } };
  }

  const metrics =
    input.answer === null ? { options: [], picks: 0, typedText: false } : answerMetrics(input);

  const { picks, typedText } = metrics;

  return input.question === "work"
    ? { name, properties: { from, outcome, picks, question: input.question, typedText } }
    : {
        name,
        properties: {
          from,
          options: metrics.options,
          outcome,
          picks,
          question: input.question,
          typedText,
        },
      };
}
