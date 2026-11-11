import { type LearnerLanguages } from "./types";

export function practiceLanguages(input: {
  learnerLanguage: string;
  targetLanguage: string;
}): LearnerLanguages {
  return { language: input.learnerLanguage, otherLanguages: [input.targetLanguage] };
}

export function ownLanguage(input: { language: string }): LearnerLanguages {
  return { language: input.language };
}
