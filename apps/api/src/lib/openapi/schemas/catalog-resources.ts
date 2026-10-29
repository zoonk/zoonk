import { courseExamDaysSchema } from "@zoonk/core/catalog/course-exam-days-contract";
import { coursePlanExampleSchema } from "@zoonk/core/catalog/course-plan-example-contract";
import { CourseFormat, CourseLevel } from "@zoonk/db";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { z } from "zod";

const generationStatusSchema = z.enum(["completed", "failed", "pending", "running"]);

const DEFAULT_RESOURCE_PAGE_SIZE = 20;

export const resourcePageQuerySchema = z
  .object({
    cursor: z.string().optional().meta({ description: "Pagination cursor" }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(DEFAULT_RESOURCE_PAGE_SIZE)
      .meta({ description: "Results per page" }),
  })
  .meta({ id: "ResourcePageQuery" });

export const catalogSearchQuerySchema = z
  .object({
    language: z
      .string()
      .min(2)
      .meta({ description: "Catalog language code", examples: ["en"] }),
    query: z.string().trim().min(1).meta({ description: "Search query" }),
  })
  .meta({ id: "CatalogSearchQuery" });

export const chapterCourseContextQuerySchema = z
  .object({
    courseId: z
      .uuid()
      .optional()
      .meta({
        description:
          "Course to read the chapter in, since a chapter can be placed in several courses. Defaults to the chapter's home course; a course that doesn't place the chapter is not found.",
      }),
  })
  .meta({ id: "ChapterCourseContextQuery" });

export const catalogLessonQuerySchema = z
  .object({
    courseId: z
      .uuid()
      .meta({
        description:
          "Course the lesson is read in; a lesson its outline doesn't hold, or a course that isn't published, is not found",
      }),
  })
  .meta({ id: "CatalogLessonQuery" });

export const organizationSummarySchema = z
  .object({
    id: z.uuid().meta({ description: "Organization ID" }),
    logo: z.string().nullable().meta({ description: "Organization logo URL" }),
    name: z.string().meta({ description: "Organization name" }),
    slug: z.string().meta({ description: "Organization slug" }),
  })
  .meta({ id: "OrganizationSummary" });

export const nullableOrganizationSummarySchema = organizationSummarySchema
  .nullable()
  .meta({
    description: "Null for a learner's private course, which has no organization or public page",
  });

const courseLandingPageSchema = z
  .object({
    audience: z.array(z.string()).meta({ description: "Who the course is for, one line each" }),
    outcomes: z
      .array(z.string())
      .meta({ description: "What the course makes someone able to do, first steps first" }),
    valueProposition: z.string().meta({ description: "The course's promise in one sentence" }),
  })
  .meta({ id: "CourseLandingPage" });

const firstQuestionSchema = z
  .object({
    context: z
      .string()
      .nullable()
      .meta({ description: "Plain text the question follows; null when it stands alone" }),
    guess: z
      .boolean()
      .meta({
        description:
          "A guess before the lesson teaches it, which doesn't count; otherwise a question the lesson checks",
      }),
    kind: z.literal("choice"),
    options: z
      .array(z.object({ id: z.string(), text: z.string() }))
      .meta({
        description:
          "Without which is right: the lesson checks the answer the learner opens it with",
      }),
    question: z
      .string()
      .meta({ description: "Rich text: the lesson Markdown subset and `$…$` math" }),
  })
  .meta({ id: "CatalogFirstQuestion" });

const catalogTryLessonSchema = z
  .object({
    chapterTitle: z.string(),
    lessonId: z.uuid(),
    minutes: z.int().nonnegative(),
    number: z.int().min(1).meta({ description: "The lesson's number in its chapter" }),
    screen: firstQuestionSchema,
  })
  .meta({
    description:
      "A lesson to try from the page: among the first lessons, one that opens with a guess, else with a question. Opening it with an option answers its first screen.",
    id: "CatalogTryLesson",
  });

export const courseResourceSchema = z
  .object({
    categories: z
      .array(z.enum(COURSE_CATEGORIES))
      .meta({ description: "Oldest first: the first is the course's subject, its pages' color" }),
    description: z.string().nullable(),
    editions: z
      .array(z.object({ id: z.uuid(), language: z.string(), title: z.string() }))
      .meta({
        description:
          "The course's published editions in every language, itself included; empty for a learner's private course",
      }),
    exam: courseExamDaysSchema
      .nullable()
      .meta({
        description:
          "Upcoming exam days, matching a default course start; null for non-exam, private or unknown exam courses. Estimated when the next edition's notice is not stored",
      }),
    examplePlan: coursePlanExampleSchema
      .nullable()
      .meta({
        description:
          "The course page's example plan, Monday to Friday from scratch: a quarter hour a day to the course's end, or half an hour a day to an exam course's next sitting; null for a learner's private course",
      }),
    format: z.enum(CourseFormat),
    generationId: z
      .string()
      .nullable()
      .meta({ description: "Run writing the course outline, followed through generations" }),
    generationStatus: generationStatusSchema.meta({
      description: "Whether every chapter of the course outline is written",
    }),
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    landingPage: courseLandingPageSchema
      .nullable()
      .meta({ description: "The course page's copy; null until the course's details are written" }),
    language: z.string(),
    languageFlag: z
      .string()
      .nullable()
      .meta({
        description:
          "A language course's flag: a country's two-letter code, or a region's (`es-ct`, `gb-wls`, `arab`), as flag-icons names them; null for other courses",
      }),
    organization: nullableOrganizationSummarySchema,
    slug: z.string(),
    targetLanguage: z.string().nullable(),
    title: z.string(),
    tryLesson: catalogTryLessonSchema
      .nullable()
      .meta({ description: "Null when none of the course's first lessons opens with a question" }),
  })
  .meta({ id: "CourseResource" });

const chapterFieldsSchema = z.object({
  courseId: z.uuid().meta({ description: "Course the chapter is read in" }),
  description: z.string(),
  generationId: z
    .string()
    .nullable()
    .meta({ description: "Run writing the chapter's lesson outline" }),
  generationStatus: generationStatusSchema.meta({
    description: "Whether the chapter's lesson titles and descriptions are written",
  }),
  id: z.uuid(),
  language: z.string(),
  level: z.enum(CourseLevel).meta({ description: "Level band the course places the chapter in" }),
  objectives: z.array(z.string()).meta({ description: "What the chapter teaches, one line each" }),
  position: z
    .number()
    .int()
    .min(0)
    .meta({ description: "0-based position across the whole course outline" }),
  slug: z.string(),
  title: z.string(),
});

export const chapterResourceSchema = chapterFieldsSchema
  .extend({
    tryLesson: catalogTryLessonSchema
      .nullable()
      .meta({ description: "Null when none of the chapter's first lessons opens with a question" }),
  })
  .meta({ id: "ChapterResource" });

const courseChapterSchema = chapterFieldsSchema
  .extend({
    lessonCount: z.number().int().min(0),
    lessons: z
      .array(
        z.object({
          estimatedMinutes: z.int().nonnegative(),
          id: z.uuid(),
          slug: z.string(),
          title: z.string(),
        }),
      )
      .meta({
        description: "The chapter's visible lessons in order, as its course's outline lists them",
      }),
  })
  .meta({ id: "CourseChapter" });

const lessonResourceSchema = z
  .object({
    chapterId: z.uuid(),
    courseId: z.uuid(),
    description: z.string().nullable(),
    estimatedMinutes: z.int().nonnegative().meta({ description: "How long the lesson takes" }),
    generationId: z.string().nullable().meta({ description: "Run writing the lesson's content" }),
    generationStatus: generationStatusSchema.meta({
      description: "Whether the lesson's content is written",
    }),
    id: z.uuid(),
    language: z.string(),
    position: z.number().int().min(0).meta({ description: "0-based position in the chapter" }),
    slug: z.string(),
    title: z.string().nullable(),
  })
  .meta({ id: "LessonResource" });

export const catalogSearchResponseSchema = z
  .object({
    chapters: z.array(
      z.object({
        courseId: z.uuid(),
        courseSlug: z.string(),
        courseTitle: z.string(),
        description: z.string(),
        id: z.uuid(),
        language: z.string(),
        organizationSlug: z.string(),
        slug: z.string(),
        title: z.string(),
      }),
    ),
    courses: z.array(
      z.object({
        description: z.string().nullable(),
        id: z.uuid(),
        imageUrl: z.string().nullable(),
        language: z.string(),
        organizationSlug: z.string(),
        slug: z.string(),
        targetLanguage: z
          .string()
          .nullable()
          .meta({ description: "The language a language course teaches; null for other courses" }),
        title: z.string(),
      }),
    ),
  })
  .meta({ id: "CatalogSearchResponse" });

export const courseChapterListResponseSchema = z
  .object({ data: z.array(courseChapterSchema) })
  .meta({ id: "CourseChapterListResponse" });

export const chapterLessonListResponseSchema = z
  .object({ data: z.array(lessonResourceSchema) })
  .meta({ id: "ChapterLessonListResponse" });

export const catalogLessonSchema = z
  .object({
    description: z.string(),
    estimatedMinutes: z.int().nonnegative(),
    firstScreen: z
      .discriminatedUnion("kind", [
        firstQuestionSchema,
        z
          .object({ kind: z.literal("text"), text: z.string().meta({ description: "Plain text" }) })
          .meta({ id: "CatalogFirstText" }),
        z
          .object({ kind: z.literal("start") })
          .meta({
            description: "A first screen with nothing to show before the lesson",
            id: "CatalogFirstStart",
          }),
      ])
      .nullable()
      .meta({ description: "What the lesson opens with; null until its content is written" }),
    id: z.uuid(),
    language: z.string(),
    summaryIdeas: z
      .array(z.string())
      .meta({
        description: "What the lesson teaches, each idea in one sentence; empty until it's written",
      }),
    title: z.string(),
  })
  .meta({ id: "CatalogLesson" });
