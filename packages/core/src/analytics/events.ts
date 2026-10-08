import { type BuddyKind } from "@zoonk/utils/buddy";
import { type AnalyticsGoalKind, type SharedEventProperties } from "./shared-properties";

/**
 * The event catalog every Zoonk app sends to PostHog.
 *
 * - Outcomes (completions, sessions, skill changes and subscriptions) are sent
 *   from the server with `trackServerEvent`, so ad blockers can't hide them.
 *   Views and taps are sent from the browser with `trackEvent`.
 * - Events that existed before this catalog keep their names and camelCase
 *   properties so existing dashboards keep working. When the plan calls one of
 *   them something else, its comment names the plan's event. New events use
 *   snake_case properties, like PostHog's own.
 * - Properties are flat primitives because Vercel Web Analytics rejects nested
 *   values, and they never reuse a shared property name, which would overwrite it.
 */

type EventPropertyValue = boolean | number | string | null | undefined;
type NoProperties = Record<string, never>;

type EventCatalog<
  Catalog extends Record<
    string,
    Record<string, EventPropertyValue> & Partial<Record<keyof SharedEventProperties, never>>
  >,
> = Catalog;

type PublicPageKind = "chapter" | "course" | "lesson";
type StudyBlockKind = "checkpoint" | "learn" | "practice" | "produce" | "review";
type MasteryState = "learning" | "mastered" | "new" | "solid";
type MistakeCause = "gap" | "guess" | "misread" | "time" | "trap";
type MemoryCategory = "background" | "context" | "goals" | "learning" | "preferences" | "routine";
type InsightKind = "plan_change" | "schedule" | "tip";

/**
 * `lessonKind` (the ledger's label, `"library"` for a lesson) and `stepCount` keep the names earlier
 * lesson events used, so existing lesson charts continue.
 */
type LessonEventProperties = { goal_id: string | null; lessonKind: string; lesson_id: string };

type ArrivalEvents = {
  "Guest Lesson Started": { lesson_id: string };
  "Home Viewed": NoProperties;
  "Hook Answered": { lesson_id: string };
  "Plan Link Opened": { plan_id: string };
  "Public Page Viewed": { content_id: string; page: PublicPageKind };
};

type OnboardingEvents = {
  "Goal Classified": { duration_ms: number; result: AnalyticsGoalKind | "declined" };
  "Goal Typed": { has_attachment: boolean };
  "Buddy Chosen": { buddy: BuddyKind; renamed: boolean };
  "Placement Answered": {
    answer: "correct" | "dont_know" | "incorrect";
    question_number: number;
    skill_id: string;
  };
  "Plan Created": {
    estimate_hours: number | null;
    from_plan_link: boolean;
    goal_id: string;
    phases: number;
  };
};

type DailyEvents = {
  "Block Completed": {
    block_kind: StudyBlockKind;
    position: number;
    seconds: number;
    session_id: string;
  };
  "Session Completed": {
    blocks_completed: number;
    daily_goal_met: boolean;
    minutes: number;
    session_id: string;
  };
  "Session Started": { blocks: number; planned_minutes: number; session_id: string };
  "Today Viewed": NoProperties;
};

type LearningEvents = {
  /** Counts drop-off after wrong answers in a row, by the screen the learner left on. */
  "Activity Abandoned": {
    lesson_id: string;
    screen: number;
    step_kind: string;
    wrong_in_a_row: number;
  };
  "Activity Used": { lesson_id: string; template: string };
  /** Every closed run, replays included; the first finish of a lesson has `first_completion`. */
  "Lesson Completed": LessonEventProperties & { first_completion: boolean; seconds: number };
  /** A new run: resuming one started in the last half hour doesn't send it again. */
  "Lesson Started": LessonEventProperties & { stepCount: number };
  "Mistake Fixed": { cause: MistakeCause | null; skill_id: string | null };
  /** A "Practice mistakes" run finished, at its end or stopped early. */
  "Mistake Practice Finished": { correct: number; questions: number };
  "Mock Exam Completed": {
    correct: number;
    exam_blueprint_id: string | null;
    minutes: number;
    questions: number;
  };
  "Pronunciation Tip Shown": { skill_id: string | null; target_language: string };
  /** A live call ended: practice, a unit's checkpoint or a speaking mock. */
  "Conversation Finished": {
    conversation_kind: "checkpoint" | "practice" | "speaking_mock";
    objectives: number;
    objectives_met: number;
    spoken_seconds: number;
    target_language: string;
  };
  /** The language level test ended, whenever the learner stopped it. */
  "Level Test Finished": { answered: number; target_language: string };
  /** A pattern (or only typos) found in a learner's recent language mistakes. */
  "Mistake Pattern Found": { pattern_kind: "pattern" | "typos"; target_language: string };
  "Mistake Pattern Practiced": { correct: number; questions: number };
  /** One reviewed skill, so recall can be measured by how late and how long after learning. */
  "Review Completed": {
    days_after_due: number;
    days_since_last_review: number;
    is_correct: boolean;
    skill_id: string;
  };
  "Skill Level Changed": { from_state: MasteryState; skill_id: string; to_state: MasteryState };
  /** `score` is the percent of answers right. */
  "Test-out Taken": { chapter_id: string; passed: boolean; score: number };
  /**
   * A new question to the tutor: about a lesson (all of it, one screen or the learner's answer), a
   * chapter, the learner's plan, a mock they finished or their own material (one question can cover
   * several of the files, links or text they added, so it names none).
   */
  "Tutor Asked":
    | { chapter_id: string; scope: "chapter" }
    | { goal_id: string; scope: "plan" }
    | { lesson_id: string; scope: "answer" | "lesson" | "screen" }
    | { mock_id: string; scope: "mock" }
    | { scope: "material" };
};

type MemoryEvents = {
  "Insight Shown": { insight: InsightKind };
  "Insight Undone": { insight: InsightKind };
  "Memory Updated": {
    category: MemoryCategory;
    change: "added" | "deleted" | "updated";
    origin: "noticed" | "said";
  };
};

type MechanicsEvents = {
  "Big Challenge Finished": { correct: number; questions: number };
  "Boss Finished": { boss: "final" | "language" | "phase"; passed: boolean };
  "Capsule Opened": { days_since_sealed: number; lesson_id: string | null };
  /** A milestone's full-screen moment appeared; badges have none. */
  "Ceremony Shown": { ceremony: "belt" | "buddy_stage" | "glasses" };
  "Hyperdrive Reached": { multiplier: number };
  "Logbook Viewed": NoProperties;
  "Milestone Earned": { key: string; milestone: "badge" | "belt" | "glasses" | "buddy_stage" };
  "Mission Completed": { full_meal: boolean; mission: "fix" | "new" | "review" };
};

type SettingsEvents = { "Memory Turned Off": NoProperties; "Plan Edited": { change_kind: string } };

type AccountEvents = {
  /** Sent once an account is deleted, with no properties, so its PostHog person can be deleted too. */
  "Account Deleted": NoProperties;
  "Sign In Completed": NoProperties;
  "Sign In Method Chosen": { method: "apple" | "google" | "otp" };
  /** The plan's "Signed Up". */
  "Sign Up Completed": { from_guest: boolean };
  "Subscription Canceled": { plan: string };
  /** The plan's "Checkout Started". */
  "Subscription Checkout Started": { billingPeriod: "monthly" | "yearly"; plan: string };
  /** The plan's "Subscription Started": sent once Stripe confirms the purchase, not on checkout clicks. */
  "Subscription Conversion": { plan: string };
  /** The plan's "Paywall Shown". */
  "Subscription Gate Shown": NoProperties;
};

type QualityEvents = {
  "Content Reported": { content_id: string; content_kind: string; reason: string };
  /** A vote from a screen's menu or thumbs on AI content, named by its id and kind. */
  "Content Voted": { content_id: string; content_kind: string; vote: "down" | "up" };
  "Feedback Sent": { content_kind: string | null };
  /** A run that gave up on content; `model` is null when the failure isn't tied to one model call. */
  "Generation Failed": { content_kind: string; model: string | null; task: string };
  "Generation Waited": { content_kind: string; milliseconds: number };
};

type OutcomeEvents = {
  /** A language unit's "I can" checks reached: every lesson done or its call won. */
  "Can-do Reached": { can_dos: number; chapter_id: string };
  "Exam Result Reported": {
    exam_blueprint_id: string | null;
    passed: boolean | null;
    score: number | null;
  };
  "Goal Reached": { days: number; goal_id: string };
};

type AnalyticsEvents = EventCatalog<
  ArrivalEvents &
    OnboardingEvents &
    DailyEvents &
    LearningEvents &
    MemoryEvents &
    MechanicsEvents &
    SettingsEvents &
    AccountEvents &
    QualityEvents &
    OutcomeEvents
>;

/** How the browser sends one event. */
export type TrackOptions = {
  /** Sends it right away instead of in the next batch, for an event sent as the page closes. */
  instant?: boolean;
};

/** Pairs each event name with its own properties, so a sender can't mix up shapes. */
export type AnalyticsEvent = {
  [Name in keyof AnalyticsEvents]: AnalyticsEvents[Name] extends NoProperties
    ? { name: Name; properties?: undefined }
    : { name: Name; properties: AnalyticsEvents[Name] };
}[keyof AnalyticsEvents];

/** A browser sender, as hosts inject it into shared screens. */
export type TrackEvent = (event: AnalyticsEvent, options?: TrackOptions) => void;
