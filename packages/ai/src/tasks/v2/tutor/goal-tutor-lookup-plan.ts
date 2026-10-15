import { type TutorLink } from "./goal-tutor-pages";

/**
 * What the buddy can look up about the learner's plan beyond its context: every lesson earlier days
 * left (the context lists the first few), the plan's days ahead, and every challenge and mock
 * ahead. Each item carries where it opens (`link`), as core points at it.
 */
export const PLAN_LOOKUPS = ["catchUp", "schedule", "challenges"] as const;

export type PlanLookUp = (typeof PLAN_LOOKUPS)[number];

/** A plan item on one of the days ahead, as the plan saved it. */
type ScheduledItem = {
  /** lesson, chapter, review, checkpoint (the week's challenge, a short mixed one), boss (a phase's challenge) or mock. */
  kind: string;
  /** A challenge's or a mock's page, which opens it before its day too; null for anything else. */
  link: TutorLink | null;
  /** As the plan estimates it, for this week's days; null past them. */
  minutes: number | null;
  /** A mock exam the learner's plan doesn't include: it comes with Plus. */
  plusRequired?: true;
  /** todo, done (studied ahead), skipped or testedOut. */
  status: string;
  /** Empty for a challenge or a mock, which `kind` names. */
  title: string;
  /** Lessons the app is still writing, named by their subject: say "more lessons" on it. */
  writing?: true;
};

/** What a plan lookup found, by kind. */
export type PlanLookUpFound =
  | {
      /** In the plan's order. No day each came from: the plan keeps only that earlier days left them. */
      lessons: {
        /** Today's session already holds it: the session opens with it. */
        inToday: boolean;
        /** Today's block that holds it, or Today when it offers catching up; null when nothing opens it yet (the next study days do) or outside the buddy's conversation about the open goal. */
        link: TutorLink | null;
        title: string;
      }[];
      /** Lessons left out of the list, past the ones shown. */
      more: number;
      /** Today offers adding the ones today doesn't hold with one tap; otherwise the next days open with them. */
      offeredToday: boolean;
      total: number;
      what: "catchUp";
    }
  | {
      /** The plan's study days in that span, in order; days with nothing planned are left out. */
      days: {
        date: string;
        items: ScheduledItem[];
        moreItems: number;
        /** Past a free exam plan's first week: the day's lessons, practice and mocks come with Plus. */
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
      /** The plan's phase challenges, mocks and weekly challenges the learner already did. */
      done: { challenges: number; mocks: number; weekly: number };
      /** Weekly challenges and mocks ahead past the ones listed. */
      more: number;
      what: "challenges";
    };

/** What each plan lookup holds and when it answers the learner, in the model's words. */
export const PLAN_LOOKUP_USES: Record<PlanLookUp, string> = {
  catchUp:
    "every lesson earlier days left that they haven't done, in the plan's order, past the first few the context lists: each one's title, whether today's session already holds it (`inToday`) and where it opens, how many in all, and whether Today offers catching up today (`offeredToday`). Which day each one came from isn't kept. Takes no `area` or `query`. For which lessons they're behind on.",
  challenges:
    "every phase challenge still ahead (in phase order), then the next weekly challenges (`weekly`, the week's mixed challenge) and planned mock exams by day, with `more` for the rest: when each comes (on its `date`, in their next session, or after the challenge before it), its phase, whether starting it needs Plus (`locked`) and its link, and how many of each they already did. Takes no `area` or `query`. For when their next challenges and mocks are.",
  schedule:
    "the plan's study days ahead, up to 14 days from the day in `query` (YYYY-MM-DD; null for the day after the context's `today`, which the context already has): each day's lessons, reviews, challenges and mocks with their status, minutes for this week's days, and the challenges' and mocks' links. Ask again from the day after `to` for later days. For what comes on a day or in the next weeks.",
};
