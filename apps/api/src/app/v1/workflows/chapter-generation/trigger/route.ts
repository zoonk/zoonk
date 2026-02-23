import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { chapterGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { prisma } from "@zoonk/db";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

async function getChapterPosition(chapterId: number) {
  const chapter = await prisma.chapter.findUnique({
    select: { position: true },
    where: { id: chapterId },
  });
  return chapter;
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, chapterGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const chapter = await getChapterPosition(parsed.data.chapterId);

  if (!chapter) {
    return errors.notFound();
  }

  if (chapter.position !== 0) {
    const hasSubscription = await hasActiveSubscription(request.headers);

    if (!hasSubscription) {
      return errors.paymentRequired();
    }
  }

  const run = await start(chapterGenerationWorkflow, [parsed.data.chapterId]);

  return NextResponse.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
