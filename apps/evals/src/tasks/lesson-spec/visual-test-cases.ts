import { type TestCase } from "@/lib/types";
import { type LessonSpecParams } from "@zoonk/ai/tasks/v2/lesson-spec";
import { activityTemplates } from "@zoonk/core/library/activities/templates";

/**
 * Whether a lesson needs pictures (`visual` on some screen), must have none, or may go either way
 * when a native kind (a table, a chart, a timeline or an activity) can show what it needs.
 */
export type LessonSpecExpected = { pictures: "any" | "none" | "some" };

const ACTIVITY_TEMPLATES: LessonSpecParams["activityTemplates"] = activityTemplates.map(
  (template) => ({ description: template.description, id: template.id }),
);

const VISUAL_EXPECTATIONS = `
  - Every screen the learner would otherwise have to imagine something on (how it looks, is built, is arranged or moves, a place, a comparison, data) shows it; screens whose words alone are fully clear stay text only
  - The kind follows the app's order: data as a table, a bar or line chart or a timeline in the brief with exact values and \`visual\` null; something to work with as an activity whose template draws it; a picture in \`visual\` only for what those can't show
  - A planned picture names every part, place or label its screen talks about; no decorative picture
  - Don't evaluate JSON formatting; estimated minutes are computed by code
`;

type VisualCase = TestCase<LessonSpecExpected, LessonSpecParams>;

function visualCase({
  expectations,
  id,
  pictures,
  ...input
}: Omit<LessonSpecParams, "activityTemplates"> & {
  expectations: string;
  id: string;
  pictures: LessonSpecExpected["pictures"];
}): VisualCase {
  return {
    expectations: `${expectations}\n${VISUAL_EXPECTATIONS}`,
    expected: { pictures },
    id: `visual-${id}`,
    userInput: { activityTemplates: ACTIVITY_TEMPLATES, ...input },
  };
}

/**
 * Lessons whose ideas need seeing (Oct 2026, owner: "we shouldn't require users to imagine a
 * concept"), lessons where the app's own table, chart or timeline is the right visual, and one
 * that needs none. Run them alone with `--case visual-`.
 */
export const VISUAL_TEST_CASES: VisualCase[] = [
  visualCase({
    chapterTitle: "The nervous system",
    courseTitle: "Human biology",
    expectations: `
      - MUST be in US English
      - The screens that explain where each lobe is and what it does show the brain with those lobes (one picture of the brain with its lobes labeled, or the lobe in question highlighted on each screen); a lesson that names the lobes in words only fails
    `,
    id: "en-brain-lobes",
    language: "en",
    lessonCanDo: "Name the four lobes of the brain and what each one does",
    lessonDescription: "Find the frontal, parietal, temporal and occipital lobes and their jobs.",
    lessonTitle: "The lobes of the brain",
    level: "beginner",
    pictures: "some",
    skills: ["Locate the four lobes of the brain", "Match each lobe to its main job"],
  }),
  visualCase({
    chapterTitle: "Do Renascimento ao Barroco",
    courseTitle: "História da arte",
    expectations: `
      - MUST be in Brazilian Portuguese
      - Comparing a Renaissance and a Baroque painting needs the two paintings shown: one picture with both, labeled 1 and 2, describing what each shows (composition, light, movement); a question about them is fine since the skill is reading artworks
    `,
    id: "pt-comparar-pinturas",
    language: "pt",
    lessonCanDo: "Diferenciar uma pintura renascentista de uma barroca",
    lessonDescription:
      "Compare a calma e o equilíbrio do Renascimento com o drama e a luz forte do Barroco.",
    lessonTitle: "Renascimento e Barroco: comparando pinturas",
    level: "beginner",
    pictures: "some",
    skills: ["Comparar a composição e a luz de pinturas renascentistas e barrocas"],
  }),
  visualCase({
    chapterTitle: "Water on Earth",
    courseTitle: "Earth science",
    expectations: `
      - MUST be in US English
      - The cycle's stages (evaporation, condensation, precipitation, collection) are shown, not only named: a picture of the cycle with its stages, and/or a labeled diagram activity of the water cycle from the catalog
    `,
    id: "en-water-cycle",
    language: "en",
    lessonCanDo: "Trace water through the water cycle",
    lessonDescription: "Follow water from the ocean to the clouds and back as rain and rivers.",
    lessonTitle: "The water cycle",
    level: "beginner",
    pictures: "any",
    skills: ["Describe the stages of the water cycle in order"],
  }),
  visualCase({
    chapterTitle: "Roma antiga",
    courseTitle: "História",
    expectations: `
      - MUST be in Brazilian Portuguese
      - Where the empire reached is shown on a map: a picture of a map with the places the screens name, or a map activity from the catalog (the Roman Empire base map); places listed only in words fail
    `,
    id: "pt-mapa-imperio-romano",
    language: "pt",
    lessonCanDo: "Localizar até onde o Império Romano chegou no seu auge",
    lessonDescription:
      "Veja no mapa como Roma passou a controlar todo o Mediterrâneo e por que isso importava.",
    lessonTitle: "A expansão do Império Romano",
    level: "beginner",
    pictures: "any",
    skills: ["Localizar no mapa as regiões do Império Romano em seu auge"],
  }),
  visualCase({
    chapterTitle: "Nouns",
    courseTitle: "English grammar",
    expectations: `
      - MUST be in US English
      - Plural spelling rules are clear in words (a rule and examples), so no screen has a picture; a short table of examples is fine but not required
    `,
    id: "en-plural-nouns-grammar",
    language: "en",
    lessonCanDo: "Spell the plural of regular nouns",
    lessonDescription: "Add -s or -es to make nouns plural, and change -y to -ies.",
    lessonTitle: "Regular plural nouns",
    level: "beginner",
    pictures: "none",
    skills: ["Spell regular plural nouns with -s, -es and -ies"],
  }),
  visualCase({
    chapterTitle: "Simple machines",
    courseTitle: "Physics",
    expectations: `
      - MUST be in US English
      - A lever must be seen: a picture of the bar, the fulcrum, the load and the effort with their distances; an activity where the learner moves the fulcrum or a weight also fits
    `,
    id: "en-lever",
    language: "en",
    lessonCanDo: "Explain how a lever lets a small force lift a heavy load",
    lessonDescription: "See why pushing farther from the fulcrum lifts more with less force.",
    lessonTitle: "How a lever multiplies force",
    level: "beginner",
    pictures: "any",
    skills: ["Relate a lever's arm lengths to the force it needs"],
  }),
  visualCase({
    chapterTitle: "Oferta e demanda",
    courseTitle: "Economia",
    expectations: `
      - MUST be in Brazilian Portuguese
      - The demand curve moving right and the new price are shown, not only described: a line chart with example prices and quantities before and after (marked as an example) or a picture of the two curves and the shift
    `,
    id: "pt-deslocamento-demanda",
    language: "pt",
    lessonCanDo: "Prever o que acontece com o preço quando a demanda aumenta",
    lessonDescription:
      "Entenda o que desloca a curva de demanda e como o preço de equilíbrio muda com isso.",
    lessonTitle: "Deslocamentos da curva de demanda",
    level: "intermediate",
    pictures: "any",
    skills: ["Prever o novo equilíbrio após um deslocamento da demanda"],
  }),
  visualCase({
    chapterTitle: "Syntax",
    courseTitle: "Introduction to linguistics",
    expectations: `
      - MUST be in US English
      - A sentence's tree (S splitting into a noun phrase and a verb phrase, and so on) is a structure to see: a picture of the tree with its labels, never a tree described in words
    `,
    id: "en-syntax-tree",
    language: "en",
    lessonCanDo: "Draw a simple sentence as a syntax tree",
    lessonDescription: "Break a sentence into its noun phrase and verb phrase and draw the tree.",
    lessonTitle: "Syntax trees",
    level: "intermediate",
    pictures: "some",
    skills: ["Split a simple sentence into a noun phrase and a verb phrase"],
  }),
  visualCase({
    chapterTitle: "Ligações químicas",
    courseTitle: "Química",
    expectations: `
      - MUST be in Brazilian Portuguese
      - A covalent bond is shown: a picture of the atoms sharing a pair of electrons (water or H₂), and a molecule-building activity from the catalog also fits for a check
    `,
    id: "pt-ligacao-covalente",
    language: "pt",
    lessonCanDo: "Explicar como dois átomos se ligam compartilhando elétrons",
    lessonDescription:
      "Veja como os átomos compartilham elétrons para formar moléculas como a água.",
    lessonTitle: "Ligação covalente",
    level: "beginner",
    pictures: "any",
    skills: ["Representar uma ligação covalente simples"],
  }),
  visualCase({
    chapterTitle: "Tactics",
    courseTitle: "Understanding soccer",
    expectations: `
      - MUST be in US English
      - A formation is a layout on the field: a picture of the field with the players' positions in a 4-3-3 (and a 4-4-2 to compare, as one picture labeled 1 and 2 when compared)
    `,
    id: "en-soccer-formation",
    language: "en",
    lessonCanDo: "Read a 4-3-3 formation and say where each line plays",
    lessonDescription: "See how a 4-3-3 spreads defenders, midfielders and forwards on the field.",
    lessonTitle: "The 4-3-3 formation",
    level: "overview",
    pictures: "some",
    skills: ["Describe the lines of a 4-3-3 formation"],
  }),
  visualCase({
    chapterTitle: "Juros",
    courseTitle: "Matemática financeira",
    expectations: `
      - MUST be in Brazilian Portuguese
      - Growth over the years is data: a line chart (or a table) of the balance year by year with exact values in the brief, visual null; no picture is needed for it
    `,
    id: "pt-juros-compostos",
    language: "pt",
    lessonCanDo: "Calcular quanto um valor rende com juros compostos",
    lessonDescription: "Entenda por que os juros compostos crescem mais rápido que os simples.",
    lessonTitle: "Juros compostos",
    level: "beginner",
    pictures: "any",
    skills: ["Calcular o montante com juros compostos"],
  }),
  visualCase({
    chapterTitle: "The inner planets",
    courseTitle: "Astronomy",
    expectations: `
      - MUST be in US English
      - Comparing Earth and Mars needs seeing them: one picture with both planets, labeled 1 and 2, at their relative sizes and colors; their numbers (diameter, distance from the Sun, length of a year) are a table, not a picture
    `,
    id: "en-earth-mars",
    language: "en",
    lessonCanDo: "Compare Earth and Mars and explain why Mars is colder",
    lessonDescription: "Compare the size, distance and air of Earth and Mars.",
    lessonTitle: "Earth and Mars compared",
    level: "beginner",
    pictures: "some",
    skills: ["Compare Earth and Mars by size, distance from the Sun and atmosphere"],
  }),
  visualCase({
    chapterTitle: "Adaptações",
    courseTitle: "Biologia",
    expectations: `
      - MUST be in Brazilian Portuguese
      - The camel's adaptations are features of its body: a picture of the camel with the features the lesson names labeled (humps, long eyelashes, wide feet, nostrils that close)
    `,
    id: "pt-camelo-adaptacoes",
    language: "pt",
    lessonCanDo: "Relacionar as partes do corpo do camelo à vida no deserto",
    lessonDescription: "Descubra como o corpo do camelo o ajuda a sobreviver no deserto.",
    lessonTitle: "Adaptações do camelo ao deserto",
    level: "beginner",
    pictures: "some",
    skills: ["Relacionar características do camelo à vida no deserto"],
  }),
  visualCase({
    chapterTitle: "Medieval architecture",
    courseTitle: "Art history",
    expectations: `
      - MUST be in US English
      - Telling the styles apart is about how buildings look: one picture with a Romanesque and a Gothic church, labeled 1 and 2, showing round versus pointed arches, thick walls versus tall windows and flying buttresses
    `,
    id: "en-gothic-romanesque",
    language: "en",
    lessonCanDo: "Tell a Gothic church from a Romanesque one",
    lessonDescription: "Spot the arches, walls and windows that set the two styles apart.",
    lessonTitle: "Romanesque and Gothic churches",
    level: "beginner",
    pictures: "some",
    skills: ["Identify Romanesque and Gothic features in a church"],
  }),
  visualCase({
    chapterTitle: "The American Revolution",
    courseTitle: "US history",
    expectations: `
      - MUST be in US English
      - The dated events from the Stamp Act (1765) to the Declaration of Independence (1776) are a timeline with exact dates in the brief, visual null; no picture is needed for them
    `,
    id: "en-road-to-revolution",
    language: "en",
    lessonCanDo: "Order the events that led to the Declaration of Independence",
    lessonDescription:
      "Follow the decade of laws and protests that led the colonies to break away.",
    lessonTitle: "The road to revolution",
    level: "beginner",
    pictures: "any",
    skills: ["Order the main events from 1765 to 1776"],
  }),
];
