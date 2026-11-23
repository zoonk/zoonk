import { z } from "zod";
import { noSittingSchema, noticeDaySchema } from "./notice-dates";
import { planMockScheduleSchema } from "./plan-mock-schedule";
import { planWeekShapeSchema } from "./plan-week-shape";

const isoDateSchema = z.iso.date();

export const dailyTimesSchema = z
  .array(z.int().positive())
  .meta({
    description:
      "The daily times a learner can pick, in order, from the shortest a plan accepts to 8 hours, the longest a learner can set. The goal's own time (`schedule.dailyMinutes`) can fall between them, or above them for a time saved before that limit",
  });

export const planScheduleSchema = z.object({
  dailyMinutes: z.int(),
  dailyTimes: dailyTimesSchema,
  fullCourse: z
    .boolean()
    .meta({
      description:
        "The exam plan studies everything: what doesn't fit before the exam goes on after it (`setFullCourse`); the exam keeps its date. False for other goals, which study everything without a date",
    }),
  lightWeeks: z.array(z.object({ endDate: isoDateSchema, startDate: isoDateSchema })),
  mocks: planMockScheduleSchema,
  nextSitting: isoDateSchema
    .nullable()
    .meta({
      description:
        "For a plan that goes on after its exam (`fullCourse`), whose mocks there are for the exam's next sitting: that sitting's first day, when the notice lists it; null otherwise",
    }),
  noSitting: noSittingSchema,
  noticeDay: noticeDaySchema,
  shape: planWeekShapeSchema,
  studyDays: z.int().min(0).max(7),
  targetDate: isoDateSchema.nullable(),
  targetDateEstimated: z
    .boolean()
    .meta({ description: "The date is the likely day of an exam whose notice isn't out yet" }),
  targetDateNamedMonth: z
    .boolean()
    .meta({
      description:
        "The date is the start of the month the learner named, and stands for that month, not that day",
    }),
  weekdayMinutes: z.array(z.int()).meta({ description: "Sunday first; 0 for rest days" }),
});
