import { defineScoreCategories } from "@/lib/score-categories";

export const LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Each passage sits clearly at its CEFR level, and its options check the kind of understanding that level asks: A1 one stated fact in very common words, A2 stated facts put together or the order of events, B1 the main point, a reason or a stated opinion, B2 an implied attitude, purpose or argument, C1 implicit meaning, stance, tone or a qualified view, C2 a fine shade of meaning, an allusion, how an argument is built or an unstated assumption. A learner one level below would get at least one option wrong. Score at most 5 when the options can be decided at a lower level, such as by matching words.`,
    id: "calibration",
    label: "Confirms the level",
    weight: 40,
  },
  {
    expectations: `Every option is right or wrong on its own according to the passage (check the passage for each), exactly the options marked right are right, and a careful reader at the level picks exactly that set. Wrong options are plausible to someone who misread the text but clearly wrong; none is a milder or stronger version of a right one; no option can be decided from general knowledge alone; options are similar in length and form. Score at most 4 when an option is defensible both ways or a key is wrong.`,
    id: "answers",
    label: "One clearly right set",
    weight: 35,
  },
  {
    expectations: `Passages are natural and correct in the target variant. Reading passages read like real written texts and listening passages like natural speech. Questions and options are in the learner's language and its variant. No brands, real people or stereotypes. Score at most 5 for a field in the wrong language.`,
    id: "language",
    label: "Languages",
    weight: 25,
  },
]);
