import {
  type GoalTutorLinks,
  type GoalTutorPage,
  type TutorLink,
} from "@zoonk/core/lesson-questions/contract";
import { keepAllowedMarkdownLinks } from "@zoonk/utils/markdown-links";

/**
 * Where each of the app's pages the buddy may send the learner to lives in the web app, as its
 * router takes it (without the language: the app's `Link` adds it). Main checks every one against
 * its routes.
 */
const TUTOR_PAGE_PATHS = {
  activity: "/activity",
  appearance: "/settings/appearance",
  buddy: "/buddy",
  courses: "/courses",
  earlierQuestions: "/buddy/earlier-questions",
  energy: "/energy",
  exam: "/exam",
  level: "/level",
  logbook: "/logbook",
  memory: "/settings/memory",
  mindMaps: "/mind-maps",
  mistakes: "/mistakes",
  mistakesPractice: "/mistakes/practice",
  mockChooser: "/mock/new",
  patterns: "/patterns",
  plan: "/plan",
  profile: "/profile",
  pronunciation: "/pronunciation",
  score: "/score",
  settings: "/settings",
  speaking: "/speaking",
  startGoal: "/start",
  stats: "/stats",
  subscription: "/subscription",
  support: "/support",
  today: "/today",
} as const satisfies Record<GoalTutorPage, string>;

/** The session screen showing one of today's blocks, as Today's queue opens it. */
const BLOCK_PATH = "/session?block=";
const CHALLENGE_PATH = "/challenge/";
const SUBJECT_PATH = "/plan/";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const BLOCK_LINK = new RegExp(`^/session\\?block=(${UUID})$`, "u");
const CHALLENGE_LINK = new RegExp(`^/challenge/${UUID}$`, "u");
const SUBJECT_LINK = /^\/plan\/[^/?#\s]+$/u;

const PAGE_PATHS = new Set<string>(Object.values(TUTOR_PAGE_PATHS));

/** The web app's link to what core points at. */
function toTutorAppPath(link: TutorLink): string {
  switch (link.kind) {
    case "block":
      return `${BLOCK_PATH}${link.blockId}`;
    case "challenge":
      return `${CHALLENGE_PATH}${link.planItemId}`;
    case "page":
      return TUTOR_PAGE_PATHS[link.page];
    case "subject":
      return `${SUBJECT_PATH}${encodeURIComponent(link.key)}`;
    default:
      return link satisfies never;
  }
}

/**
 * Whether a link in a buddy answer has the shape of one the app gives it: one of its pages, or a
 * block, challenge or subject of the plan. Saved answers keep only the exact links their answer
 * was given; this keeps any other shape (an outside site, a path the app never links) from ever
 * being a link.
 */
export function isTutorAppPath(href: string): boolean {
  return (
    PAGE_PATHS.has(href) ||
    BLOCK_LINK.test(href) ||
    CHALLENGE_LINK.test(href) ||
    SUBJECT_LINK.test(href)
  );
}

/** The block a buddy link opens, for hosts that start it as Today does; null for any other link. */
export function readTutorBlockLink(href: string): string | null {
  return BLOCK_LINK.exec(href)?.[1] ?? null;
}

/**
 * The links one buddy answer may keep, as the web app writes them: the pages its guide lists
 * (`listGoalTutorPages` in `@zoonk/ai`) and every link its context and lookups give it, recorded
 * as the task reads them. `links` is what the task reads; `checkLinks` turns any other link in
 * the answer into its words, so the answer links only what it was given, never a link it made up,
 * an outside site or one a title smuggled in. The answers route saves what it returns, and the
 * buddy's eval scores the same check.
 */
export function createAnswerLinks(pages: readonly GoalTutorPage[]): {
  checkLinks: (markdown: string) => ReturnType<typeof keepAllowedMarkdownLinks>;
  links: GoalTutorLinks;
} {
  const given = new Set<string>(pages.map((page) => TUTOR_PAGE_PATHS[page]));

  return {
    checkLinks: (markdown) =>
      keepAllowedMarkdownLinks({ isAllowed: (href) => given.has(href), markdown }),
    links: {
      pages: TUTOR_PAGE_PATHS,
      toLink: (link) => {
        const path = toTutorAppPath(link);
        given.add(path);
        return path;
      },
    },
  };
}
