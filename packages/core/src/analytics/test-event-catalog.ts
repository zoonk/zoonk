import { type CefrLevel } from "@zoonk/utils/cefr";

export type TestEventContext = {
  attempt_id: string | null;
  goal_id: string;
  part: number | null;
  parts: number | null;
  questions: number | null;
  surface: "onboarding" | "plan";
  test: "course" | "focus" | "language" | "level_test_out";
};

export type TestRow =
  | "continue"
  | "direct"
  | "first_lesson"
  | "not_now"
  | "quick"
  | "test_out"
  | "whole_course";
export type TestEnd =
  | "audio_deferred"
  | "check_missed"
  | "check_passed"
  | "material_exhausted"
  | "nothing_to_check"
  | "question_cap"
  | "stopped"
  | "unknown_streak";

export type TestEvents = {
  "Test Offered": TestEventContext & { preselected: TestRow; rows: string };
  "Test Offer Deferred": TestEventContext;
  "Test Skipped": TestEventContext & { row: "first_lesson" | "not_now" };
  "Test Started": TestEventContext & { level?: CefrLevel; resumed: boolean; row: TestRow };
  "Test First Question Shown": TestEventContext & {
    question_number: number;
    resumed: boolean;
    wait_ms: number;
  };
  "Test Answered": TestEventContext & {
    answer: "correct" | "dont_know" | "incorrect";
    difficulty?: number | null;
    duration_ms: number;
    kind: "check" | "course" | "focus" | "listening" | "reading";
    level?: CefrLevel;
    question_number: number;
    skill_id?: string;
  };
  "Test Audio Deferred": TestEventContext & {
    kind: "check" | "listening";
    level: CefrLevel;
    question_number: number;
  };
  "Test Left": TestEventContext & { question_number: number };
  "Test Finished": TestEventContext & {
    answered: number;
    duration_ms: number;
    end: TestEnd;
    lessons_skipped: number;
    levels_skipped: number;
    parts_left: number;
    unknowns: number;
  };
  "Test Continued": TestEventContext & {
    from_part: number;
    reason: "next_part" | "whole_course" | "more_focus";
  };
  "Test Result Undone": TestEventContext & { change_id: string; lessons_restored: number };
  "Test Lesson Started": TestEventContext & { lesson_id: string };
};
