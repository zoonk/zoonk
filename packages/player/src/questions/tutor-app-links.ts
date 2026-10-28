import {
  type GoalTutorLinks,
  type GoalTutorPage,
  type TutorLink,
} from "@zoonk/core/lesson-questions/contract";
import { keepAllowedMarkdownLinks } from "@zoonk/utils/markdown-links";

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

const BLOCK_PATH = "/session?block=";
const CHALLENGE_PATH = "/challenge/";
const SUBJECT_PATH = "/plan/";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const BLOCK_LINK = new RegExp(`^/session\\?block=(${UUID})$`, "u");
const CHALLENGE_LINK = new RegExp(`^/challenge/${UUID}$`, "u");
const SUBJECT_LINK = /^\/plan\/[^/?#\s]+$/u;

const PAGE_PATHS = new Set<string>(Object.values(TUTOR_PAGE_PATHS));

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

/** Checks path shape only; saved answer links must also match their exact allowlist. */
export function isTutorAppPath(href: string): boolean {
  return (
    PAGE_PATHS.has(href) ||
    BLOCK_LINK.test(href) ||
    CHALLENGE_LINK.test(href) ||
    SUBJECT_LINK.test(href)
  );
}

export function readTutorBlockLink(href: string): string | null {
  return BLOCK_LINK.exec(href)?.[1] ?? null;
}

/** Save the answer returned by `checkLinks`; links outside the collected allowlist become plain text. */
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
