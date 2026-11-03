import {
  certificateListResponseSchema,
  certificateSchema,
  ownedCertificateSchema,
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
        "Awards the goal's course certificate, or returns it when it exists. Learn and exam goals earn one when every lesson of the plan is studied or tested out, at least one of them studied, and every phase challenge is won; an exam's mocks don't count. Use it where the goal map says `certificate.code` is null. Show its award moment while `shownAt` is null.",
      operationId: "claimCourseCertificate",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: ownedCertificateSchema } },
          description: "The certificate",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description:
            "`COURSE_NOT_FINISHED`: the course isn't finished yet, or the goal is one that earns no course certificate (language and explain goals)",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Claim a goal's course certificate",
      tags: TAGS,
    },
  },
  "/me/certificates": {
    get: {
      description:
        "The learner's certificates, newest first: finished courses, finished language levels and placement results. Reading them never marks one shown.",
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
