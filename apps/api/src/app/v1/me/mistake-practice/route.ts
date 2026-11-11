import { withApiErrorBoundary } from "@/lib/api-handler";
import { toAppSteps } from "@/lib/app-steps";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { readQueryParams } from "@/lib/request-input";
import { mistakePracticeInputSchema } from "@zoonk/core/mistakes/contract";
import { getMistakePractice } from "@zoonk/core/mistakes/practice";
import { NextResponse } from "next/server";

async function getPractice(request: Request) {
  const query = readQueryParams(request, mistakePracticeInputSchema);

  const result = await getMistakePractice(query);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  const practice = await Promise.all(
    result.practice.map(async (entry) => {
      if (!entry.lesson) {
        return entry;
      }

      const [step] = await toAppSteps([entry.lesson.step]);
      return { ...entry, lesson: { ...entry.lesson, step } };
    }),
  );

  return NextResponse.json(withApiImageUrls({ practice, trueFalseLabels: result.trueFalseLabels }));
}

export const GET = withApiErrorBoundary(getPractice);
