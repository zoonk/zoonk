import { errors } from "@/lib/api-errors";
import { getLearnerProtections } from "@zoonk/core/minors/protections";
import { type LearningProfileView } from "@zoonk/core/profile/contract";
import { NextResponse } from "next/server";

/** The profile with the protections its age answer implies, so clients never compute either. */
export async function createLearningProfileResponse(profile: LearningProfileView) {
  const protections = await getLearnerProtections();

  if (!protections) {
    return errors.unauthorized();
  }

  return NextResponse.json({ profile, protections });
}
