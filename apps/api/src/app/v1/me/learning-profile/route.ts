import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningProfileUpdateSchema } from "@/lib/openapi/schemas/learning-profile";
import {
  getCurrentUserLearningProfile,
  updateCurrentUserLearningProfile,
} from "@zoonk/core/users/learning-profile";
import { type NextRequest, NextResponse } from "next/server";

async function getLearningProfile() {
  const result = await getCurrentUserLearningProfile();

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json(result.profile);
}

async function updateLearningProfile(request: NextRequest) {
  const parsed = await parseBody(request, learningProfileUpdateSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await updateCurrentUserLearningProfile(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalid") {
    return errors.badRequest("Invalid learning interests");
  }

  return NextResponse.json(result.profile);
}

export const GET = withApiErrorBoundary(getLearningProfile);
export const PATCH = withApiErrorBoundary(updateLearningProfile);
