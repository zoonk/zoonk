import { defineScoreCategories } from "@/lib/score-categories";

export const SPEAKING_MOCK_SCENARIO_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `The call is a practice mock of the named exam, presented as practice and never as an official test, with a neutral examiner who never corrects or grades. Topics are everyday and safe, and every sentence and question is original, not copied from published test materials. Score at most 5 for a mock that follows the wrong exam's format.`,
    id: "examFit",
    label: "Follows the exam",
    weight: 25,
  },
  {
    expectations: `The examiner keeps the exam's usual clear, natural wording at every level. Hints use words and structures a learner at the given level knows: at A1 and A2 short sentences with the most common words, longer and richer from B1 up. The opening line is the usual greeting and the first item: the first Part 1 question for IELTS, or the Listen and Repeat directions, setting and first sentence for TOEFL. Hints are general phrases to keep talking, give an opinion or add an example, never an answer about the topic. Score at most 6 when most hints are clearly above the level.`,
    id: "level",
    label: "Opening and hints",
    weight: 20,
  },
  {
    expectations: `The objectives are the exam's parts or tasks in order, one each: IELTS's three parts, or TOEFL's "Listen and Repeat" and "Take an Interview". Each description says what the candidate does in it. Score at most 5 when a part is missing or out of order.`,
    id: "objectives",
    label: "Objectives",
    weight: 20,
  },
  {
    expectations: `The character brief is the examiner's script in English, run in about the mock's minutes, with everything the examiner says written out: for IELTS, 3 or 4 Part 1 questions, the full Part 2 cue card with its topic and four bullet prompts, and 3 or 4 Part 3 questions linked to the cue card topic; for TOEFL, a campus or academic setting with seven original sentences that grow from about 5 words to 14 to 20 with dependent or relative clauses, then an interview introduction and four questions going from a brief fact to an opinion and a prediction, each said once with about 45 seconds per answer. Score at most 5 when the script misses a part's items.`,
    id: "brief",
    label: "Examiner's script",
    weight: 20,
  },
  {
    expectations: `Title, situation, role and objective descriptions are in the learner's language, natural and concise, and the situation says the mock is shorter than the real test; place, opening line, objective labels and hints are in the target language and its variant; the brief is in English. No emojis and no em dashes. Score at most 5 for a field in the wrong language.`,
    id: "languages",
    label: "Right language per field",
    weight: 15,
  },
]);
