import { defineScoreCategories } from "@/lib/score-categories";

export const WRITE_LISTENING_SET_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every question's key must be right from the script alone: the correct option, statement judgment or typed answer is what the recording says, after any correction a speaker makes, and no wrong option is also defensible from the script. Each question must need the recording: it can't be answered from common sense or from the question's own words. Score at most 6 when one key is wrong or two options are defensible; at most 7 when several questions can be answered without listening.`,
    id: "keys",
    label: "Right, fair keys",
    weight: 35,
  },
  {
    expectations: `The recording and questions must look like the named exam's listening part in the task: the kind of recording (conversation, monologue, interview, lecture), number of speakers, setting, length for that part, question format and option count, difficulty for the level, and the distractors listening papers use (a correction, two numbers or names mentioned, a suggestion rejected). Questions follow the recording's order and paraphrase it rather than repeating its words. Score at most 7 when the set would look out of place in the named exam (wrong kind of recording, far too short or long, school-exercise questions).`,
    id: "examRealism",
    label: "Exam realism",
    weight: 35,
  },
  {
    expectations: `The script reads as people talking in the recording's language: contractions, reactions, natural openings and closings, sparing hesitations, and the spelling and expressions of the speakers' variety. It holds only spoken words, with no stage directions or narrator lines unless the task has a narrator. Reasons and misconceptions are in the learner's language and point to what was said. Score at most 7 when the script reads like written prose or an exercise, or when the reasons are in the wrong language.`,
    id: "naturalSpeech",
    label: "Natural speech & language",
    weight: 30,
  },
]);
