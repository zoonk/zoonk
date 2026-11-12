import { passkeyAssertionSchema } from "@zoonk/auth/passkey-approval-contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const contentFixPathParamsSchema = z
  .object({ fixId: uuidSchema().meta({ description: "Content fix ID" }) })
  .meta({ id: "ContentFixPathParams" });

const contentFixStatusSchema = z.enum(["proposed", "applied", "rejected", "stale"]);

const decidedFixSchema = z
  .object({
    id: uuidSchema(),
    staleReason: z
      .string()
      .nullable()
      .meta({ description: "Why approving found the content no longer as the fix described it" }),
    status: contentFixStatusSchema,
  })
  .meta({ id: "DecidedContentFix" });

const decidedSchema = z.object({
  cacheNotified: z
    .boolean()
    .nullable()
    .meta({
      description:
        "Set when this request applied the fix: false means Main shows the old content until its cache expires. Null for an outcome decided earlier.",
    }),
  fix: decidedFixSchema,
  status: z.literal("decided"),
});

const approvalOptionsSchema = z
  .object({
    allowCredentials: z.array(
      z.object({
        id: z.string(),
        transports: z.array(z.string()).optional(),
        type: z.literal("public-key"),
      }),
    ),
    challenge: z.string(),
    rpId: z.string(),
    timeout: z.int(),
    userVerification: z.literal("required"),
  })
  .meta({
    description:
      "Pass to `navigator.credentials.get()` (`startAuthentication` in `@simplewebauthn/browser`)",
    id: "ContentFixApprovalOptions",
  });

export const contentFixApprovalOptionsResponseSchema = z
  .discriminatedUnion("status", [
    z.object({ options: approvalOptionsSchema, status: z.literal("ready") }),
    z
      .object({ status: z.literal("needsPasskey") })
      .meta({
        description: "The staff person has no passkey yet; they add one in Main's settings",
      }),
    decidedSchema.omit({ cacheNotified: true }),
  ])
  .meta({ id: "ContentFixApprovalOptionsResponse" });

export const contentFixDecisionRequestSchema = z
  .discriminatedUnion("decision", [
    z
      .object({ assertion: passkeyAssertionSchema, decision: z.literal("approve") })
      .strict()
      .meta({
        description: "The approver's own passkey signed this fix's challenge on Admin's page",
      }),
    z.object({ decision: z.literal("reject") }).strict(),
  ])
  .meta({ id: "ContentFixDecisionRequest" });

export const contentFixDecisionResponseSchema = z
  .discriminatedUnion("status", [
    decidedSchema,
    z
      .object({ status: z.literal("approvalExpired") })
      .meta({ description: "The challenge was used or expired; ask for new approval options" }),
    z
      .object({ status: z.literal("assertionInvalid") })
      .meta({
        description: "The assertion isn't this person's passkey signing this fix's challenge",
      }),
  ])
  .meta({ id: "ContentFixDecision" });
