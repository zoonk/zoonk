import { NextResponse } from "next/server";
import { runEval } from "@/lib/eval-runner";
import { TASKS } from "@/tasks";

export async function POST(request: Request) {
  const { taskId, modelId } = await request.json();

  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    // biome-ignore lint/suspicious/noExplicitAny: task can be of any type
    const results = await runEval(task as any, modelId);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Error running eval:", error);
    return NextResponse.json({ error: "Failed to run eval" }, { status: 500 });
  }
}
