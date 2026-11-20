import { z } from "zod";
import { DAYS_PER_WEEK } from "./planner/plan-state";

const isoDateSchema = z.iso.date();

const weekdaySchema = z
  .int()
  .min(0)
  .max(DAYS_PER_WEEK - 1);

const areaTopicsSchema = z
  .object({
    area: z.string().meta({ description: "The plan's area, as plan changes name it" }),
    topics: z.array(z.string()).meta({ description: "In the notice's own words" }),
  })
  .meta({ id: "PlanEffectTopics" });

export const planEffectSchema = z
  .object({
    addedTopicsBeforeBasics: z
      .literal(true)
      .optional()
      .meta({
        description:
          "For topics the learner adds: they come before lessons of the plan's first phase (its basics), as asking to start them now does",
      }),
    addedTopicsStart: isoDateSchema
      .optional()
      .meta({
        description:
          "For topics the learner adds (SQL for an interview, a portfolio project): the day the first of their lessons is due with the change",
      }),
    areaEnds: z
      .array(
        z.object({
          after: isoDateSchema.meta({ description: "The day its last lesson is due after it" }),
          area: z.string(),
          before: isoDateSchema.meta({ description: "The day it's due now, as the learner sees" }),
          lessonsGained: z
            .int()
            .optional()
            .meta({
              description:
                "The lessons still to do it gains with the change, negative when it has fewer; absent when they move by rounding only",
            }),
        }),
      )
      .optional()
      .meta({
        description:
          "For more or less time on some areas (a focus, or less of an area): when each one whose end moves has its last lesson after the change and before it. With every lesson in the plan, more of an area brings its end forward and less of one pushes it back; short on time, more of an area brings more of its lessons in, which can end it later (`lessonsGained` is how many)",
      }),
    areaLessons: z
      .array(
        z.object({
          after: z.int().meta({ description: "Its lessons still to do after the change" }),
          area: z.string(),
          before: z.int().meta({ description: "Its lessons still to do now, as the learner sees" }),
        }),
      )
      .optional()
      .meta({
        description:
          "For more or less time on some areas: each area the change doesn't name whose lessons still to do move by more than two, with how many before and after",
      }),
    areaStarts: z
      .array(
        z.object({
          after: isoDateSchema.nullable(),
          area: z.string(),
          before: isoDateSchema.nullable(),
        }),
      )
      .optional()
      .meta({
        description:
          "For a focus: when each focused area's first lesson is due after the change and before it. It may stay after what the area builds on",
      }),
    endDateAfter: isoDateSchema
      .nullable()
      .meta({ description: "When the plan ends after the change" }),
    endDateBefore: isoDateSchema.nullable().meta({ description: "When it ended before" }),
    fromPlacement: z
      .literal(true)
      .optional()
      .meta({
        description:
          "For coverageChanged: the learner's placement answers (what they missed, or showed they know) planned it again as placement ended",
      }),
    lessonsAdded: z.int().min(0),
    lessonsAddedEstimated: z
      .literal(true)
      .optional()
      .meta({
        description:
          "Some of the lessons added aren't written yet: lessonsAdded counts the plan's estimate for their topic, and the written lessons can be more or fewer",
      }),
    lessonsLeftOut: z
      .array(z.string())
      .optional()
      .meta({
        description:
          "The lessons the change leaves out of the plan the learner sees, whole, by title in the plan's order. A topic's lessons not written yet count as one entry, its name",
      }),
    lessonsRemoved: z.int().min(0),
    listeningPastBasics: z
      .array(z.string())
      .optional()
      .meta({
        description:
          "For testedOut, or coverageChanged with fromPlacement: the exam's listening areas the learner's answers to text questions started past their basics, whose basics leave the plan because those answers show the learner knows them; practice with recordings checks them later",
      }),
    nextMock: z
      .object({
        after: isoDateSchema.meta({ description: "The day the next mock is on after the change" }),
        before: isoDateSchema.meta({ description: "The day it's on now, as the learner sees" }),
      })
      .optional()
      .meta({
        description:
          "For an exam's plan: the day the next mock moves ahead to, and the day it was on",
      }),
    outcomesAdded: z
      .array(z.string())
      .optional()
      .meta({
        description:
          "For moving the phase dates (fitPhaseDates): the goal's outcome skills (a career's job search) keeping the dates leaves out by the goal's date and moving them fits in, by name",
      }),
    phaseEnds: z
      .array(
        z.object({
          after: isoDateSchema.meta({ description: "The day the phase ends after the change" }),
          before: isoDateSchema.meta({ description: "The day it ends now, as the learner saw" }),
          lessonsFirst: z
            .literal(true)
            .optional()
            .meta({
              description:
                "Lessons its challenge tests are taking longer than planned and would come after the challenge on the day it ends now: moving the dates puts the challenge after them",
            }),
          name: z.string().meta({ description: "The phase's name, as the plan shows it" }),
          restDay: z
            .literal(true)
            .optional()
            .meta({
              description:
                "The day it ends now is one the learner rests: its challenge stays there until they move the dates",
            }),
        }),
      )
      .optional()
      .meta({
        description:
          "For moving the phase dates (fitPhaseDates): each phase that would end on another day. With lessonsAdded, the lessons keeping the dates leaves out by the goal's date and moving them fits in. For missed days (kind missedDays): each phase whose end the settling moved, so its challenge comes after the lessons it tests",
      }),
    reviewFirst: z
      .object({
        areas: z
          .array(z.string())
          .meta({ description: "The focused areas, or the parts of them the focus names" }),
        date: isoDateSchema.meta({ description: "The review day the focused topics open" }),
      })
      .optional()
      .meta({
        description:
          "For a focus: the next review day ahead (a class test's day before, a free plan's full review) asks the focused topics first",
      }),
    topicsAdded: z
      .array(areaTopicsSchema)
      .optional()
      .meta({ description: "The exam's notice topics the change brings into the plan, by area" }),
    topicsLeftOut: z
      .array(areaTopicsSchema)
      .optional()
      .meta({ description: "The exam's notice topics the change leaves out of the plan, by area" }),
    unwrittenLeftOut: z
      .array(
        z.object({
          lessons: z.int().min(1).meta({ description: "About how many lessons it leaves out" }),
          skill: z.string().meta({ description: "The topic's name" }),
        }),
      )
      .optional()
      .meta({
        description:
          "Lessons not written yet that the change leaves out of topics it keeps, by topic, about how many: with lessonsLeftOut, every lesson it leaves out",
      }),
    weeklyEvents: z
      .object({
        after: weekdaySchema.meta({
          description: "The weekday they move to, from Sunday (0) to Saturday (6)",
        }),
        before: weekdaySchema.meta({ description: "The weekday they were on" }),
        kind: z
          .enum(["challenge", "mock"])
          .meta({
            description: "`mock`: an exam's weekly mocks; `challenge`: the weekly challenges",
          }),
      })
      .optional()
      .meta({
        description:
          "The week's mocks or challenges move to another weekday, as a change to the learner's days moves them off a rest day",
      }),
  })
  .meta({ id: "PlanEffect" });
