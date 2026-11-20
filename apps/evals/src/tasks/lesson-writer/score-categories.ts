import { defineScoreCategories } from "@/lib/score-categories";

export const LESSON_WRITER_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Check accuracy like a subject expert. Every fact, number, calculation, formula and notation must be correct, every check must have exactly one defensible right answer, and every reason must match its option. Data must be real or labeled as an example. An error that teaches something wrong or marks a wrong answer right misleads the learner; a small imprecision a learner wouldn't notice is a minor cost.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 25,
  },
  {
    expectations: `Read it for how it feels to learn from, as a learner who would rather watch a great teacher on YouTube than read a textbook. The hook opens on something from everyday life the learner has seen, felt or done, not a definition or a topic statement. Each idea arrives through one brief, specific example the learner can picture (a named situation, real numbers, a familiar object or moment) before or with its rule; a comparison appears only where it truly maps and helps, and a loose or forced one counts against it. The voice talks to the learner in spoken, everyday words and short sentences, and each screen gives a reason to read the next (a question, a surprise, a contrast). Warm and direct, never cheesy: no "Great job!", "Let's dive in", forced jokes or exclamation marks for energy. A lesson that reads like a textbook or an encyclopedia (definitions first, passive voice, abstract nouns, "it is important to note") loses the learner as surely as a wrong fact: they stop reading. Notice screens that state a rule before any example, cheesy filler, and generic examples ("a company", "a person", "product X") where a specific one would teach. Reading costs the learner, so length is never a strength: a screen longer than its idea needs (a second example, a recap, side detail the learner reads past) is worse than a shorter one that teaches the same thing.`,
    id: "teacher",
    label: "Engaging, not a textbook",
    weight: 25,
  },
  {
    expectations: `Check clarity for the stated level, as an adult who never studied the subject and reads each screen once. Each screen teaches one idea in short sentences, and every sentence reads like natural speech, in the order a person would say it: no inverted or fronted clauses, no definition squeezed between commas or into a clause, no connecting words cut to save space, no instructions about the screen ("Look at the table", "The next screen shows why"). Questions, options and feedback count too. Every technical term is explained before it's used (with an everyday comparison where plain words aren't enough), and never two new terms on one screen. Complex ideas are explained completely: no skipped steps, no naming an idea instead of explaining how it works. A lesson a learner at this level couldn't follow, or with many sentences that sound unnatural, fails its reader; one unexplained term, skipped step or sentence a learner would reread is a smaller cost.`,
    id: "clarity",
    label: "Clarity",
    weight: 20,
  },
  {
    expectations: `Check the checks. Each makes the learner use the idea (predict, calculate, classify, spot the error), never repeat a sentence from a screen. Wrong options are real misconceptions, including the tempting wrong answer the plan names, and every option's reason says plainly why it's right, or what's wrong with it and what's true instead. Checks after worked examples give less help. Typed answers have key points a grader can check. Activities make the learner do something that shows the idea, with a check about it. Every learner reads the same screens whatever they picked, so a screen after a check builds on its question and right answer and never praises or corrects the learner's pick ("you started with the right question", "you got it"). Checks that mostly don't test understanding let the learner pass without learning; one recall-only check, a weak reason or a screen that judges the learner's pick is a smaller cost.`,
    id: "checks",
    label: "Checks & feedback",
    weight: 15,
  },
  {
    expectations: `Check fit and relevance. The level is respected (overview: no formulas or notation; beginner: words a 12-year-old follows, a formula only after the intuition; advanced: precise and complete). The first screen is a scene with nothing to answer, at every level (no "In this lesson", no recap, no greeting), and a guess appears only where the plan puts one. Examples come from the learner's world in the lesson's language and country. The application is a realistic situation naming a concrete place where the idea shows up. No filler, history or "why this matters in general". The lesson follows its plan's briefs. The summary states each idea in one sentence, under a name (\`label\`) this learner reads before the lesson too: a code, abbreviation, symbol or technical name they can't read yet never stands alone, but comes with plain words saying what it is. Formulas in an overview, or the wrong language variant, lose the reader; one slip elsewhere is a smaller cost.`,
    id: "fitAndApplication",
    label: "Level, hook & application",
    weight: 15,
  },
]);
