import { defineScoreCategories } from "@/lib/score-categories";

export const COURSE_OUTLINE_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Check whether the band covers what a serious course at this level must teach, using the case's topic guidance as the minimum list. A related chapter does not stand in for a missing named pillar, and modern developments must add depth without replacing foundations. When REQUIRED_SKILLS are given, every required key must be tagged on a chapter that really teaches it; a tag on an unrelated chapter counts as missing. Each missing pillar or required skill is a gap the learner never closes, and a missing area is worse. Judge coverage only.`,
    id: "coverage",
    label: "Coverage",
    weight: 25,
  },
  {
    expectations: `Check the order. Chapters must build cumulatively so each relies only on earlier chapters, earlier bands and everyday life, and lessons inside a chapter must follow the same rule. Notice a showcase or advanced chapter before its prerequisites, lessons that use an idea taught later, and chapters whose position makes no sense for a learner: each makes the learner meet something they can't follow yet. A band that can't be studied in order fails the learner outright.`,
    id: "order",
    label: "Order",
    weight: 15,
  },
  {
    expectations: `Check lesson size and shape. Each lesson must be one idea (1 to 3 closely linked skills) that fits in 2 to 5 minutes: split umbrella lessons that bundle several mechanisms, merge lessons that would repeat the same explanation. Chapters usually hold 4 to 12 lessons. Every lesson needs a canonical, searchable title, a one-sentence description naming its scope, a concrete can-do line worded as an action in the form that language's course pages use (the verb first in English and the Romance languages, verb-final in German, Turkish, Japanese and Korean), and skills named as generic actions. Notice vague or cute titles, descriptions that only describe feelings, can-do lines that are not observable actions, and skills that are topic names rather than actions. A few umbrella or fragment lessons are a small cost; lessons consistently the wrong size leave the learner with lessons too big to finish or too thin to teach.`,
    id: "granularity",
    label: "Lesson granularity",
    weight: 20,
  },
  {
    expectations: `Look for filler: "Introduction to…", "What is X", "Why X matters", course overview, recap, summary, review, "putting it together", study tips, career or job-search chapters, history used as a warm-up (history is fine when the subject is history or the field's evolution is knowledge practitioners use), and lessons that would duplicate each other. Each one spends the learner's time on nothing new, and a pattern of them makes the course feel padded.`,
    id: "noFiller",
    label: "No filler",
    weight: 15,
  },
  {
    expectations: `Check fit to the level band and language. Overview: 3 to 6 chapters of big ideas in plain words, covering beginner and advanced ideas at a high level, with no formulas, equations, code or notation anywhere in titles, descriptions, can-do lines or skills. Beginner: from zero, everyday words. Intermediate and advanced: build on earlier bands without repeating them. Text must be in the requested language variant (US English, Brazilian Portuguese, Mexican Spanish). An overview with fewer than 3 or more than 6 chapters, or one that relies on formulas or code, loses the reader it's for; one level mismatch is a smaller cost, and several, or the wrong language variant in several places, a larger one.`,
    id: "levelFit",
    label: "Level & language fit",
    weight: 15,
  },
  {
    expectations: `Check whether the band favors what still matters when AI does routine work: understanding why, judgment, framing problems, estimating, checking results, and working with AI (describing the task, reviewing output, finding its mistakes) in fields AI is changing such as programming, writing, design and analysis. Notice lessons built around memorizing syntax or long manual procedures that tools do beyond what understanding needs. Subjects AI doesn't change much don't need AI lessons. A field AI is changing with no work-with-AI lessons, or one where rote procedures dominate, teaches skills that matter less each year.`,
    id: "aiEraSkills",
    label: "Skills for a world with AI",
    weight: 10,
  },
]);
