import { NextResponse } from "next/server";
import { getTaskResults } from "@/lib/eval-runner";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const modelId = searchParams.get("modelId");

  if (taskId === null || modelId === null) {
    return NextResponse.json(
      { error: "taskId and modelId are required" },
      { status: 400 },
    );
  }

  const results = await getTaskResults(taskId, modelId);

  if (!results) {
    return NextResponse.json({ results: null });
  }

  return NextResponse.json(results);
}
