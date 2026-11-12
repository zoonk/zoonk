import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { type proposeContentFix } from "@zoonk/core/staff/content-fixes/propose";
import { NextResponse } from "next/server";

const CREATED = 201;

export function proposalResponse(result: Awaited<ReturnType<typeof proposeContentFix>>) {
  switch (result.status) {
    case "proposed":
      return NextResponse.json({ fix: result.fix }, { status: CREATED });
    case "unauthorized":
      return errors.unauthorized("Run `pnpm zoonk login` to sign in.");
    case "forbidden":
      return errors.forbidden("This login does not have staff access.");
    case "missingScope":
      return createErrorResponse({
        code: "SCOPE_REQUIRED",
        message: "This login can only read. Run `pnpm zoonk login` again to propose content fixes.",
        status: httpStatus.forbidden,
      });
    case "invalid":
      return errors.badRequest(result.message);
    case "notFound":
      return errors.notFound(result.message);
    case "error":
      return errors.internal();
    default:
      return errors.internal();
  }
}
