import { defineScoreCategories } from "@/lib/score-categories";

export const WARM_UP_CARDS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Check every card as an expert in the subject. The option marked correct is right, no other option is also right or partly right, and the reveal agrees with it and is true in every detail. Nothing from the never-write list: personal content, records or superlatives that can change, exact figures that aren't standard textbook numbers, anything that changes with time (current laws, rules, taxes, prices, versions, news, an exam's own dates, fees, question counts, scoring or cutoffs), quotes or who said something, "scientists recently found", health, legal or money advice (what someone should do), famous myths stated as facts, disputed trivia, jokes at someone's expense. Count the cards that are false, have a second right option, or break the never-write list: score at most 8 with one, 6 with two, and 4 with three or more. A checker drops doubtful cards before learners see them, so the count is what matters.`,
    id: "accuracy",
    label: "Accuracy and safe topics",
    weight: 40,
  },
  {
    expectations: `It works as a pretest for a beginner: each card is about an idea the learner meets in the first weeks of this goal, with a gap the learner wants closed and a surprising but fair answer. The strongest hook comes first, easy before hard, a mix of shapes (how many, which one, which is bigger, finish the sentence), and never two cards on one idea or one card giving away another's answer. Wrong options are ones a beginner might pick and an expert never would. A broad subject gets about 10 cards; a niche or sensitive one may have fewer, and fewer true cards beat a full deck with a doubtful one. Topics a case's expectations list are examples of what fits, not a checklist: never lower a score for leaving one out. Score at most 7 when cards are trivia unrelated to what a beginner will learn, when the answer is obvious from the question, or when two cards test the same idea.`,
    id: "pretest",
    label: "Pretest value and deck order",
    weight: 25,
  },
  {
    expectations: `The question is one sentence of about 50 to 110 characters (it may end in "…" to be completed). Options are 1 to 6 words, 2 for "which is bigger, older, longer" and 3 otherwise, and none is "both", "all of the above" or "none of these". The reveal is 1 or 2 sentences of at most about 220 characters, starts with the answer, then gives the why, never repeats the question, and never says whether the learner guessed right. Score at most 7 when several cards break these limits.`,
    id: "format",
    label: "Card format",
    weight: 15,
  },
  {
    expectations: `Written entirely in the learner's language and its variety (Brazilian Portuguese for pt, US English for en, Mexican Spanish for es), natural and correct. A language goal's target-language words are in quotes, exactly as written in that language. The tone is a good YouTube teacher's: everyday words, concrete pictures, a little playful, never silly. No "Did you know", "Fun fact", exclamation marks or emoji. Score at most 6 when cards mix languages outside quoted target-language words, and at most 7 when the tone is dry like an exam or childish.`,
    id: "language",
    label: "Language and tone",
    weight: 20,
  },
]);
