import { defineScoreCategories } from "@/lib/score-categories";

export const CONVERSATION_SCENARIO_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `The call is a real moment from the unit that a person would handle by talking to someone, uses only what the unit covers, and is everyday and safe. The character fits the place: a common first name where the target variant is spoken, a plausible role, a short place name, and prices or times realistic for that country. For a speaking exam unit, the character is a neutral examiner and the call is presented as a practice mock, never an official test. Score at most 5 for a scenario outside the unit.`,
    id: "unitFit",
    label: "Fits the unit and real life",
    weight: 25,
  },
  {
    expectations: `The opening line and hints use words and structures a learner at the given level knows: at A1 and A2 short sentences with the most common words, longer and richer from B1 up. The opening line greets, says who the character is and invites the learner to talk without answering any objective. Hints are complete sentences the learner could say as they are, covering the objectives. In an exam mock, the examiner's opening is the usual greeting and the first item: the first Part 1 question for IELTS, or the Listen and Repeat directions, setting and first sentence for TOEFL. Score at most 6 when the opening line or most hints are clearly above the level.`,
    id: "level",
    label: "At the learner's level",
    weight: 20,
  },
  {
    expectations: `2 to 4 objectives, in the order they'd happen, that a learner can reach in 1 to 3 minutes of talk (about 5 for an exam mock), each checkable from what the learner says (never a feeling or attitude). Labels are 2 to 5 words starting with a verb (or the exam part names) and descriptions say what to say or find out. For an exam unit, the objectives are the exam's parts or tasks in order: IELTS's three parts, or TOEFL's "Listen and Repeat" and "Take an Interview". Score at most 6 when an objective can't be checked from speech.`,
    id: "objectives",
    label: "Objectives",
    weight: 25,
  },
  {
    expectations: `The character brief is in English and gives the voice model what it needs: personality, every fact the learner may ask about with concrete values, one small twist kept simple at A1 and A2, how to wrap up, and the instruction to speak at the level. The character doesn't do the learner's goals for them. For an exam mock, the brief is the examiner's script and the examiner never corrects or grades: for IELTS, questions for Parts 1 and 3 and the full Part 2 cue card with its topic and four bullet prompts; for TOEFL, a campus or academic setting with seven original sentences that grow from about 5 words to 14 to 20 with dependent or relative clauses, then an interview introduction and four questions going from a brief fact to an opinion and a prediction, each said once with about 45 seconds per answer. Score at most 5 when facts the objectives need are missing.`,
    id: "brief",
    label: "Character brief",
    weight: 15,
  },
  {
    expectations: `Title, situation, role and objective descriptions are in the learner's language, natural and concise; place, opening line, objective labels and hints are in the target language and its variant (US English, Brazilian Portuguese, Spain Spanish); the brief is in English. No emojis and no em dashes. Score at most 5 for a field in the wrong language.`,
    id: "languages",
    label: "Right language per field",
    weight: 15,
  },
]);
