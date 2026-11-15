import { type Anchor, PHONE_AND_LAPTOP, type Scenario, type Step } from "./shape.mts";

/** Taps that set the sound delay up, then a try's: enough to cover each one's beat. */
const SETUP_TAPS = 16;
const TRY_TAPS = 30;
/** The setup's last tap settling before its Continue shows. */
const SETTLE_MS = 1500;

/** A learner tapping the space bar `count` times, about a third of a second apart. */
function taps(count: number): Step[] {
  return Array.from({ length: count }, (): Step[] => [{ pause: 350 }, { press: "Space" }]).flat();
}

/** What a detail page's placeholder draws (S1's `DetailSkeleton`): its bar, title and aside. */
const DETAIL_TOP: Anchor[] = [
  { id: "bar", web: "main [data-slot=page-top-bar]" },
  { id: "back-link", web: "main [data-slot=back-link]" },
  { id: "bar-action", web: "main [data-slot=page-top-end] > *" },
  // A detail page's title is `DetailTitle`; its placeholder's, `PageTitle`.
  { id: "title", web: "main :is([data-slot=page-title], [data-slot=detail-title])" },
  { id: "aside", web: "[data-slot=page-aside]" },
];

/** A detail page, and its placeholder as a hard load first paints it. */
function detailPair({
  id,
  persona,
  proof,
  screen,
}: {
  id: string;
  persona: string;
  proof: string;
  screen: string;
}): Scenario[] {
  const page = {
    anchors: DETAIL_TOP,
    prerequisites: { persona: { name: persona } },
    proof,
    reach: [],
    screen,
    sizes: PHONE_AND_LAPTOP,
  };

  return [
    { ...page, id, pair: { change: [], placeholder: true, with: `${id}.placeholder` } },
    { ...page, firstPaint: true, id: `${id}.placeholder` },
  ];
}

/**
 * The states a learner reaches by a tap, a seeded copy or a first paint: placeholders against their
 * pages, the plan's reveal, an activity after its own action, and the pages siblings sit on.
 */
export const STATE_SCENARIOS: Scenario[] = [
  // A detail page's placeholder draws its bar and title where the page does, and nothing the
  // page then moves or removes (S1's rule; S2's back link the shell drew and the page hid).
  ...detailPair({ id: "exam.detail", persona: "ana", proof: "Mock exams", screen: "/exam" }),
  ...detailPair({
    id: "completed-lessons",
    persona: "maya",
    proof: "Completed lessons",
    screen: "/completed-lessons",
  }),
  // The plan's reveal, onboarding's last step: from Today the learner opens it, skips the questions
  // about them, and sees their first week, a list whose dates lead its days (`week-day-date`, `week-day-item`).
  {
    anchors: [],
    from: "/today",
    id: "onboarding.reveal",
    prerequisites: { persona: { name: "maya" }, state: "reveal" },
    proof: "Plan created",
    reach: [{ click: "See your plan" }, { click: "Skip all" }, { wait: "Plan created" }],
    screen: "/start/[goal]",
    sizes: PHONE_AND_LAPTOP,
    writes: true,
  },
  // The state after an activity's own action, once the lesson's Check can be pressed: one filled
  // action on the page (the code runner after a run, the rhythm tapper after a try), and a
  // learner's question typed into Buddy's composer.
  {
    anchors: [],
    app: "playground",
    id: "player.code-runner.after-run",
    prerequisites: { persona: "visitor" },
    proof: "Run again",
    reach: [{ click: "Run" }, { wait: "Run again" }],
    screen: "/preview?entry=activity-codeRunner&state=answering",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [],
    app: "playground",
    id: "player.rhythm-tapper.after-try",
    prerequisites: { persona: "visitor" },
    proof: "Try again",
    reach: [
      // Its sound delay is set up first, by tapping along.
      { click: "Start" },
      ...taps(SETUP_TAPS),
      { pause: SETTLE_MS },
      { click: "Continue" },
      { click: "Start tapping" },
      ...taps(TRY_TAPS),
      { wait: "Try again" },
    ],
    screen: "/preview?entry=activity-rhythmTapper&state=answering",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [],
    id: "buddy.typed",
    prerequisites: { persona: { name: "maya" } },
    proof: "What should I study next?",
    reach: [{ fill: { field: "Ask anything", value: "What should I study next?" } }],
    screen: "/buddy",
    sizes: PHONE_AND_LAPTOP,
  },
  // A Statistics page: its stat tiles, and from `md` the section's tabs, siblings side by side.
  {
    anchors: [],
    id: "stats.activity",
    prerequisites: { persona: { name: "maya" } },
    proof: "Days studied",
    reach: [],
    screen: "/activity",
    sizes: [
      { pointer: "touch", size: "phone" },
      { pointer: "touch", size: "tablet" },
      { pointer: "keys", size: "laptop" },
    ],
  },
];
