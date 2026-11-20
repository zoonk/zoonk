// The pieces worth showing, per screen: a scene picks one in focus and one behind it. Each is found by
// the app's own data-slot, at the narrowest width that gives its composed layout on a wide screen
// (`wide`), or at a phone's width for the 4:5 frame.
import { LEARNERS, type LearnerId } from "../learners/learners";
import { type PieceSpec } from "./kit";

const CHROME = ['[data-slot="page-top-bar"]', '[data-slot="bottom-bar"]'];
const TAB_CHROME = [...CHROME, '[data-slot="learn-bottom-navigation"]'];
const HEADING = '[data-slot="onboarding-heading"]';
const PHONE = 430;
/** Room under a piece whose rows arrive with a short rise, so its crop never cuts the last one on the way. */
const RISE: [number, number, number, number] = [0, 0, 18, 0];

type Screen = "goal" | "reveal" | "time" | "today";

export type PieceOptions = {
  /** The app's wide layout; the phone's otherwise. */
  wide: boolean;
  /** A width other than the piece's own. */
  w?: number;
  /** More of the view's parameters, such as "typed=0" or "minutes=155". */
  query?: string;
};

function base(screen: Screen, who: LearnerId, { query, w, wide }: PieceOptions, wideWidth: number) {
  const view = [
    `views=learners&view=learner-${screen}`,
    `learner=${who}`,
    `lang=${LEARNERS[who].lang}`,
    query,
  ]
    .filter(Boolean)
    .join("&");
  return { view, w: w ?? (wide ? wideWidth : PHONE) };
}

type PieceFor = (who: LearnerId, options: PieceOptions) => PieceSpec;

export const pieces = {
  goal: {
    /** "What's your goal?" and the line under it. */
    heading: (who, o) => ({
      ...base("goal", who, o, 660),
      crop: [HEADING],
      hide: CHROME,
      radius: 0,
    }),
    /** The box with the learner's sentence; one line from 660 px. */
    box: (who, o) => ({
      ...base("goal", who, o, 660),
      crop: ['[data-slot="goal-field"]'],
      hide: CHROME,
      lift: true,
    }),
    /** "Build my plan", where the wide layout's bottom bar puts it. */
    button: (who, o) => ({
      ...base("goal", who, o, 1240),
      h: 700,
      crop: ['[data-slot="bottom-bar-actions"] button[type="submit"]'],
      css: '[data-slot="page-top-bar"] { visibility: hidden !important; }',
    }),
  },
  reveal: {
    /** "Your plan is ready" and the goal's name. */
    heading: (who, o) => ({
      ...base("reveal", who, o, 660),
      crop: [HEADING],
      pad: RISE,
      hide: CHROME,
      radius: 0,
    }),
    /** The time a day, the days until the date and what that time covers. */
    plan: (who, o) => ({
      ...base("reveal", who, o, 660),
      crop: ['[data-slot="reveal-plan"]'],
      pad: RISE,
      hide: CHROME,
      radius: 0,
    }),
    /** A language goal's path of phases, or an exam's subjects. */
    structure: (who, o) => ({
      ...base("reveal", who, o, 700),
      crop: ['[data-slot="reveal-structure"]'],
      pad: RISE,
      hide: CHROME,
      radius: 0,
    }),
  },
  time: {
    /** "How much time can you study each day?" */
    heading: (who, o) => ({
      ...base("time", who, o, 480),
      crop: [HEADING],
      hide: CHROME,
      radius: 0,
    }),
    /** The time picked and what it covers by the date, with the offer to cover everything. */
    answer: (who, o) => ({
      ...base("time", who, o, 480),
      crop: ['[data-slot="schedule-time"]'],
      pad: [8, 0, 10, 10],
      hide: CHROME,
      radius: 0,
      wait: '[data-slot="schedule-time"] p',
    }),
  },
  today: {
    /** "Today", the minutes left, the day's bar and its lessons, with the row for the ones still being prepared. */
    day: (who, o) => ({
      ...base("today", who, o, PHONE),
      crop: ['[data-slot="page-header"]', '[data-slot="today-session"]'],
      pad: [10, 12, RISE[2], 12],
      hide: TAB_CHROME,
      radius: 0,
    }),
    /** "This week", the day's place in it. */
    week: (who, o) => ({
      ...base("today", who, o, PHONE),
      crop: ['[data-slot="today-week"]'],
      pad: RISE,
      hide: TAB_CHROME,
      radius: 0,
    }),
  },
} satisfies Record<Screen, Record<string, PieceFor>>;
