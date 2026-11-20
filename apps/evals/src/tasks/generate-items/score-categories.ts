import { defineScoreCategories } from "@/lib/score-categories";

export const GENERATE_ITEMS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Solve every question yourself before reading its key. Each question must have exactly one defensible correct answer (for a question that asks the learner to pick several options, exactly one defensible set of correct options, each option right or wrong on its own), the keyed answer must be that answer, and every fact, number, rule and legal or scientific statement must be accurate for the country and date the question implies. For numeric items, recompute the answer and check that the worked steps lead to it. A wrong key, two defensible answers or a factual error marks a learner wrong for being right, or teaches them a mistake.`,
    id: "correctness",
    label: "Correctness",
    weight: 30,
  },
  {
    expectations: `Every wrong option, false statement trap or common math mistake must come from a specific, realistic mistake a learner makes with this skill, not a random wrong value or an obviously silly choice. Its misconception label names that mistake, and its reason tells the learner in plain words why the choice is wrong and what the mistake was ("you divided by 4 instead of…"), not only what the right answer is. For a wrong value the learner works out, redo the stated mistake: it must give that value. For typed, spoken and essay items, key points must each be one idea a grader can check on its own. A short typed answer (a number, term or name of up to five words) lists its common correct wordings in accepted answers; an explanation leaves accepted answers empty by design, because a grader checks it against its key points, so an empty list there is not a flaw. Notice distractors nobody would pick, reasons that only restate the right answer, a label or reason naming a mistake that doesn't give its option, and generic misconceptions ("wrong answer", "calculation error"): the learner learns nothing from getting it wrong.`,
    id: "misconceptionsAndFeedback",
    label: "Misconceptions & feedback",
    weight: 25,
  },
  {
    expectations: `When an exam is named, the questions must look, read and score like that exam's real ones: ENEM uses a short support text with an everyday or interdisciplinary situation and a command, 5 options with one correct; Cebraspe uses one assertion judged right or wrong with a realistic trap (swapped concept, wrong exception, absolute word); the digital SAT uses concise context, a direct question and 4 options, or a student-produced numeric answer; a school test uses short constructed-response questions a teacher would write. Without an exam, questions read like realistic everyday or workplace situations, set in the given field when there is one. The level must fit (beginner: everyday words and one step). Notice copied or near-copied real past questions, wording no real exam would use, and options whose length or confidence gives the answer away. A set that would look out of place in the named exam or setting doesn't prepare the learner for it.`,
    id: "realism",
    label: "Exam and setting realism",
    weight: 25,
  },
  {
    expectations: `Questions must make the learner use the skill (apply, predict, calculate, diagnose, compare or explain), not recall a definition or a sentence. The set should vary situations and what it asks, spread difficulty, stay within the skill and be written entirely in the requested language. Recall questions, or two questions testing the same thing the same way, give the learner practice that doesn't build the skill.`,
    id: "skillFit",
    label: "Skill fit & variety",
    weight: 20,
  },
]);
