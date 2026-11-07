import {
  certificateListResponseSchema,
  certificateSchema,
  goalCertificatesResponseSchema,
} from "../schemas/certificates";
import { certificatePathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY, PUBLIC_SECURITY } from "../security";

const TAGS = ["Certificates"];

export const certificatePaths = {
  "/certificates/{code}": {
    get: {
      description:
        "What a certificate's public link shows anyone, signed in or not: the learner's profile name, what they completed and when, and the pictures to show or share. Nothing else about the learner. Not for indexing.",
      operationId: "getCertificate",
      requestParams: { path: certificatePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: certificateSchema } },
          description: "The certificate",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Get a certificate",
      tags: TAGS,
    },
  },
  "/goals/{goalId}/certificates": {
    post: {
      description:
        "Writes the goal's finished level and plan certificates the learner doesn't hold yet, and returns all of them. A learn, exam or language goal on a Library course earns one per course level its plan holds whole (every chapter the level had when the plan began), once every lesson of it is studied or tested out, at least half of them studied, and the challenges of its phases are won (a free learner's Plus-only calls excepted); an exam's mocks don't count. The plan earns one of its own once it's all finished so, with studied lessons no certified level covers: a plan without levels, a partial level, other courses' lessons. Use it while the goal map lists `certificates.unclaimed`. Show the award moment of each returned certificate whose `shownAt` is null, then read the map again.",
      operationId: "claimCourseCertificate",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: goalCertificatesResponseSchema } },
          description: "The goal's certificates",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description:
            "`COURSE_NOT_FINISHED`: no level or plan of the goal is finished, or the goal is one that earns no course certificate (explain goals)",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Claim a goal's course certificates",
      tags: TAGS,
    },
  },
  "/me/certificates": {
    get: {
      description:
        "The learner's certificates, latest finished first: finished course levels and plans, locked ones included. Reading them never marks one shown.",
      operationId: "listCertificates",
      responses: {
        "200": {
          content: { "application/json": { schema: certificateListResponseSchema } },
          description: "The learner's certificates",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the current learner's certificates",
      tags: TAGS,
    },
  },
  "/me/certificates/{code}/views": {
    post: {
      description:
        "Records that a certificate's award moment was closed, so completion results stop returning it. Showing it again keeps the first time.",
      operationId: "markCertificateShown",
      requestParams: { path: certificatePathParamsSchema },
      responses: {
        "204": { description: "Marked as shown" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Mark a certificate as shown",
      tags: TAGS,
    },
  },
};
