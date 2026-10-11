import { defineScoreCategories } from "@/lib/score-categories";

export const WRITE_ITEM_SET_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Solve every question from the stimulus before reading its key. Each key must follow from the stimulus alone (the correct option, or the statement's judgment), with no second defensible option, and each question must need the stimulus: a learner who has the skill but didn't read it can't answer it from common sense or from the question's own words. Score at most 6 when one key is wrong or two options are defensible; at most 7 when several questions can be answered without the stimulus.`,
    id: "keys",
    label: "Right keys that need the stimulus",
    weight: 35,
  },
  {
    expectations: `The stimulus and its questions must look like the named exam's: the kind of text, case or chart, its length and register, how many questions share it, the question format and option count, and distractors from real reading mistakes (a detail true in the world but not in the text, an inference too strong, the opposite of the author's view). Questions ask different things (main idea, inference, detail in other words, purpose, data reading). Score at most 7 when the set would look out of place in the named exam.`,
    id: "examRealism",
    label: "Exam realism",
    weight: 35,
  },
  {
    expectations: `The stimulus is original: it never copies a real text or attributes itself to a real author, outlet, book or study, and invented numbers about real places, people or companies aren't presented as fact. It is written in the requested language, clearly and naturally for its kind, without em dashes. Reasons and misconceptions are in the learner's language and point to what the stimulus says. Score at most 6 when it claims a real source or invents facts about real entities; at most 7 when it reads unnaturally.`,
    id: "stimulus",
    label: "Original, clear stimulus",
    weight: 30,
  },
]);
