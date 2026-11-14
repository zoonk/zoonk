import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";

const MAX_QUOTE_LENGTH = 64;

/** Names the numbers a proposal shows: it changes whenever its `effect` does, whoever wrote it. */
export const planChangeQuoteSchema = z
  .string()
  .max(MAX_QUOTE_LENGTH)
  .meta({
    description:
      "Names the numbers `effect` shows, and changes whenever they do. Send it back as it came when accepting",
    id: "PlanChangeQuote",
  });

export type PlanChangeQuote = z.infer<typeof planChangeQuoteSchema>;

/**
 * swift-openapi-generator clients leave out a required key whose value is null, so an absent quote
 * reads as null, which never matches a proposal's quote.
 */
export const quoteSeenSchema = planChangeQuoteSchema.nullable().default(null);

export const planChangeDecisionInputSchema = z
  .object({
    quote: quoteSeenSchema.meta({
      description:
        "Send the change's `quote` as the learner saw it. Applying a proposal applies it only when this is the change's current `quote`; otherwise nothing is applied and the answer is the change still `proposed` with its current `effect` and `quote`, for the learner to answer again. Other answers ignore it",
    }),
    status: z
      .enum(["applied", "declined", "undone", "seen"])
      .meta({
        description:
          "Accept or decline a proposed change, undo an applied one (a proposal the learner applied then waits for their answer again, status proposed, as before Apply; replaced when a newer proposal asks about the same thing), or mark an applied one as seen, which sets its `seen`",
      }),
    surface: z
      .enum(["today", "tutor", "behind"])
      .optional()
      .meta({
        description:
          "Where the learner answered the change, to preserve the analytics change_kind. Defaults to the proposal source when omitted.",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "PlanChangeDecisionInput" });

export type PlanChangeDecisionInput = z.infer<typeof planChangeDecisionInputSchema>;

/** Only an accept needs the quote the learner saw; other answers may leave it out. */
type QuotedStatus =
  | { quote: PlanChangeQuote | null; status: "applied" }
  | {
      quote?: PlanChangeQuote | null;
      status: Exclude<PlanChangeDecisionInput["status"], "applied">;
    };

export type PlanChangeDecision = Omit<PlanChangeDecisionInput, "quote" | "status"> & QuotedStatus;

/** An app's answer to one change. */
export type PlanChangeAnswer = {
  changeId: string;
  surface?: PlanChangeDecisionInput["surface"];
} & QuotedStatus;
