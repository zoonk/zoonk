import { type TutorLink } from "./goal-tutor-pages";

/**
 * What the buddy can look up about the learner beyond their goal's plan: today's missions and
 * their Brain Power, their goals, their account (Free or Plus, call time, memory, preferences),
 * their week in review, their courses and their progress. Each item that opens in the app carries
 * where (`link`), as core points at it.
 */
export const LEARNER_LOOKUPS = [
  "missions",
  "goals",
  "account",
  "weekly",
  "courses",
  "progress",
] as const;

export type LearnerLookUp = (typeof LEARNER_LOOKUPS)[number];

/** A week's numbers as the logbook counts them. */
type WeekNumbers = {
  /** Minutes per day studied. */
  averageMinutes: number;
  daysStudied: number;
  minutes: number;
  questions: number;
};

/** What a learner lookup found, by kind. */
export type LearnerLookUpFound =
  | {
      /** Brain Power earned today (finishing every mission included) and in all. */
      brainPower: { today: number; total: number };
      /** The Brain Power finishing every mission adds once, and whether today earned it. */
      bonus: { brainPower: number; earned: boolean };
      /** The day Today shows: today, or the day before while they're still in its session. */
      date: string;
      missions: {
        done: number;
        kind: string;
        /** Where a mission still to do opens; null once done or when it opens outside a link. */
        link: TutorLink | null;
        /** `todo` or `done`. */
        status: string;
        /** What it opens next, such as a lesson's title. */
        title: string | null;
        total: number;
      }[];
      moreMissions: number;
      what: "missions";
    }
  | {
      /** Today's study time across their active goals. */
      dailyMinutes: number;
      goals: {
        dailyMinutes: number;
        kind: string;
        /** The Plan, for the goal the app has open only. */
        link: TutorLink | null;
        /** The goal the app has open (its tabs show it). */
        open: boolean;
        /** Lessons studied of the plan's lessons, and when the plan ends; null before it's built. */
        plan: { endDate: string | null; lessonsDone: number; lessonsTotal: number } | null;
        /** `active`, `paused` or `completed`. */
        status: string;
        targetDate: string | null;
        /** The goal this conversation is about. */
        thisGoal: boolean;
        title: string;
      }[];
      moreGoals: number;
      what: "goals";
    }
  | {
      /** Call minutes left today and this month; null for a period their plan doesn't cap. */
      callMinutesLeft: { thisMonth: number | null; today: number | null };
      /** Their settings page, which lists everything. */
      link: TutorLink | null;
      memory: { enabled: boolean; link: TutorLink | null };
      /** `free`, `plus`, or `guest` before they create an account. */
      plan: { link: TutorLink | null; tier: "free" | "guest" | "plus" };
      preferences: {
        /** The name they gave their buddy; null while it goes by its own name. */
        buddyName: string | null;
        /** Their daily time limit; null without one. */
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
      /** Badges earned during the week. */
      badges: number;
      lastWeek: WeekNumbers;
      /** The logbook, which tells this week. */
      link: TutorLink | null;
      /** The next lesson their plan has for the goal. */
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
        /** Lessons they finished in it. */
        lessonsDone: number;
        /** Percent of the course done, from its written chapters; null before it can tell. */
        percentDone: number | null;
        /** The course this goal is built on. */
        thisGoal: boolean;
        title: string;
      }[];
      /** The catalog, to find another course. */
      link: TutorLink | null;
      moreCourses: number;
      what: "courses";
    }
  | {
      /** For a language goal: the level across skills, each skill's, the target and "I can" checks. */
      language: {
        /** "I can" checks: the last units' done, the current unit's ahead. */
        canDo: { done: boolean; text: string }[];
        level: string | null;
        skills: { level: string; levelAtStart: string; skill: string; trend: string }[];
        target: string | null;
      } | null;
      /** Where to see their progress: the Plan in the open goal's conversation, else their stats. */
      link: TutorLink | null;
      mistakes: { link: TutorLink | null; open: number };
      /** Null for a goal without one. */
      preparation: {
        /** A range, only once mock exams hold enough of the exam. */
        estimatedScore: { high: number; low: number; scale: string } | null;
        /** From 0 to 100. */
        percent: number;
        /** The plan's pace: `onTrack`, `ahead`, `behind`, `pastDate`, `finished`, and so on. */
        planStatus: string | null;
        /** `starting`, `building`, `growing` or `solid`. */
        stage: string;
        /** Points gained since the week began. */
        weekGain: number;
        weakestArea: string | null;
      } | null;
      /** The skills below their bar, by area, with the study time the plan still gives them; the totals count only the areas found. */
      stillNeeded: {
        areas: {
          minutes: number;
          /** Some of the skills left, by name; `skillsLeft` counts them all. */
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

/** What each learner lookup holds and when it answers the learner, in the model's words. */
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
