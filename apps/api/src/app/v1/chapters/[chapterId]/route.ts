import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toChapterResource } from "@/lib/catalog-responses";
import { readChapterContext } from "@/lib/chapter-context";
import { getCatalogChapter } from "@zoonk/core/catalog/chapter";
import { getChapterTryLesson } from "@zoonk/core/catalog/try-lesson";
import { NextResponse } from "next/server";

async function getChapter(request: Request, context: RouteContext<"/v1/chapters/[chapterId]">) {
  const parsed = await readChapterContext({ context, request });

  const [chapter, tryLesson] = await Promise.all([
    getCatalogChapter(parsed),
    getChapterTryLesson(parsed),
  ]);

  if (!chapter) {
    return errors.notFound("Chapter not found");
  }

  return NextResponse.json({ ...toChapterResource(chapter), tryLesson });
}

export const GET = withApiErrorBoundary(getChapter);
