import { defineScoreCategories } from "@/lib/score-categories";

export const SKILL_GRAPH_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit whether the graph contains every skill the goal needs, using the case's topic guidance as the minimum list. A related skill does not stand in for a missing named pillar. For exam goals, every blueprint area and scored ability (such as the essay competencies) must appear, every topic a notice lists must be taught by some skill however few questions its subject has, and exam weights must follow the blueprint: frequently tested topics weigh more than rare ones. For goals across several subjects, the prerequisite subjects must be there too. Score at most 8 when one pillar from the guidance is missing or exam weights ignore the blueprint in one area; at most 7 when two or three pillars are missing; at most 6 when coverage misses a whole area or course. Judge coverage only.`,
    id: "coverage",
    label: "Coverage",
    weight: 25,
  },
  {
    expectations: `Audit the order and the prerequisites. Every skill must come after the skills it needs, with direct prerequisites listed (for example calculus before Newtonian mechanics with derivatives, complex numbers before the wave function, reading a table before interpreting a chart question). Phases must run in a sensible order, each phase's milestone must be a real capability reached by that phase's skills, each phase's title must name its stage of the path, different from every other phase's title and never the name of a skill, situation, area or topic it teaches (the learner sees those under it, so the name would show twice), written without the first person or words that agree with the learner's gender (such as "Pronta para…" or "Pronto para…" in Portuguese), and courses must be canonical Library subjects rather than titles about this learner. Penalize missing prerequisite edges between clearly dependent skills, invented dependencies, advanced skills placed early, milestones that are vague or promise results, and phase titles that name what the phase teaches instead of its stage. Score at most 9 when one phase is titled like a skill, situation or topic it teaches, or in the first person or a gendered form; at most 8 for one clear ordering or prerequisite error on a central skill, or when most phases are titled that way; at most 7 for several ordering errors; at most 6 when the path could not be followed in order.`,
    id: "orderAndPrerequisites",
    label: "Order & prerequisites",
    weight: 20,
  },
  {
    expectations: `Audit the size of the skills and of the whole path against what the goal demands. Small goals (a school test this week) need lesson-sized skills and a total of a few hours; medium goals need skills of a few to about fifteen lessons; huge learn and language goals (a whole field from zero, fluency) need chapter-sized skills and a total of hundreds of hours. For an exam with a notice, audit depth topic by topic rather than the total: each topic once, in the lessons a learner new to it needs to answer this exam's questions on it (its concepts, the distinctions those questions turn on and worked cases). Check the broad topics most (a whole statute, a grammar area with many rules, a family of methods): one squeezed into fewer lessons than its distinctions and worked cases need is too thin, however few questions its subject has, since a few questions sample a broad syllabus rather than make it easy. Padding is lessons a topic's questions don't need: a narrow line stretched to a chapter, re-teaching, or content the notice doesn't list that no topic needs as a prerequisite; the foundations a learner needs to reach the notice's topics are not padding. Never reward or penalize an exam's map for its total size alone. Each skill is one action, without unrelated abilities bundled in. Penalize a quantum-physics-from-zero path under about 250 hours or an overview over about 15 hours, a school test over about 15 hours, and a graph so fine-grained it lists hundreds of trivia skills or so coarse that one skill covers a whole course. Score at most 8 for one clearly mis-sized area or broad topic too thin for its questions; at most 7 for several, for padding throughout an area, or when a learn goal's total is off by more than half; at most 6 when the granularity makes the graph unusable for planning.`,
    id: "granularity",
    label: "Size matched to demand",
    weight: 15,
  },
  {
    expectations: `Audit for filler, overlap and content the goal doesn't ask for. Every skill must be needed for the goal. Penalize "Introduction to…", "Why X matters", overview or recap skills, study tips, motivation, history for its own sake and general career advice. Penalize overlap: two skills that would share most of their lessons, sibling skills that split one idea and each teach it again (a formula in one skill and the problems it solves in another), and content a notice lists in two subjects taught twice in full rather than once, with the other subject's skill building on it. For an exam, penalize topics and areas its notice doesn't test: a neighboring topic the syllabus doesn't name, or an area beyond its subjects other than the parts it scores apart (an essay or discursive test, exam strategy). The prerequisites a learner needs to reach the notice's topics are not filler, even when the notice doesn't name them, as long as they sit in the subject they prepare for. A career-change goal may include producing work that shows the skill (such as a portfolio case study); an exam goal may include exam strategy the exam scores. Score at most 8 for one filler, overlapping or unsupported skill; at most 7 for two or three; at most 6 for four or more, a filler phase or an area the notice doesn't have.`,
    id: "noFiller",
    label: "No filler or overlap",
    weight: 15,
  },
  {
    expectations: `Audit fit to the goal kind, purpose, the learner's own level and context. An overview covers the big ideas in plain words with no formula or code skills. A work goal targets the learner's role and tasks and leaves out what the role doesn't use. A career change covers what a junior needs on day one. An exam follows the blueprint or the learner's material and leaves out what isn't tested. A language goal uses real situations with can-dos ordered by CEFR level, with grammar inside situations. The starting point must match the stated level (no basic arithmetic for a university graduate; foundations for someone starting from zero). Names, descriptions, titles and milestones must be in the requested language variant. Score at most 8 for one clear mismatch; at most 7 for a pattern of mismatches or the wrong language variant in several fields; at most 6 when the graph serves a different goal than the one asked.`,
    id: "goalFit",
    label: "Goal & level fit",
    weight: 15,
  },
  {
    expectations: `Audit whether the graph favors what still matters when AI does routine work: understanding why, judgment, framing problems, estimating, checking results, and directing and checking AI. Work and career goals must include using AI tools well for that work (describing the task, reviewing output, catching mistakes). Penalize rote goals that tools do, such as memorizing syntax or long manual procedures beyond what understanding needs. Exams test what they test: keeping manual skills the exam scores is correct, not a flaw. Score at most 8 when a work or career graph has no AI-tool skill or when rote skills dominate one area; at most 7 when the graph is mostly rote procedures in a field AI is changing.`,
    id: "aiEraSkills",
    label: "Skills for a world with AI",
    weight: 10,
  },
]);
