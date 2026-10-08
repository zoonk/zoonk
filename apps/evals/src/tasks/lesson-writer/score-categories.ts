import { defineScoreCategories } from "@/lib/score-categories";

export const LESSON_WRITER_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit accuracy like a subject expert. Every fact, number, calculation, formula and notation must be correct, every check must have exactly one defensible right answer, and every reason must match its option. Data must be real or labeled as an example. Score at most 6 for any error that teaches something wrong or marks a wrong answer right; at most 8 for a small imprecision a learner wouldn't notice.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 30,
  },
  {
    expectations: `Audit clarity for the stated level. Each screen teaches one idea with a concrete example, in short sentences and everyday language with no academic tone. Every technical term is explained, with an everyday comparison, before it's used, and never two new terms on one screen. Complex ideas are explained completely: no skipped steps, no naming an idea instead of explaining how it works. Score at most 8 for one unexplained term or skipped step; at most 7 for several or for textbook tone; at most 6 when a learner at this level couldn't follow.`,
    id: "clarity",
    label: "Clarity & plain words",
    weight: 25,
  },
  {
    expectations: `Audit the checks. Each makes the learner use the idea (predict, calculate, classify, spot the error), never repeat a sentence from a screen. Wrong options are real misconceptions, including the tempting wrong answer the plan names, and every option's reason explains why it's right, or why it's tempting and wrong. Checks after worked examples give less help. Typed answers have key points a grader can check. Activities make the learner do something that shows the idea, with a check about it. Score at most 8 for one recall-only check or a weak reason; at most 7 for several; at most 6 when checks mostly don't test understanding.`,
    id: "checks",
    label: "Checks & feedback",
    weight: 20,
  },
  {
    expectations: `Audit fit and relevance. The level is respected (overview: no formulas or notation; beginner: words a 12-year-old follows, a formula only after the intuition; advanced: precise and complete). The hook opens with the idea (no "In this lesson", no recap, no greeting). Examples come from the learner's world in the lesson's language and country. The application is a realistic situation naming a concrete place where the idea shows up. No filler, history or "why this matters in general". The lesson follows its plan's briefs. The summary states each idea in one sentence. Score at most 6 for formulas in an overview or wrong language variant; at most 8 for one slip; at most 7 for several.`,
    id: "fitAndApplication",
    label: "Level, hook & application",
    weight: 25,
  },
]);
