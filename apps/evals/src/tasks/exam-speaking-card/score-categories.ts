import { defineScoreCategories } from "@/lib/score-categories";

export const EXAM_SPEAKING_CARD_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `The card reads like the named exam's own sheet for this task: the same kind of instructions (with the exam's form of address: "usted" in DELE, "vous" in DELF, "Sie" in the Goethe-Zertifikat, "you" in Cambridge), prompts and material, at the exam's level, fitting the task brief and its speaking time. A task that continues an earlier one stays on that card's topic and material. The topic is original, everyday and safe (no emergencies, conflict, money trouble or illness) and nothing is copied from published papers. Score at most 5 when the card follows another task's or exam's format.`,
    id: "examFit",
    label: "Like the exam's sheet",
    weight: 30,
  },
  {
    expectations: `The material works for the task: a photo scene shows one concrete everyday moment with people, place and mood to describe and speculate about, and nothing to read in it; a text reads like its real source at the given length, states facts and views to argue with and never tells the candidate what to say; a table has a title with an invented but plausible source and year, short cells and figures that add up. Facts, names, prices and places are realistic for where the exam's language is spoken. Score at most 5 when the material can't support the task.`,
    id: "material",
    label: "Material that works",
    weight: 25,
  },
  {
    expectations: `The character brief is the voice model's private script in English with every line it says written out in the exam's language, run in about the task's minutes. As examiner: the exam's short standard wording, the questions in order with back-ups, listening without interrupting where the candidate talks alone, never correcting, praising or grading. As the other candidate: its own views and ideas, sometimes disagreeing, speaking about half the time and helping reach a decision when asked, never acting as examiner. The opening line fits that role. Hints are phrases to buy time, give an opinion, agree or disagree at the level, never an answer about the topic. Score at most 5 when the script contradicts the card or the role.`,
    id: "script",
    label: "The examiner's or partner's script",
    weight: 25,
  },
  {
    expectations: `Summary, the character's role and every photo's alt are in the learner's language (a summary to the learner as "you", never a translation of the prompts); instructions, prompts, text, table, place, opening line and hints are in the exam's language and variety; the brief and photo scenes are in English. No emojis and no em dashes. Score at most 5 for a field in the wrong language.`,
    id: "languages",
    label: "Right language per field",
    weight: 20,
  },
]);
