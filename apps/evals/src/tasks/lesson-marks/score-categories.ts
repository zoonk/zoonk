import { defineScoreCategories } from "@/lib/score-categories";

export const LESSON_MARKS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit each "about" line, which the learner reads BEFORE the lesson. It names the topic or the question its idea answers, in the lesson's language, in at most 60 characters. It never states or paraphrases the idea's conclusion: no rule, definition, cause, number, outcome or verdict a learner could answer the idea's question from. Score at most 5 when any line gives its idea's answer away, and at most 7 when one hints at it strongly.`,
    id: "about",
    label: "About lines that don't give the answer away",
    weight: 30,
  },
  {
    expectations: `Audit each screen's idea: the map idea the screen teaches or asks about; a question mixing two ideas takes the later one. Score at most 6 for any screen placed under the wrong idea.`,
    id: "ideas",
    label: "Each screen under its idea",
    weight: 20,
  },
  {
    expectations: `Audit the underlines and examples that code kept (it already dropped the inexact ones). An underline is the short phrase stating the screen's main point, not the bold term alone and not most of a sentence; many screens rightly have none, so a missing underline is never a flaw. An example frames the sentences that give a concrete case (a person, a number, an everyday situation), never the rule itself. Score at most 7 for an underline on a side detail or an example that frames the rule.`,
    id: "marks",
    label: "Underlines on the main point, examples on the case",
    weight: 20,
  },
  {
    expectations: `Audit the icons. Every screen the input marks "may get an icon" has one, and no other screen does. Each names in English one concrete, drawable, generic thing a learner would connect with that screen's own case at a glance, or a common symbol of its idea when the screen has no object: never a person, a face, a brand, a named place, text or a number. Generic fillers (clipboard, document, money bag, magnifying glass, lightbulb) count as weak unless the screen is about that object. The same thing keeps the same name across the lesson. Score at most 6 for an icon that would suggest something wrong, and at most 8 when several are weak.`,
    id: "icons",
    label: "Concrete, fitting icons",
    weight: 30,
  },
]);
