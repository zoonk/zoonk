import { parseNumericId } from "@zoonk/utils/string";
import { start } from "workflow/api";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";

export async function POST(request: Request) {
  const body = await request.json();
  const chapterId = parseNumericId(String(body.chapterId ?? ""));

  if (!chapterId) {
    return Response.json(
      { error: "Missing or invalid chapterId" },
      { status: 400 },
    );
  }

  const run = await start(chapterGenerationWorkflow, [chapterId]);

  return Response.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
