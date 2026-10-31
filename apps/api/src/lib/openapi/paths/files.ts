import { z } from "zod";
import { ownFilePathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const filePaths = {
  "/files/{folder}/{ownerId}/{name}": {
    get: {
      description:
        "One of the signed-in learner's own private files: a picture on one of their private lessons' screens (its image URL points here) or an upload. Another learner's file answers 404. Responses are `Cache-Control: private, no-cache` with an `ETag`: send it back as `If-None-Match` to get a 304 while the file is unchanged.",
      operationId: "getOwnFile",
      requestParams: {
        header: z.object({
          "if-none-match": z
            .string()
            .optional()
            .meta({ description: "The ETag of the copy you have" }),
        }),
        path: ownFilePathParamsSchema,
      },
      responses: {
        "200": {
          content: { "*/*": { schema: z.file() } },
          description: "The file, with its stored content type",
        },
        "304": { description: "Your copy is current" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get one of your private files",
      tags: ["Files"],
    },
  },
};
