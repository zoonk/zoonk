import { Button } from "@zoonk/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import {
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTaskResults } from "@/lib/eval-runner";
import { EVAL_MODELS } from "@/lib/models";
import { TASKS } from "@/tasks";
import { runEvalAction } from "./actions";
import { EvalResults } from "./eval-results";

export default async function TaskModelPage({
  params,
}: PageProps<"/tasks/[taskId]/[modelId]">) {
  const { taskId, modelId: rawModelId } = await params;
  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    notFound();
  }

  const modelId = decodeURIComponent(rawModelId);
  const model = EVAL_MODELS.find((m) => m.id === modelId);

  if (!model) {
    redirect(`/tasks/${taskId}`);
  }

  const results = await getTaskResults(taskId, modelId);

  return (
    <main className="flex flex-col gap-6">
      <ContainerHeader>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>
          Run evals and view results for this task
        </ContainerDescription>
      </ContainerHeader>

      <Card>
        <CardHeader>
          <CardTitle>Run Eval</CardTitle>
          <CardDescription>
            Evaluating with {model?.name || modelId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={runEvalAction}>
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="modelId" value={modelId} />
            <div className="flex items-center gap-4">
              <Button type="submit" className="w-full sm:w-auto">
                <PlayIcon className="size-4" />
                Run Eval
              </Button>
              <Link href={`/tasks/${taskId}`}>
                <Button type="button" variant="outline">
                  Change Model
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {results && <EvalResults results={results} />}
    </main>
  );
}
