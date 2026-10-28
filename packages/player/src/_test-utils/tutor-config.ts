import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type LessonTutorConfig } from "../lesson/lesson-player-types";
import { type LessonQuestionNavigation } from "../questions/lesson-question-navigation";
import { TestLink } from "./render-lesson-player";
import { TUTOR_API_URL, TUTOR_AUTHORIZATION } from "./tutor-api";

const TEST_BUDDY: NonNullable<LessonTutorConfig["buddy"]> = {
  beltColor: "white",
  energy: null,
  glasses: "round",
  kind: "zu",
  name: "Pip",
};

const ENGLISH_SUGGESTIONS: LessonTutorSuggestion[] = [
  { id: "simpler", label: "Explain it more simply" },
  { id: "deeper", label: "I want to go deeper" },
  { id: "example", label: "Give me another example" },
];

export function buildTutor(
  navigation: Partial<LessonQuestionNavigation> = {},
  {
    buddy = TEST_BUDDY,
    suggestions = ENGLISH_SUGGESTIONS,
  }: { buddy?: LessonTutorConfig["buddy"]; suggestions?: LessonTutorSuggestion[] } = {},
): LessonTutorConfig {
  return {
    buddy,
    canAsk: true,
    connection: {
      apiUrl: TUTOR_API_URL,
      getHeaders: () => Promise.resolve({ Authorization: TUTOR_AUTHORIZATION }),
    },
    navigation: {
      linkComponent: TestLink,
      loginHref: "/login",
      subscriptionHref: "/subscription",
      ...navigation,
    },
    suggestions,
  };
}
