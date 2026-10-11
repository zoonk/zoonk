import { studyBlockCompletionSchema } from "@zoonk/core/sessions/completion-contract";
import {
  studyAnswerInputSchema,
  studyBlockStartInputSchema,
  studySessionTimeZoneInputSchema,
} from "@zoonk/core/sessions/contract";
import { studySessionErrorCodes } from "../../study-session-errors";
import {
  goalPathParamsSchema,
  studyBlockPathParamsSchema,
  studySessionPathParamsSchema,
} from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  jsonResponse,
  notFoundResponse,
  paymentRequiredResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { studySessionSummaryResponseSchema } from "../schemas/study-session-results";
import {
  startedStudyBlockResponseSchema,
  studyAnswerFeedbackResponseSchema,
  studyBlockDetailResponseSchema,
  studyBlockSchema,
  studySessionResponseSchema,
} from "../schemas/study-sessions";
import { weeklyChallengeResponseSchema } from "../schemas/weekly-challenge";
import { AUTHENTICATED_SECURITY } from "../security";

const TAGS = ["Study sessions"];

const readErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

const timeZoneBody = {
  content: { "application/json": { schema: studySessionTimeZoneInputSchema } },
  required: true,
} as const;

const sessionSummaryResponse = jsonResponse(
  studySessionSummaryResponseSchema,
  "What changed in the session",
);

export const studySessionPaths = {
  "/goals/{goalId}/weekly-challenge": {
    get: {
      description:
        "The goal's next weekly checkpoint, the Big Challenge: its date, what it asks (an exam's mock conditions, or ten mixed questions on the week's skills), its Brain Power and the checklist to rehearse exam day. An exam's mock needs Plus: `access` says so instead of hiding it.",
      operationId: "getWeeklyChallenge",
      requestParams: { path: goalPathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: {
        "200": jsonResponse(weeklyChallengeResponseSchema, "The next weekly checkpoint"),
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's weekly challenge",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}": {
    get: {
      description: "One of the learner's study sessions with its blocks, missions and progress.",
      operationId: "getStudySession",
      requestParams: { path: studySessionPathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: { "200": jsonResponse(studySessionResponseSchema, "The session"), ...readErrors },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a study session",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/blocks/{blockId}": {
    get: {
      description:
        "A question block's questions without their answers: capsules with the learner's last answer (the time machine), mistake drills, practice and checkpoint questions, and which were answered already. Checkpoints have no hints.",
      operationId: "getStudyBlock",
      requestParams: { path: studyBlockPathParamsSchema },
      responses: {
        "200": jsonResponse(studyBlockDetailResponseSchema, "The block and its questions"),
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a study block",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/blocks/{blockId}/answers": {
    post: {
      description: `Grades one answer and records it as learning (memory, mistakes notebook, fixes). A checkpoint says right or wrong without the answer until it ends.`,
      operationId: "createStudyAnswer",
      requestBody: {
        content: { "application/json": { schema: studyAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: studyBlockPathParamsSchema },
      responses: {
        "200": jsonResponse(
          studyAnswerFeedbackResponseSchema,
          "Feedback, Hyperdrive and a pause suggestion",
        ),
        ...readErrors,
        "409": {
          ...conflictResponse,
          description: `Already answered or block not started. Error codes: ${studySessionErrorCodes.alreadyAnswered}, ${studySessionErrorCodes.blockNotActive}.`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `The question isn't in the block. Error code: ${studySessionErrorCodes.invalidItem}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a study question",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/blocks/{blockId}/completions": {
    post: {
      description:
        "Finishes a block and returns its completion moment: Brain Power (with the bonus for all three missions when it just paid), the session bar, missions, a checkpoint's result with each right answer and why, when a lesson comes back, and milestones earned. Learn blocks finish once their lesson was finished in the lesson player.",
      operationId: "createStudyBlockCompletion",
      requestBody: timeZoneBody,
      requestParams: { path: studyBlockPathParamsSchema },
      responses: {
        "200": jsonResponse(studyBlockCompletionSchema, "The block's completion moment"),
        ...readErrors,
        "409": {
          ...conflictResponse,
          description: `Already finished, or the lesson isn't finished yet. Error codes: ${studySessionErrorCodes.blockFinished}, ${studySessionErrorCodes.lessonNotFinished}.`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `Nothing answered yet, or a checkpoint with unanswered questions. Error codes: ${studySessionErrorCodes.noAnswers}, ${studySessionErrorCodes.unanswered}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Finish a study block",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/blocks/{blockId}/starts": {
    post: {
      description:
        "Starts or resumes a block. The session's first start records where the learner stands, so its end can say what changed. The daily time limit is checked before anything new starts.",
      operationId: "createStudyBlockStart",
      requestBody: {
        content: { "application/json": { schema: studyBlockStartInputSchema } },
        required: true,
      },
      requestParams: { path: studyBlockPathParamsSchema },
      responses: {
        "200": jsonResponse(startedStudyBlockResponseSchema, "The started block"),
        ...readErrors,
        "403": {
          ...forbiddenResponse,
          description: `Today's time limit is reached. Error code: ${studySessionErrorCodes.dailyLimitReached}.`,
        },
        "409": {
          ...conflictResponse,
          description: `The block is finished (error code ${studySessionErrorCodes.blockFinished}), or it's a challenge whose questions aren't written yet (error code ${studySessionErrorCodes.questionsNeeded}: POST /challenges/{planItemId}/generations, follow the run until it ends, then start it again with \`afterWriting\`).`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a study block",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/catch-up-blocks": {
    post: {
      description:
        "\"Catch up today\": the lessons earlier days left that the day's normal time didn't fit (`catchUp.later` on the session) join the end of today's session, in plan order, so the learner is back on pace once they're done. Without it they come first on the next days. A finished day opens again. Only while the day offers it (`catchUp.later.offered`); past a free exam plan's first week its new lessons come with Plus, these too.",
      operationId: "createStudyCatchUpBlocks",
      requestBody: timeZoneBody,
      requestParams: { path: studySessionPathParamsSchema },
      responses: {
        "200": jsonResponse(studySessionResponseSchema, "The session with the lessons added"),
        ...readErrors,
        "402": {
          ...paymentRequiredResponse,
          description: `A free exam plan past its first week: its new lessons come with Plus (\`examAccess.trialEnded\`). Error code: ${studySessionErrorCodes.plusRequired}.`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `Nothing to add to today: no lessons left to catch up on, or the day doesn't offer them (\`catchUp.later.offered\` is false or \`catchUp\` is null). Error code: ${studySessionErrorCodes.nothingToCatchUp}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Catch up today",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/extra-blocks": {
    post: {
      description:
        '"10 more minutes": one bonus block of mixed practice (or the next lesson) after the day\'s session, at most twice a day and never past the daily time limit. Its Brain Power is capped. A free exam plan past its first week has none (`plusRequired`): its practice and new lessons come with Plus.',
      operationId: "createStudyExtraBlock",
      requestParams: { path: studySessionPathParamsSchema },
      responses: {
        "201": jsonResponse(studyBlockSchema, "The bonus block"),
        ...readErrors,
        "409": {
          ...conflictResponse,
          description: `Not available now; details.reason says why. Error code: ${studySessionErrorCodes.extraTimeUnavailable}.`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `Nothing more to practice today. Error code: ${studySessionErrorCodes.nothingToPractice}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Add ten more minutes",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/stops": {
    post: {
      description:
        '"Stop for today": what was done counts (a partial day is a day studied) and the summary of what changed so far comes back. Nothing is skipped: the rest of the session stays as it is, so it can be picked up later the same day (`finished` is false until every block is done).',
      operationId: "createStudySessionStop",
      requestBody: timeZoneBody,
      requestParams: { path: studySessionPathParamsSchema },
      responses: { "200": sessionSummaryResponse, ...readErrors },
      security: AUTHENTICATED_SECURITY,
      summary: "Stop for today",
      tags: TAGS,
    },
  },
  "/study-sessions/{sessionId}/summary": {
    get: {
      description:
        "What changed in the session: time, questions and accuracy, the best streak, Brain Power, the best Hyperdrive, Energy, belt stripes, preparation, skills that moved and new cards, mistakes saved, when things come back, capsules sealed, what the buddy ate, tomorrow's lesson and at most one ceremony. A completed session's summary stays as the session ended, whatever is played later.",
      operationId: "getStudySessionSummary",
      requestParams: { path: studySessionPathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: { "200": sessionSummaryResponse, ...readErrors },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a study session's summary",
      tags: TAGS,
    },
  },
};
