import { defineScoreCategories } from "@/lib/score-categories";

export const LESSON_SPEC_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit whether each lesson teaches one idea: one skill or up to three closely linked skills that a learner would naturally learn together. Skills must be generic actions worded in the form that language's course pages use (the verb first in English and the Romance languages, verb-final in German, Turkish, Japanese and Korean), with a canonical topic, a one-sentence idea, a concrete example and a real-life use. When the input lesson was too big and the output has several lessons, the split must follow natural boundaries (for example measures of center apart from measures of spread), keep teaching order, and give each lesson a canonical title, a scoped description and a concrete can-do line. Penalize a lesson that bundles unrelated ideas, a split that separates mutually defining ideas, and a skill that is a topic name instead of an action. Score at most 8 for one weak skill or boundary; at most 7 when a lesson clearly teaches two separate ideas or a split is incoherent; at most 6 when the lesson has no single idea.`,
    id: "oneIdea",
    label: "One idea",
    weight: 25,
  },
  {
    expectations: `Audit the screen plan a writer will follow. At every level, the first screen is a scene that asks nothing: an everyday moment where the idea shows up, ending on the question the lesson answers, never "In this lesson…". Right after the first explanation comes one guess that doesn't count, a prediction that neither contains its answer nor repeats the screen before's calculation. Explanations must go from something concrete to the name to symbols, one idea per screen. Checks must make the learner use the idea (predict, calculate, classify, spot the error) with a named tempting wrong answer, not repeat a sentence. Hard skills need a worked example followed by a similar problem with less help. The last screen applies the skills to a realistic situation for this audience. At every level, the first explanation comes before the first check. Briefs must be concrete enough for a writer: each states its idea in a plain sentence with the case that shows it (numbers, cases, examples). Score at most 8 for one weak check, hook or application; at most 7 when checks mostly ask for recall, the worked example is missing its follow-up, or briefs are too vague to write from; at most 6 when the plan would produce an unclear lesson.`,
    id: "screenPlan",
    label: "Screen plan",
    weight: 35,
  },
  {
    expectations: `Audit activities and visuals. An activity belongs only where doing beats reading (a value that changes with another, an order to rebuild, a guess to test), must use a template that fits the interaction, and must be tied to what the screen teaches; no activity is fine when none helps. Every screen a learner would otherwise have to picture in their head to follow or to answer, questions included, shows it (how something looks, is built, is arranged or moves, a place, a curve, data to compare, a thing nobody sees in daily life), and every other screen stays text only, the opening scene included: a visual is never there to fill a screen. The kind follows the app's order: data as a table, a bar or line chart or a timeline in the brief with exact values (visual null), something to work with as an activity whose template draws it, and a picture in \`visual\` only for what those can't show; a picture names every part, place or label the screen needs. Penalize as much a screen that leaves the learner to imagine something as a decorative visual (a scene or a person that shows nothing to see, a table that restates its sentence, the same picture again with nothing new), and a picture where a table, chart or timeline fits. Score at most 8 for one missing, misplaced or decorative visual or one poorly chosen activity; at most 7 for several; at most 6 when a lesson about something visual has no visual, or when visuals or activities are mostly decoration.`,
    id: "activitiesAndVisuals",
    label: "Activities & visuals",
    weight: 15,
  },
  {
    expectations: `Audit fit to the level, the scope and the language. Overview: plain words and stories, no formulas, equations, code or notation, light checks. Beginner: everyday words a 12-year-old can follow, a formula only when the idea needs it and after the intuition. Intermediate and advanced: precise terms and notation after the intuition. The plan must stay inside this lesson: ideas from the other lessons in the chapter get at most a sentence of context, an idea an earlier lesson taught is not explained again, and the plan never reuses a case, set of numbers or question the chapter's other lessons list. No filler screens (why the topic matters in general, history, study tips, summaries). All text must be in the requested language variant (US English, Brazilian Portuguese, Mexican Spanish). Score at most 6 for formulas or notation in an overview; at most 8 for one level or scope slip or one reused case; at most 7 for several or for the wrong language variant.`,
    id: "levelAndScope",
    label: "Level, scope & language",
    weight: 25,
  },
]);
