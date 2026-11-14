import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { type proposeContentFix } from "@zoonk/core/staff/content-fixes/propose";
import { type withdrawContentFixes } from "@zoonk/core/staff/content-fixes/withdraw";
import { NextResponse } from "next/server";

const CREATED = 201;

function loginRefusal(status: "forbidden" | "missingScope" | "unauthorized") {
  switch (status) {
    case "unauthorized":
      return errors.unauthorized("Run `pnpm zoonk login` to sign in.");
    case "forbidden":
      return errors.forbidden("This login does not have staff access.");
    case "missingScope":
      return createErrorResponse({
        code: "SCOPE_REQUIRED",
        message:
          "This login can only read. Run `pnpm zoonk login` again to propose or withdraw content fixes.",
        status: httpStatus.forbidden,
      });
    default:
      return status satisfies never;
  }
}

export function proposalResponse(result: Awaited<ReturnType<typeof proposeContentFix>>) {
  switch (result.status) {
    case "proposed":
      return NextResponse.json(
        { batchId: result.batchId, fixes: result.fixes, reviewUrl: result.reviewUrl },
        { status: CREATED },
      );
    case "unauthorized":
    case "forbidden":
    case "missingScope":
      return loginRefusal(result.status);
    case "invalid":
      return errors.badRequest(result.message);
    case "notFound":
      return errors.notFound(result.message);
    case "error":
      return errors.internal();
    default:
      return result satisfies never;
  }
}

export function withdrawalResponse(result: Awaited<ReturnType<typeof withdrawContentFixes>>) {
  switch (result.status) {
    case "withdrawn":
      return NextResponse.json({
        batchId: result.batchId,
        fixes: result.fixes,
        withdrawn: result.withdrawn,
      });
    case "unauthorized":
    case "forbidden":
    case "missingScope":
      return loginRefusal(result.status);
    case "invalid":
      return errors.badRequest(result.message);
    case "notFound":
      return errors.notFound(result.message);
    case "notProposer":
      return createErrorResponse({
        code: "NOT_PROPOSER",
        message: result.message,
        status: httpStatus.forbidden,
      });
    case "nothingToWithdraw":
      return errors.conflict(result.message);
    default:
      return result satisfies never;
  }
}
