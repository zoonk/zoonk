import { defineScoreCategories } from "@/lib/score-categories";

export const COURSE_OUTLINE_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit whether the band covers what a serious course at this level must teach, using the case's topic guidance as the minimum list. A related chapter does not stand in for a missing named pillar, and modern developments must add depth without replacing foundations. When REQUIRED_SKILLS are given, every required key must be tagged on a chapter that really teaches it; a tag on an unrelated chapter counts as missing. Score at most 8 when one pillar or one required skill is missing; at most 7 when two or three are; at most 6 when a whole area is missing. Judge coverage only.`,
    id: "coverage",
    label: "Coverage",
    weight: 25,
  },
  {
    expectations: `Audit the order. Chapters must build cumulatively so each relies only on earlier chapters, earlier bands and everyday life, and lessons inside a chapter must follow the same rule. Penalize a showcase or advanced chapter before its prerequisites, lessons that use an idea taught later, and chapters whose position makes no sense for a learner. Score at most 8 for one misplaced central chapter or several misplaced lessons; at most 7 for a pattern; at most 6 when the band could not be studied in order.`,
    id: "order",
    label: "Order",
    weight: 15,
  },
  {
    expectations: `Audit lesson size and shape. Each lesson must be one idea (1 to 3 closely linked skills) that fits in 2 to 5 minutes: split umbrella lessons that bundle several mechanisms, merge lessons that would repeat the same explanation. Chapters usually hold 4 to 12 lessons. Every lesson needs a canonical, searchable title, a one-sentence description naming its scope, a concrete can-do line starting with a verb, and skills named as generic actions. Penalize vague or cute titles, descriptions that only describe feelings, can-do lines that are not observable actions, and skills that are topic names rather than actions. Score at most 8 when several lessons are umbrellas or fragments; at most 7 when it's a pattern across chapters or many can-do lines are vague; at most 6 when lessons are consistently the wrong size.`,
    id: "granularity",
    label: "Lesson granularity",
    weight: 20,
  },
  {
    expectations: `Audit for filler. Penalize "Introduction to…", "What is X", "Why X matters", course overview, recap, summary, review, "putting it together", study tips, career or job-search chapters, history used as a warm-up (history is fine when the subject is history or the field's evolution is knowledge practitioners use), and lessons that would duplicate each other. Score at most 8 for one filler chapter or two or three filler lessons; at most 7 for more; at most 6 for a pattern of filler.`,
    id: "noFiller",
    label: "No filler",
    weight: 15,
  },
  {
    expectations: `Audit fit to the level band and language. Overview: 3 to 6 chapters of big ideas in plain words, covering beginner and advanced ideas at a high level, with no formulas, equations, code or notation anywhere in titles, descriptions, can-do lines or skills. Beginner: from zero, everyday words. Intermediate and advanced: build on earlier bands without repeating them. Text must be in the requested language variant (US English, Brazilian Portuguese, Spain Spanish). Score at most 6 when an overview has fewer than 3 or more than 6 chapters or relies on formulas or code; at most 8 for one level mismatch; at most 7 for several or for the wrong language variant in several places.`,
    id: "levelFit",
    label: "Level & language fit",
    weight: 15,
  },
  {
    expectations: `Audit whether the band favors what still matters when AI does routine work: understanding why, judgment, framing problems, estimating, checking results, and working with AI (describing the task, reviewing output, finding its mistakes) in fields AI is changing such as programming, writing, design and analysis. Penalize lessons built around memorizing syntax or long manual procedures that tools do beyond what understanding needs. Subjects AI doesn't change much are not penalized for lacking AI lessons. Score at most 8 when a field AI is changing has no work-with-AI lessons; at most 7 when rote procedures dominate.`,
    id: "aiEraSkills",
    label: "Skills for a world with AI",
    weight: 10,
  },
]);
