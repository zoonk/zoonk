import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { suggestCurrentUsername } from "@zoonk/core/users/current";
import { getSession } from "@zoonk/core/users/session";
import { NextResponse } from "next/server";

async function getCurrentUserUsernameSuggestion() {
  if (!(await getSession())) {
    return errors.unauthorized();
  }

  return NextResponse.json({ username: await suggestCurrentUsername() });
}

export const GET = withApiErrorBoundary(getCurrentUserUsernameSuggestion);
