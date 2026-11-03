import { defineScoreCategories } from "@/lib/score-categories";

export const LESSON_WRITER_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit accuracy like a subject expert. Every fact, number, calculation, formula and notation must be correct, every check must have exactly one defensible right answer, and every reason must match its option. Data must be real or labeled as an example. Score at most 6 for any error that teaches something wrong or marks a wrong answer right; at most 8 for a small imprecision a learner wouldn't notice.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 25,
  },
  {
    expectations: `Audit how it feels to learn from, as a learner who would rather watch a great teacher on YouTube than read a textbook. The hook opens on something from everyday life the learner has seen, felt or done, not a definition or a topic statement. Each idea arrives through one brief, specific example the learner can picture (a named situation, real numbers, a familiar object or moment) before or with its rule, and hard ideas get an everyday comparison. The voice talks to the learner in spoken, everyday words and short sentences, and each screen gives a reason to read the next (a question, a surprise, a contrast). Warm and direct, never cheesy: no "Great job!", "Let's dive in", forced jokes or exclamation marks for energy. Score at most 6 when it reads like a textbook or an encyclopedia (definitions first, passive voice, abstract nouns, "it is important to note"); at most 7 when most screens state a rule before any example, or for cheesy filler; at most 8 for one stretch of textbook tone or one generic example ("a company", "a person", "product X") where a specific one would teach. Reading costs the learner, so length is never a strength here: score at most 7 when screens run longer than their idea needs (a second example, a recap, side detail the learner reads past), since a shorter screen that teaches the same thing is the better one.`,
    id: "teacher",
    label: "Engaging, not a textbook",
    weight: 25,
  },
  {
    expectations: `Audit clarity for the stated level. Each screen teaches one idea in short sentences. Every technical term is explained before it's used (with an everyday comparison where plain words aren't enough), and never two new terms on one screen. Complex ideas are explained completely: no skipped steps, no naming an idea instead of explaining how it works. Score at most 8 for one unexplained term or skipped step; at most 7 for several; at most 6 when a learner at this level couldn't follow.`,
    id: "clarity",
    label: "Clarity",
    weight: 20,
  },
  {
    expectations: `Audit the checks. Each makes the learner use the idea (predict, calculate, classify, spot the error), never repeat a sentence from a screen. Wrong options are real misconceptions, including the tempting wrong answer the plan names, and every option's reason explains why it's right, or why it's tempting and wrong. Checks after worked examples give less help. Typed answers have key points a grader can check. Activities make the learner do something that shows the idea, with a check about it. Every learner reads the same screens whatever they picked, so a screen after a check builds on its question and right answer and never praises or corrects the learner's pick ("you started with the right question", "you got it"). Score at most 8 for one recall-only check, a weak reason or a screen that judges the learner's pick; at most 7 for several; at most 6 when checks mostly don't test understanding.`,
    id: "checks",
    label: "Checks & feedback",
    weight: 15,
  },
  {
    expectations: `Audit fit and relevance. The level is respected (overview: no formulas or notation; beginner: words a 12-year-old follows, a formula only after the intuition; advanced: precise and complete). The hook opens with the idea (no "In this lesson", no recap, no greeting). Examples come from the learner's world in the lesson's language and country. The application is a realistic situation naming a concrete place where the idea shows up. No filler, history or "why this matters in general". The lesson follows its plan's briefs. The summary states each idea in one sentence. Score at most 6 for formulas in an overview or wrong language variant; at most 8 for one slip; at most 7 for several.`,
    id: "fitAndApplication",
    label: "Level, hook & application",
    weight: 15,
  },
]);
