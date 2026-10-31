import { skillOutlineSchema } from "@zoonk/core/lookahead/skill-outline-contract";
import { z } from "zod";
import { goalSkillPathParamsSchema } from "../schemas/paths";
import {
  guestRefusalResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { skillOutlineGenerationSchema } from "../schemas/skill-outlines";
import { AUTHENTICATED_SECURITY } from "../security";

const readErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const skillOutlinePaths = {
  "/goals/{goalId}/skills/{skillId}/outline": {
    get: {
      description:
        "A topic of the goal's plan as its lesson plan stands. The plan writes each topic's lessons ahead for the next two weeks; a topic further away shows what the plan knows (its lesson count and first day on the Journey and the syllabus) until its course is outlined. `ready` lists the chapters that teach it; `writing` means its course's outline is being written; `available` means nothing is written yet, and POST `/goals/{goalId}/skills/{skillId}/outline/generations` writes it now. A skill outside the goal's plan isn't found.",
      operationId: "getSkillOutline",
      requestParams: { path: goalSkillPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: skillOutlineSchema } },
          description: "The topic's lesson plan",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a far topic's lesson plan",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/skills/{skillId}/outline/generations": {
    post: {
      description:
        "Writes a far topic's lesson plan when the learner asks to see it (never on a screen view). `ready` when its chapters exist. Otherwise the outline of its course's level band is written (its other topics in the plan come with it, the chapter teaching this one first, about half a minute) and the answer is 202; it's shared Library content, so the next learner of the course gets it free. A request while its course is being outlined starts nothing and is 202 without a `generationId`. A new one counts once per topic toward the learner's lesson plans (`resource: outline`: three a day and ten a month on the free plan, one for a guest, fair use with Plus), so a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED`.",
      operationId: "createSkillOutlineGeneration",
      requestParams: { path: goalSkillPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: skillOutlineGenerationSchema } },
          description: "The topic's chapters exist",
        },
        "202": {
          content: { "application/json": { schema: skillOutlineGenerationSchema } },
          description: "Its lesson plan is being written",
          headers: z.object({
            Location: z
              .string()
              .optional()
              .meta({
                description:
                  "The run's status URL, when this request started one: GET /generations/{generationId}",
              }),
          }),
        },
        ...readErrors,
        "402": paymentRequiredResponse,
        "403": guestRefusalResponse,
        "422": {
          ...unprocessableEntityResponse,
          description:
            "The plan has nothing left to write for the topic: studied, settled or left out",
        },
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Write a far topic's lesson plan",
      tags: ["Learner"],
    },
  },
};
