import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type LessonTutorConfig } from "../lesson/lesson-player-types";
import { type LessonQuestionNavigation } from "../questions/lesson-question-navigation";
import { TestLink } from "./render-lesson-player";
import { TUTOR_API_URL, TUTOR_AUTHORIZATION } from "./tutor-api";

/** A learner's buddy as the host reads it: Zu, named Pip by the learner. */
const TEST_BUDDY: NonNullable<LessonTutorConfig["buddy"]> = {
  beltColor: "white",
  energy: null,
  glasses: "round",
  kind: "zu",
  name: "Pip",
};

/** The lesson payload's tutor suggestions, as the server words them for an English lesson. */
const ENGLISH_SUGGESTIONS: LessonTutorSuggestion[] = [
  { id: "simpler", label: "Explain it more simply" },
  { id: "deeper", label: "I want to go deeper" },
  { id: "example", label: "Give me another example" },
];

/**
 * The tutor as a host app sets it up for a learner who may ask, reaching the faked API. The
 * learner's buddy (Pip) answers unless a test passes `buddy: null` (no buddy picked yet); the
 * lesson's suggestions are English unless a test passes the payload's own.
 */
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
