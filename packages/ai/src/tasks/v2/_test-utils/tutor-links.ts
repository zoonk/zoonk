import { type GoalTutorLinks } from "../tutor/goal-tutor-pages";

/** A host that links each page by its name and everything else by its kind and id. */
export const TEST_TUTOR_LINKS: GoalTutorLinks = {
  pages: {
    activity: "/activity",
    appearance: "/appearance",
    buddy: "/buddy",
    courses: "/courses",
    earlierQuestions: "/earlierQuestions",
    energy: "/energy",
    exam: "/exam",
    level: "/level",
    logbook: "/logbook",
    memory: "/memory",
    mindMaps: "/mindMaps",
    mistakes: "/mistakes",
    mistakesPractice: "/mistakesPractice",
    mockChooser: "/mockChooser",
    patterns: "/patterns",
    plan: "/plan",
    profile: "/profile",
    pronunciation: "/pronunciation",
    score: "/score",
    settings: "/settings",
    speaking: "/speaking",
    startGoal: "/startGoal",
    stats: "/stats",
    subscription: "/subscription",
    support: "/support",
    today: "/today",
  },
  toLink: (link) => {
    switch (link.kind) {
      case "block":
        return `/block/${link.blockId}`;
      case "challenge":
        return `/challenge/${link.planItemId}`;
      case "page":
        return `/${link.page}`;
      case "subject":
        return `/subject/${link.key}`;
      default:
        return link satisfies never;
    }
  },
};
