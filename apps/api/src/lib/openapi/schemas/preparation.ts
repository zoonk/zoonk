import { EXAM_SCALES } from "@zoonk/core/exams/scales";
import { skillStateCountsSchema } from "@zoonk/core/learner/contract";
import { z } from "zod";

const shareSchema = z.number().min(0).max(1);

/** The SAT's 1,600 tops every scale estimates use. */
const MAX_ESTIMATE = 1600;

export const estimatedScoreSchema = z
  .object({
    calibrated: z
      .boolean()
      .meta({ description: "Adjusted by official results other learners reported" }),
    high: z.number().min(0).max(MAX_ESTIMATE),
    low: z.number().min(0).max(MAX_ESTIMATE),
    mocks: z.number().int().min(1),
    scale: z
      .enum(["irt", "percent", ...EXAM_SCALES])
      .meta({
        description:
          "percent correct, the exam's item response theory scale (ENEM), or the exam's own scale: ap 1 to 5, sat 400 to 1600, toefl bands 1 to 6 in half bands",
      }),
  })
  .meta({ id: "EstimatedScore" });

export const planStatusSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("onTrack") }),
    z.object({ days: z.number().int().min(1), kind: z.literal("ahead") }),
    z.object({
      days: z
        .number()
        .int()
        .min(0)
        .meta({ description: "Days of extra time that catch up; 0 when lessons says it instead" }),
      extraMinutesPerDay: z.number().int().min(0),
      kind: z.literal("behind"),
      lessons: z
        .number()
        .int()
        .min(1)
        .nullable()
        .meta({
          description:
            "Lessons earlier days left that the learner hasn't caught up on: they come first in the plan, and the learner is behind until they're done. Say this count instead of days when present",
        }),
    }),
    z
      .object({
        challenges: z
          .number()
          .int()
          .min(1)
          .meta({ description: "The phases' challenges left to win" }),
        kind: z.literal("challengesLeft"),
      })
      .meta({
        description:
          "Every lesson of the plan is studied or tested out (its progress reads 100%) and only required phase challenges are left: the plan isn't finished until they're won. Free language call challenges remain pending and locked but don't block finishing. Non-exam reviews are practice and don't block this status, whatever the date. Exams still wait for their mocks and reviews. Never say it finished while required challenges remain; say how many are left",
      }),
    z
      .object({ kind: z.literal("finished") })
      .meta({
        description:
          "Every lesson of the plan is studied or tested out and every required phase challenge won. Free language call challenges can remain pending and locked, with no won result. Non-exam reviews remain practice after finishing and never delay this status. An exam also waits for its mocks and reviews still ahead",
      }),
    z.object({
      kind: z.literal("needsAdjusting"),
      options: z.array(z.enum(["addTime", "narrowScope", "moveDate"])),
    }),
    z
      .object({
        kind: z.literal("pastDate"),
        lessons: z
          .number()
          .int()
          .min(1)
          .meta({ description: "The lessons left, to do or set aside when the date came" }),
      })
      .meta({
        description:
          "The plan's date came with lessons left. The plan doesn't end: never say it ended or finished. Offer the change that keeps it going, previewed when the learner asks (POST /v1/goals/{goalId}/plan/change-previews): a goal's date moves to the day its time covers what's left by (`fittingDate` from POST /v1/goals/{goalId}/plan/time-to-cover, sent as `setTargetDate`); an exam's plan goes on after it (`setFullCourse`)",
      }),
  ])
  .meta({ id: "PlanStatus" });

const componentsSchema = z
  .object({
    coverage: z.object({
      heaviest: z
        .object({
          studiedSkills: z.number().int().min(0),
          totalSkills: z.number().int().min(0),
          value: shareSchema,
        })
        .meta({
          description:
            "The goal's globally heavier part (its hardest and most asked skills) and the share of it studied. Solid eligibility uses this goal-level coverage with the goal's quality evidence; it caps `stage`, never the weighted `value`",
        }),
      studiedSkills: z.number().int().min(0),
      totalSkills: z.number().int().min(0),
      value: shareSchema.meta({
        description:
          "Share of the goal studied, each skill counting by the exam's weight on it and how hard it is",
      }),
    }),
    mastery: z
      .object({
        answered: z.number().int().min(0),
        correct: z.number().int().min(0),
        evidence: z
          .number()
          .min(0)
          .meta({ description: "How many answers the weighted ones are worth as evidence" }),
        supported: shareSchema
          .nullable()
          .meta({
            description:
              "The share right the answers support (Wilson's lower bound), the value to show for this part. Preparation counts each section's own, from its answers",
          }),
        value: shareSchema
          .nullable()
          .meta({
            description:
              "Accuracy on questions never seen before, each answer counting by its skill's importance. Null until a section has the few answers mastery needs: show that it comes after a few practice questions",
          }),
      })
      .meta({
        description:
          "Read from the answers in positively weighted sections (`sections`) with enough of them to count mastery: a few answers spread over many subjects count in none yet, and zero-weight sections do not contribute",
      }),
    mocks: z
      .object({
        kind: z
          .enum(["fullReviews", "mockExams", "weeklyChallenges"])
          .meta({
            description:
              "fullReviews: an exam goal whose plan has no mock exams (free) counts its full reviews in the exam's format (study blocks with `fullReview`), which its plan gives it on the mock's day",
          }),
        plusRequired: z
          .boolean()
          .meta({
            description:
              "The test needs Plus now: the plan has no mocks and its free days are over. Show the mock with the Plus mark",
          }),
        taken: z.number().int().min(0),
        value: shareSchema.nullable().meta({ description: "Recent results" }),
      })
      .meta({
        description:
          "The fourth part: an exam goal's mock exams (or its full reviews when its plan has no mocks), or another goal's weekly challenges (it has no exam to rehearse). Preparation stays under 75% until one is taken, never for a test the learner's plan can't take",
      }),
    retention: z.object({
      studiedSkills: z.number().int().min(0),
      value: shareSchema
        .nullable()
        .meta({ description: "How much of what was studied is still remembered" }),
    }),
  })
  .meta({ id: "PreparationComponents" });

export const goalPreparationResponseSchema = z
  .object({
    areas: z.array(
      z.object({
        areaId: z.string(),
        needsPractice: z.boolean(),
        preparation: shareSchema,
        skills: skillStateCountsSchema,
        title: z.string(),
        weekGain: z.number().min(-1).max(1),
      }),
    ),
    components: componentsSchema,
    estimatedScore: estimatedScoreSchema
      .nullable()
      .meta({
        description:
          "Only for an exam goal once its last three mock exams hold at least 30 questions and not one subject alone, always a range labeled Estimated. Null before that: after a mock (components.mocks.taken > 0), say that more mocks of the whole exam or half of it bring the estimate",
      }),
    goalId: z.uuid(),
    sections: z
      .array(
        z.object({
          mastery: z
            .object({ answered: z.number().int().min(0), correct: z.number().int().min(0) })
            .nullable()
            .meta({
              description:
                "Its first answers to questions never seen before, once it has the few its preparation needs to count mastery; null before",
            }),
          preparation: shareSchema,
          section: z
            .string()
            .meta({ description: "As a syllabus subject's `areas` name it, such as Matemática" }),
          weight: shareSchema.meta({
            description:
              "Its normalized share of the exam score when exam shares are available, otherwise its share of the goal's skill importance. Sections outside an available exam share map count as zero; set-aside sections are excluded before normalization",
          }),
        }),
      )
      .meta({
        description:
          "Preparation in each section of the goal's skill graph, by the goal's rule on its own skills and answers with the goal's tests, which span every section: weighted by `weight`, they are `value`. Subjects the learner removed are excluded, including skills from finished lessons. Subjects left out for time, past basics or skipped bases still count. Without exam shares, skills without a section count as one more part. A syllabus subject's `preparation` is its sections' (`GET /v1/goals/{goalId}/syllabus`)",
      }),
    skills: skillStateCountsSchema,
    stage: z
      .enum(["starting", "building", "growing", "solid"])
      .meta({
        description:
          "The value's stage, capped at growing until the goal's globally heaviest skills have the evidence Solid needs (`components.coverage.heaviest` with the goal's quality evidence). It can stay growing at a value of 0.75 or more; use this stage rather than inferring Solid from the number",
      }),
    status: planStatusSchema.nullable().meta({ description: "Null while nothing is scheduled" }),
    value: shareSchema.meta({
      description:
        "Preparation: coverage times how well the studied part is known, in each section (`sections`), weighted by its normalized exam share when available, otherwise its skill importance. It sits within its contributing subjects, or is zero when none contributes. An exam goal's one number; other goals read their progress in lessons (the syllabus's `lessons`)",
    }),
    weakestAreaId: z.string().nullable(),
    weekGain: z
      .number()
      .min(-1)
      .max(1)
      .meta({
        description:
          "Preparation gained since the start of the learner's week (Monday, in their time zone)",
      }),
  })
  .meta({ id: "GoalPreparation" });
