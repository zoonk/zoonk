import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { type StaffResult } from "@zoonk/core/staff/read";
import { NextResponse } from "next/server";

export function staffResponse<T extends object>(result: StaffResult<T>) {
  switch (result.status) {
    case "unauthorized":
      return errors.unauthorized("Run `pnpm zoonk login` to sign in.");
    case "forbidden":
      return errors.forbidden("This login does not have staff access.");
    case "invalid":
      return errors.badRequest(result.message);
    case "notFound":
      return errors.notFound(result.message);
    case "timeout":
      return createErrorResponse({
        code: "QUERY_TIMEOUT",
        message: result.message,
        status: httpStatus.unprocessableEntity,
      });
    case "ready": {
      const { status: _status, ...body } = result;
      return NextResponse.json(body);
    }

    case "error":
      return errors.internal();
    default:
      return errors.internal();
  }
}
