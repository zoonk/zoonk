/**
 * The one list: each host maps every page to its own link and the guide lists them in this order.
 * It's the same for every learner, so the guide stays in the cached start of every request.
 */
export const GOAL_TUTOR_PAGES = [
  "today",
  "plan",
  "buddy",
  "earlierQuestions",
  "mistakes",
  "mistakesPractice",
  "mockChooser",
  "exam",
  "logbook",
  "stats",
  "energy",
  "level",
  "patterns",
  "activity",
  "score",
  "mindMaps",
  "speaking",
  "pronunciation",
  "courses",
  "startGoal",
  "profile",
  "settings",
  "appearance",
  "memory",
  "subscription",
  "support",
] as const;

export type GoalTutorPage = (typeof GOAL_TUTOR_PAGES)[number];

/**
 * They show the goal the app has open, so the buddy links them only in its conversation about that
 * goal (`PlanScopeContext.selectedGoal`) and a link never opens another goal's page.
 */
const SELECTED_GOAL_PAGES = new Set<GoalTutorPage>([
  "buddy",
  "exam",
  "logbook",
  "mindMaps",
  "mistakes",
  "mistakesPractice",
  "mockChooser",
  "plan",
  "pronunciation",
  "speaking",
  "today",
]);

export function listGoalTutorPages({ selectedGoal }: { selectedGoal: boolean }): GoalTutorPage[] {
  return GOAL_TUTOR_PAGES.filter((page) => selectedGoal || !SELECTED_GOAL_PAGES.has(page));
}

const PAGE_USES: Record<GoalTutorPage, string> = {
  activity:
    "their study days, the lessons they finished and their time spent learning. For when or how much they studied.",
  appearance:
    'the Preferences page: their buddy ("Choose your buddy" opens its character, name and glasses; Save keeps the change), sounds when they get an answer right or finish, a daily time limit that stops them for the day, and the app\'s language. Light and dark mode follow their device. For changing their buddy, sounds, the daily limit or the language.',
  buddy:
    "this conversation with you, their buddy, for the goal they have open, and their buddy's day. For asking you something later.",
  courses:
    "the app's catalog of ready courses, by category. For browsing courses or finding one to start.",
  earlierQuestions: "the questions they asked you before, with your answers.",
  energy: "their Energy now and over the past 12 months. For questions about their Energy.",
  exam: "about their exam, for an exam goal: its days, the next mock exam, what's on it, how it's scored, their mocks so far and their results. For what their exam is like.",
  level: "their belt, level and Brain Power. For questions about their level, belt or Brain Power.",
  logbook:
    "their week in review: what they did this week next to the last, their biggest step forward and what comes next. For what they did this week.",
  memory:
    "what the app remembers about them, to see, correct or delete, and the switch that turns memory off.",
  mindMaps:
    "the mind maps of the chapters they finished, by subject, each opening full screen. For reviewing a chapter at a glance.",
  mistakes:
    "their mistakes notebook: every question they got wrong, why, and what's fixed. For going over their mistakes.",
  mistakesPractice:
    "practice that brings back the questions they got wrong, to fix them. For practising their mistakes now.",
  mockChooser:
    "choosing a mock exam of their exam to take now: the full exam, half of it or one subject. For a mock outside the plan's days.",
  patterns:
    "when they perform best over the past 90 days. For their study habits and the best time to study.",
  plan: "their plan for the goal: its phases, this week's days, the challenges and mocks ahead, what's left, their status, and every setting they can change (daily time, days, date, focus). For anything about their plan.",
  profile: "their profile: their name, username and account.",
  pronunciation:
    "the words they mispronounced in the language they're learning, to say again with a native recording. For their pronunciation.",
  score:
    "how many of their answers are right and the weekly trend over the past 90 days. For how accurate they are.",
  settings:
    "their settings in one list: their account, preferences (buddy, sounds, daily time limit, language), memory, subscription and help.",
  speaking:
    "for a language goal, speaking practice in an exam's format at the level they aim for: its tasks, one at a time, and their last results. For practising speaking in an exam's format.",
  startGoal: "starting a new goal: another subject, skill, language or exam.",
  stats:
    "their statistics: Energy, level, how many answers they get right, when they study best and the days they studied. For how they're doing in numbers.",
  subscription:
    "their subscription: Free or Plus, what Plus includes, subscribing, managing or cancelling it.",
  support:
    "help: ask a question, report a problem or share an idea; the team answers by email. For a problem with the app.",
  today:
    "today's session in order, their missions, and catching up on lessons earlier days left when that's offered. For what to do today.",
};

/** Each host turns it into its own link; core never knows the routes. */
export type TutorLink =
  | { blockId: string; kind: "block" }
  | { kind: "challenge"; planItemId: string }
  | { kind: "page"; page: GoalTutorPage }
  | { key: string; kind: "subject" };

/** The model reads the links as they are and copies them into its answer. */
export type GoalTutorLinks = {
  pages: Record<GoalTutorPage, string>;
  toLink: (link: TutorLink) => string;
};

/** The links are the host's and the same for every learner. */
export function formatGoalTutorPageGuide({
  pages,
  selectedGoal,
}: {
  pages: GoalTutorLinks["pages"];
  selectedGoal: boolean;
}): string {
  return listGoalTutorPages({ selectedGoal })
    .map((page) => `- ${pages[page]}: ${PAGE_USES[page]}`)
    .join("\n");
}

function isTutorLink(value: unknown): value is TutorLink {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "block" ||
      value.kind === "challenge" ||
      value.kind === "page" ||
      value.kind === "subject")
  );
}

/** `link` fields hold the host's link, so the model copies a ready link and never builds one. */
export function stringifyWithLinks(value: unknown, toLink: GoalTutorLinks["toLink"]): string {
  return JSON.stringify(value, (key, field: unknown) =>
    key === "link" && isTutorLink(field) ? toLink(field) : field,
  );
}
