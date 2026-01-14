import { auth } from "@zoonk/core/auth";
import { parseNumericId } from "@zoonk/utils/string";
import { headers } from "next/headers";
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

  const subscriptions = await auth.api.listActiveSubscriptions({
    headers: await headers(),
  });

  const activeSubscription = subscriptions.find(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );

  if (!activeSubscription) {
    return Response.json(
      { error: "Active subscription required" },
      { status: 402 },
    );
  }

  const run = await start(chapterGenerationWorkflow, [chapterId]);

  return Response.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
