import { type TutorLink } from "./goal-tutor-pages";

/** `timeToCover` plans the goal at each daily time, so only a question about time asks for it. */
export const PLAN_LOOKUPS = ["catchUp", "schedule", "challenges", "timeToCover"] as const;

export type PlanLookUp = (typeof PLAN_LOOKUPS)[number];

type ScheduledItem = {
  /** lesson, chapter, review, checkpoint (the week's challenge, a short mixed one), boss (a phase's challenge) or mock. */
  kind: string;
  /** Opens it before its day too; null for anything but a challenge or a mock. */
  link: TutorLink | null;
  /** Null past this week's days. */
  minutes: number | null;
  /** A mock the plan doesn't include comes with Plus. */
  plusRequired?: true;
  /** todo, done (studied ahead), skipped or testedOut. */
  status: string;
  /** Empty for a challenge or a mock, which `kind` names. */
  title: string;
  /** Lessons the app is still writing, named by their subject: say "more lessons" on it. */
  writing?: true;
};

export type PlanLookUpFound =
  | {
      /** In the plan's order. No day each came from: the plan keeps only that earlier days left them. */
      lessons: {
        /** Today's session already holds it: the session opens with it. */
        inToday: boolean;
        /**
         * Null when nothing opens it yet, or outside the buddy's conversation about the open goal.
         */
        link: TutorLink | null;
        title: string;
      }[];
      more: number;
      /** Today offers adding the ones today doesn't hold with one tap; otherwise the next days open with them. */
      offeredToday: boolean;
      total: number;
      what: "catchUp";
    }
  | {
      /** Days with nothing planned are left out. */
      days: {
        date: string;
        items: ScheduledItem[];
        moreItems: number;
        /** Past a free exam plan's first week, the day comes with Plus. */
        plusRequired?: true;
      }[];
      /** The first day read: the day after the context's `today`; it and earlier days are never read. */
      from: string;
      /** The last day read: ask again from the day after it for later days. */
      to: string;
      what: "schedule";
    }
  | {
      /** The phase challenges in phase order, then the first weekly challenges and mocks by day. */
      challenges: {
        date: string | null;
        /** A phase's challenge (`challenge`), the week's mixed challenge (`weekly`) or a mock exam (`mock`). */
        kind: "challenge" | "mock" | "weekly";
        /** Null for a selected item until the learner's next POST persists it. */
        link: TutorLink | null;
        /** Still in the plan, but starting it needs Plus. */
        locked: boolean;
        /** The phase it belongs to; `name` is null for an exam's phases, which `kind` names. */
        phase: { index: number; kind: string; name: string | null } | null;
        /** On its `date`, in the learner's next session (`nextSession`), or after the challenge before it (`queued`). */
        when: "date" | "nextSession" | "queued";
      }[];
      done: { challenges: number; mocks: number; weekly: number };
      /** Weekly challenges and mocks ahead past the ones listed. */
      more: number;
      what: "challenges";
    }
  | {
      /**
       * When even the cores don't fit by the date: the fewest minutes a day that bring every topic
       * in.
       */
      coreMinutes: number | null;
      /**
       * For a non-exam goal whose time falls short: the earliest date that time covers it all by.
       */
      fittingDate: string | null;
      /** The fewest minutes a day that study the whole goal in depth by its date; null when no daily time does. */
      recommendedMinutes: number | null;
      targetDate: string | null;
      what: "timeToCover";
    };

export const PLAN_LOOKUP_USES: Record<PlanLookUp, string> = {
  catchUp:
    "every lesson earlier days left that they haven't done, in the plan's order, past the first few the context lists: each one's title, whether today's session already holds it (`inToday`) and where it opens, how many in all, and whether Today offers catching up today (`offeredToday`). Which day each one came from isn't kept. Takes no `area` or `query`. For which lessons they're behind on.",
  challenges:
    "every phase challenge still ahead (in phase order), then the next weekly challenges (`weekly`, the week's mixed challenge) and planned mock exams by day, with `more` for the rest: when each comes (on its `date`, in their next session, or after the challenge before it), its phase, whether starting it needs Plus (`locked`) and its link, and how many of each they already did. Takes no `area` or `query`. For when their next challenges and mocks are.",
  schedule:
    "the plan's study days ahead, up to 14 days from the day in `query` (YYYY-MM-DD; null for the day after the context's `today`, which the context already has): each day's lessons, reviews, challenges and mocks with their status, minutes for this week's days, and the challenges' and mocks' links. Ask again from the day after `to` for later days. For what comes on a day or in the next weeks.",
  timeToCover:
    "the daily time that studies their whole goal in depth by its date (`recommendedMinutes`), found by planning the goal at each daily time: exact, so it takes a moment; null when not even a whole day does. For a goal that isn't an exam whose own time falls short, the earliest date that time covers everything by (`fittingDate`); when even the topics' cores don't fit, the time that brings every topic in (`coreMinutes`). Takes no `area` or `query`. Only when they ask about their daily time, what more time would cover or when they'd finish everything: never for anything else.",
};
