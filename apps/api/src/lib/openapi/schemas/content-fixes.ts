import { passkeyAssertionSchema } from "@zoonk/auth/passkey-approval-contract";
import { MAX_BATCH_FIXES } from "@zoonk/core/staff/content-fixes/batches";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const contentFixPathParamsSchema = z
  .object({ fixId: uuidSchema().meta({ description: "Content fix ID" }) })
  .meta({ id: "ContentFixPathParams" });

export const contentFixBatchPathParamsSchema = z
  .object({ batchId: uuidSchema().meta({ description: "Content fix batch ID" }) })
  .meta({ id: "ContentFixBatchPathParams" });

const contentFixStatusSchema = z
  .enum(["proposed", "approved", "applied", "rejected", "stale"])
  .meta({
    description:
      "`approved` means a passkey approved it and it hasn't applied yet; the same approver resumes it",
  });

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
        "Set when this request applied fixes: false means Main shows the old content until its cache expires. Null when it applied none.",
    }),
  fixes: z
    .array(decidedFixSchema)
    .meta({ description: "Each fix of the batch and where it stands" }),
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

export const contentFixApprovalOptionsRequestSchema = z
  .object({
    fixIds: z
      .array(uuidSchema())
      .min(1)
      .max(MAX_BATCH_FIXES)
      .meta({ description: "The batch's proposed fixes the approver read and selected" }),
  })
  .strict()
  .meta({ id: "ContentFixApprovalOptionsRequest" });

export const contentFixApprovalOptionsResponseSchema = z
  .discriminatedUnion("status", [
    z.object({ options: approvalOptionsSchema, status: z.literal("ready") }),
    z
      .object({ status: z.literal("needsPasskey") })
      .meta({
        description: "The staff person has no passkey yet; they add one in Main's settings",
      }),
    z
      .object({ status: z.literal("changed") })
      .meta({
        description: "The selection no longer matches the batch's proposed fixes; read it again",
      }),
  ])
  .meta({ id: "ContentFixApprovalOptionsResponse" });

export const contentFixBatchDecisionRequestSchema = z
  .discriminatedUnion("decision", [
    z
      .object({ assertion: passkeyAssertionSchema, decision: z.literal("approve") })
      .strict()
      .meta({
        description:
          "The approver's own passkey signed the challenge of the fixes they selected, on Admin's page",
      }),
    z
      .object({ decision: z.literal("resume") })
      .strict()
      .meta({ description: "Applies what this approver already approved but didn't finish" }),
  ])
  .meta({ id: "ContentFixBatchDecisionRequest" });

export const contentFixDecisionRequestSchema = z
  .object({ decision: z.literal("reject") })
  .strict()
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
        description: "The assertion isn't this person's passkey signing the batch's challenge",
      }),
  ])
  .meta({ id: "ContentFixDecision" });
