import { codeRunInputSchema } from "@zoonk/core/library/activities/sandbox-contract";
import { z } from "zod";
import {
  conflictResponse,
  guestRefusalResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const codeRunPaths = {
  "/code-runs": {
    post: {
      description:
        "Runs one source file in a sandbox for the authenticated learner or guest. Source is limited to 64 KiB in UTF-8. One run can be active per learner across all languages. Repeating a request ID returns its completed result without another charge.",
      operationId: "runCode",
      requestBody: {
        content: { "application/json": { schema: codeRunInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "text/event-stream": { schema: z.string() } },
          description:
            "Zero or more `phase` events with JSON `{ phase }` (`starting`, `compiling` or `running`), then one `result` event with JSON `{ runId, stop, output, errorOutput, error }`. Stops are `done`, `error`, `timeout`, `tooMuchOutput` or `unavailable`. The error is null or `{ line, message }`; the line is one-based or null. The run ID identifies its measured stdout when checking the activity answer.",
        },
        "400": {
          ...validationErrorResponse,
          description:
            "The request is invalid (`VALIDATION_ERROR`), or the source is longer than the largest program that runs (`CODE_TOO_LONG`, with `details.maxBytes`, that limit in UTF-8 bytes)",
        },
        "401": unauthorizedResponse,
        "402": {
          ...paymentRequiredResponse,
          description:
            "A free learner reached today's AI budget (`USAGE_LIMIT_REACHED` with resource `aiSpend`)",
        },
        "403": guestRefusalResponse,
        "409": { ...conflictResponse, description: "A run is already active (`ALREADY_RUNNING`)" },
        "429": {
          ...tooManyRequestsResponse,
          description:
            "`SLOW_DOWN`: try again after `Retry-After`; or `USAGE_LIMIT_REACHED`, back tomorrow: the learner reached the day's run ceiling, the same for every account (resource `codeRun`), or a Plus learner reached today's AI budget (resource `aiSpend`)",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Run code",
      tags: ["Lessons"],
    },
  },
};
