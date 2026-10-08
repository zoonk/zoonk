import {
  goalUnderstandingInputSchema,
  onboardingAnswerInputSchema,
  onboardingDraftEditSchema,
} from "@zoonk/core/view-models/onboarding/contract";
import {
  onboardingDraftViewSchema,
  onboardingResumeSchema,
} from "@zoonk/core/view-models/onboarding/view-schemas";
import { z } from "zod";
import { explanationResponseSchema, onboardingResponseSchema } from "../schemas/onboarding";
import { goalPathParamsSchema, goalUnderstandingPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const location = z.object({
  Location: z
    .string()
    .meta({ description: "The typed goal's URL: GET /goal-understandings/{understandingId}" }),
});

const goalErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const onboardingPaths = {
  "/goal-understandings": {
    post: {
      description:
        "Saves a goal typed in the learner's own words as a draft and starts reading it: goals to plan, each with a draft for POST /goals holding every fact the words already give (an exam's dates for the year named, from its stored notice with the source or estimated), a quick question for an explanation, an instrument, or something unsafe or too vague. The same words in the same language on the same day are understood at once (201). Otherwise a run reads them (202): stream GET /generations/{generationId}/events for `readGoal`, `findExamDates`, then `understandingReady` (or `joinRunningUnderstanding` with the id of the run already reading it, whose events to follow instead), and read the draft again. Reading new words is one of the learner's small AI calls: a refusal is `SLOW_DOWN` (429) or `USAGE_LIMIT_REACHED` with `details.limit` (403 asks a guest to sign up, 402 a free learner to upgrade, 429 Plus to come back later). Guests can call it.",
      operationId: "createGoalUnderstanding",
      requestBody: {
        content: { "application/json": { schema: goalUnderstandingInputSchema } },
        required: true,
      },
      responses: {
        "201": {
          content: { "application/json": { schema: onboardingDraftViewSchema } },
          description: "Understood at once",
          headers: location,
        },
        "202": {
          content: { "application/json": { schema: onboardingDraftViewSchema } },
          description: "Saved; a run is reading it",
          headers: location,
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": {
          ...paymentRequiredResponse,
          description: "The free plan's small AI calls are used up for now",
        },
        "403": {
          ...forbiddenResponse,
          description: "A guest used today's small AI calls; signing up keeps going",
        },
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Understand a typed goal",
      tags: ["Onboarding"],
    },
  },
  "/goal-understandings/{understandingId}": {
    get: {
      description:
        "A typed goal as it stands: `understanding` while a run reads it (follow `generationId`), `understood` with the learner's fixes, or `failed` (start it again). `goalId` is the main goal created from it once confirmed. Only its learner can read it.",
      operationId: "getGoalUnderstanding",
      requestParams: { path: goalUnderstandingPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: onboardingDraftViewSchema } },
          description: "The typed goal",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal understanding",
      tags: ["Onboarding"],
    },
    patch: {
      description:
        "One fix on the \"Here's what I understood\" card, recomputing the fields that depend on it: a new exam year reads that year's dates (official or estimated) and drops a deadline set for the old year; the learner's own deadline replaces the exam's dates; a study time replaces the time the words gave. 409 while it's being read or once goals were created from it; 422 when the fix doesn't apply to that goal (not an exam, a day or year already past). Searching the web for a new exam year's day counts as small AI help; past the learner's cap it isn't searched and the day is to be confirmed. Fixing the words themselves is a new understanding.",
      operationId: "reviseGoalUnderstanding",
      requestBody: {
        content: { "application/json": { schema: onboardingDraftEditSchema } },
        required: true,
      },
      requestParams: { path: goalUnderstandingPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: onboardingDraftViewSchema } },
          description: "The card with the fix",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Fix a goal understanding",
      tags: ["Onboarding"],
    },
  },
  "/goal-understandings/{understandingId}/generations": {
    post: {
      description:
        "Starts reading a saved typed goal, or reads it again after its run failed or couldn't start. A run still reading it is followed instead (202 with its `generationId`), and a goal already understood needs none (200). Reading it again is one of the learner's small AI calls: a refusal is `SLOW_DOWN` (429) or `USAGE_LIMIT_REACHED` (403 for a guest, 402 for a free learner, 429 for Plus).",
      operationId: "createGoalUnderstandingGeneration",
      requestParams: { path: goalUnderstandingPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: onboardingDraftViewSchema } },
          description: "Already understood",
        },
        "202": {
          content: { "application/json": { schema: onboardingDraftViewSchema } },
          description: "A run is reading it",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": {
          ...paymentRequiredResponse,
          description: "The free plan's small AI calls are used up for now",
        },
        "403": {
          ...forbiddenResponse,
          description: "A guest used today's small AI calls; signing up keeps going",
        },
        "404": notFoundResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Read a goal understanding",
      tags: ["Onboarding"],
    },
  },
  "/goals/{goalId}/explanation": {
    get: {
      description:
        "A quick explanation for one of the learner's questions: the story screens and one check, the \"Now you know\" recap and \"Want to go further?\" into the subject's Overview course. `preparing` while it's being written; ask again until it's `ready`.",
      operationId: "getExplanation",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...goalErrors,
        "200": {
          content: { "application/json": { schema: explanationResponseSchema } },
          description: "The explanation",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a quick explanation",
      tags: ["Onboarding"],
    },
  },
  "/goals/{goalId}/onboarding": {
    get: {
      description:
        "The rest of onboarding for a new goal: only the questions the typed goal didn't answer, one per screen, then the age and buddy when needed, placement and the plan.",
      operationId: "getOnboarding",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...goalErrors,
        "200": {
          content: { "application/json": { schema: onboardingResponseSchema } },
          description: "The screens still ahead",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's onboarding",
      tags: ["Onboarding"],
    },
  },
  "/goals/{goalId}/onboarding/answers": {
    post: {
      description:
        "Saves one onboarding answer and returns the screens still ahead. Skippable questions take null and are never asked again. The schedule re-plans, splits the day's time between goals typed together and starts writing the lessons and outlines the first days now hold, as `POST /goals/{goalId}/lesson-preparations` does. Age and buddy go to the learner's profile; an age under 13 deletes the account (403 UNDER_MINIMUM_AGE), since Zoonk is for 13 and older.",
      operationId: "answerOnboardingQuestion",
      requestBody: {
        content: { "application/json": { schema: onboardingAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...goalErrors,
        "200": {
          content: { "application/json": { schema: onboardingResponseSchema } },
          description: "The screens still ahead",
        },
        "403": forbiddenResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer an onboarding question",
      tags: ["Onboarding"],
    },
  },
  "/me/onboarding-resume": {
    get: {
      description:
        "What a returning learner (guests included) should continue: a goal they typed but haven't confirmed (`draft`), their newest goal while its onboarding hasn't reached the plan (`goal`), or their day when they have an active goal (`today`). `resume` is null when there's nothing to continue.",
      operationId: "getOnboardingResume",
      responses: {
        "200": {
          content: { "application/json": { schema: onboardingResumeSchema } },
          description: "Where to continue",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get where to continue",
      tags: ["Onboarding"],
    },
  },
};
