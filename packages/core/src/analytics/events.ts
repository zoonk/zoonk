import { type BuddyKind } from "@zoonk/utils/buddy";
import { type MissionKind } from "../sessions/missions/catalog";
import { type AnalyticsGoalKind, type SharedEventProperties } from "./shared-properties";

/** Vercel Web Analytics rejects nested property values. */
type EventPropertyValue = boolean | number | string | null | undefined;
type NoProperties = Record<string, never>;

/** Event properties must not reuse shared property names: they would overwrite them. */
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

/** Keep these property names so existing lesson dashboards continue to work. */
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
  "Mistake Practice Finished": { correct: number; questions: number };
  "Mock Exam Completed": {
    correct: number;
    exam_blueprint_id: string | null;
    minutes: number;
    questions: number;
  };
  "Pronunciation Tip Shown": { skill_id: string | null; target_language: string };
  "Conversation Finished": {
    conversation_kind: "checkpoint" | "exam_speaking" | "practice" | "speaking_mock";
    objectives: number;
    objectives_met: number;
    spoken_seconds: number;
    target_language: string;
  };
  "Level Test Finished": { answered: number; target_language: string };
  "Mistake Pattern Found": { pattern_kind: "pattern" | "typos"; target_language: string };
  "Mistake Pattern Practiced": { correct: number; questions: number };
  "Review Completed": {
    days_after_due: number;
    days_since_last_review: number;
    is_correct: boolean;
    skill_id: string;
  };
  "Skill Level Changed": { from_state: MasteryState; skill_id: string; to_state: MasteryState };
  /** `score` is the percent of answers right. */
  "Test-out Taken": { chapter_id: string; passed: boolean; score: number };
  "Tutor Asked":
    | { chapter_id: string; scope: "chapter" }
    | { goal_id: string; scope: "plan" }
    | { goal_id: string; scope: "subject"; subject_key: string }
    | { item_id: string; scope: "item" }
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
  "Ceremony Shown": { ceremony: "belt" | "buddy_stage" | "glasses" };
  "Hyperdrive Reached": { multiplier: number };
  "Logbook Viewed": NoProperties;
  "Milestone Earned": { key: string; milestone: "badge" | "belt" | "glasses" | "buddy_stage" };
  "Mission Completed": { full_meal: boolean; mission: MissionKind | "fix" | "new" };
};

type SettingsEvents = { "Memory Turned Off": NoProperties; "Plan Edited": { change_kind: string } };

type AccountEvents = {
  "Sign In Completed": NoProperties;
  "Sign In Method Chosen": { method: "apple" | "google" | "otp" };
  "Sign Up Completed": { from_guest: boolean };
  "Subscription Canceled": { plan: string };
  "Subscription Checkout Started": { billingPeriod: "monthly" | "yearly"; plan: string };
  "Subscription Conversion": { plan: string };
  "Subscription Gate Shown": NoProperties;
};

type QualityEvents = {
  "Content Reported": { content_id: string; content_kind: string; reason: string };
  "Feedback Sent": { content_kind: string | null };
  "Generation Failed": { content_kind: string; model: string | null; task: string };
  "Generation Waited": { content_kind: string; milliseconds: number };
};

type OutcomeEvents = {
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

export type TrackOptions = {
  /** Sends it right away instead of in the next batch, for an event sent as the page closes. */
  instant?: boolean;
};

export type AnalyticsEvent = {
  [Name in keyof AnalyticsEvents]: AnalyticsEvents[Name] extends NoProperties
    ? { name: Name; properties?: undefined }
    : { name: Name; properties: AnalyticsEvents[Name] };
}[keyof AnalyticsEvents];

export type TrackEvent = (event: AnalyticsEvent, options?: TrackOptions) => void;
