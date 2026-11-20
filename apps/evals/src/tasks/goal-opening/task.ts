import { type Task } from "@/lib/types";
import {
  type GoalOpeningParams,
  generateGoalOpening,
} from "@zoonk/ai/tasks/curriculum/goal-opening";
import { TEST_CASES } from "./test-cases";

type GoalOpeningOutput = Awaited<ReturnType<typeof generateGoalOpening>>["data"];

export const goalOpeningTask: Task<GoalOpeningParams, GoalOpeningOutput> = {
  criteria: [
    {
      expectations:
        "The skill is where this learner's path starts: it builds on nothing the path teaches, starts at the goal's own subject, and fits their level and purpose. Notice an introduction, an overview of the field, its history or why it matters standing in for a real first skill, or a skill pitched too high or too low. Cost: the first lesson teaches nothing the learner came for, or loses them.",
      id: "firstSkill",
      label: "The first skill",
    },
    {
      expectations:
        "The course is the shared catalog subject that teaches the skill, with the title a catalog would use. Notice a title about this one learner, or a course that doesn't teach the skill. Cost: the lesson lands in the wrong course, and other learners can't find or reuse it.",
      id: "course",
      label: "The course",
    },
    {
      expectations:
        "The chapter teaches that skill at its level, its first lesson starts on a concrete idea of the subject, every lesson is one idea of 2 to 5 minutes, and no two lessons teach the same thing. Titles are the searchable names of their topics. Notice a vague first lesson, a lesson that packs several ideas, or two lessons that overlap. Cost: the learner's first minutes are slow, repeated or confusing.",
      id: "firstChapter",
      label: "The first chapter",
    },
  ],
  description:
    "Pick a learn goal's first skill, the course that teaches it and that skill's first chapter, so the first lesson is written before the plan",
  generate: generateGoalOpening,
  id: "goal-opening",
  name: "Goal opening",
  priorities: {
    comparison: {
      criteria: { course: "counts", firstChapter: "counts", firstSkill: "counts" },
      preference: "separates",
      trade: null,
    },
    distribution: "shared",
    first: "latency",
    reads: "A learner starts their first lesson from the opening it picks",
    reason:
      "Every call before the first lesson is one the learner waits on; shared when the goal's general form is",
    waits: "A learner waits in the request",
  },
  testCases: TEST_CASES,
};
