import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";
import { TOOL_CHOICES, TOOL_SYSTEMS } from "./plan-tools-contract";

const MAX_TOOLS = 20;

export const planToolChoiceInputSchema = z
  .object({
    choice: z
      .enum(TOOL_CHOICES)
      .meta({
        description:
          "have: the learner has it. setup: a short lesson sets it up on `system`, before the first chapter that needs it. none: no install, the learner learns it with examples",
      }),
    system: z
      .enum(TOOL_SYSTEMS)
      .nullable()
      .default(null)
      .meta({
        description: "The learner's device, needed to set a tool up; phone means no computer",
      }),
    timeZone: answerTimeZoneSchema,
    tools: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(MAX_TOOLS)
      .meta({ description: "Tool names exactly as the plan lists them" }),
  })
  .strict()
  .refine((input) => input.choice !== "setup" || input.system !== null, {
    message: "Setting a tool up needs the learner's device",
    path: ["system"],
  })
  .meta({ id: "PlanToolChoiceInput" });

export type PlanToolChoiceInput = z.infer<typeof planToolChoiceInputSchema>;
