import { internalErrorResponse, validationErrorResponse } from "../schemas/responses";
import {
  usernameAvailabilityPathSchema,
  usernameAvailabilityResponseSchema,
} from "../schemas/usernames";
import { PUBLIC_SECURITY } from "../security";

export const usernamePaths = {
  "/usernames/{username}/availability": {
    get: {
      description:
        "Availability is advisory. A later profile update can still conflict if another account claims the username first.",
      operationId: "getUsernameAvailability",
      requestParams: { path: usernameAvailabilityPathSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: usernameAvailabilityResponseSchema } },
          description: "Current username availability",
        },
        "400": validationErrorResponse,
        "500": internalErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Get username availability",
      tags: ["Users"],
    },
  },
};
