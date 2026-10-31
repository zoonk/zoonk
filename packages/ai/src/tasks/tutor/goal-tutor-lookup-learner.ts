import { type TutorLink } from "./goal-tutor-pages";

/** Each item that opens in the app carries where (`link`), as core points at it. */
export const LEARNER_LOOKUPS = [
  "missions",
  "goals",
  "account",
  "weekly",
  "courses",
  "progress",
] as const;

export type LearnerLookUp = (typeof LEARNER_LOOKUPS)[number];

type WeekNumbers = {
  /** Per day studied. */
  averageMinutes: number;
  daysStudied: number;
  minutes: number;
  questions: number;
};

export type LearnerLookUpFound =
  | {
      /** Finishing every mission included. */
      brainPower: { today: number; total: number };
      /** What finishing every mission adds once, and whether today earned it. */
      bonus: { brainPower: number; earned: boolean };
      /** The day Today shows: today, or the day before while they're still in its session. */
      date: string;
      missions: {
        done: number;
        kind: string;
        /** Null once done or when it opens outside a link. */
        link: TutorLink | null;
        /** `todo` or `done`. */
        status: string;
        title: string | null;
        total: number;
      }[];
      moreMissions: number;
      what: "missions";
    }
  | {
      dailyMinutes: number;
      goals: {
        dailyMinutes: number;
        kind: string;
        /** Only for the goal the app has open. */
        link: TutorLink | null;
        open: boolean;
        /** Null before the plan is built. */
        plan: { endDate: string | null; lessonsDone: number; lessonsTotal: number } | null;
        /** `active`, `paused` or `completed`. */
        status: string;
        targetDate: string | null;
        thisGoal: boolean;
        title: string;
      }[];
      moreGoals: number;
      what: "goals";
    }
  | {
      /** Null for a period their plan doesn't cap. */
      callMinutesLeft: { thisMonth: number | null; today: number | null };
      link: TutorLink | null;
      memory: { enabled: boolean; link: TutorLink | null };
      /** `free`, `plus`, or `guest` before they create an account. */
      plan: { link: TutorLink | null; tier: "free" | "guest" | "plus" };
      preferences: {
        /** Null while it goes by its own name. */
        buddyName: string | null;
        dailyLimitMinutes: number | null;
        link: TutorLink | null;
        sounds: boolean;
      };
      what: "account";
    }
  | {
      /** The skill whose share of right answers went up the most during the week. */
      biggestStep: {
        /** How it's known now: `gold` (mastered), `solid`, or still `practice`. */
        reason: string;
        /** Later days of the week whose first answer on it was right. */
        rememberedDays: number;
        /** Percent right on its first and last day studied. */
        rightFrom: number;
        rightTo: number;
        skill: string;
      } | null;
      badges: number;
      lastWeek: WeekNumbers;
      link: TutorLink | null;
      next: string | null;
      phasesFinished: string[];
      week: WeekNumbers & {
        end: string;
        /** False until Sunday: the week is still being written. */
        finished: boolean;
        start: string;
      };
      what: "weekly";
    }
  | {
      courses: {
        lessonsDone: number;
        /** From its written chapters; null before it can tell. */
        percentDone: number | null;
        /** The course this goal is built on. */
        thisGoal: boolean;
        title: string;
      }[];
      link: TutorLink | null;
      moreCourses: number;
      what: "courses";
    }
  | {
      language: {
        /** "I can" checks: the last units' done, the current unit's ahead. */
        canDo: { done: boolean; text: string }[];
        level: string | null;
        skills: { level: string; levelAtStart: string; skill: string; trend: string }[];
        target: string | null;
      } | null;
      /** The Plan in the open goal's conversation, else their stats. */
      link: TutorLink | null;
      mistakes: { link: TutorLink | null; open: number };
      /** Null for a goal without one. */
      preparation: {
        /** A range, only once mock exams hold enough of the exam. */
        estimatedScore: { high: number; low: number; scale: string } | null;
        /** 0 to 100. */
        percent: number;
        /** The plan's pace: `onTrack`, `ahead`, `behind`, `pastDate`, `finished`, and so on. */
        planStatus: string | null;
        /** `starting`, `building`, `growing` or `solid`. */
        stage: string;
        /** Points gained since the week began. */
        weekGain: number;
        weakestArea: string | null;
      } | null;
      /** The totals count only the areas found. */
      stillNeeded: {
        areas: {
          minutes: number;
          /** Some of them; `skillsLeft` counts them all. */
          skills: string[];
          skillsLeft: number;
          skillsTotal: number;
          title: string;
        }[];
        minutes: number;
        moreAreas: number;
        skillsLeft: number;
      } | null;
      what: "progress";
    };

export const LEARNER_LOOKUP_USES: Record<LearnerLookUp, string> = {
  account:
    "their account: Free or Plus (`guest` before they create an account), the call minutes left today and this month (null when that period has no cap), whether memory is on, and their preferences (the name they gave you, null when you go by your own; sounds; a daily time limit). Each part links its page. Never say a price. For their plan, call time, memory or settings.",
  courses:
    "the courses they study, most recent first, each with the lessons they finished and how far they are (`percentDone`), and whether it's the course this goal is built on. Narrow it with `query` (a course's title). For their courses outside this goal.",
  goals:
    "every goal they have (not archived): its title, kind and status, the one the app has open (`open`) and the one this conversation is about (`thisGoal`), its daily minutes and date, and its plan's lessons done of the total and end date. For their other goals or how they compare.",
  missions:
    "today's missions as Today shows them (done of total, status, each linked while still to do), the Brain Power they earned today and in all, and the bonus for finishing every mission. For what's left of today's missions or their Brain Power.",
  progress:
    "their progress toward this goal as the Plan shows it: their preparation (a percent from 0 to 100 with its stage, its gain this week, the plan's pace, the weakest area, and an estimated score range only after mocks), what's still needed by area (skills left and the plan's minutes for them; `area` for one), open mistakes, and for a language goal their level by skill, the target and the \"I can\" checks. Say preparation, never a pass or a result. For how ready they are or what's left.",
  weekly:
    "their week in review, as the logbook tells it: the latest finished week (this week on Sunday) next to the one before (days studied, minutes, questions), the skill they improved most and how, badges, phases finished and the next lesson. For how their week went.",
};
