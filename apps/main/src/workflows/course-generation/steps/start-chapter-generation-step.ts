import { runNestedWorkflow } from "@/workflows/_shared/run-nested-workflow";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { start } from "workflow/api";
import type { CreatedChapter } from "../types";

export async function startChapterGenerationStep(chapter: CreatedChapter): Promise<void> {
  "use step";

  const run = await start(chapterGenerationWorkflow, [chapter.id]);
  await runNestedWorkflow(run);
}
