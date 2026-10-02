import { researchResultSchema } from "@/workflows/v2/research/research-result";
import {
  examEditionSchema,
  examStructureSchema,
  topicFrequencySchema,
} from "@zoonk/core/library/exams/blueprint-contract";
import { MAX_PASTED_TEXT_LENGTH, reusePolicySchema } from "@zoonk/core/library/sources/contract";
import {
  GoalKind,
  LearnerSourceOrigin,
  LibraryVisibility,
  ResearchUploadReason,
  SourceKind,
} from "@zoonk/db";
import { z } from "zod";
import { generationResourceSchema } from "./workflows";

const MAX_TITLE_LENGTH = 200;
const MAX_RESEARCH_UPLOADS = 5;
const MAX_LINK_LENGTH = 2000;

const languageSchema = z
  .string()
  .trim()
  .min(2)
  .max(10)
  .meta({
    description: "The learner's language code, used when a document doesn't state its own",
    examples: ["pt"],
  });

const reusePolicyResourceSchema = reusePolicySchema.meta({
  description:
    "Whether past exam questions from the source may be quoted, with the terms that say so",
  id: "SourceReusePolicy",
});

export const sourcePathParamsSchema = z
  .object({ sourceId: z.uuid().meta({ description: "Source ID" }) })
  .meta({ id: "SourcePathParams" });

export const examBlueprintPathParamsSchema = z
  .object({ blueprintId: z.uuid().meta({ description: "Exam blueprint ID" }) })
  .meta({ id: "ExamBlueprintPathParams" });

export const researchPathParamsSchema = z
  .object({ researchId: z.string().trim().min(1).meta({ description: "Research run ID" }) })
  .meta({ id: "ResearchPathParams" });

export const sourceResourceSchema = z
  .object({
    fetchedAt: z.iso.datetime(),
    id: z.uuid(),
    kind: z.enum(SourceKind),
    language: z.string(),
    mimeType: z.string().nullable(),
    publisher: z.string().nullable(),
    reusePolicy: reusePolicyResourceSchema.nullable(),
    title: z.string(),
    url: z
      .string()
      .nullable()
      .meta({ description: "Where the publisher offers it; null for private uploads" }),
    validUntil: z.iso.datetime().nullable().meta({ description: "When it's checked again" }),
    visibility: z
      .enum(LibraryVisibility)
      .meta({ description: "Public sources are shared; private uploads are only their owner's" }),
  })
  .meta({ id: "Source" });

export const uploadTokenRequestSchema = z
  .object({
    payload: z.object({
      clientPayload: z.string().nullable(),
      multipart: z.boolean(),
      pathname: z
        .string()
        .min(1)
        .meta({ description: "Must be inside `sources/{userId}/`, the learner's own folder" }),
    }),
    type: z.literal("blob.generate-presigned-url"),
  })
  .meta({
    description: "The body Vercel Blob's client `uploadPresigned()` sends to its `handleUploadUrl`",
    id: "UploadTokenRequest",
  });

export const uploadTokenResponseSchema = z
  .object({
    presignedUrlPayload: z
      .object({
        delegationToken: z.string(),
        params: z.record(z.string(), z.string()),
        signature: z.string(),
      })
      .meta({
        description:
          "Signs one `PUT` of this file to the private store: `uploadPresigned()` sends it, or send the file to Blob's API with these values as query parameters",
      }),
    type: z.literal("blob.generate-presigned-url"),
  })
  .meta({ id: "UploadToken" });

const uploadOptionsSchema = {
  goalId: z.uuid().nullish().meta({ description: "The goal the material is for" }),
  language: languageSchema,
  title: z.string().trim().max(MAX_TITLE_LENGTH).nullish(),
};

export const createUploadRequestSchema = z
  .discriminatedUnion("kind", [
    z.object({
      ...uploadOptionsSchema,
      kind: z.literal("file"),
      pathname: z.string().min(1).meta({ description: "The uploaded blob's pathname" }),
    }),
    z.object({
      ...uploadOptionsSchema,
      kind: z.literal("link"),
      url: z
        .url({ protocol: /^https?$/u })
        .max(MAX_LINK_LENGTH)
        .meta({ description: "A public web page or PDF the learner pasted, read once as text" }),
    }),
    z.object({
      ...uploadOptionsSchema,
      kind: z.literal("text"),
      text: z.string().trim().min(1).max(MAX_PASTED_TEXT_LENGTH),
    }),
  ])
  .meta({ id: "CreateUploadRequest" });

export const uploadResourceSchema = z
  .object({
    checkingVisibility: z
      .boolean()
      .meta({ description: "True while the app checks whether its publisher made it public" }),
    source: sourceResourceSchema,
  })
  .meta({ id: "Upload" });

export const learnerSourcesQuerySchema = z
  .object({ goalId: z.uuid().optional() })
  .meta({ id: "LearnerSourcesQuery" });

export const learnerSourcesResponseSchema = z
  .object({
    sources: z.array(
      z.object({
        addedAt: z.iso.datetime(),
        goalId: z.uuid().nullable(),
        origin: z.enum(LearnerSourceOrigin),
        source: sourceResourceSchema,
      }),
    ),
  })
  .meta({ id: "LearnerSources" });

export const changeNoticesQuerySchema = z
  .object({ goalId: z.uuid() })
  .meta({ id: "SourceChangeNoticesQuery" });

export const changeNoticesResponseSchema = z
  .object({
    notices: z.array(
      z.object({
        createdAt: z.iso.datetime(),
        examBlueprintId: z.uuid().nullable(),
        fields: z.array(z.string()),
        id: z.uuid(),
        message: z.string().meta({ description: "One line for Today, in the source's language" }),
        sourceId: z.uuid(),
      }),
    ),
  })
  .meta({ id: "SourceChangeNotices" });

export const examBlueprintResourceSchema = z
  .object({
    board: z.string().nullable(),
    country: z.string(),
    edition: examEditionSchema.meta({ id: "ExamEdition" }),
    examDate: z.iso.datetime().nullable(),
    id: z.uuid(),
    language: z.string(),
    name: z.string(),
    registrationEndsAt: z.iso.datetime().nullable(),
    role: z.string().nullable(),
    source: z
      .object({
        fetchedAt: z.iso.datetime(),
        id: z.uuid(),
        kind: z.enum(SourceKind),
        publisher: z.string().nullable(),
        reusePolicy: reusePolicyResourceSchema.nullable(),
        title: z.string(),
        url: z.string().nullable(),
      })
      .nullable()
      .meta({ description: "The notice the blueprint was read from" }),
    structure: examStructureSchema.meta({ id: "ExamStructure" }),
    topicFrequency: topicFrequencySchema.meta({ id: "ExamTopicFrequency" }),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    description:
      "An exam's canonical blueprint. Every fact cites the passage of the source it was read from.",
    id: "ExamBlueprint",
  });

export const createResearchRequestSchema = z
  .object({
    goalId: z.uuid(),
    sourceIds: z
      .array(z.uuid())
      .max(MAX_RESEARCH_UPLOADS)
      .optional()
      .meta({
        description: "Uploads to read instead of searching, such as the notice research asked for",
      }),
  })
  .meta({ id: "CreateResearchRequest" });

export const researchResourceSchema = z
  .object({
    id: z.string().min(1).meta({ description: "Research run ID" }),
    result: researchResultSchema.nullable().meta({ description: "Set once the run completed" }),
    status: generationResourceSchema.shape.status,
  })
  .meta({ id: "Research" });

export const goalUploadRequestResponseSchema = z
  .object({
    request: z
      .object({
        goalId: z.uuid(),
        goalKind: z.enum(GoalKind),
        language: z
          .string()
          .meta({ description: "The goal's language, to send with uploads as `language`" }),
        reason: z
          .enum(ResearchUploadReason)
          .meta({
            description:
              "`noOfficialSource`: research found no official notice or source. `unverified`: what it found didn't match what it read. `classMaterial`: a teacher's test that only the class's material describes",
          }),
      })
      .nullable()
      .meta({ description: "Null when research needs nothing from the learner" }),
  })
  .meta({ id: "GoalUploadRequest" });

export const freshnessCommandRequestSchema = z
  .object({
    command: z.enum(["checkNow", "stop"]),
    target: z.discriminatedUnion("kind", [
      z.object({ examBlueprintId: z.uuid(), kind: z.literal("exam") }),
      z.object({ kind: z.literal("source"), sourceId: z.uuid() }),
    ]),
  })
  .meta({ id: "FreshnessCommandRequest" });

export const freshnessCommandResponseSchema = z
  .object({
    status: z
      .enum(["started", "stopped"])
      .meta({
        description:
          "A check started, or no more checks until a learner's goal needs the exam or source again",
      }),
  })
  .meta({ id: "FreshnessCommand" });

const materialCitationSchema = z
  .object({
    page: z.int().min(1).nullable().meta({ description: "Null for material without pages" }),
    title: z.string(),
    unit: z.enum(["page", "section", "slide"]),
  })
  .meta({ id: "MaterialCitation" });

export const materialQuestionAnswerSchema = z
  .object({
    answer: z.string(),
    citations: z.array(materialCitationSchema),
    found: z
      .boolean()
      .meta({
        description: "False when the material doesn't cover the question; the answer says so",
      }),
  })
  .meta({ id: "MaterialQuestionAnswer" });
