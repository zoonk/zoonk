import { defineScoreCategories } from "@/lib/score-categories";

export const WRITE_LISTENING_SET_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every question's key must be right from the script alone: the correct option, statement judgment or typed answer is what the recording says, after any correction a speaker makes, and no wrong option is also defensible from the script. Each question must need the recording: it can't be answered from common sense or from the question's own words. A wrong key or two defensible options marks the learner wrong for being right; questions answerable without listening don't practice listening.`,
    id: "keys",
    label: "Right, fair keys",
    weight: 35,
  },
  {
    expectations: `The recording and questions must look like the named exam's listening part in the task: the kind of recording (conversation, monologue, interview, lecture), number of speakers, setting, length for that part, question format and option count, difficulty for the level, and the distractors listening papers use (a correction, two numbers or names mentioned, a suggestion rejected). Questions follow the recording's order and paraphrase it rather than repeating its words. A set that would look out of place in the named exam (wrong kind of recording, far too short or long, school-exercise questions) doesn't prepare the learner for it.`,
    id: "examRealism",
    label: "Exam realism",
    weight: 35,
  },
  {
    expectations: `The script reads as people talking in the recording's language: contractions, reactions, natural openings and closings, sparing hesitations, and the spelling and expressions of the speakers' variety. It holds only spoken words, with no stage directions or narrator lines unless the task has a narrator. Reasons and misconceptions are in the learner's language and point to what was said. A script that reads like written prose or an exercise doesn't train the learner's ear for real speech, and reasons in the wrong language are reasons they can't read.`,
    id: "naturalSpeech",
    label: "Natural speech & language",
    weight: 30,
  },
]);
