import { type LearningProfileView } from "@zoonk/core/profile/contract";
import { NextResponse } from "next/server";

export function createLearningProfileResponse(profile: LearningProfileView) {
  return NextResponse.json({ profile });
}
