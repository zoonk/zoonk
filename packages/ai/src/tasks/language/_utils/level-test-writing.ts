import { formatLocalContext } from "../../_utils/language-context";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import ladder from "../level-test-ladder.prompt.md";
import languageRules from "../level-test-language-rules.prompt.md";
import { type LevelTestSkill, type TestLevel } from "../level-test-levels";

export type LevelTestLanguages = { learnerLanguage: string; targetLanguage: string };

/**
 * The model picks one before writing the text, so a B2 question is planned as an implication
 * instead of drifting into a stated detail.
 */
export const QUESTION_TESTS = {
  A1: ["one stated fact"],
  A2: ["two stated facts put together", "the order of events"],
  B1: ["the main point", "a reason", "a stated opinion"],
  B2: ["an implied attitude", "the writer's purpose", "the point of an argument"],
  C1: ["implicit meaning", "the speaker's stance", "tone or register", "a qualified or mixed view"],
  C2: [
    "a fine shade of meaning",
    "how an argument is built",
    "an allusion or irony",
    "an unstated assumption",
  ],
} as const satisfies Record<TestLevel, readonly [string, ...string[]]>;

/**
 * Questions of a level are written in several calls at once, so each takes its own situations;
 * topics move from concrete at A1 to abstract at C2, as CEFR's descriptors do.
 */
export const QUESTION_SITUATIONS = {
  A1: {
    listening: [
      "getting around town",
      "meeting a friend",
      "an announcement in a shop",
      "ordering food",
      "a phone message from family",
      "an announcement at a station",
      "a teacher's instruction in class",
      "asking the time or the day",
      "a neighbor saying hello",
      "a taxi or bus ride",
      "a sports class",
      "the weather today",
    ],
    reading: [
      "a shop, café or market",
      "a home or a family",
      "a bus or train ticket",
      "a class timetable",
      "a menu or a price list",
      "a sign in a park or street",
      "a weather notice",
      "a birthday invitation",
      "a pharmacy's opening hours",
      "a hotel's front desk",
      "a supermarket offer",
      "a museum entrance",
    ],
  },
  A2: {
    listening: [
      "an appointment or a booking",
      "a weekend activity",
      "a train delay",
      "a friend's message about a party",
      "shopping for clothes",
      "a museum tour",
      "a weather report on the radio",
      "a message from a landlord",
      "a restaurant reservation",
      "plans to watch a match",
      "a family visit",
      "a bag lost at an airport",
    ],
    reading: [
      "a trip or a holiday",
      "a place to live",
      "a message about a change of plans",
      "an ad for a used bike",
      "a short review of a café",
      "a notice at work",
      "a recipe card",
      "a club's newsletter",
      "an email from a teacher",
      "rules at a swimming pool",
      "a hotel booking confirmation",
      "a postcard from a friend",
    ],
  },
  B1: {
    listening: [
      "a problem while traveling",
      "a sport, hobby or club",
      "a colleague explaining a new procedure",
      "a podcast about saving money",
      "a friend talking about a film",
      "a radio interview with a cook",
      "a tour guide's introduction",
      "a voice message about a cancelled plan",
      "a teacher explaining a project",
      "a neighbor asking for help",
      "a call to customer service",
      "a talk about a local festival",
    ],
    reading: [
      "work or a new job",
      "a course or a class",
      "a blog post about a trip",
      "a notice explaining a change at a gym",
      "an email about a late delivery",
      "a magazine piece on a hobby",
      "a letter from the city about road works",
      "a review of a phone app",
      "an article about eating well",
      "a volunteer program",
      "a message about moving house",
      "a company newsletter",
    ],
  },
  B2: {
    listening: [
      "a product or service someone tried",
      "technology in daily life",
      "a radio comment on traffic",
      "a colleague's view of a meeting",
      "a podcast on cheap clothes",
      "a debate on school uniforms",
      "a friend describing a difficult flatmate",
      "a call-in show about pets in cities",
      "a manager announcing a reorganization",
      "an interview about electric cars",
      "a review of a TV series",
      "a talk on sleep habits",
    ],
    reading: [
      "a change at work or school",
      "a neighborhood or city issue",
      "a review of a hotel",
      "an opinion post about working from home",
      "a complaint to a landlord",
      "a column on social media habits",
      "a workplace email about a new policy",
      "an article on public transport fares",
      "a letter to an editor about tourism",
      "a review of a concert",
      "a post on screen time for children",
      "a report on a local shop closing",
    ],
  },
  C1: {
    listening: [
      "a radio guest talking about their field",
      "someone looking back on a big decision",
      "a panel on a museum's new wing",
      "a podcast host on the culture of productivity",
      "a scientist explaining a disputed finding",
      "a chef reflecting on criticism",
      "a manager giving guarded feedback",
      "an interview with an author",
      "a documentary narrator on a vanishing trade",
      "a friend's careful reaction to news",
      "a debate on tourist taxes",
      "an architect on a controversial building",
    ],
    reading: [
      "a review of a book, film, show or restaurant",
      "an opinion column on how people live or work",
      "a carefully worded email declining an offer",
      "an essay on ambition",
      "a review of an art exhibition",
      "a column on city gardens",
      "a letter of resignation",
      "a feature on a craft tradition",
      "an editorial on a school reform",
      "a memoir's pages about a first job",
      "a critique of a business book",
      "a column on parenting advice",
    ],
  },
  C2: {
    listening: [
      "a late-night radio monologue",
      "an unscripted panel of experts",
      "a comedian's routine",
      "a lecturer's aside on history",
      "a dinner conversation full of allusion",
      "a podcast on the ethics of technology",
      "a retirement speech",
      "an interview with a poet",
      "a talk-show host's ironic commentary",
      "the close of a conference keynote",
      "a theater director on a production",
      "a radio essay on cities at night",
    ],
    reading: [
      "a literary review",
      "an essay on memory",
      "a satirical column",
      "a scholar's blog on how a language changes",
      "a tribute to a retiring artist",
      "an essay on free time",
      "a critic on a cult novel",
      "a commentary on a court ruling for the public",
      "a travel essay that turns reflective",
      "a profile of a reclusive scientist",
      "an essay on translation",
      "an opinion piece with a hidden concession",
    ],
  },
} as const satisfies Record<TestLevel, Record<LevelTestSkill, readonly string[]>>;

/** Apart from the questions' situations, so a confirmation never repeats a question's scene. */
export const CONFIRMATION_SITUATIONS = {
  A1: {
    listening: ["a doctor's receptionist", "a delivery at the door"],
    reading: ["a lost-and-found note", "a pool timetable"],
  },
  A2: {
    listening: ["a school event", "a call to a hairdresser"],
    reading: ["a cinema program", "a note from a neighbor"],
  },
  B1: {
    listening: ["a coach after a match", "a friend's advice on a job interview"],
    reading: ["a forum post about learning an instrument", "a travel guide's page"],
  },
  B2: {
    listening: ["a radio guest on a new airport", "a voice message about a disappointing holiday"],
    reading: ["an essay on volunteering", "a review of a cooking class"],
  },
  C1: {
    listening: ["a commentator on a city's new stadium", "a musician on fame"],
    reading: ["a review of a play's revival", "an opinion piece on nostalgia"],
  },
  C2: {
    listening: ["a moderator's closing remarks", "a storyteller retelling a family legend"],
    reading: ["the opening of a short story", "a review of a poetry collection"],
  },
} as const satisfies Record<TestLevel, Record<LevelTestSkill, readonly [string, string]>>;

/** Both writers share the ladder and the language rules, so their levels mean the same. */
export function withLevelTestRules(template: string): string {
  return template
    .replace("{{LEVELS}}\n", () => `${ladder.trimEnd()}\n\n`)
    .replace("{{LANGUAGE_RULES}}\n", () => `${languageRules.trimEnd()}\n\n`);
}

export function formatLevelTestLanguages({ learnerLanguage, targetLanguage }: LevelTestLanguages) {
  const languages = getLanguagePromptContext({ targetLanguage, userLanguage: learnerLanguage });

  return `TARGET_LANGUAGE: ${languages.targetLanguageName}
LEARNER_LANGUAGE: ${languages.userLanguageName}
${formatLocalContext({ country: null, language: targetLanguage, register: false })}`;
}

export function formatWords({ max, min }: { max: number; min: number }): string {
  return `${min} to ${max}`;
}

/** A stable order from the text, so the right answers don't sit where a model tends to put them. */
export function hashText(text: string): number {
  return Array.from({ length: text.length }, (_, index) => text.codePointAt(index) ?? 0).reduce(
    (total, code) => total + code,
    0,
  );
}
